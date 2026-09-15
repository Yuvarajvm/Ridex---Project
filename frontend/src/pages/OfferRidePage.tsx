import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  ArrowLeftRight,
  Car,
  Sparkles,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { apiClient } from '../services/apiClient'
import type { Ride } from '../features/rides/types'

import './offer-ride.css'

const LOCATION_OPTIONS = [
  'Nandyal',
  'Kurnool',
  'Hyderabad',
  'Bangalore',
  'Chennai',
  'Vijayawada',
  'Tirupati',
  'Kadapa',
  'Anantapur',
  'Guntur',
]

interface Vehicle {
  id: string
  vehicle_type: string
  make: string
  model: string
  color: string | null
  registration_number: string
  seat_capacity: number
  verification_status: string
}

interface VehicleListResponse {
  items: Vehicle[]
  total: number
}

export function OfferRidePage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()

  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(isAuthenticated)

  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [departureDate, setDepartureDate] = useState('')
  const [departureTime, setDepartureTime] = useState('')
  const [availableSeats, setAvailableSeats] = useState('3')
  const [pricePerSeat, setPricePerSeat] = useState('')
  const [notes, setNotes] = useState('')
  const [isWomenOnly, setIsWomenOnly] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!isAuthenticated) return

    let isMounted = true
    apiClient.get<VehicleListResponse>('/vehicles')
      .then((response) => {
        if (!isMounted) return
        const items = response.items || []
        setVehicles(items)
        if (items.length > 0) {
          setSelectedVehicleId(items[0].id)
          if (items[0].seat_capacity < 3) {
            setAvailableSeats(String(items[0].seat_capacity))
          }
        }
      })
      .catch((error) => {
        console.error('Failed to load vehicles', error)
      })
      .finally(() => {
        if (isMounted) setIsLoadingVehicles(false)
      })

    return () => {
      isMounted = false
    }
  }, [isAuthenticated])

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId)
  const maxSeats = selectedVehicle?.seat_capacity ?? 4

  function handleSwapLocations() {
    setOrigin(destination)
    setDestination(origin)
  }

  function handleVehicleChange(newVehicleId: string) {
    setSelectedVehicleId(newVehicleId)
    const veh = vehicles.find((v) => v.id === newVehicleId)
    if (veh && Number(availableSeats) > veh.seat_capacity) {
      setAvailableSeats(String(veh.seat_capacity))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    if (!selectedVehicleId) {
      setErrorMessage('Please select a registered vehicle.')
      return
    }

    if (!origin || !destination) {
      setErrorMessage('Please enter both your starting point and destination.')
      return
    }

    if (origin.trim().toLowerCase() === destination.trim().toLowerCase()) {
      setErrorMessage('Starting point and destination must be different.')
      return
    }

    if (!departureDate || !departureTime) {
      setErrorMessage('Please choose a departure date and time.')
      return
    }

    if (!pricePerSeat || Number(pricePerSeat) < 10) {
      setErrorMessage('Price per seat must be at least ₹10.')
      return
    }

    const departureAt = new Date(`${departureDate}T${departureTime}`)

    if (Number.isNaN(departureAt.getTime())) {
      setErrorMessage('Please enter a valid departure date and time.')
      return
    }

    if (departureAt <= new Date()) {
      setErrorMessage('Departure must be in the future.')
      return
    }

    setIsSubmitting(true)

    try {
      const data = await apiClient.post<Ride>('/rides', {
        vehicle_id: selectedVehicleId,
        origin: origin.trim(),
        destination: destination.trim(),
        departure_at: departureAt.toISOString(),
        available_seats: Number(availableSeats),
        price_per_seat: Number(pricePerSeat),
        is_women_only: isWomenOnly,
        notes: notes.trim() || null,
      })

      navigate(`/rides/${data.id}`)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'We could not create the ride.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="offer-ride-page">
      <section className="offer-ride-hero">
        <div className="offer-ride-hero-inner">
          <Link to="/" className="offer-back-link">
            <ArrowLeft size={16} />
            <span>Back to home</span>
          </Link>

          <div className="offer-hero-copy">
            <span className="offer-eyebrow">PUBLISH RIDE</span>
            <h1>
              You are going
              <span> somewhere.</span>
            </h1>
            <p>
              Share your journey, fill empty seats, and travel comfortably together.
            </p>
          </div>
        </div>
      </section>

      <main className="offer-ride-content">
        {!isAuthenticated ? (
          <section className="offer-form-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
            <span className="offer-section-label">AUTHENTICATION REQUIRED</span>
            <h2 style={{ marginTop: '12px', fontSize: '24px', fontWeight: 800 }}>Sign in to publish a ride</h2>
            <p style={{ color: '#64748b', maxWidth: '480px', margin: '12px auto 28px', lineHeight: '1.6', fontSize: '14.5px' }}>
              RIDEX maintains a verified mobility network. Please sign in with your account or register to offer rides.
            </p>
            <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
              <Link
                to="/login"
                className="offer-submit-button"
                style={{ textDecoration: 'none', minWidth: '150px' }}
              >
                <span>Sign In</span>
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/register"
                className="offer-submit-button"
                style={{
                  textDecoration: 'none',
                  minWidth: '150px',
                  background: 'transparent',
                  color: '#0f172a',
                  border: '1.5px solid #cbd5e1',
                }}
              >
                Register
              </Link>
            </div>
          </section>
        ) : isLoadingVehicles ? (
          <section className="offer-form-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
            <Clock size={28} style={{ margin: '0 auto 12px', color: '#94a3b8' }} />
            <p style={{ color: '#64748b', fontSize: '14px' }}>Loading your fleet information...</p>
          </section>
        ) : vehicles.length === 0 ? (
          <section className="offer-form-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
            <Car size={36} style={{ margin: '0 auto 12px', color: '#94a3b8' }} />
            <span className="offer-section-label">VEHICLE REQUIRED</span>
            <h2 style={{ marginTop: '12px', fontSize: '24px', fontWeight: 800 }}>Register a vehicle first</h2>
            <p style={{ color: '#64748b', maxWidth: '480px', margin: '12px auto 28px', lineHeight: '1.6', fontSize: '14.5px' }}>
              To offer a ride on RIDEX, you must have at least one active vehicle registered under your driver account.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Link
                to="/vehicles"
                className="offer-submit-button"
                style={{ textDecoration: 'none', minWidth: '180px' }}
              >
                <span>Go to My Vehicles</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </section>
        ) : (
          <section className="offer-form-card">
            <div className="offer-form-heading">
              <div>
                <span className="offer-section-label">TRIP DETAILS</span>
                <h2>Plan your ride</h2>
                <p>Tell passengers where, when, and in which car you are travelling.</p>
              </div>
              <span className="offer-step">Step 1 of 1</span>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '22px' }}>
                <label className="offer-field">
                  <span>SELECT VEHICLE</span>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => handleVehicleChange(e.target.value)}
                    required
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.make} {v.model} ({v.registration_number}) — {v.seat_capacity} seats capacity
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="offer-route-row">
                <label className="offer-field">
                  <span>FROM</span>
                  <input
                    list="ridex-location-options"
                    value={origin}
                    onChange={(event) => setOrigin(event.target.value)}
                    placeholder="Starting point"
                    required
                  />
                </label>

                <button
                  type="button"
                  className="offer-swap-button"
                  onClick={handleSwapLocations}
                  aria-label="Swap locations"
                  title="Swap locations"
                >
                  <ArrowLeftRight size={16} />
                </button>

                <label className="offer-field">
                  <span>TO</span>
                  <input
                    list="ridex-location-options"
                    value={destination}
                    onChange={(event) => setDestination(event.target.value)}
                    placeholder="Destination"
                    required
                  />
                </label>

                <datalist id="ridex-location-options">
                  {LOCATION_OPTIONS.map((location) => (
                    <option key={location} value={location} />
                  ))}
                </datalist>
              </div>

              <div className="offer-details-grid">
                <label className="offer-field">
                  <span>DATE</span>
                  <input
                    type="date"
                    value={departureDate}
                    onChange={(event) => setDepartureDate(event.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    required
                  />
                </label>

                <label className="offer-field">
                  <span>DEPARTURE TIME</span>
                  <input
                    type="time"
                    value={departureTime}
                    onChange={(event) => setDepartureTime(event.target.value)}
                    required
                  />
                </label>

                <label className="offer-field">
                  <span>AVAILABLE SEATS</span>
                  <select
                    value={availableSeats}
                    onChange={(event) => setAvailableSeats(event.target.value)}
                  >
                    {Array.from({ length: maxSeats }, (_, i) => i + 1).map((seats) => (
                      <option key={seats} value={seats}>
                        {seats} {seats === 1 ? 'seat' : 'seats'}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="offer-field">
                  <span>PRICE PER SEAT</span>
                  <div className="offer-price-input">
                    <span>₹</span>
                    <input
                      type="number"
                      min="10"
                      step="1"
                      value={pricePerSeat}
                      onChange={(event) => setPricePerSeat(event.target.value)}
                      placeholder="180"
                      required
                    />
                  </div>
                </label>
              </div>

              <label className="offer-field offer-notes-field">
                <span>
                  NOTES <small>OPTIONAL</small>
                </span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Luggage space, AC, stops along the way, etc."
                  rows={4}
                  maxLength={2000}
                />
              </label>

              {/* Women-Only Ride Feature Toggle */}
              <div
                style={{
                  background: isWomenOnly ? '#faf5ff' : '#f8fafc',
                  border: `1.5px solid ${isWomenOnly ? '#c084fc' : '#e2e8f0'}`,
                  borderRadius: '14px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  marginTop: '16px',
                }}
                onClick={() => setIsWomenOnly(!isWomenOnly)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: isWomenOnly ? '#f3e8ff' : '#f1f5f9',
                      color: isWomenOnly ? '#9333ea' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                        Women-Only Ride
                      </strong>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: isWomenOnly ? '#9333ea' : '#64748b',
                          color: '#ffffff',
                          textTransform: 'uppercase',
                        }}
                      >
                        {isWomenOnly ? 'Enabled' : 'Off'}
                      </span>
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                      Only verified female passengers may book seats on this trip.
                    </p>
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={isWomenOnly}
                  onChange={(e) => setIsWomenOnly(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#9333ea', cursor: 'pointer' }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {errorMessage && (
                <div className="offer-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="offer-form-footer">
                <p>
                  Your ride will be published to the RIDEX marketplace immediately for verified
                  passengers to discover.
                </p>

                <button
                  type="submit"
                  className="offer-submit-button"
                  disabled={isSubmitting}
                >
                  <span>{isSubmitting ? 'Publishing ride...' : 'Publish Ride'}</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </section>
        )}

        <aside className="offer-side-card">
          <span className="offer-section-label">COMMUNITY STANDARDS</span>
          <h2>
            Make every
            <br />
            seat count.
          </h2>

          <div className="offer-side-list">
            <div>
              <span>01</span>
              <p>Set a clear, accessible pickup point along your route.</p>
            </div>
            <div>
              <span>02</span>
              <p>Choose a realistic departure time with sufficient buffer.</p>
            </div>
            <div>
              <span>03</span>
              <p>Keep passengers updated through co-traveler chat.</p>
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}