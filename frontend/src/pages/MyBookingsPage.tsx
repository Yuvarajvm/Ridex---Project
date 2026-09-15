import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Navigation,
  ArrowRight,
  CreditCard,
  Building2,
  Zap,
  Star,
  CheckCircle2,
  XCircle,
  Clock,
  X,
  User,
  Car,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  Plus,
  AlertTriangle,
  Users,
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { apiClient } from '../services/apiClient'
import { rideService } from '../services/rideService'
import type { Ride } from '../types'

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
  updated_at?: string
  ride?: BookingRide | null
  rider?: {
    id: string
    full_name?: string | null
    email?: string | null
    phone_number?: string | null
    avatar_url?: string | null
  } | null
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
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') === 'offered' ? 'offered' : 'passenger'

  // Passenger bookings state
  const [bookings, setBookings] = useState<Booking[]>([])
  const [paymentsMap, setPaymentsMap] = useState<Record<string, Payment>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  // Driver offered rides state
  const [offeredRides, setOfferedRides] = useState<Ride[]>([])
  const [isOfferedLoading, setIsOfferedLoading] = useState(true)
  const [offeredErrorMessage, setOfferedErrorMessage] = useState('')
  const [expandedRideId, setExpandedRideId] = useState<string | null>(null)
  const [offeredBookingsMap, setOfferedBookingsMap] = useState<
    Record<string, { bookings: Booking[]; isLoading: boolean; error?: string }>
  >({})

  // Driver cancel ride modal state
  const [cancelModalRide, setCancelModalRide] = useState<Ride | null>(null)
  const [driverCancelReason, setDriverCancelReason] = useState('')
  const [isCancellingRide, setIsCancellingRide] = useState(false)
  const [cancelRideSuccessAlert, setCancelRideSuccessAlert] = useState<string | null>(null)
  const [cancelRideErrorAlert, setCancelRideErrorAlert] = useState<string | null>(null)

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

    let isMounted = true

    // 1. Fetch passenger bookings and payments
    Promise.all([
      apiClient.get<BookingListResponse>('/bookings/my'),
      apiClient.get<PaymentListResponse>('/payments/my').catch(() => ({ items: [], total: 0 })),
    ])
      .then(([bookingsResp, paymentsResp]) => {
        if (!isMounted) return
        setBookings(bookingsResp.items || [])
        const pMap: Record<string, Payment> = {}
        for (const p of paymentsResp.items || []) {
          pMap[p.booking_id] = p
        }
        setPaymentsMap(pMap)
      })
      .catch((err) => {
        if (!isMounted) return
        setErrorMessage(
          err instanceof Error ? err.message : 'Could not load your reservations.',
        )
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    // 2. Fetch driver offered rides
    rideService
      .getMyOfferedRides(1, 50)
      .then((resp) => {
        if (!isMounted) return
        setOfferedRides(resp.items || [])
      })
      .catch((err) => {
        if (!isMounted) return
        setOfferedErrorMessage(
          err instanceof Error ? err.message : 'Could not load your offered rides.',
        )
      })
      .finally(() => {
        if (isMounted) setIsOfferedLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isAuthenticated])

  async function handleToggleManifest(rideId: string) {
    if (expandedRideId === rideId) {
      setExpandedRideId(null)
      return
    }

    setExpandedRideId(rideId)

    if (offeredBookingsMap[rideId] && !offeredBookingsMap[rideId].error) {
      return
    }

    setOfferedBookingsMap((prev) => ({
      ...prev,
      [rideId]: { bookings: [], isLoading: true },
    }))

    try {
      const data = await rideService.getRideBookings(rideId, 1, 50)
      setOfferedBookingsMap((prev) => ({
        ...prev,
        [rideId]: { bookings: data.items || [], isLoading: false },
      }))
    } catch (err) {
      setOfferedBookingsMap((prev) => ({
        ...prev,
        [rideId]: {
          bookings: [],
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to load bookings.',
        },
      }))
    }
  }

  async function handleConfirmCancelOfferedRide() {
    if (!cancelModalRide) return

    setIsCancellingRide(true)
    setCancelRideErrorAlert(null)

    try {
      const updatedRide = await rideService.cancelOfferedRide(
        cancelModalRide.id,
        driverCancelReason.trim() || undefined,
      )

      // Update offered rides in state
      setOfferedRides((prev) =>
        prev.map((r) => (r.id === updatedRide.id ? { ...r, status: 'cancelled' } : r)),
      )

      // Update loaded passenger bookings in map
      setOfferedBookingsMap((prev) => {
        const entry = prev[cancelModalRide.id]
        if (!entry) return prev
        return {
          ...prev,
          [cancelModalRide.id]: {
            ...entry,
            bookings: entry.bookings.map((b) =>
              b.status === 'confirmed' || b.status === 'requested'
                ? {
                    ...b,
                    status: 'cancelled',
                    cancellation_reason: driverCancelReason.trim() || 'Cancelled by driver',
                  }
                : b,
            ),
          },
        }
      })

      setCancelRideSuccessAlert(
        `Ride from ${cancelModalRide.origin} to ${cancelModalRide.destination} has been cancelled. Active passenger bookings have been released and notified.`,
      )
      setCancelModalRide(null)
      setDriverCancelReason('')
      setTimeout(() => {
        setCancelRideSuccessAlert(null)
      }, 5000)
    } catch (err) {
      setCancelRideErrorAlert(err instanceof Error ? err.message : 'Failed to cancel ride.')
    } finally {
      setIsCancellingRide(false)
    }
  }

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
      const intent = await apiClient.post<PaymentIntentResponse>('/payments/create-intent', {
        booking_id: activeCheckoutBooking.id,
      })

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
      <div style={{ minHeight: '80vh', background: '#f8fafc', padding: '80px 24px' }}>
        <div
          style={{
            maxWidth: '520px',
            margin: '0 auto',
            background: '#ffffff',
            borderRadius: '20px',
            padding: '48px 36px',
            textAlign: 'center',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.06)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: '#f1f5f9',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              color: '#0f172a',
            }}
          >
            <Navigation size={28} />
          </div>
          <span style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#059669', letterSpacing: '0.15em' }}>
            AUTHENTICATION REQUIRED
          </span>
          <h1 style={{ fontSize: '26px', color: '#0f172a', margin: '12px 0 10px', fontWeight: 800 }}>
            Sign in to view your trips
          </h1>
          <p style={{ color: '#64748b', lineHeight: '1.6', marginBottom: '28px', fontSize: '14.5px' }}>
            Please log in with your RIDEX account to review your travel itineraries, passenger manifests, and trip receipts.
          </p>
          <Link
            to="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: '#059669',
              color: '#ffffff',
              padding: '12px 24px',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '14px',
              textDecoration: 'none',
              transition: 'background 0.15s ease',
            }}
          >
            <span>Sign In</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '90vh', background: '#f8fafc', color: '#0f172a' }}>
      {/* Executive Hero Banner */}
      <section
        style={{
          background: 'linear-gradient(135deg, #0b1324 0%, #0f172a 100%)',
          color: '#ffffff',
          padding: '48px 24px 64px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a9dfc6' }} />
            <span style={{ color: '#a9dfc6', fontSize: '11px', fontWeight: 800, letterSpacing: '0.15em' }}>
              TRAVEL & RIDE HUB
            </span>
          </div>
          <h1 style={{ fontSize: 'clamp(32px, 4vw, 44px)', margin: '0 0 10px', fontWeight: 800, letterSpacing: '-0.04em' }}>
            My <span style={{ color: '#a9dfc6' }}>Bookings & Rides</span>
          </h1>
          <p style={{ color: '#94a3b8', maxWidth: '600px', fontSize: '15px', margin: 0 }}>
            Track your travel reservations as a passenger, or manage your offered rides and view passenger manifests as a driver.
          </p>
        </div>
      </section>

      <main style={{ maxWidth: '1120px', margin: '-30px auto 60px', padding: '0 24px' }}>
        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '24px',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '12px',
          }}
        >
          <button
            type="button"
            onClick={() => setSearchParams({ tab: 'passenger' })}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'passenger' ? '#0f172a' : '#ffffff',
              color: activeTab === 'passenger' ? '#ffffff' : '#64748b',
              fontWeight: 700,
              fontSize: '13.5px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: activeTab === 'passenger' ? '0 4px 12px rgba(15,23,42,0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
              transition: 'all 0.15s ease',
            }}
          >
            <Navigation size={16} style={{ color: activeTab === 'passenger' ? '#a9dfc6' : '#64748b' }} />
            <span>Passenger Bookings</span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 800,
                background: activeTab === 'passenger' ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                color: activeTab === 'passenger' ? '#ffffff' : '#475569',
              }}
            >
              {bookings.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSearchParams({ tab: 'offered' })}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'offered' ? '#0f172a' : '#ffffff',
              color: activeTab === 'offered' ? '#ffffff' : '#64748b',
              fontWeight: 700,
              fontSize: '13.5px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: activeTab === 'offered' ? '0 4px 12px rgba(15,23,42,0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
              transition: 'all 0.15s ease',
            }}
          >
            <Car size={16} style={{ color: activeTab === 'offered' ? '#a9dfc6' : '#64748b' }} />
            <span>Offered Rides (Driver)</span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 800,
                background: activeTab === 'offered' ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                color: activeTab === 'offered' ? '#ffffff' : '#475569',
              }}
            >
              {offeredRides.length}
            </span>
          </button>
        </div>

        {/* Global Alert for Driver Cancellation */}
        {cancelRideSuccessAlert && (
          <div
            style={{
              background: '#ecfdf5',
              borderRadius: '12px',
              padding: '16px 20px',
              border: '1px solid #a7f3d0',
              color: '#065f46',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '20px',
            }}
          >
            <CheckCircle2 size={20} />
            <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>{cancelRideSuccessAlert}</p>
          </div>
        )}

        {/* TAB 1: PASSENGER BOOKINGS */}
        {activeTab === 'passenger' && (
          <div>
            {isLoading ? (
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  padding: '60px',
                  textAlign: 'center',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                }}
              >
                <Clock size={32} style={{ margin: '0 auto 12px', color: '#94a3b8', animation: 'spin 2s linear infinite' }} />
                <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Loading your reservations...</p>
              </div>
            ) : errorMessage ? (
              <div
                style={{
                  background: '#fef2f2',
                  borderRadius: '14px',
                  padding: '20px 24px',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <XCircle size={20} />
                <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>{errorMessage}</p>
              </div>
            ) : bookings.length === 0 ? (
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '20px',
                  padding: '64px 32px',
                  textAlign: 'center',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                }}
              >
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '16px',
                    background: '#ecfdf5',
                    color: '#059669',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 18px',
                  }}
                >
                  <Navigation size={32} />
                </div>
                <h2 style={{ fontSize: '22px', margin: '0 0 8px', color: '#0f172a', fontWeight: 800 }}>
                  No passenger bookings yet
                </h2>
                <p style={{ color: '#64748b', maxWidth: '440px', margin: '0 auto 24px', lineHeight: '1.6', fontSize: '14px' }}>
                  You haven't reserved any seats yet. Search for available rides to travel affordably across India.
                </p>
                <Link
                  to="/"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#059669',
                    color: '#ffffff',
                    padding: '12px 22px',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '14px',
                    textDecoration: 'none',
                  }}
                >
                  <span>Find a Ride</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '18px' }}>
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
                        background: '#ffffff',
                        borderRadius: '16px',
                        padding: '24px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03)',
                        display: 'grid',
                        gap: '18px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                          borderBottom: '1px solid #f1f5f9',
                          paddingBottom: '16px',
                        }}
                      >
                        <div>
                          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, letterSpacing: '0.08em', fontFamily: 'monospace' }}>
                            BOOKING: #{booking.id.slice(0, 8)}
                          </span>
                          <h3 style={{ fontSize: '20px', margin: '4px 0 0', color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>{ride ? ride.origin : 'Trip'}</span>
                            <ArrowRight size={16} style={{ color: '#94a3b8' }} />
                            <span>{ride ? ride.destination : 'Destination'}</span>
                          </h3>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {isPaid && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '4px 12px',
                                borderRadius: '999px',
                                fontSize: '11px',
                                fontWeight: 800,
                                letterSpacing: '0.04em',
                                background: '#ecfdf5',
                                color: '#065f46',
                                border: '1px solid #a7f3d0',
                              }}
                            >
                              <CheckCircle2 size={12} />
                              PAID
                            </span>
                          )}

                          <span
                            style={{
                              padding: '4px 12px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                              background: isConfirmed
                                ? '#ecfdf5'
                                : isCancelled
                                ? '#fef2f2'
                                : '#f1f5f9',
                              color: isConfirmed
                                ? '#065f46'
                                : isCancelled
                                ? '#991b1b'
                                : '#334155',
                              border: `1px solid ${
                                isConfirmed ? '#a7f3d0' : isCancelled ? '#fecaca' : '#e2e8f0'
                              }`,
                            }}
                          >
                            {booking.status}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                          gap: '16px',
                        }}
                      >
                        <div>
                          <span style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em' }}>
                            DEPARTURE
                          </span>
                          <strong style={{ fontSize: '14.5px', color: '#0f172a', display: 'block', marginTop: '3px' }}>
                            {ride ? formatTime(ride.departure_at) : '—'}
                          </strong>
                          <span style={{ display: 'block', fontSize: '12px', color: '#64748b' }}>
                            {ride ? formatDate(ride.departure_at) : '—'}
                          </span>
                        </div>

                        <div>
                          <span style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em' }}>
                            SEATS RESERVED
                          </span>
                          <strong style={{ fontSize: '14.5px', color: '#0f172a', display: 'block', marginTop: '3px' }}>
                            {booking.seats_booked} {booking.seats_booked === 1 ? 'seat' : 'seats'}
                          </strong>
                          <span style={{ display: 'block', fontSize: '12px', color: '#64748b' }}>
                            Confirmed passenger
                          </span>
                        </div>

                        <div>
                          <span style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em' }}>
                            TOTAL FARE
                          </span>
                          <strong style={{ fontSize: '17px', color: '#0f172a', fontWeight: 900, display: 'flex', alignItems: 'center', marginTop: '2px' }}>
                            ₹{Number(booking.total_fare).toFixed(0)}
                          </strong>
                          <span style={{ display: 'block', fontSize: '12px', color: '#64748b' }}>
                            {ride ? `₹${Number(ride.price_per_seat).toFixed(0)} / seat` : ''}
                          </span>
                        </div>

                        <div>
                          <span style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em' }}>
                            HOST & VEHICLE
                          </span>
                          <strong style={{ fontSize: '14px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
                            <User size={13} style={{ color: '#64748b' }} />
                            <span>{ride?.driver?.full_name || 'Driver'}</span>
                          </strong>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
                            <Car size={12} />
                            <span>{ride?.vehicle ? `${ride.vehicle.make} ${ride.vehicle.model}` : 'Vehicle'}</span>
                          </span>
                        </div>
                      </div>

                      {isCancelled && booking.cancellation_reason && (
                        <div
                          style={{
                            padding: '10px 14px',
                            background: '#fef2f2',
                            borderRadius: '8px',
                            color: '#991b1b',
                            fontSize: '13px',
                            border: '1px solid #fecaca',
                          }}
                        >
                          Cancellation reason: {booking.cancellation_reason}
                        </div>
                      )}

                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          justifyContent: 'flex-end',
                          gap: '10px',
                          borderTop: '1px solid #f1f5f9',
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
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 16px',
                              borderRadius: '8px',
                              border: 'none',
                              background: '#059669',
                              color: '#ffffff',
                              fontWeight: 700,
                              fontSize: '13px',
                              cursor: 'pointer',
                            }}
                          >
                            <CreditCard size={14} />
                            <span>Pay Now (₹{Number(booking.total_fare).toFixed(0)})</span>
                          </button>
                        )}

                        {isConfirmed && ride && (
                          reviewedBookings[booking.id] ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '8px 14px',
                                borderRadius: '8px',
                                background: '#fef3c7',
                                color: '#92400e',
                                fontWeight: 700,
                                fontSize: '13px',
                                border: '1px solid #fde68a',
                              }}
                            >
                              <Star size={14} style={{ fill: '#d97706', color: '#d97706' }} />
                              Rated {reviewedBookings[booking.id]}/5
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenReviewModal(booking)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                color: '#0f172a',
                                fontWeight: 700,
                                fontSize: '13px',
                                cursor: 'pointer',
                              }}
                            >
                              <Star size={14} style={{ color: '#d97706' }} />
                              Rate Driver
                            </button>
                          )
                        )}

                        {ride && (
                          <Link
                            to={`/rides/${ride.id}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '8px 16px',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#0f172a',
                              fontWeight: 600,
                              fontSize: '13px',
                              textDecoration: 'none',
                            }}
                          >
                            View Trip
                          </Link>
                        )}

                        {isConfirmed && (
                          <button
                            type="button"
                            onClick={() => handleCancelBooking(booking.id)}
                            disabled={cancellingId === booking.id}
                            style={{
                              padding: '8px 14px',
                              borderRadius: '8px',
                              border: '1px solid #fecaca',
                              background: '#fef2f2',
                              color: '#b91c1c',
                              fontWeight: 600,
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
          </div>
        )}

        {/* TAB 2: OFFERED RIDES (DRIVER HUB) */}
        {activeTab === 'offered' && (
          <div>
            {isOfferedLoading ? (
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  padding: '60px',
                  textAlign: 'center',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                }}
              >
                <Clock size={32} style={{ margin: '0 auto 12px', color: '#94a3b8', animation: 'spin 2s linear infinite' }} />
                <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Loading your offered rides...</p>
              </div>
            ) : offeredErrorMessage ? (
              <div
                style={{
                  background: '#fef2f2',
                  borderRadius: '14px',
                  padding: '20px 24px',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <XCircle size={20} />
                <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>{offeredErrorMessage}</p>
              </div>
            ) : offeredRides.length === 0 ? (
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '20px',
                  padding: '64px 32px',
                  textAlign: 'center',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                }}
              >
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '16px',
                    background: '#ecfdf5',
                    color: '#059669',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 18px',
                  }}
                >
                  <Car size={32} />
                </div>
                <h2 style={{ fontSize: '22px', margin: '0 0 8px', color: '#0f172a', fontWeight: 800 }}>
                  No offered rides yet
                </h2>
                <p style={{ color: '#64748b', maxWidth: '440px', margin: '0 auto 24px', lineHeight: '1.6', fontSize: '14px' }}>
                  You haven't published any trips yet. Share your empty seats, offset fuel costs, and connect with passengers.
                </p>
                <Link
                  to="/rides/create"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#059669',
                    color: '#ffffff',
                    padding: '12px 22px',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '14px',
                    textDecoration: 'none',
                  }}
                >
                  <Plus size={16} />
                  <span>Offer a Ride</span>
                </Link>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '20px' }}>
                {offeredRides.map((ride) => {
                  const isCancelled = ride.status === 'cancelled'
                  const isCompleted = ride.status === 'completed'
                  const isExpanded = expandedRideId === ride.id
                  const manifestState = offeredBookingsMap[ride.id]
                  const rideBookings = manifestState?.bookings || []
                  const totalBookedSeats = rideBookings
                    .filter((b) => b.status === 'confirmed' || b.status === 'requested')
                    .reduce((sum, b) => sum + (Number(b.seats_booked) || 0), 0)

                  return (
                    <article
                      key={ride.id}
                      style={{
                        background: '#ffffff',
                        borderRadius: '16px',
                        padding: '24px',
                        border: isCancelled ? '1px solid #fecaca' : '1px solid #e2e8f0',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03)',
                        display: 'grid',
                        gap: '18px',
                        transition: 'box-shadow 0.2s ease',
                      }}
                    >
                      {/* Card Header */}
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                          borderBottom: '1px solid #f1f5f9',
                          paddingBottom: '16px',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, letterSpacing: '0.08em', fontFamily: 'monospace' }}>
                              RIDE: #{ride.id.slice(0, 8)}
                            </span>
                            {ride.is_women_only && (
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '999px',
                                  fontSize: '10px',
                                  fontWeight: 800,
                                  background: '#fdf2f8',
                                  color: '#be185d',
                                  border: '1px solid #fbcfe8',
                                }}
                              >
                                Women Only
                              </span>
                            )}
                          </div>
                          <h3 style={{ fontSize: '20px', margin: '4px 0 0', color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>{ride.origin}</span>
                            <ArrowRight size={16} style={{ color: '#94a3b8' }} />
                            <span>{ride.destination}</span>
                          </h3>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span
                            style={{
                              padding: '4px 12px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                              background: isCompleted
                                ? '#f1f5f9'
                                : isCancelled
                                ? '#fef2f2'
                                : '#ecfdf5',
                              color: isCompleted
                                ? '#475569'
                                : isCancelled
                                ? '#991b1b'
                                : '#065f46',
                              border: `1px solid ${
                                isCompleted ? '#e2e8f0' : isCancelled ? '#fecaca' : '#a7f3d0'
                              }`,
                            }}
                          >
                            {ride.status}
                          </span>
                        </div>
                      </div>

                      {/* Ride Metrics */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: '16px',
                        }}
                      >
                        <div>
                          <span style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em' }}>
                            DEPARTURE TIME
                          </span>
                          <strong style={{ fontSize: '14.5px', color: '#0f172a', display: 'block', marginTop: '3px' }}>
                            {formatTime(ride.departure_at)}
                          </strong>
                          <span style={{ display: 'block', fontSize: '12px', color: '#64748b' }}>
                            {formatDate(ride.departure_at)}
                          </span>
                        </div>

                        <div>
                          <span style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em' }}>
                            VEHICLE ASSIGNED
                          </span>
                          <strong style={{ fontSize: '14px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
                            <Car size={13} style={{ color: '#64748b' }} />
                            <span>{ride.vehicle ? `${ride.vehicle.make} ${ride.vehicle.model}` : 'Vehicle'}</span>
                          </strong>
                          <span style={{ display: 'block', fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
                            {ride.vehicle?.registration_number || '—'}
                          </span>
                        </div>

                        <div>
                          <span style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em' }}>
                            SEATS STATUS
                          </span>
                          <strong style={{ fontSize: '14.5px', color: '#0f172a', display: 'block', marginTop: '3px' }}>
                            {ride.available_seats} remaining
                          </strong>
                          <span style={{ display: 'block', fontSize: '12px', color: '#64748b' }}>
                            {ride.vehicle?.seat_capacity ? `of ${ride.vehicle.seat_capacity} total seats` : 'available'}
                          </span>
                        </div>

                        <div>
                          <span style={{ display: 'block', color: '#64748b', fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em' }}>
                            PRICE PER SEAT
                          </span>
                          <strong style={{ fontSize: '17px', color: '#059669', fontWeight: 900, display: 'flex', alignItems: 'center', marginTop: '2px' }}>
                            ₹{Number(ride.price_per_seat).toFixed(0)}
                          </strong>
                          <span style={{ display: 'block', fontSize: '12px', color: '#64748b' }}>
                            per passenger
                          </span>
                        </div>
                      </div>

                      {/* Manifest Toggle Bar */}
                      <div
                        style={{
                          background: '#f8fafc',
                          borderRadius: '12px',
                          padding: '12px 16px',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          flexWrap: 'wrap',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: '#ecfdf5',
                              color: '#059669',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Users size={16} />
                          </div>
                          <div>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'block' }}>
                              Passenger Manifest
                            </span>
                            <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                              {manifestState?.bookings ? `${rideBookings.length} booking(s) · ${totalBookedSeats} seat(s) reserved` : 'View who booked your vehicle'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleManifest(ride.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 14px',
                            borderRadius: '8px',
                            background: isExpanded ? '#0f172a' : '#ffffff',
                            color: isExpanded ? '#ffffff' : '#0f172a',
                            border: '1px solid #cbd5e1',
                            fontWeight: 700,
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span>{isExpanded ? 'Hide Manifest' : 'View Passenger Bookings'}</span>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>

                      {/* Expandable Passenger Manifest Drawer */}
                      {isExpanded && (
                        <div
                          style={{
                            background: '#f8fafc',
                            borderRadius: '12px',
                            padding: '20px',
                            border: '1.5px solid #cbd5e1',
                            display: 'grid',
                            gap: '14px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669', letterSpacing: '0.12em' }}>
                              PASSENGER ROSTER & CONTACT DETAILS
                            </span>
                            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                              Total reservations: {rideBookings.length}
                            </span>
                          </div>

                          {manifestState?.isLoading ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                              <Clock size={20} style={{ margin: '0 auto 8px', animation: 'spin 2s linear infinite' }} />
                              Loading passenger manifest...
                            </div>
                          ) : manifestState?.error ? (
                            <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '8px', color: '#991b1b', fontSize: '13px' }}>
                              {manifestState.error}
                            </div>
                          ) : rideBookings.length === 0 ? (
                            <div
                              style={{
                                padding: '32px 20px',
                                textAlign: 'center',
                                background: '#ffffff',
                                borderRadius: '10px',
                                border: '1px dashed #cbd5e1',
                              }}
                            >
                              <Users size={28} style={{ margin: '0 auto 8px', color: '#94a3b8' }} />
                              <p style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>
                                No bookings for this ride yet
                              </p>
                              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '12.5px' }}>
                                When passengers book seats in your vehicle, their identity, seat count, and phone contact will appear here.
                              </p>
                            </div>
                          ) : (
                            <div style={{ display: 'grid', gap: '10px' }}>
                              {rideBookings.map((b) => {
                                const riderName = b.rider?.full_name || 'Passenger'
                                const riderInitial = riderName[0]?.toUpperCase() || 'P'
                                const isBookConfirmed = b.status === 'confirmed'
                                const isBookCancelled = b.status === 'cancelled'

                                return (
                                  <div
                                    key={b.id}
                                    style={{
                                      background: '#ffffff',
                                      borderRadius: '10px',
                                      padding: '16px',
                                      border: '1px solid #e2e8f0',
                                      display: 'flex',
                                      flexWrap: 'wrap',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      gap: '14px',
                                    }}
                                  >
                                    {/* Rider Identity */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                      <div
                                        style={{
                                          width: '40px',
                                          height: '40px',
                                          borderRadius: '50%',
                                          background: '#0b1324',
                                          color: '#a9dfc6',
                                          fontWeight: 800,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontSize: '15px',
                                          flexShrink: 0,
                                        }}
                                      >
                                        {riderInitial}
                                      </div>
                                      <div>
                                        <h4 style={{ margin: '0 0 4px', fontSize: '14.5px', fontWeight: 800, color: '#0f172a' }}>
                                          {riderName}
                                        </h4>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '12px', color: '#64748b' }}>
                                          {b.rider?.email && (
                                            <a
                                              href={`mailto:${b.rider.email}`}
                                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#059669', textDecoration: 'none', fontWeight: 600 }}
                                            >
                                              <Mail size={13} />
                                              <span>{b.rider.email}</span>
                                            </a>
                                          )}
                                          {b.rider?.phone_number && (
                                            <a
                                              href={`tel:${b.rider.phone_number}`}
                                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#0f172a', textDecoration: 'none', fontWeight: 600 }}
                                            >
                                              <Phone size={13} style={{ color: '#64748b' }} />
                                              <span>{b.rider.phone_number}</span>
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Seats, Fare, Status */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                      <div style={{ textAlign: 'right' }}>
                                        <span
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            background: '#f1f5f9',
                                            fontSize: '12px',
                                            fontWeight: 800,
                                            color: '#0f172a',
                                          }}
                                        >
                                          <Users size={12} />
                                          <span>{b.seats_booked} {b.seats_booked === 1 ? 'seat' : 'seats'}</span>
                                        </span>
                                        <strong style={{ display: 'block', fontSize: '14px', color: '#059669', marginTop: '3px' }}>
                                          ₹{Number(b.total_fare).toFixed(0)}
                                        </strong>
                                      </div>

                                      <span
                                        style={{
                                          padding: '4px 10px',
                                          borderRadius: '999px',
                                          fontSize: '11px',
                                          fontWeight: 800,
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.04em',
                                          background: isBookConfirmed
                                            ? '#ecfdf5'
                                            : isBookCancelled
                                            ? '#fef2f2'
                                            : '#f1f5f9',
                                          color: isBookConfirmed
                                            ? '#065f46'
                                            : isBookCancelled
                                            ? '#991b1b'
                                            : '#334155',
                                          border: `1px solid ${
                                            isBookConfirmed ? '#a7f3d0' : isBookCancelled ? '#fecaca' : '#e2e8f0'
                                          }`,
                                        }}
                                      >
                                        {b.status}
                                      </span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Card Action Buttons */}
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          justifyContent: 'flex-end',
                          gap: '10px',
                          borderTop: '1px solid #f1f5f9',
                          paddingTop: '16px',
                        }}
                      >
                        <Link
                          to={`/rides/${ride.id}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#0f172a',
                            fontWeight: 600,
                            fontSize: '13px',
                            textDecoration: 'none',
                          }}
                        >
                          <span>View Public Page</span>
                        </Link>

                        {!isCancelled && !isCompleted && (
                          <button
                            type="button"
                            onClick={() => {
                              setCancelModalRide(ride)
                              setDriverCancelReason('')
                              setCancelRideErrorAlert(null)
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 14px',
                              borderRadius: '8px',
                              border: '1px solid #fecaca',
                              background: '#fef2f2',
                              color: '#b91c1c',
                              fontWeight: 600,
                              fontSize: '13px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <AlertTriangle size={14} />
                            <span>Cancel This Ride</span>
                          </button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Driver Cancel Ride Modal */}
      {cancelModalRide && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => !isCancellingRide && setCancelModalRide(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '480px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: '#fef2f2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', color: '#0f172a', fontWeight: 800, margin: 0 }}>
                  Cancel Offered Ride
                </h3>
                <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                  {cancelModalRide.origin} → {cancelModalRide.destination}
                </span>
              </div>
            </div>

            <p style={{ fontSize: '13.5px', color: '#475569', lineHeight: 1.5, margin: '0 0 16px' }}>
              Are you sure you want to cancel this offered ride? All passengers who booked seats in your vehicle will be
              automatically cancelled, held seats will be released, and instant cancellation notifications will be dispatched to each rider.
            </p>

            {cancelRideErrorAlert && (
              <div
                style={{
                  padding: '10px 14px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  color: '#dc2626',
                  fontSize: '12.5px',
                  marginBottom: '14px',
                }}
              >
                {cancelRideErrorAlert}
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: '#475569',
                  marginBottom: '6px',
                }}
              >
                Reason for cancellation (optional)
              </label>
              <textarea
                rows={3}
                placeholder="e.g., Vehicle mechanical failure, medical emergency, sudden delay..."
                value={driverCancelReason}
                onChange={(e) => setDriverCancelReason(e.target.value)}
                disabled={isCancellingRide}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setCancelModalRide(null)}
                disabled={isCancellingRide}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  background: '#f1f5f9',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                Keep Ride
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelOfferedRide}
                disabled={isCancellingRide}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <XCircle size={15} />
                <span>{isCancellingRide ? 'Cancelling...' : 'Confirm Ride Cancellation'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Checkout Modal */}
      {activeCheckoutBooking && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              padding: '32px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669', letterSpacing: '0.15em' }}>
                  SECURE CHECKOUT
                </span>
                <h3 style={{ fontSize: '20px', margin: '4px 0 0', color: '#0f172a', fontWeight: 800 }}>
                  Complete Payment
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveCheckoutBooking(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div
              style={{
                background: '#f8fafc',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b', fontSize: '13px' }}>Route</span>
                <strong style={{ fontSize: '13.5px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span>{activeCheckoutBooking.ride?.origin}</span>
                  <ArrowRight size={13} />
                  <span>{activeCheckoutBooking.ride?.destination}</span>
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#64748b', fontSize: '13px' }}>Amount to pay</span>
                <strong style={{ fontSize: '18px', color: '#059669', fontWeight: 850 }}>
                  ₹{Number(activeCheckoutBooking.total_fare).toFixed(0)}
                </strong>
              </div>
            </div>

            <div style={{ marginBottom: '22px' }}>
              <span style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '10px', letterSpacing: '0.04em' }}>
                SELECT PAYMENT METHOD
              </span>
              <div style={{ display: 'grid', gap: '8px' }}>
                {[
                  { id: 'upi', label: 'UPI (GPay, PhonePe, Paytm)', icon: Zap },
                  { id: 'card', label: 'Credit / Debit Card', icon: CreditCard },
                  { id: 'netbanking', label: 'Net Banking', icon: Building2 },
                ].map((method) => {
                  const Icon = method.icon
                  const isSelected = paymentMethod === method.id
                  return (
                    <label
                      key={method.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: isSelected ? '1.5px solid #059669' : '1px solid #e2e8f0',
                        background: isSelected ? '#ecfdf5' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <input
                        type="radio"
                        name="payment_method"
                        value={method.id}
                        checked={isSelected}
                        onChange={() => setPaymentMethod(method.id as 'upi' | 'card' | 'netbanking')}
                        style={{ accentColor: '#059669' }}
                      />
                      <Icon size={18} style={{ color: isSelected ? '#059669' : '#64748b' }} />
                      <span style={{ fontSize: '13.5px', fontWeight: 600, color: isSelected ? '#065f46' : '#0f172a' }}>
                        {method.label}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            {paymentErrorMsg && (
              <div
                style={{
                  padding: '10px 14px',
                  background: '#fef2f2',
                  borderRadius: '8px',
                  color: '#991b1b',
                  fontSize: '13px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <XCircle size={16} />
                <span>{paymentErrorMsg}</span>
              </div>
            )}

            {paymentSuccessMsg && (
              <div
                style={{
                  padding: '10px 14px',
                  background: '#ecfdf5',
                  borderRadius: '8px',
                  color: '#065f46',
                  fontSize: '13px',
                  marginBottom: '16px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={16} />
                <span>{paymentSuccessMsg}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleCompletePayment}
              disabled={isProcessingPayment}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '10px',
                background: '#059669',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <ShieldCheck size={16} />
              <span>
                {isProcessingPayment
                  ? 'Authorizing Transaction...'
                  : `Authorize ₹${Number(activeCheckoutBooking.total_fare).toFixed(0)}`}
              </span>
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
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              padding: '32px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669', letterSpacing: '0.15em' }}>
                  TRIP FEEDBACK
                </span>
                <h3 style={{ fontSize: '20px', margin: '4px 0 0', color: '#0f172a', fontWeight: 800 }}>
                  Rate your Driver
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveReviewBooking(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div
              style={{
                background: '#f8fafc',
                borderRadius: '12px',
                padding: '14px',
                marginBottom: '20px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748b', fontSize: '13px' }}>Driver</span>
                <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>
                  {activeReviewBooking.ride?.driver?.full_name || 'Driver'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: '13px' }}>Route</span>
                <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>
                  {activeReviewBooking.ride?.origin} → {activeReviewBooking.ride?.destination}
                </strong>
              </div>
            </div>

            {/* Star selector */}
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <span style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '10px', letterSpacing: '0.04em' }}>
                SELECT RATING
              </span>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
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
                        cursor: 'pointer',
                        padding: '6px',
                        transition: 'transform 0.15s ease',
                        transform: reviewHoverRating === star ? 'scale(1.2)' : 'none',
                      }}
                    >
                      <Star
                        size={28}
                        style={{
                          fill: filled ? '#f59e0b' : 'none',
                          color: filled ? '#f59e0b' : '#cbd5e1',
                        }}
                      />
                    </button>
                  )
                })}
              </div>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#64748b', marginTop: '6px', display: 'block' }}>
                {reviewRating === 5 && 'Outstanding trip (5/5)'}
                {reviewRating === 4 && 'Very good experience (4/5)'}
                {reviewRating === 3 && 'Average ride (3/5)'}
                {reviewRating === 2 && 'Below expectations (2/5)'}
                {reviewRating === 1 && 'Poor experience (1/5)'}
              </span>
            </div>

            {/* Comment */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '6px', letterSpacing: '0.04em' }}>
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
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            {reviewErrorMsg && (
              <div
                style={{
                  padding: '10px 14px',
                  background: '#fef2f2',
                  borderRadius: '8px',
                  color: '#991b1b',
                  fontSize: '13px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <XCircle size={16} />
                <span>{reviewErrorMsg}</span>
              </div>
            )}

            {reviewSuccessMsg && (
              <div
                style={{
                  padding: '10px 14px',
                  background: '#ecfdf5',
                  borderRadius: '8px',
                  color: '#065f46',
                  fontSize: '13px',
                  marginBottom: '16px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={16} />
                <span>{reviewSuccessMsg}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmitReview}
              disabled={isSubmittingReview}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '10px',
                background: '#0f172a',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 700,
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
