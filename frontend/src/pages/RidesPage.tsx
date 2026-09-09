import {
  Link,
  useSearchParams,
} from 'react-router-dom'

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
          View ride
          <span aria-hidden="true">→</span>
        </Link>
      </div>

      <div className="ride-meta">
        <span>
          <b>{ride.available_seats}</b> seats available
        </span>

        <span>{ride.vehicle ? `${ride.vehicle.make} ${ride.vehicle.model}` : 'Car'}</span>

        <span>{ride.driver?.full_name || 'Driver'}</span>

        <span className="ride-verified">
          <span className="verified-mark">✓</span>
          Verified ride
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
      <div className="empty-icon">—</div>
      <h2>No rides found</h2>
      <p>
        We could not find a ride from {origin} to {destination}{' '}
        for this date.
      </p>

      <Link className="empty-action" to="/">
        Search another date
        <span aria-hidden="true">→</span>
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
            <p className="rides-eyebrow">RIDE RESULTS</p>

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
            <span aria-hidden="true">←</span>
            Modify search
          </Link>
        </div>
      </section>

      <main className="rides-content">
        <aside className="rides-filters">
          <div className="filter-heading">
            <h2>Filters</h2>
            <p>Refine your results</p>
          </div>

          <div className="filter-group">
            <h3>Time</h3>

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
            <h3>Seats</h3>

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
            Apply filters
          </button>
        </aside>

        <section className="rides-results">
          <div className="results-toolbar">
            <span>
              {isLoading
                ? 'Finding rides...'
                : `${resultCount} ${
                    resultCount === 1
                      ? 'ride found'
                      : 'rides found'
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
              <p>Finding available rides...</p>
            </div>
          )}

          {!isLoading && isError && (
            <div className="ride-error-state">
              <h2>Unable to load rides</h2>
              <p>
                Something went wrong while loading the
                marketplace.
              </p>

              <Link to="/" className="empty-action">
                Back to search
                <span aria-hidden="true">→</span>
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
                  <span>↗</span>
                </div>

                <div>
                  <strong>
                    Travel together. Go further.
                  </strong>

                  <p>
                    Save money, reduce emissions, and make
                    new connections.
                  </p>
                </div>

                <span className="travel-banner-side">
                  A greener, friendlier way to travel
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
          <small>Move together</small>
        </div>

        <nav>
          <a href="#about">About</a>
          <a href="#safety">Safety</a>
          <a href="#help">Help</a>
          <a href="#terms">Terms</a>
          <a href="#privacy">Privacy</a>
        </nav>
      </footer>
    </div>
  )
}