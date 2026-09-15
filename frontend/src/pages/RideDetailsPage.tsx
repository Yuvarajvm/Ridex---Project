import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Users,
  Car,
  Send,
  Star,
  CheckCircle2,
  XCircle,
  X,
  AlertTriangle,
  IndianRupee,
  Mail,
  Phone,
  Clock,
} from 'lucide-react'
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

  // Driver passenger manifest & cancel controls
  const [driverBookings, setDriverBookings] = useState<any[]>([])
  const [isLoadingDriverBookings, setIsLoadingDriverBookings] = useState(false)
  const [isDriverCancelModalOpen, setIsDriverCancelModalOpen] = useState(false)
  const [driverCancelReason, setDriverCancelReason] = useState('')
  const [isDriverCancelling, setIsDriverCancelling] = useState(false)
  const [driverCancelError, setDriverCancelError] = useState<string | null>(null)
  const [driverCancelSuccess, setDriverCancelSuccess] = useState(false)

  useEffect(() => {
    if (!ride || !user || user.id !== ride.driver_id) return

    let isMounted = true
    apiClient
      .get<{ items: any[]; total: number }>(`/bookings/ride/${ride.id}`)
      .then((res) => {
        if (isMounted) setDriverBookings(res.items || [])
      })
      .catch(() => {
        // non-fatal
      })
      .finally(() => {
        if (isMounted) setIsLoadingDriverBookings(false)
      })

    return () => {
      isMounted = false
    }
  }, [ride, user])

  async function handleDriverCancelRide() {
    if (!ride) return
    setIsDriverCancelling(true)
    setDriverCancelError(null)

    try {
      const updated = await apiClient.post<Ride>(`/rides/${ride.id}/cancel`, {
        reason: driverCancelReason.trim() || undefined,
      })
      setRide(updated)
      setDriverCancelSuccess(true)
      const bookingsRes = await apiClient.get<{ items: any[]; total: number }>(`/bookings/ride/${ride.id}`)
      setDriverBookings(bookingsRes.items || [])
      setTimeout(() => {
        setIsDriverCancelModalOpen(false)
        setDriverCancelSuccess(false)
      }, 1200)
    } catch (err) {
      setDriverCancelError(err instanceof Error ? err.message : 'Failed to cancel ride.')
    } finally {
      setIsDriverCancelling(false)
    }
  }

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
    let isMounted = true
    apiClient
      .get<{ average_rating: number; total_reviews: number }>(
        `/reviews/user/${ride.driver_id}/summary`,
      )
      .then((res) => {
        if (isMounted) {
          setDriverRating({
            average: res.average_rating,
            count: res.total_reviews,
          })
        }
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [ride?.driver_id])

  useEffect(() => {
    if (!rideId || !isAuthenticated) return
    let isMounted = true

    function fetchTripMessages() {
      apiClient.get<{ items: TripMsg[]; total: number }>(`/rides/${rideId}/messages`)
        .then((res) => {
          if (isMounted) {
            setTripMessages(res.items || [])
            setCanChat(true)
          }
        })
        .catch(() => {
          if (isMounted) {
            setCanChat(false)
          }
        })
    }

    fetchTripMessages()
    const timer = setInterval(fetchTripMessages, 10000)
    return () => {
      isMounted = false
      clearInterval(timer)
    }
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
            RIDE NOT AVAILABLE
          </span>

          <h1>This ride is no longer available.</h1>

          <p>
            The ride may have been fulfilled, departed, or cancelled by the driver.
          </p>

          <Link
            to="/"
            className="details-primary-button"
          >
            <ArrowLeft size={16} />
            <span>Back to search</span>
          </Link>
        </div>
      </div>
    )
  }

  const driverInitial = ride.driver?.full_name ? ride.driver.full_name[0].toUpperCase() : 'D'

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
            <ArrowLeft size={15} />
            <span>Back to results</span>
          </Link>

          <p className="details-eyebrow">
            TRIP OVERVIEW
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
                  ROUTE ITINERARY
                </span>
                <h2>Trip information</h2>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {ride.is_women_only && (
                  <span
                    style={{
                      padding: '4px 12px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 800,
                      background: '#faf5ff',
                      color: '#9333ea',
                      border: '1px solid #e9d5ff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Sparkles size={12} />
                    <span>Women-Only</span>
                  </span>
                )}
                <span className="status-badge">
                  {ride.status}
                </span>
              </div>
            </div>

            {ride.is_women_only && (
              <div
                style={{
                  background: '#faf5ff',
                  border: '1px solid #e9d5ff',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  marginTop: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: '#f3e8ff',
                    color: '#9333ea',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Sparkles size={18} />
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: '13px', color: '#6b21a8' }}>
                    Women's Verified Safety Ride
                  </strong>
                  <span style={{ fontSize: '12.5px', color: '#7e22ce' }}>
                    This trip is driver-designated for female riders. Only verified female passengers may book seats.
                  </span>
                </div>
              </div>
            )}

            <div className="journey-route">
              <div className="journey-stop">
                <span className="journey-dot" />
                <div>
                  <small>DEPARTURE</small>
                  <strong>{formatTime(ride.departure_at)}</strong>
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
                  <p>Destination drop-off</p>
                </div>
              </div>
            </div>
          </div>

          <div className="information-card">
            <span className="details-section-label">
              TRIP SPECS
            </span>

            <h2>Ride details</h2>

            <div className="information-grid">
              <div>
                <span className="info-icon">
                  <IndianRupee size={16} />
                </span>
                <div>
                  <small>PRICE PER SEAT</small>
                  <strong>₹{formatPrice(ride.price_per_seat)}</strong>
                </div>
              </div>

              <div>
                <span className="info-icon">
                  <Users size={16} />
                </span>
                <div>
                  <small>SEATS AVAILABLE</small>
                  <strong>{ride.available_seats} remaining</strong>
                </div>
              </div>

              <div>
                <span className="info-icon">
                  <ShieldCheck size={16} />
                </span>
                <div>
                  <small>STATUS</small>
                  <strong>{ride.status}</strong>
                </div>
              </div>

              <div>
                <span className="info-icon">
                  <Car size={16} />
                </span>
                <div>
                  <small>VEHICLE</small>
                  <strong>
                    {ride.vehicle
                      ? `${ride.vehicle.make} ${ride.vehicle.model}`
                      : 'Vehicle information'}
                  </strong>
                  {ride.vehicle && (
                    <span style={{ display: 'block', color: '#64748b', fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, marginTop: '2px' }}>
                      {ride.vehicle.registration_number}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="information-card">
            <span className="details-section-label">COMMUNITY HOST</span>
            <h2>Driver Profile</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '16px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0b1324 0%, #0f172a 100%)',
                  color: '#a9dfc6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '18px',
                  border: '2px solid #e2e8f0',
                  flexShrink: 0,
                }}
              >
                {driverInitial}
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
                  <strong style={{ fontSize: '16px', color: '#0f172a', fontWeight: 800 }}>
                    {ride.driver?.full_name || 'Verified RIDEX Driver'}
                  </strong>
                  {driverRating && driverRating.count > 0 && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#fef3c7',
                        color: '#92400e',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 800,
                        border: '1px solid #fde68a',
                      }}
                    >
                      <Star size={12} className="fill-amber-500 text-amber-500" />
                      {driverRating.average.toFixed(1)} ({driverRating.count})
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontSize: '12.5px',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginTop: '2px',
                  }}
                >
                  <ShieldCheck size={13} style={{ color: '#059669' }} />
                  <span>Verified community driver • Active account</span>
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
                'No special notes provided by the host for this journey.'}
            </p>
          </div>

          {user?.id === ride.driver_id && (
            <div
              className="passenger-manifest-card"
              style={{
                background: '#ffffff',
                borderRadius: '18px',
                padding: '24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.04)',
                marginBottom: '24px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                  borderBottom: '1px solid #f1f5f9',
                  paddingBottom: '12px',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div>
                  <span className="details-section-label">PASSENGER MANIFEST</span>
                  <h2 style={{ fontSize: '18px', color: '#0f172a', fontWeight: 800, margin: '4px 0 2px' }}>
                    Who Booked Your Vehicle ({driverBookings.length})
                  </h2>
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
                    Review rider details, reserved seat counts, and traveler contact details
                  </p>
                </div>
                <span
                  style={{
                    background: '#f8fafc',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    color: '#334155',
                    border: '1px solid #e2e8f0',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Users size={14} style={{ color: '#059669' }} />
                  <span>
                    {driverBookings
                      .filter((b) => b.status === 'confirmed' || b.status === 'completed')
                      .reduce((acc, b) => acc + b.seats_booked, 0)}{' '}
                    Total Seats Reserved
                  </span>
                </span>
              </div>

              {isLoadingDriverBookings ? (
                <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                  <Clock size={20} style={{ animation: 'spin 1.5s linear infinite', margin: '0 auto 8px', display: 'block' }} />
                  <span>Loading passenger bookings...</span>
                </div>
              ) : driverBookings.length === 0 ? (
                <div
                  style={{
                    padding: '36px 20px',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px dashed #cbd5e1',
                    textAlign: 'center',
                    color: '#64748b',
                  }}
                >
                  <Users size={28} style={{ color: '#94a3b8', margin: '0 auto 8px', display: 'block' }} />
                  <strong style={{ display: 'block', color: '#1e293b', fontSize: '14px', marginBottom: '4px' }}>
                    No bookings yet
                  </strong>
                  <p style={{ margin: 0, fontSize: '12.5px' }}>
                    When riders reserve seats for this trip, their names, seats booked, and verified contact details will appear here.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {driverBookings.map((booking) => {
                    const riderName =
                      booking.rider?.full_name ||
                      (booking.rider?.email ? booking.rider.email.split('@')[0] : 'Passenger')
                    const riderInitial = (riderName[0] || 'P').toUpperCase()
                    const isConfirmed = booking.status === 'confirmed'
                    const isCancelled = booking.status === 'cancelled'

                    return (
                      <div
                        key={booking.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '14px',
                          padding: '16px 20px',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          background: '#ffffff',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div
                            style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #0b1324 0%, #0f172a 100%)',
                              color: '#a9dfc6',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '16px',
                              flexShrink: 0,
                            }}
                          >
                            {riderInitial}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <strong style={{ fontSize: '15px', color: '#0f172a' }}>
                                {riderName}
                              </strong>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '999px',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  background: isConfirmed ? '#ecfdf5' : isCancelled ? '#fef2f2' : '#eff6ff',
                                  color: isConfirmed ? '#065f46' : isCancelled ? '#991b1b' : '#1d4ed8',
                                  border: `1px solid ${
                                    isConfirmed ? '#a7f3d0' : isCancelled ? '#fecaca' : '#bfdbfe'
                                  }`,
                                }}
                              >
                                {booking.status}
                              </span>
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                fontSize: '12.5px',
                                color: '#64748b',
                                marginTop: '4px',
                                flexWrap: 'wrap',
                              }}
                            >
                              {booking.rider?.email && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <Mail size={13} style={{ color: '#94a3b8' }} />
                                  <span>{booking.rider.email}</span>
                                </span>
                              )}
                              {booking.rider?.phone_number && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <Phone size={13} style={{ color: '#059669' }} />
                                  <a
                                    href={`tel:${booking.rider.phone_number}`}
                                    style={{ color: '#059669', textDecoration: 'none', fontWeight: 600 }}
                                  >
                                    {booking.rider.phone_number}
                                  </a>
                                </span>
                              )}
                              <span>•</span>
                              <span>Reserved on {formatDate(booking.created_at)}</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              background: '#ecfdf5',
                              color: '#065f46',
                              fontWeight: 800,
                              fontSize: '12px',
                              marginBottom: '4px',
                            }}
                          >
                            <Users size={12} />
                            <span>
                              {booking.seats_booked} Seat{booking.seats_booked > 1 ? 's' : ''}
                            </span>
                          </span>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                            ₹{booking.total_fare}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {canChat && (
            <div
              className="trip-chat-card"
              style={{
                background: '#ffffff',
                borderRadius: '18px',
                padding: '24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.04)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                  borderBottom: '1px solid #f1f5f9',
                  paddingBottom: '12px',
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: '#059669',
                      letterSpacing: '0.12em',
                    }}
                  >
                    CO-TRAVELER CHAT
                  </span>
                  <h2 style={{ fontSize: '18px', margin: '3px 0 0', color: '#0f172a', fontWeight: 800 }}>
                    Trip Discussion
                  </h2>
                </div>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                  {tripMessages.length} {tripMessages.length === 1 ? 'message' : 'messages'}
                </span>
              </div>

              {/* Messages stream */}
              <div
                style={{
                  maxHeight: '260px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  paddingRight: '6px',
                  marginBottom: '16px',
                }}
              >
                {tripMessages.length === 0 ? (
                  <p
                    style={{
                      color: '#94a3b8',
                      fontSize: '13px',
                      textAlign: 'center',
                      margin: '20px 0',
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
                          maxWidth: '75%',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '11px',
                            color: '#64748b',
                            marginBottom: '2px',
                            textAlign: isMe ? 'right' : 'left',
                            fontWeight: 600,
                          }}
                        >
                          {isMe ? 'You' : m.sender?.full_name || 'Passenger'}
                        </div>
                        <div
                          style={{
                            padding: '10px 14px',
                            borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                            background: isMe ? '#0f172a' : '#f1f5f9',
                            color: isMe ? '#ffffff' : '#0f172a',
                            fontSize: '13.5px',
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
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={isSendingMessage || !newMessageText.trim()}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    background: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Send size={14} />
                  <span>{isSendingMessage ? 'Sending...' : 'Send'}</span>
                </button>
              </form>
            </div>
          )}
        </section>

        <aside className="booking-card">
          <div className="booking-price">
            <span>Price per seat</span>
            <strong>₹{formatPrice(ride.price_per_seat)}</strong>
          </div>

          <div className="booking-divider" />

          <div className="booking-row">
            <span>Available seats</span>
            <strong>{ride.available_seats}</strong>
          </div>

          <div className="booking-row">
            <span>Departure</span>
            <strong>{formatTime(ride.departure_at)}</strong>
          </div>

          {!isAuthenticated ? (
            <>
              <Link
                to="/login"
                className="book-ride-button"
                style={{
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <span>Sign in to book</span>
                <ArrowRight size={16} />
              </Link>
              <p className="booking-note">
                Sign in to reserve a seat on this journey.
              </p>
            </>
          ) : user?.id === ride.driver_id ? (
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>
                    Trip Host Controls
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      textTransform: 'uppercase',
                      background: ride.status === 'scheduled' ? '#ecfdf5' : ride.status === 'completed' ? '#eff6ff' : '#fef2f2',
                      color: ride.status === 'scheduled' ? '#065f46' : ride.status === 'completed' ? '#1d4ed8' : '#991b1b',
                      border: `1px solid ${ride.status === 'scheduled' ? '#a7f3d0' : ride.status === 'completed' ? '#bfdbfe' : '#fecaca'}`,
                    }}
                  >
                    {ride.status}
                  </span>
                </div>

                <div style={{ fontSize: '13px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Reserved Seats:</span>
                    <strong>
                      {driverBookings
                        .filter((b) => b.status === 'confirmed' || b.status === 'completed')
                        .reduce((acc, b) => acc + b.seats_booked, 0)}{' '}
                      seats
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Seats Left:</span>
                    <strong>{ride.available_seats} remaining</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid #e2e8f0' }}>
                    <span style={{ color: '#64748b' }}>Total Fare Volume:</span>
                    <strong style={{ color: '#059669' }}>
                      ₹
                      {driverBookings
                        .filter((b) => b.status === 'confirmed' || b.status === 'completed')
                        .reduce((acc, b) => acc + Number(b.total_fare), 0)}
                    </strong>
                  </div>
                </div>
              </div>

              {ride.status === 'scheduled' ? (
                <button
                  type="button"
                  onClick={() => {
                    setDriverCancelError(null)
                    setDriverCancelReason('')
                    setIsDriverCancelModalOpen(true)
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    background: '#fef2f2',
                    color: '#b91c1c',
                    border: '1px solid #fecaca',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <XCircle size={16} />
                  <span>Cancel This Ride</span>
                </button>
              ) : ride.status === 'cancelled' ? (
                <div
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    background: '#fef2f2',
                    color: '#991b1b',
                    fontSize: '12px',
                    fontWeight: 600,
                    textAlign: 'center',
                  }}
                >
                  This offered ride was cancelled.
                </div>
              ) : null}
            </div>
          ) : bookingSuccess ? (
            <div
              style={{
                marginTop: '16px',
                padding: '16px',
                borderRadius: '12px',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                textAlign: 'center',
              }}
            >
              <strong
                style={{
                  color: '#065f46',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '14.5px',
                  marginBottom: '6px',
                }}
              >
                <CheckCircle2 size={16} />
                <span>Booking Confirmed!</span>
              </strong>
              <p
                style={{
                  color: '#334155',
                  fontSize: '12.5px',
                  margin: '0 0 14px',
                }}
              >
                Your seats are reserved. View your itinerary in My Bookings.
              </p>
              <Link
                to="/bookings"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#059669',
                  color: '#ffffff',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: '12.5px',
                  fontWeight: 700,
                }}
              >
                <span>Go to My Bookings</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          ) : ride.available_seats === 0 ? (
            <div
              style={{
                marginTop: '16px',
                padding: '12px 14px',
                borderRadius: '10px',
                background: '#fef2f2',
                color: '#991b1b',
                border: '1px solid #fecaca',
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
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontWeight: 700,
                    fontSize: '13.5px',
                    color: '#0f172a',
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
                  borderTop: '1px solid #f1f5f9',
                  paddingTop: '12px',
                  marginBottom: '16px',
                }}
              >
                <span>Total fare</span>
                <strong style={{ fontSize: '18px', color: '#0f172a', fontWeight: 850 }}>
                  ₹{formatPrice(Number(ride.price_per_seat) * seatsToBook)}
                </strong>
              </div>

              {bookingError && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    fontSize: '12.5px',
                    marginBottom: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <XCircle size={15} />
                  <span>{bookingError}</span>
                </div>
              )}

              <button
                type="button"
                className="book-ride-button"
                onClick={handleBookSeat}
                disabled={isBooking}
              >
                <span>{isBooking ? 'Reserving seats...' : 'Confirm & Book'}</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}

          {isAuthenticated && (
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              style={{
                marginTop: '16px',
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px dashed #cbd5e1',
                background: '#f8fafc',
                color: '#64748b',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <ShieldAlert size={14} style={{ color: '#ef4444' }} />
              <span>Report Safety or Trip Issue</span>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#dc2626', letterSpacing: '0.15em' }}>
                  TRUST & SAFETY ESCALATION
                </span>
                <h3 style={{ fontSize: '20px', margin: '4px 0 0', color: '#0f172a', fontWeight: 800 }}>
                  File Safety Report
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
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

            <p style={{ color: '#64748b', fontSize: '13px', lineHeight: '1.5', margin: '0 0 18px' }}>
              Your report will be confidentially submitted to RIDEX Trust & Safety for review.
            </p>

            <form onSubmit={handleSubmitReport} style={{ display: 'grid', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '6px', letterSpacing: '0.04em' }}>
                  ISSUE CATEGORY
                </label>
                <select
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    outline: 'none',
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
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '6px', letterSpacing: '0.04em' }}>
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
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              {reportErrorMsg && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: '8px', color: '#991b1b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={16} />
                  <span>{reportErrorMsg}</span>
                </div>
              )}

              {reportSuccessMsg && (
                <div style={{ padding: '10px 14px', background: '#ecfdf5', borderRadius: '8px', color: '#065f46', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} />
                  <span>{reportSuccessMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingReport || reportDescription.trim().length < 5}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  marginTop: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <AlertTriangle size={15} />
                <span>{isSubmittingReport ? 'Submitting Report...' : 'Submit Confidential Report'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Driver Cancel Ride Modal */}
      {isDriverCancelModalOpen && (
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
          onClick={() => !isDriverCancelling && setIsDriverCancelModalOpen(false)}
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
                  {ride.origin} → {ride.destination}
                </span>
              </div>
            </div>

            <p style={{ fontSize: '13.5px', color: '#475569', lineHeight: 1.5, margin: '0 0 16px' }}>
              Are you sure you want to cancel this journey? Any passengers who reserved seats will be automatically
              cancelled, held seats will be released, and passengers will receive immediate notifications.
            </p>

            {driverCancelError && (
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
                {driverCancelError}
              </div>
            )}

            {driverCancelSuccess && (
              <div
                style={{
                  padding: '10px 14px',
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: '8px',
                  color: '#065f46',
                  fontSize: '12.5px',
                  marginBottom: '14px',
                }}
              >
                Ride cancelled successfully.
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 700,
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
                placeholder="e.g., Vehicle maintenance, schedule conflict, emergency..."
                value={driverCancelReason}
                onChange={(e) => setDriverCancelReason(e.target.value)}
                disabled={isDriverCancelling}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setIsDriverCancelModalOpen(false)}
                disabled={isDriverCancelling}
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
                onClick={handleDriverCancelRide}
                disabled={isDriverCancelling}
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
                <span>{isDriverCancelling ? 'Cancelling...' : 'Confirm Cancellation'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="ride-details-footer">
        <strong>
          RIDE<span>X</span>
        </strong>
        <span>Move together across India.</span>
      </footer>
    </div>
  )
}
