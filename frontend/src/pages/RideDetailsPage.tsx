import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { apiClient } from '../services/apiClient'

import './ride-details.css'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  'http://127.0.0.1:8000/api/v1'

import type { Ride } from '../features/rides/types'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
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

function formatPrice(value: number | string) {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Number(value))
}

export function RideDetailsPage() {
  const { rideId } = useParams<{ rideId: string }>()
  const { user, isAuthenticated } = useAuthStore()

  const [ride, setRide] = useState<Ride | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(rideId))
  const [isError, setIsError] = useState(!rideId)

  const [seatsToBook, setSeatsToBook] = useState(1)
  const [isBooking, setIsBooking] = useState(false)
  const [bookingSuccess, setBookingSuccess] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [driverRating, setDriverRating] = useState<{ average: number; count: number } | null>(null)

  // Trip chat state
  interface TripMsg {
    id: string
    ride_id: string
    sender_id: string
    content: string
    created_at: string
    sender?: {
      id: string
      full_name?: string | null
      avatar_url?: string | null
    } | null
  }
  const [tripMessages, setTripMessages] = useState<TripMsg[]>([])
  const [canChat, setCanChat] = useState(false)
  const [newMessageText, setNewMessageText] = useState('')
  const [isSendingMessage, setIsSendingMessage] = useState(false)

  // Safety report modal state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [reportCategory, setReportCategory] = useState('safety')
  const [reportDescription, setReportDescription] = useState('')
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)
  const [reportSuccessMsg, setReportSuccessMsg] = useState<string | null>(null)
  const [reportErrorMsg, setReportErrorMsg] = useState<string | null>(null)

  async function handleBookSeat() {
    if (!ride) return
    setBookingError(null)
    setIsBooking(true)

    try {
      await apiClient.post('/bookings', {
        ride_id: ride.id,
        seats_booked: seatsToBook,
      })
      setBookingSuccess(true)
      setRide((prev) =>
        prev
          ? {
              ...prev,
              available_seats: Math.max(0, prev.available_seats - seatsToBook),
            }
          : null,
      )
    } catch (err) {
      setBookingError(
        err instanceof Error ? err.message : 'Could not complete booking.',
      )
    } finally {
      setIsBooking(false)
    }
  }

  useEffect(() => {
    if (!rideId) return

    const controller = new AbortController()

    async function loadRide() {
      setIsLoading(true)
      setIsError(false)

      try {
        const response = await fetch(
          `${API_BASE_URL}/rides/${rideId}`,
          {
            signal: controller.signal,
          },
        )

        if (!response.ok) {
          throw new Error('Ride could not be loaded.')
        }

        const data = (await response.json()) as Ride

        if (!controller.signal.aborted) {
          setRide(data)
        }
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }

        if (!controller.signal.aborted) {
          setIsError(true)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadRide()

    return () => {
      controller.abort()
    }
  }, [rideId])

  useEffect(() => {
    if (!ride?.driver_id) return
    apiClient
      .get<{ average_rating: number; total_reviews: number }>(
        `/reviews/user/${ride.driver_id}/summary`,
      )
      .then((res) => {
        setDriverRating({
          average: res.average_rating,
          count: res.total_reviews,
        })
      })
      .catch(() => {})
  }, [ride?.driver_id])

  useEffect(() => {
    if (!rideId || !isAuthenticated) return

    async function fetchTripMessages() {
      try {
        const res = await apiClient.get<{ items: TripMsg[]; total: number }>(`/rides/${rideId}/messages`)
        setTripMessages(res.items || [])
        setCanChat(true)
      } catch {
        setCanChat(false)
      }
    }

    fetchTripMessages()
    const timer = setInterval(fetchTripMessages, 10000)
    return () => clearInterval(timer)
  }, [rideId, isAuthenticated, bookingSuccess])

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!rideId || !newMessageText.trim()) return

    setIsSendingMessage(true)
    try {
      const sent = await apiClient.post<TripMsg>(`/rides/${rideId}/messages`, {
        content: newMessageText.trim(),
      })
      setTripMessages((prev) => [...prev, sent])
      setNewMessageText('')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send message.')
    } finally {
      setIsSendingMessage(false)
    }
  }

  async function handleSubmitReport(e: React.FormEvent) {
    e.preventDefault()
    if (!ride || !reportDescription.trim()) return

    setIsSubmittingReport(true)
    setReportErrorMsg(null)
    setReportSuccessMsg(null)

    try {
      await apiClient.post('/safety/reports', {
        ride_id: ride.id,
        reported_user_id: ride.driver_id,
        category: reportCategory,
        description: reportDescription.trim(),
      })
      setReportSuccessMsg('Report submitted to Trust & Safety team. Thank you.')
      setTimeout(() => {
        setIsReportModalOpen(false)
        setReportSuccessMsg(null)
        setReportDescription('')
      }, 1500)
    } catch (err) {
      setReportErrorMsg(err instanceof Error ? err.message : 'Could not submit report.')
    } finally {
      setIsSubmittingReport(false)
    }
  }

  if (isLoading) {
    return (
      <div className="ride-details-page">
        <div className="ride-details-state">
          <div className="details-loading-line" />
          <p>Loading ride details...</p>
        </div>
      </div>
    )
  }

  if (isError || !ride) {
    return (
      <div className="ride-details-page">
        <div className="ride-details-state">
          <span className="details-state-label">
            RIDE NOT FOUND
          </span>

          <h1>This ride is no longer available.</h1>

          <p>
            The ride may have been removed or the link may
            no longer be valid.
          </p>

          <Link
            to="/"
            className="details-primary-button"
          >
            Back to search
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="ride-details-page">
      <section className="ride-details-hero">
        <div className="ride-details-hero-inner">
          <Link
            to={`/rides?origin=${encodeURIComponent(
              ride.origin,
            )}&destination=${encodeURIComponent(
              ride.destination,
            )}&date=${ride.departure_at.slice(0, 10)}`}
            className="details-back-link"
          >
            <span aria-hidden="true">←</span>
            Back to results
          </Link>

          <p className="details-eyebrow">
            RIDE DETAILS
          </p>

          <h1>
            {ride.origin}
            <span> to </span>
            {ride.destination}
          </h1>

          <p className="details-date">
            {formatDate(ride.departure_at)}
          </p>
        </div>
      </section>

      <main className="ride-details-content">
        <section className="ride-details-main">
          <div className="journey-card">
            <div className="journey-heading">
              <div>
                <span className="details-section-label">
                  YOUR JOURNEY
                </span>

                <h2>Trip information</h2>
              </div>

              <span className="status-badge">
                {ride.status}
              </span>
            </div>

            <div className="journey-route">
              <div className="journey-stop">
                <span className="journey-dot" />

                <div>
                  <small>DEPARTURE</small>

                  <strong>
                    {formatTime(ride.departure_at)}
                  </strong>

                  <p>{ride.origin}</p>
                </div>
              </div>

              <div className="journey-connector">
                <span />
              </div>

              <div className="journey-stop">
                <span className="journey-dot destination" />

                <div>
                  <small>DESTINATION</small>

                  <strong>{ride.destination}</strong>

                  <p>Arrival location</p>
                </div>
              </div>
            </div>
          </div>

          <div className="information-card">
            <span className="details-section-label">
              ABOUT THIS RIDE
            </span>

            <h2>What to expect</h2>

            <div className="information-grid">
              <div>
                <span className="info-icon">₹</span>

                <div>
                  <small>PRICE PER SEAT</small>

                  <strong>
                    ₹{formatPrice(ride.price_per_seat)}
                  </strong>
                </div>
              </div>

              <div>
                <span className="info-icon">
                  {ride.available_seats}
                </span>

                <div>
                  <small>SEATS AVAILABLE</small>

                  <strong>
                    {ride.available_seats}
                  </strong>
                </div>
              </div>

              <div>
                <span className="info-icon">✓</span>

                <div>
                  <small>RIDE STATUS</small>

                  <strong>
                    {ride.status}
                  </strong>
                </div>
              </div>

              <div>
                <span className="info-icon">CAR</span>

                <div>
                  <small>VEHICLE</small>

                  <strong>
                    {ride.vehicle
                      ? `${ride.vehicle.make} ${ride.vehicle.model}`
                      : 'Vehicle information'}
                  </strong>
                  {ride.vehicle && (
                    <small style={{ display: 'block', color: '#7c8495', marginTop: '2px' }}>
                      {ride.vehicle.registration_number}
                    </small>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="information-card" style={{ marginTop: '20px' }}>
            <span className="details-section-label">YOUR HOST</span>
            <h2>Driver Profile</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '16px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: '#26345f',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '18px',
                }}
              >
                {ride.driver?.full_name ? ride.driver.full_name[0].toUpperCase() : 'D'}
              </div>
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  <strong
                    style={{
                      fontSize: '17px',
                      color: '#17203b',
                    }}
                  >
                    {ride.driver?.full_name || 'Verified RIDEX Driver'}
                  </strong>
                  {driverRating && driverRating.count > 0 && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#fff9e6',
                        color: '#b27b00',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 800,
                      }}
                    >
                      ★ {driverRating.average.toFixed(1)} ({driverRating.count})
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontSize: '13px',
                    color: '#7c8495',
                    display: 'block',
                    marginTop: '2px',
                  }}
                >
                  Verified community driver • Active member
                </span>
              </div>
            </div>
          </div>

          <div className="notes-card">
            <span className="details-section-label">
              DRIVER NOTES
            </span>

            <h2>Before you travel</h2>

            <p>
              {ride.notes ||
                'No additional notes have been provided for this ride.'}
            </p>
          </div>

          {canChat && (
            <div
              className="trip-chat-card"
              style={{
                background: '#fff',
                borderRadius: '24px',
                padding: '28px',
                border: '1px solid #e0e2e7',
                marginTop: '24px',
                boxShadow: '0 4px 20px rgba(31, 43, 78, 0.03)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                  borderBottom: '1px solid #f0f2f5',
                  paddingBottom: '12px',
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: '#2d7a54',
                      letterSpacing: '0.15em',
                    }}
                  >
                    CO-TRAVELER CHAT
                  </span>
                  <h2 style={{ fontSize: '20px', margin: '4px 0 0', color: '#17203b' }}>
                    Trip Discussion
                  </h2>
                </div>
                <span style={{ fontSize: '12px', color: '#7c8495', fontWeight: 600 }}>
                  {tripMessages.length} {tripMessages.length === 1 ? 'message' : 'messages'}
                </span>
              </div>

              {/* Messages stream */}
              <div
                style={{
                  maxHeight: '280px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  paddingRight: '6px',
                  marginBottom: '18px',
                }}
              >
                {tripMessages.length === 0 ? (
                  <p
                    style={{
                      color: '#7c8495',
                      fontSize: '13px',
                      textAlign: 'center',
                      margin: '24px 0',
                    }}
                  >
                    No messages yet. Say hello to your driver and fellow passengers!
                  </p>
                ) : (
                  tripMessages.map((m) => {
                    const isMe = m.sender_id === user?.id
                    return (
                      <div
                        key={m.id}
                        style={{
                          alignSelf: isMe ? 'flex-end' : 'flex-start',
                          maxWidth: '80%',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '11px',
                            color: '#7c8495',
                            marginBottom: '3px',
                            textAlign: isMe ? 'right' : 'left',
                            fontWeight: 600,
                          }}
                        >
                          {isMe ? 'You' : m.sender?.full_name || 'Passenger'}
                        </div>
                        <div
                          style={{
                            padding: '10px 14px',
                            borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                            background: isMe ? '#26345f' : '#f0f3f6',
                            color: isMe ? '#fff' : '#17203b',
                            fontSize: '14px',
                            lineHeight: '1.4',
                          }}
                        >
                          {m.content}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Send message form */}
              <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  placeholder="Ask a question about pickup, timing, luggage..."
                  disabled={isSendingMessage}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1px solid #dfe2e7',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={isSendingMessage || !newMessageText.trim()}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '12px',
                    background: '#e98570',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  {isSendingMessage ? 'Sending...' : 'Send'}
                </button>
              </form>
            </div>
          )}
        </section>

        <aside className="booking-card">
          <div className="booking-price">
            <span>Price per seat</span>

            <strong>
              ₹{formatPrice(ride.price_per_seat)}
            </strong>
          </div>

          <div className="booking-divider" />

          <div className="booking-row">
            <span>Available seats</span>

            <strong>
              {ride.available_seats}
            </strong>
          </div>

          <div className="booking-row">
            <span>Departure</span>

            <strong>
              {formatTime(ride.departure_at)}
            </strong>
          </div>

          {!isAuthenticated ? (
            <>
              <Link
                to="/login"
                className="book-ride-button"
                style={{
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                Sign in to book
                <span aria-hidden="true">→</span>
              </Link>
              <p className="booking-note">
                Sign in to request a seat on this ride.
              </p>
            </>
          ) : user?.id === ride.driver_id ? (
            <div
              style={{
                marginTop: '16px',
                padding: '14px',
                borderRadius: '12px',
                background: '#edf5f0',
                color: '#2d7a54',
                textAlign: 'center',
                fontWeight: 700,
                fontSize: '13px',
              }}
            >
              You are the host/driver of this ride.
            </div>
          ) : bookingSuccess ? (
            <div
              style={{
                marginTop: '16px',
                padding: '16px',
                borderRadius: '12px',
                background: '#edf5f0',
                textAlign: 'center',
              }}
            >
              <strong
                style={{
                  color: '#2d7a54',
                  display: 'block',
                  fontSize: '15px',
                  marginBottom: '6px',
                }}
              >
                ✓ Booking Confirmed!
              </strong>
              <p
                style={{
                  color: '#17203b',
                  fontSize: '12px',
                  margin: '0 0 14px',
                }}
              >
                Your seats are reserved. View your itinerary in My Bookings.
              </p>
              <Link
                to="/bookings"
                style={{
                  display: 'inline-block',
                  background: '#26345f',
                  color: '#fff',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                Go to My Bookings →
              </Link>
            </div>
          ) : ride.available_seats === 0 ? (
            <div
              style={{
                marginTop: '16px',
                padding: '14px',
                borderRadius: '12px',
                background: '#fff4f1',
                color: '#a64d3d',
                textAlign: 'center',
                fontWeight: 700,
                fontSize: '13px',
              }}
            >
              This ride has no available seats remaining.
            </div>
          ) : (
            <div style={{ marginTop: '16px' }}>
              <div className="booking-row" style={{ marginBottom: '12px' }}>
                <span>Seats to book</span>
                <select
                  value={seatsToBook}
                  onChange={(e) => setSeatsToBook(Number(e.target.value))}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #dfe2e7',
                    background: '#fff',
                    fontWeight: 700,
                    fontSize: '14px',
                    color: '#17203b',
                  }}
                >
                  {Array.from(
                    { length: Math.min(ride.available_seats, 8) },
                    (_, i) => i + 1,
                  ).map((s) => (
                    <option key={s} value={s}>
                      {s} {s === 1 ? 'seat' : 'seats'}
                    </option>
                  ))}
                </select>
              </div>

              <div
                className="booking-row"
                style={{
                  borderTop: '1px solid #eceef1',
                  paddingTop: '12px',
                  marginBottom: '16px',
                }}
              >
                <span>Total fare</span>
                <strong style={{ fontSize: '18px', color: '#26345f' }}>
                  ₹
                  {formatPrice(
                    Number(ride.price_per_seat) * seatsToBook,
                  )}
                </strong>
              </div>

              {bookingError && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#fff4f1',
                    color: '#a64d3d',
                    fontSize: '12px',
                    marginBottom: '14px',
                  }}
                >
                  {bookingError}
                </div>
              )}

              <button
                type="button"
                className="book-ride-button"
                onClick={handleBookSeat}
                disabled={isBooking}
              >
                {isBooking ? 'Reserving seats...' : 'Confirm & Book'}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          )}

          {isAuthenticated && (
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              style={{
                marginTop: '18px',
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px dashed #d1d5db',
                background: '#fafbfc',
                color: '#7c8495',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              🛡️ Report Safety or Trip Issue
            </button>
          )}
        </aside>
      </main>

      {/* Safety Incident Report Modal */}
      {isReportModalOpen && (
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
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#e98570', letterSpacing: '0.15em' }}>
                  TRUST & SAFETY
                </span>
                <h3 style={{ fontSize: '22px', margin: '4px 0 0', color: '#17203b' }}>
                  File Safety Report
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '22px', color: '#7c8495', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: '#7c8495', fontSize: '13px', lineHeight: '1.5', margin: '0 0 20px' }}>
              Your report will be confidentially escalated to the RIDEX Trust & Safety team.
            </p>

            <form onSubmit={handleSubmitReport} style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#7c8495', marginBottom: '6px' }}>
                  ISSUE CATEGORY
                </label>
                <select
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1px solid #dfe2e7',
                    fontSize: '14px',
                  }}
                >
                  <option value="safety">Reckless driving or route safety concern</option>
                  <option value="harassment">Inappropriate behavior or harassment</option>
                  <option value="vehicle_mismatch">Vehicle did not match listing</option>
                  <option value="payment">Unapproved cash demand / payment dispute</option>
                  <option value="other">Other issue</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#7c8495', marginBottom: '6px' }}>
                  DESCRIPTION
                </label>
                <textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Describe what occurred with as much detail as possible..."
                  required
                  rows={4}
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

              {reportErrorMsg && (
                <div style={{ padding: '12px', background: '#fff4f1', borderRadius: '10px', color: '#a64d3d', fontSize: '13px' }}>
                  {reportErrorMsg}
                </div>
              )}

              {reportSuccessMsg && (
                <div style={{ padding: '12px', background: '#edf5f0', borderRadius: '10px', color: '#2d7a54', fontSize: '13px', fontWeight: 700 }}>
                  ✓ {reportSuccessMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingReport || reportDescription.trim().length < 5}
                style={{
                  padding: '15px',
                  borderRadius: '12px',
                  background: '#a64d3d',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 850,
                  border: 'none',
                  cursor: 'pointer',
                  marginTop: '6px',
                }}
              >
                {isSubmittingReport ? 'Submitting Report...' : 'Submit Confidential Report'}
              </button>
            </form>
          </div>
        </div>
      )}

      <footer className="ride-details-footer">
        <strong>
          RIDE<span>X</span>
        </strong>

        <span>Move together.</span>
      </footer>
    </div>
  )
}
