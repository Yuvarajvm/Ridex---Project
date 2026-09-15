import {
  Link,
  useSearchParams,
} from 'react-router-dom'
import {
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  Users,
  Car,
  User,
  Navigation,
  TrendingUp,
} from 'lucide-react'

import { useSearchRides } from '../features/rides/hooks/useSearchRides'
import type { Ride } from '../features/rides/types'

import './rides.css'

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

function formatPrice(value: number | string) {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Number(value))
}

function RideCard({ ride }: { ride: Ride }) {
  return (
    <article className="ride-result-card">
      <div className="ride-main">
        <div className="ride-time-block">
          <strong>{formatTime(ride.departure_at)}</strong>
          <span>{ride.origin}</span>
          <small>{formatDate(ride.departure_at)}</small>
        </div>

        <div className="ride-route-line" aria-hidden="true">
          <span />
          <div />
          <span />
        </div>

        <div className="ride-destination-block">
          <strong>{ride.destination}</strong>
          <span>Arrival</span>
          <small>{formatDate(ride.departure_at)}</small>
        </div>

        <div className="ride-price-block">
          <span>per seat</span>
          <strong>₹{formatPrice(ride.price_per_seat)}</strong>
        </div>

        <Link
          className="ride-view-button"
          to={`/rides/${ride.id}`}
        >
          <span>View ride</span>
          <ArrowRight size={15} />
        </Link>
      </div>

      <div className="ride-meta">
        {ride.is_women_only && (
          <span
            style={{
              padding: '3px 10px',
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
            <span>Women Only</span>
          </span>
        )}

        <span>
          <Users size={13} style={{ color: '#64748b' }} />
          <span><b>{ride.available_seats}</b> seats available</span>
        </span>

        <span>
          <Car size={13} style={{ color: '#64748b' }} />
          <span>{ride.vehicle ? `${ride.vehicle.make} ${ride.vehicle.model}` : 'Car'}</span>
        </span>

        <span>
          <User size={13} style={{ color: '#64748b' }} />
          <span>{ride.driver?.full_name || 'Driver'}</span>
        </span>

        <span className="ride-verified">
          <ShieldCheck size={14} style={{ color: '#059669' }} />
          <span>Verified ride</span>
        </span>
      </div>
    </article>
  )
}

function EmptyState({
  origin,
  destination,
}: {
  origin: string
  destination: string
}) {
  return (
    <div className="ride-empty-state">
      <div className="empty-icon">
        <Navigation size={22} />
      </div>
      <h2>No rides found</h2>
      <p>
        We could not find a scheduled ride from {origin || 'origin'} to {destination || 'destination'}{' '}
        for this date. Try another date or publish an offer.
      </p>

      <Link className="empty-action" to="/">
        <span>Search another date</span>
        <ArrowRight size={15} />
      </Link>
    </div>
  )
}

export function RidesPage() {
  const [searchParams] = useSearchParams()

  const origin = searchParams.get('origin') ?? ''
  const destination = searchParams.get('destination') ?? ''
  const date = searchParams.get('date') ?? ''

  const {
    data,
    isLoading,
    isError,
  } = useSearchRides({
    origin,
    destination,
    date,
  })

  const rides = data?.items ?? []
  const resultCount = data?.total ?? rides.length

  const headingDate = date
    ? new Date(`${date}T12:00:00`)
    : undefined

  const formattedHeadingDate = headingDate
    ? new Intl.DateTimeFormat('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(headingDate)
    : 'your selected date'

  return (
    <div className="rides-page">
      <section className="rides-hero">
        <div className="rides-hero-inner">
          <div>
            <p className="rides-eyebrow">MARKETPLACE RESULTS</p>

            <h1>
              {origin || 'Any location'}
              <span> to </span>
              {destination || 'Any destination'}
            </h1>

            <p className="rides-subtitle">
              {resultCount} {resultCount === 1 ? 'ride' : 'rides'}{' '}
              available on {formattedHeadingDate}
            </p>
          </div>

          <Link className="modify-search-button" to="/">
            <ArrowLeft size={15} />
            <span>Modify search</span>
          </Link>
        </div>
      </section>

      <main className="rides-content">
        <aside className="rides-filters">
          <div className="filter-heading">
            <h2>Filters</h2>
            <p>Refine your trip results</p>
          </div>

          <div className="filter-group">
            <h3>Time of departure</h3>

            <label>
              <input type="checkbox" />
              <span>Before 6 AM</span>
            </label>

            <label>
              <input type="checkbox" />
              <span>6 AM – 12 PM</span>
            </label>

            <label>
              <input type="checkbox" />
              <span>12 PM – 6 PM</span>
            </label>

            <label>
              <input type="checkbox" />
              <span>After 6 PM</span>
            </label>
          </div>

          <div className="filter-group">
            <h3>Price range (₹)</h3>

            <div className="price-inputs">
              <input
                type="number"
                placeholder="Min"
                min="0"
              />

              <span>–</span>

              <input
                type="number"
                placeholder="Max"
                min="0"
              />
            </div>
          </div>

          <div className="filter-group">
            <h3>Seats needed</h3>

            <label>
              <input type="checkbox" />
              <span>1 seat</span>
            </label>

            <label>
              <input type="checkbox" />
              <span>2 seats</span>
            </label>

            <label>
              <input type="checkbox" />
              <span>3+ seats</span>
            </label>
          </div>

          <button
            type="button"
            className="apply-filter-button"
          >
            Apply Filters
          </button>
        </aside>

        <section className="rides-results">
          <div className="results-toolbar">
            <span>
              {isLoading
                ? 'Finding available rides...'
                : `${resultCount} ${
                    resultCount === 1
                      ? 'ride available'
                      : 'rides available'
                  }`}
            </span>

            <label className="sort-control">
              <span>Sort by</span>
              <select defaultValue="departure">
                <option value="departure">
                  Departure time (earliest)
                </option>
                <option value="price">
                  Price (lowest)
                </option>
                <option value="seats">
                  Most seats available
                </option>
              </select>
            </label>
          </div>

          {isLoading && (
            <div className="ride-loading">
              <div className="loading-bar" />
              <p>Finding available rides across the network...</p>
            </div>
          )}

          {!isLoading && isError && (
            <div className="ride-error-state">
              <h2>Unable to load rides</h2>
              <p>
                Something went wrong while connecting to the
                marketplace.
              </p>

              <Link to="/" className="empty-action">
                <ArrowLeft size={15} />
                <span>Back to search</span>
              </Link>
            </div>
          )}

          {!isLoading &&
            !isError &&
            rides.length === 0 && (
              <EmptyState
                origin={origin}
                destination={destination}
              />
            )}

          {!isLoading &&
            !isError &&
            rides.length > 0 && (
              <div className="ride-list">
                {rides.map((ride: Ride) => (
                  <RideCard
                    key={ride.id}
                    ride={ride}
                  />
                ))}
              </div>
            )}

          {!isLoading &&
            !isError &&
            rides.length > 0 && (
              <div className="travel-banner">
                <div className="travel-banner-icon">
                  <TrendingUp size={18} />
                </div>

                <div>
                  <strong>
                    Travel together. Go further.
                  </strong>

                  <p>
                    Save travel costs, reduce carbon emissions, and meet verified co-travelers.
                  </p>
                </div>

                <span className="travel-banner-side">
                  Safe, community-first mobility
                </span>
              </div>
            )}
        </section>
      </main>

      <footer className="rides-footer">
        <div>
          <strong>
            RIDE<span>X</span>
          </strong>
          <small>Move together across India</small>
        </div>

        <nav>
          <a href="#about">About</a>
          <a href="#safety">Safety</a>
          <a href="#help">Help Center</a>
          <a href="#terms">Terms</a>
          <a href="#privacy">Privacy</a>
        </nav>
      </footer>
    </div>
  )
}