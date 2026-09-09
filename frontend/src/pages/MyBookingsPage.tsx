import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { apiClient } from '../services/apiClient'

interface BookingRide {
  id: string
  driver_id: string
  origin: string
  destination: string
  departure_at: string
  price_per_seat: number | string
  status: string
  driver?: {
    id: string
    full_name?: string | null
    avatar_url?: string | null
  } | null
  vehicle?: {
    id: string
    vehicle_type: string
    make: string
    model: string
    color?: string | null
    registration_number: string
    seat_capacity: number
  } | null
}

interface Booking {
  id: string
  ride_id: string
  rider_id: string
  seats_booked: number
  total_fare: number | string
  status: string
  cancellation_reason?: string | null
  created_at: string
  updated_at: string
  ride?: BookingRide | null
}

interface Payment {
  id: string
  booking_id: string
  amount: number | string
  currency: string
  status: string
  provider_payment_id?: string | null
}

interface BookingListResponse {
  items: Booking[]
  total: number
}

interface PaymentListResponse {
  items: Payment[]
  total: number
}

interface PaymentIntentResponse {
  payment_id: string
  booking_id: string
  amount: number | string
  currency: string
  status: string
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value))
}

export function MyBookingsPage() {
  const { isAuthenticated } = useAuthStore()

  const [bookings, setBookings] = useState<Booking[]>([])
  const [paymentsMap, setPaymentsMap] = useState<Record<string, Payment>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  // Payment checkout modal state
  const [activeCheckoutBooking, setActiveCheckoutBooking] = useState<Booking | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi')
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState<string | null>(null)
  const [paymentErrorMsg, setPaymentErrorMsg] = useState<string | null>(null)

  // Review modal state
  const [activeReviewBooking, setActiveReviewBooking] = useState<Booking | null>(null)
  const [reviewRating, setReviewRating] = useState<number>(5)
  const [reviewHoverRating, setReviewHoverRating] = useState<number>(0)
  const [reviewComment, setReviewComment] = useState('')
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState<string | null>(null)
  const [reviewErrorMsg, setReviewErrorMsg] = useState<string | null>(null)
  const [reviewedBookings, setReviewedBookings] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('ridex_reviewed_bookings')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  useEffect(() => {
    if (!isAuthenticated) return

    async function loadData() {
      try {
        setIsLoading(true)
        setErrorMessage('')
        const [bookingsResp, paymentsResp] = await Promise.all([
          apiClient.get<BookingListResponse>('/bookings/my'),
          apiClient.get<PaymentListResponse>('/payments/my').catch(() => ({ items: [], total: 0 })),
        ])

        setBookings(bookingsResp.items || [])
        const pMap: Record<string, Payment> = {}
        for (const p of paymentsResp.items || []) {
          pMap[p.booking_id] = p
        }
        setPaymentsMap(pMap)
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Could not load your bookings.',
        )
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [isAuthenticated])

  async function handleCancelBooking(bookingId: string) {
    if (!window.confirm('Are you sure you want to cancel this booking? Held seats will be released back to the ride.')) {
      return
    }

    try {
      setCancellingId(bookingId)
      const updated = await apiClient.post<Booking>(`/bookings/${bookingId}/cancel`, {
        reason: 'Cancelled by passenger',
      })

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, ...updated } : b)),
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel booking.')
    } finally {
      setCancellingId(null)
    }
  }

  async function handleCompletePayment() {
    if (!activeCheckoutBooking) return
    setIsProcessingPayment(true)
    setPaymentErrorMsg(null)
    setPaymentSuccessMsg(null)

    try {
      // 1. Create intent
      const intent = await apiClient.post<PaymentIntentResponse>('/payments/create-intent', {
        booking_id: activeCheckoutBooking.id,
      })

      // 2. Process mock payment
      const paymentResult = await apiClient.post<Payment>('/payments/process', {
        payment_id: intent.payment_id,
        payment_method: paymentMethod,
        simulate_failure: false,
      })

      if (paymentResult.status === 'succeeded') {
        setPaymentSuccessMsg(`Payment completed! Ref: ${paymentResult.provider_payment_id || paymentResult.id.slice(0, 8)}`)
        setPaymentsMap((prev) => ({
          ...prev,
          [activeCheckoutBooking.id]: paymentResult,
        }))
        setTimeout(() => {
          setActiveCheckoutBooking(null)
          setPaymentSuccessMsg(null)
        }, 1500)
      } else {
        setPaymentErrorMsg('Payment processing was declined. Please try again.')
      }
    } catch (err) {
      setPaymentErrorMsg(
        err instanceof Error ? err.message : 'Payment failed. Please try again.',
      )
    } finally {
      setIsProcessingPayment(false)
    }
  }

  function handleOpenReviewModal(booking: Booking) {
    setActiveReviewBooking(booking)
    setReviewRating(5)
    setReviewHoverRating(0)
    setReviewComment('')
    setReviewErrorMsg(null)
    setReviewSuccessMsg(null)
  }

  async function handleSubmitReview() {
    if (!activeReviewBooking || !activeReviewBooking.ride) return

    const driverId = activeReviewBooking.ride.driver_id || activeReviewBooking.ride.driver?.id
    if (!driverId) {
      setReviewErrorMsg('Driver information is missing for this trip.')
      return
    }

    setIsSubmittingReview(true)
    setReviewErrorMsg(null)
    setReviewSuccessMsg(null)

    try {
      await apiClient.post('/reviews', {
        ride_id: activeReviewBooking.ride_id,
        reviewee_id: driverId,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      })

      const updatedMap = {
        ...reviewedBookings,
        [activeReviewBooking.id]: reviewRating,
      }
      setReviewedBookings(updatedMap)
      try {
        localStorage.setItem('ridex_reviewed_bookings', JSON.stringify(updatedMap))
      } catch {
        // localStorage non-fatal
      }

      setReviewSuccessMsg('Review submitted successfully! Thank you.')
      setTimeout(() => {
        setActiveReviewBooking(null)
        setReviewSuccessMsg(null)
      }, 1400)
    } catch (err) {
      setReviewErrorMsg(
        err instanceof Error ? err.message : 'Failed to submit review. Please try again.',
      )
    } finally {
      setIsSubmittingReview(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '80vh', background: '#f5f2ea', padding: '60px 24px' }}>
        <div
          style={{
            maxWidth: '560px',
            margin: '0 auto',
            background: '#fff',
            borderRadius: '24px',
            padding: '48px 32px',
            textAlign: 'center',
            border: '1px solid #e0e2e7',
            boxShadow: '0 12px 35px rgba(31, 43, 78, 0.05)',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#a9dfc6', letterSpacing: '0.15em' }}>
            AUTHENTICATION REQUIRED
          </span>
          <h1 style={{ fontSize: '28px', color: '#17203b', margin: '14px 0 10px' }}>
            Sign in to view your bookings
          </h1>
          <p style={{ color: '#7c8495', lineHeight: '1.6', marginBottom: '28px' }}>
            Please log in with your RIDEX account to review your travel itineraries, seat reservations, and trip receipts.
          </p>
          <Link
            to="/login"
            style={{
              display: 'inline-block',
              background: '#e98570',
              color: '#fff',
              padding: '14px 28px',
              borderRadius: '12px',
              fontWeight: 800,
              textDecoration: 'none',
            }}
          >
            Sign In →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '90vh', background: '#f5f2ea', color: '#17203b' }}>
      <section
        style={{
          background: 'linear-gradient(135deg, #26345f 0%, #1d294d 100%)',
          color: '#fff',
          padding: '48px 24px 64px',
          borderRadius: '0 0 34px 34px',
        }}
      >
        <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
          <span style={{ color: '#a9dfc6', fontSize: '11px', fontWeight: 800, letterSpacing: '0.18em' }}>
            YOUR TRIPS
          </span>
          <h1 style={{ fontSize: 'clamp(36px, 5vw, 54px)', margin: '12px 0 8px', letterSpacing: '-0.04em' }}>
            My <span style={{ color: '#a9dfc6' }}>Bookings</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.76)', maxWidth: '600px', fontSize: '16px', margin: 0 }}>
            Manage your upcoming journeys, track ride reservations, and view trip details.
          </p>
        </div>
      </section>

      <main style={{ maxWidth: '1080px', margin: '-30px auto 60px', padding: '0 24px' }}>
        {isLoading ? (
          <div
            style={{
              background: '#fff',
              borderRadius: '20px',
              padding: '60px',
              textAlign: 'center',
              border: '1px solid #e0e2e7',
            }}
          >
            <p style={{ color: '#7c8495' }}>Loading your reservations...</p>
          </div>
        ) : errorMessage ? (
          <div
            style={{
              background: '#fff4f1',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid #efc5bd',
              color: '#a64d3d',
            }}
          >
            <p style={{ margin: 0, fontWeight: 700 }}>{errorMessage}</p>
          </div>
        ) : bookings.length === 0 ? (
          <div
            style={{
              background: '#fff',
              borderRadius: '24px',
              padding: '64px 32px',
              textAlign: 'center',
              border: '1px solid #e0e2e7',
              boxShadow: '0 12px 35px rgba(31, 43, 78, 0.04)',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#edf5f0',
                color: '#2d7a54',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                margin: '0 auto 18px',
              }}
            >
              🚗
            </div>
            <h2 style={{ fontSize: '24px', margin: '0 0 10px', color: '#17203b' }}>
              No bookings yet
            </h2>
            <p style={{ color: '#7c8495', maxWidth: '440px', margin: '0 auto 28px', lineHeight: '1.6' }}>
              You haven't reserved any seats yet. Search for available rides to travel affordably across India.
            </p>
            <Link
              to="/"
              style={{
                display: 'inline-block',
                background: '#e98570',
                color: '#fff',
                padding: '14px 28px',
                borderRadius: '12px',
                fontWeight: 800,
                textDecoration: 'none',
              }}
            >
              Find a Ride →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '20px' }}>
            {bookings.map((booking) => {
              const ride = booking.ride
              const isConfirmed = booking.status === 'confirmed'
              const isCancelled = booking.status === 'cancelled'
              const payment = paymentsMap[booking.id]
              const isPaid = payment && payment.status === 'succeeded'

              return (
                <article
                  key={booking.id}
                  style={{
                    background: '#fff',
                    borderRadius: '20px',
                    padding: '28px',
                    border: '1px solid #e0e2e7',
                    boxShadow: '0 8px 24px rgba(31, 43, 78, 0.04)',
                    display: 'grid',
                    gap: '20px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      borderBottom: '1px solid #f0f2f5',
                      paddingBottom: '16px',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '11px', color: '#7c8495', fontWeight: 800, letterSpacing: '0.1em' }}>
                        BOOKING ID: {booking.id.slice(0, 8)}
                      </span>
                      <h3 style={{ fontSize: '22px', margin: '4px 0 0', color: '#17203b' }}>
                        {ride ? `${ride.origin} → ${ride.destination}` : 'Trip Details'}
                      </h3>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {isPaid && (
                        <span
                          style={{
                            padding: '6px 14px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: 800,
                            letterSpacing: '0.08em',
                            background: '#edf5f0',
                            color: '#2d7a54',
                          }}
                        >
                          ✓ PAID
                        </span>
                      )}

                      <span
                        style={{
                          padding: '6px 14px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          background: isConfirmed
                            ? '#edf5f0'
                            : isCancelled
                            ? '#fff4f1'
                            : '#eef1f8',
                          color: isConfirmed
                            ? '#2d7a54'
                            : isCancelled
                            ? '#a64d3d'
                            : '#26345f',
                        }}
                      >
                        {booking.status}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                      gap: '16px',
                    }}
                  >
                    <div>
                      <small style={{ display: 'block', color: '#7c8495', fontSize: '11px', fontWeight: 800 }}>
                        DEPARTURE
                      </small>
                      <strong style={{ fontSize: '15px', color: '#17203b' }}>
                        {ride ? formatTime(ride.departure_at) : '—'}
                      </strong>
                      <span style={{ display: 'block', fontSize: '12px', color: '#7c8495' }}>
                        {ride ? formatDate(ride.departure_at) : '—'}
                      </span>
                    </div>

                    <div>
                      <small style={{ display: 'block', color: '#7c8495', fontSize: '11px', fontWeight: 800 }}>
                        SEATS RESERVED
                      </small>
                      <strong style={{ fontSize: '15px', color: '#17203b' }}>
                        {booking.seats_booked} {booking.seats_booked === 1 ? 'seat' : 'seats'}
                      </strong>
                      <span style={{ display: 'block', fontSize: '12px', color: '#7c8495' }}>
                        Passenger reservation
                      </span>
                    </div>

                    <div>
                      <small style={{ display: 'block', color: '#7c8495', fontSize: '11px', fontWeight: 800 }}>
                        TOTAL FARE
                      </small>
                      <strong style={{ fontSize: '18px', color: '#26345f', fontWeight: 850 }}>
                        ₹{Number(booking.total_fare).toFixed(0)}
                      </strong>
                      <span style={{ display: 'block', fontSize: '12px', color: '#7c8495' }}>
                        {ride ? `₹${Number(ride.price_per_seat).toFixed(0)} / seat` : ''}
                      </span>
                    </div>

                    <div>
                      <small style={{ display: 'block', color: '#7c8495', fontSize: '11px', fontWeight: 800 }}>
                        HOST & VEHICLE
                      </small>
                      <strong style={{ fontSize: '14px', color: '#17203b' }}>
                        {ride?.driver?.full_name || 'Driver'}
                      </strong>
                      <span style={{ display: 'block', fontSize: '12px', color: '#7c8495' }}>
                        {ride?.vehicle ? `${ride.vehicle.make} ${ride.vehicle.model} (${ride.vehicle.registration_number})` : 'Vehicle'}
                      </span>
                    </div>
                  </div>

                  {isCancelled && booking.cancellation_reason && (
                    <div
                      style={{
                        padding: '10px 14px',
                        background: '#fff4f1',
                        borderRadius: '10px',
                        color: '#a64d3d',
                        fontSize: '13px',
                      }}
                    >
                      Reason: {booking.cancellation_reason}
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'flex-end',
                      gap: '12px',
                      borderTop: '1px solid #f0f2f5',
                      paddingTop: '16px',
                    }}
                  >
                    {isConfirmed && !isPaid && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCheckoutBooking(booking)
                          setPaymentErrorMsg(null)
                          setPaymentSuccessMsg(null)
                        }}
                        style={{
                          padding: '10px 18px',
                          borderRadius: '10px',
                          border: 'none',
                          background: '#e98570',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: '13px',
                          cursor: 'pointer',
                        }}
                      >
                        Pay Now (₹{Number(booking.total_fare).toFixed(0)}) →
                      </button>
                    )}

                    {isConfirmed && ride && (
                      reviewedBookings[booking.id] ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '10px 16px',
                            borderRadius: '10px',
                            background: '#edf5f0',
                            color: '#2d7a54',
                            fontWeight: 800,
                            fontSize: '13px',
                          }}
                        >
                          ★ Rated {reviewedBookings[booking.id]}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenReviewModal(booking)}
                          style={{
                            padding: '10px 18px',
                            borderRadius: '10px',
                            border: '1px solid #a9dfc6',
                            background: '#f2faf6',
                            color: '#17203b',
                            fontWeight: 800,
                            fontSize: '13px',
                            cursor: 'pointer',
                          }}
                        >
                          ★ Rate Driver
                        </button>
                      )
                    )}

                    {ride && (
                      <Link
                        to={`/rides/${ride.id}`}
                        style={{
                          padding: '10px 18px',
                          borderRadius: '10px',
                          border: '1px solid #dfe2e7',
                          background: '#fff',
                          color: '#26345f',
                          fontWeight: 700,
                          fontSize: '13px',
                          textDecoration: 'none',
                        }}
                      >
                        View Trip Details
                      </Link>
                    )}

                    {isConfirmed && (
                      <button
                        type="button"
                        onClick={() => handleCancelBooking(booking.id)}
                        disabled={cancellingId === booking.id}
                        style={{
                          padding: '10px 18px',
                          borderRadius: '10px',
                          border: '1px solid #efc5bd',
                          background: '#fff4f1',
                          color: '#a64d3d',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: 'pointer',
                        }}
                      >
                        {cancellingId === booking.id ? 'Cancelling...' : 'Cancel Booking'}
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>

      {/* Checkout Modal */}
      {activeCheckoutBooking && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(23, 32, 59, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '24px',
              padding: '36px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 45px rgba(0, 0, 0, 0.18)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#a9dfc6', letterSpacing: '0.15em' }}>
                  RIDEX PAY
                </span>
                <h3 style={{ fontSize: '22px', margin: '4px 0 0', color: '#17203b' }}>
                  Complete Payment
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveCheckoutBooking(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '22px',
                  color: '#7c8495',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                background: '#f7f8fa',
                borderRadius: '14px',
                padding: '16px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#7c8495', fontSize: '13px' }}>Route</span>
                <strong style={{ fontSize: '14px', color: '#17203b' }}>
                  {activeCheckoutBooking.ride?.origin} → {activeCheckoutBooking.ride?.destination}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#7c8495', fontSize: '13px' }}>Amount to pay</span>
                <strong style={{ fontSize: '18px', color: '#26345f' }}>
                  ₹{Number(activeCheckoutBooking.total_fare).toFixed(0)}
                </strong>
              </div>
            </div>

            <div style={{ marginBottom: '22px' }}>
              <span style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#7c8495', marginBottom: '10px' }}>
                PAYMENT METHOD
              </span>
              <div style={{ display: 'grid', gap: '10px' }}>
                {[
                  { id: 'upi', label: 'UPI (GPay, PhonePe, Paytm)', icon: '⚡' },
                  { id: 'card', label: 'Credit / Debit Card', icon: '💳' },
                  { id: 'netbanking', label: 'Net Banking', icon: '🏦' },
                ].map((method) => (
                  <label
                    key={method.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: paymentMethod === method.id ? '2px solid #26345f' : '1px solid #dfe2e7',
                      background: paymentMethod === method.id ? '#edf5f0' : '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="payment_method"
                      value={method.id}
                      checked={paymentMethod === method.id}
                      onChange={() => setPaymentMethod(method.id as 'upi' | 'card' | 'netbanking')}
                    />
                    <span style={{ fontSize: '18px' }}>{method.icon}</span>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#17203b' }}>
                      {method.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {paymentErrorMsg && (
              <div
                style={{
                  padding: '12px',
                  background: '#fff4f1',
                  borderRadius: '10px',
                  color: '#a64d3d',
                  fontSize: '13px',
                  marginBottom: '16px',
                }}
              >
                {paymentErrorMsg}
              </div>
            )}

            {paymentSuccessMsg && (
              <div
                style={{
                  padding: '12px',
                  background: '#edf5f0',
                  borderRadius: '10px',
                  color: '#2d7a54',
                  fontSize: '13px',
                  marginBottom: '16px',
                  fontWeight: 700,
                }}
              >
                ✓ {paymentSuccessMsg}
              </div>
            )}

            <button
              type="button"
              onClick={handleCompletePayment}
              disabled={isProcessingPayment}
              style={{
                width: '100%',
                padding: '15px',
                borderRadius: '12px',
                background: '#e98570',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 850,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {isProcessingPayment
                ? 'Authorizing Transaction...'
                : `Pay ₹${Number(activeCheckoutBooking.total_fare).toFixed(0)}`}
            </button>
          </div>
        </div>
      )}
      {/* Review Modal */}
      {activeReviewBooking && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(23, 32, 59, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '24px',
              padding: '36px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 45px rgba(0, 0, 0, 0.18)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#a9dfc6', letterSpacing: '0.15em' }}>
                  TRIP FEEDBACK
                </span>
                <h3 style={{ fontSize: '22px', margin: '4px 0 0', color: '#17203b' }}>
                  Rate your Driver
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveReviewBooking(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '22px',
                  color: '#7c8495',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                background: '#f7f8fa',
                borderRadius: '14px',
                padding: '16px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#7c8495', fontSize: '13px' }}>Driver</span>
                <strong style={{ fontSize: '14px', color: '#17203b' }}>
                  {activeReviewBooking.ride?.driver?.full_name || 'Driver'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#7c8495', fontSize: '13px' }}>Route</span>
                <strong style={{ fontSize: '14px', color: '#26345f' }}>
                  {activeReviewBooking.ride?.origin} → {activeReviewBooking.ride?.destination}
                </strong>
              </div>
            </div>

            {/* Star selector */}
            <div style={{ marginBottom: '22px', textAlign: 'center' }}>
              <span style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#7c8495', marginBottom: '10px' }}>
                YOUR RATING
              </span>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                {[1, 2, 3, 4, 5].map((star) => {
                  const filled = (reviewHoverRating || reviewRating) >= star
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setReviewHoverRating(star)}
                      onMouseLeave={() => setReviewHoverRating(0)}
                      onClick={() => setReviewRating(star)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        fontSize: '32px',
                        cursor: 'pointer',
                        color: filled ? '#f59e0b' : '#d1d5db',
                        transition: 'transform 0.15s ease, color 0.15s ease',
                        transform: reviewHoverRating === star ? 'scale(1.2)' : 'none',
                        padding: '4px',
                      }}
                    >
                      ★
                    </button>
                  )
                })}
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#7c8495', marginTop: '6px', display: 'block' }}>
                {reviewRating === 5 && 'Outstanding trip! (5/5)'}
                {reviewRating === 4 && 'Very good experience (4/5)'}
                {reviewRating === 3 && 'Average ride (3/5)'}
                {reviewRating === 2 && 'Below expectations (2/5)'}
                {reviewRating === 1 && 'Poor experience (1/5)'}
              </span>
            </div>

            {/* Comment */}
            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#7c8495', marginBottom: '8px' }}>
                COMMENT (OPTIONAL)
              </label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your experience about punctuality, driving comfort, route adherence..."
                maxLength={1000}
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid #dfe2e7',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {reviewErrorMsg && (
              <div
                style={{
                  padding: '12px',
                  background: '#fff4f1',
                  borderRadius: '10px',
                  color: '#a64d3d',
                  fontSize: '13px',
                  marginBottom: '16px',
                }}
              >
                {reviewErrorMsg}
              </div>
            )}

            {reviewSuccessMsg && (
              <div
                style={{
                  padding: '12px',
                  background: '#edf5f0',
                  borderRadius: '10px',
                  color: '#2d7a54',
                  fontSize: '13px',
                  marginBottom: '16px',
                  fontWeight: 700,
                }}
              >
                ✓ {reviewSuccessMsg}
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmitReview}
              disabled={isSubmittingReview}
              style={{
                width: '100%',
                padding: '15px',
                borderRadius: '12px',
                background: '#26345f',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 850,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {isSubmittingReview ? 'Submitting Review...' : `Submit ${reviewRating}-Star Review`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
