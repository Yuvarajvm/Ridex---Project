import { Link, useSearchParams } from 'react-router-dom'

import { useSearchRides } from '../features/rides/hooks/useSearchRides'
import type { Ride } from '../features/rides/types'
import './rides.css'

function ArrowRightIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
      <path
        d="M4 10H16M11 5L16 10L11 15"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <circle
        cx="10"
        cy="10"
        r="7"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M10 6V10L12.5 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SeatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <circle
        cx="10"
        cy="6"
        r="2.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M5.5 16C5.9 12.7 7.4 11 10 11C12.6 11 14.1 12.7 14.5 16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(value))
}

function formatPrice(value: string): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value))
}

function RideCard({ ride }: { ride: Ride }) {
  return (
    <article className="ride-card">
      <div className="ride-main">
        <div className="ride-time-column">
          <strong>{formatTime(ride.departure_at)}</strong>
          <span>{ride.origin}</span>
        </div>

        <div className="ride-route-line">
          <span className="route-dot" />
          <span className="route-stroke" />
          <span className="route-dot route-dot-end" />
        </div>

        <div className="ride-time-column destination">
          <strong>{ride.destination}</strong>
          <span>Destination</span>
        </div>
      </div>

      <div className="ride-divider" />

      <div className="ride-bottom">
        <div className="ride-meta">
          <span>
            <ClockIcon />
            {formatDate(ride.departure_at)}
          </span>

          <span>
            <SeatIcon />
            {ride.available_seats} seats
          </span>
        </div>

        <div className="ride-price">
          <small>per seat</small>
          <strong>{formatPrice(ride.price_per_seat)}</strong>
        </div>

        <Link className="ride-view-button" to={`/rides/${ride.id}`}>
          View ride
          <ArrowRightIcon />
        </Link>
      </div>
    </article>
  )
}

function LoadingCard() {
  return (
    <div className="ride-card skeleton-card">
      <div className="skeleton skeleton-route" />
      <div className="skeleton-divider" />
      <div className="skeleton skeleton-bottom" />
    </div>
  )
}

export function RidesPage() {
  const [searchParams] = useSearchParams()

  const origin = searchParams.get('origin') ?? ''
  const destination = searchParams.get('destination') ?? ''
  const date = searchParams.get('date') ?? ''

  const { data, isLoading, isError, refetch } = useSearchRides({
    origin: origin || undefined,
    destination: destination || undefined,
    date: date || undefined,
  })

  const title =
    origin && destination
      ? `${origin} to ${destination}`
      : 'Available rides'

  return (
    <div className="rides-page">
      <section className="rides-hero">
        <div className="rides-hero-inner">
          <Link className="back-link" to="/">
            Back to search
          </Link>

          <div className="results-heading">
            <div>
              <span className="section-label">RIDEX MARKETPLACE</span>
              <h1>{title}</h1>

              <p>
                {date
                  ? `Rides available on ${formatDate(`${date}T12:00:00`)}`
                  : 'Discover rides heading your way.'}
              </p>
            </div>

            <div className="result-count">
              <strong>{data?.total ?? 0}</strong>
              <span>rides found</span>
            </div>
          </div>
        </div>
      </section>

      <main className="results-container">
        <div className="results-toolbar">
          <span>
            {isLoading
              ? 'Finding the best rides...'
              : `${data?.total ?? 0} matching rides`}
          </span>

          <Link className="modify-search" to="/">
            Modify search
          </Link>
        </div>

        <section className="rides-list">
          {isLoading && (
            <>
              <LoadingCard />
              <LoadingCard />
              <LoadingCard />
            </>
          )}

          {isError && (
            <div className="state-card">
              <div className="state-icon">!</div>
              <h2>We couldn't load the rides.</h2>
              <p>
                The marketplace is temporarily unavailable.
                Please try again.
              </p>
              <button type="button" onClick={() => refetch()}>
                Try again
              </button>
            </div>
          )}

          {!isLoading && !isError && data?.items.length === 0 && (
            <div className="state-card">
              <div className="state-icon">R</div>
              <h2>No rides found yet.</h2>
              <p>
                Try a nearby city, another date, or broaden your
                search.
              </p>
              <Link to="/">Search again</Link>
            </div>
          )}

          {!isLoading &&
            !isError &&
            data?.items.map((ride) => (
              <RideCard key={ride.id} ride={ride} />
            ))}
        </section>
      </main>
    </div>
  )
}