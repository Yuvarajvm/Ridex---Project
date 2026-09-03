import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import type {
  FormEvent,
  ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'

import './index.css'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  'http://127.0.0.1:8000/api/v1'

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

interface RideAvailabilityResponse {
  items?: Array<{
    departure_at: string
  }>
  total?: number
}

function ArrowRightIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
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

function SwapIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 6H15M15 6L12 3M15 6L12 9M16 14H5M5 14L8 11M5 14L8 17"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LocationIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M16 8.2C16 12.3 10 17 10 17S4 12.3 4 8.2C4 5.2 6.7 3 10 3C13.3 3 16 5.2 16 8.2Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle
        cx="10"
        cy="8"
        r="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="4.5"
        width="14"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M6.5 2.5V6.5M13.5 2.5V6.5M3 8H17"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function RouteIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="5"
        cy="5"
        r="2.4"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle
        cx="15"
        cy="15"
        r="2.4"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M7.5 5H11C13.2 5 14 6.2 14 8V12.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="7"
        r="3"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M2.8 16C3.3 12.9 5 11.3 8 11.3C11 11.3 12.7 12.9 13.2 16"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M13 4.8C15 5 16.2 6.3 16.2 8C16.2 9.4 15.4 10.5 14.2 11"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 2.5L16 5V9.5C16 13.3 13.5 16.8 10 18C6.5 16.8 4 13.3 4 9.5V5L10 2.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M7.5 10L9.2 11.7L12.7 8.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function formatDateKey(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-')
}

function getTodayKey(): string {
  return formatDateKey(new Date())
}

function getMonthStart(value: Date): Date {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    1,
  )
}

function isSameMonth(
  first: Date,
  second: Date,
): boolean {
  return (
    first.getFullYear() ===
      second.getFullYear() &&
    first.getMonth() ===
      second.getMonth()
  )
}

function getMonthLabel(value: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
  }).format(value)
}

function formatSelectedDate(
  value: string,
): string {
  if (!value) {
    return ''
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(
    new Date(`${value}T12:00:00`),
  )
}

function filterLocations(
  value: string,
): string[] {
  const query =
    value.trim().toLowerCase()

  if (!query) {
    return []
  }

  return LOCATION_OPTIONS
    .filter((location) =>
      location
        .toLowerCase()
        .includes(query),
    )
    .slice(0, 5)
}

export function HomePage() {
  const navigate = useNavigate()

  const todayKey =
    getTodayKey()

  const currentMonth =
    getMonthStart(new Date())

  const [origin, setOrigin] =
    useState('')

  const [destination, setDestination] =
    useState('')

  const [date, setDate] =
    useState('')

  const [
    activeLocationField,
    setActiveLocationField,
  ] = useState<
    'origin' | 'destination' | null
  >(null)

  const [
    calendarOpen,
    setCalendarOpen,
  ] = useState(false)

  const [
    calendarMonth,
    setCalendarMonth,
  ] = useState(
    () =>
      getMonthStart(
        new Date(),
      ),
  )

  const [
    availableDates,
    setAvailableDates,
  ] = useState<
    Set<string>
  >(new Set())

  const [
    availabilityLoading,
    setAvailabilityLoading,
  ] = useState(false)

  const [
    availabilityError,
    setAvailabilityError,
  ] = useState(false)

  const [
    searchError,
    setSearchError,
  ] = useState('')

  const originSuggestions =
    useMemo(
      () =>
        filterLocations(
          origin,
        ),
      [origin],
    )

  const destinationSuggestions =
    useMemo(
      () =>
        filterLocations(
          destination,
        ),
      [destination],
    )

  const isPreviousMonthDisabled =
    isSameMonth(
      calendarMonth,
      currentMonth,
    )

  useEffect(() => {
    const cleanOrigin =
      origin.trim()

    const cleanDestination =
      destination.trim()

    if (
      !cleanOrigin ||
      !cleanDestination ||
      cleanOrigin.toLowerCase() ===
        cleanDestination.toLowerCase()
    ) {
      setAvailableDates(
        new Set(),
      )

      setAvailabilityLoading(
        false,
      )

      setAvailabilityError(
        false,
      )

      return
    }

    const controller =
      new AbortController()

    async function loadAvailability() {
      setAvailabilityLoading(
        true,
      )

      setAvailabilityError(
        false,
      )

      const year =
        calendarMonth.getFullYear()

      const month =
        calendarMonth.getMonth()

      const monthStart =
        new Date(
          year,
          month,
          1,
        )

      const monthEnd =
        new Date(
          year,
          month + 1,
          0,
        )

      const params =
        new URLSearchParams()

      params.set(
        'origin',
        cleanOrigin,
      )

      params.set(
        'destination',
        cleanDestination,
      )

      params.set(
        'departure_from',
        `${formatDateKey(
          monthStart,
        )}T00:00:00`,
      )

      params.set(
        'departure_to',
        `${formatDateKey(
          monthEnd,
        )}T23:59:59`,
      )

      params.set(
        'page',
        '1',
      )

      params.set(
        'page_size',
        '100',
      )

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/rides?${params.toString()}`,
            {
              signal:
                controller.signal,
            },
          )

        if (!response.ok) {
          throw new Error(
            'Unable to load ride availability.',
          )
        }

        const data =
          (await response.json()) as RideAvailabilityResponse

        const dates =
          new Set<string>()

        for (
          const ride of
          data.items ?? []
        ) {
          const departure =
            new Date(
              ride.departure_at,
            )

          if (
            !Number.isNaN(
              departure.getTime(),
            )
          ) {
            dates.add(
              formatDateKey(
                departure,
              ),
            )
          }
        }

        setAvailableDates(
          dates,
        )
      } catch (error) {
        if (
          error instanceof
            DOMException &&
          error.name ===
            'AbortError'
        ) {
          return
        }

        setAvailableDates(
          new Set(),
        )

        setAvailabilityError(
          true,
        )
      } finally {
        if (
          !controller.signal
            .aborted
        ) {
          setAvailabilityLoading(
            false,
          )
        }
      }
    }

    void loadAvailability()

    return () =>
      controller.abort()
  }, [
    origin,
    destination,
    calendarMonth,
  ])

  function handleSearch(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    const cleanOrigin =
      origin.trim()

    const cleanDestination =
      destination.trim()

    setSearchError('')

    if (
      !cleanOrigin ||
      !cleanDestination
    ) {
      setSearchError(
        'Choose both your starting point and destination.',
      )

      return
    }

    if (
      cleanOrigin.toLowerCase() ===
      cleanDestination.toLowerCase()
    ) {
      setSearchError(
        'Starting point and destination must be different.',
      )

      return
    }

    if (!date) {
      setSearchError(
        'Choose an available travel date.',
      )

      setCalendarOpen(true)

      return
    }

    const params =
      new URLSearchParams()

    params.set(
      'origin',
      cleanOrigin,
    )

    params.set(
      'destination',
      cleanDestination,
    )

    params.set(
      'date',
      date,
    )

    navigate(
      `/rides?${params.toString()}`,
    )
  }

  function selectLocation(
    field:
      | 'origin'
      | 'destination',
    value: string,
  ) {
    if (field === 'origin') {
      setOrigin(value)
    } else {
      setDestination(value)
    }

    setActiveLocationField(
      null,
    )

    setDate('')
    setSearchError('')
    setCalendarOpen(false)
  }

  function swapLocations() {
    setOrigin(destination)
    setDestination(origin)

    setDate('')
    setSearchError('')
    setCalendarOpen(false)
  }

  function changeCalendarMonth(
    offset: number,
  ) {
    setCalendarMonth(
      (current) => {
        const nextMonth =
          new Date(
            current.getFullYear(),
            current.getMonth() +
              offset,
            1,
          )

        /*
         * Never allow navigation
         * before the current month.
         */
        if (
          nextMonth <
          currentMonth
        ) {
          return currentMonth
        }

        return nextMonth
      },
    )
  }

  function selectDate(
    value: string,
  ) {
    /*
     * Never allow a past date,
     * even if the API accidentally
     * returns one.
     */
    if (
      value < todayKey
    ) {
      return
    }

    /*
     * Only dates with actual
     * rides can be selected.
     */
    if (
      !availableDates.has(
        value,
      )
    ) {
      return
    }

    setDate(value)
    setSearchError('')
    setCalendarOpen(false)
  }

  function renderCalendarDays(): ReactNode[] {
    const year =
      calendarMonth.getFullYear()

    const month =
      calendarMonth.getMonth()

    const firstDay =
      new Date(
        year,
        month,
        1,
      )

    const daysInMonth =
      new Date(
        year,
        month + 1,
        0,
      ).getDate()

    const startingDay =
      firstDay.getDay()

    const cells: ReactNode[] =
      []

    for (
      let index = 0;
      index < startingDay;
      index += 1
    ) {
      cells.push(
        <span
          key={`empty-${index}`}
          className="ridex-calendar-day ridex-calendar-day-empty"
          aria-hidden="true"
        />,
      )
    }

    for (
      let day = 1;
      day <= daysInMonth;
      day += 1
    ) {
      const currentDate =
        new Date(
          year,
          month,
          day,
        )

      const key =
        formatDateKey(
          currentDate,
        )

      const isPast =
        key < todayKey

      const isAvailable =
        availableDates.has(
          key,
        )

      const isSelected =
        date === key

      cells.push(
        <button
          key={key}
          type="button"
          className={[
            'ridex-calendar-day',
            isAvailable
              ? 'ridex-calendar-day-available'
              : '',
            isSelected
              ? 'ridex-calendar-day-selected'
              : '',
            isPast
              ? 'ridex-calendar-day-past'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
          disabled={
            isPast ||
            !isAvailable
          }
          onClick={() =>
            selectDate(key)
          }
        >
          <span>
            {day}
          </span>

          {isAvailable && (
            <span
              className="ridex-calendar-availability-dot"
              aria-hidden="true"
            />
          )}
        </button>,
      )
    }

    return cells
  }

  return (
    <div className="ridex-home-page">
      <section className="ridex-hero">
        <div
          className="ridex-hero-grid"
          aria-hidden="true"
        />

        <div className="ridex-hero-inner">
          <div className="ridex-hero-copy">
            <div className="ridex-kicker">
              <span className="ridex-kicker-dot" />
              SHARED JOURNEYS. BETTER
              TOGETHER.
            </div>

            <h1>
              Your next ride
              <br />
              starts <em>here.</em>
            </h1>

            <p className="ridex-hero-description">
              Find people travelling your
              way, share the journey, and get
              there comfortably.
            </p>

            <div className="ridex-hero-links">
              <a href="#how-it-works">
                See how RIDEX works
                <ArrowRightIcon />
              </a>

              <span className="ridex-hero-divider" />

              <span>
                Built for everyday travel
              </span>
            </div>
          </div>

          <form
            className="ridex-search-card"
            onSubmit={handleSearch}
          >
            <div className="ridex-search-card-top">
              <div>
                <span className="ridex-search-label">
                  FIND YOUR RIDE
                </span>

                <h2>
                  Where are you going?
                </h2>
              </div>

              <div className="ridex-live-status">
                <span />
                Live marketplace
              </div>
            </div>

            <div className="ridex-route-fields">
              <div className="ridex-field-wrapper">
                <label htmlFor="ridex-origin">
                  FROM
                </label>

                <div
                  className={[
                    'ridex-input',
                    activeLocationField ===
                    'origin'
                      ? 'is-active'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <LocationIcon />

                  <input
                    id="ridex-origin"
                    value={origin}
                    placeholder="Leaving from"
                    autoComplete="off"
                    onFocus={() =>
                      setActiveLocationField(
                        'origin',
                      )
                    }
                    onChange={(event) => {
                      setOrigin(
                        event.target.value,
                      )

                      setDate('')
                      setSearchError('')

                      setActiveLocationField(
                        'origin',
                      )
                    }}
                  />
                </div>

                {activeLocationField ===
                  'origin' &&
                  originSuggestions.length >
                    0 && (
                    <div className="ridex-suggestions">
                      {originSuggestions.map(
                        (location) => (
                          <button
                            key={location}
                            type="button"
                            onMouseDown={(
                              event,
                            ) =>
                              event.preventDefault()
                            }
                            onClick={() =>
                              selectLocation(
                                'origin',
                                location,
                              )
                            }
                          >
                            <LocationIcon />

                            <span>
                              {location}
                            </span>
                          </button>
                        ),
                      )}
                    </div>
                  )}
              </div>

              <button
                type="button"
                className="ridex-swap"
                aria-label="Swap locations"
                disabled={
                  !origin &&
                  !destination
                }
                onClick={
                  swapLocations
                }
              >
                <SwapIcon />
              </button>

              <div className="ridex-field-wrapper">
                <label htmlFor="ridex-destination">
                  TO
                </label>

                <div
                  className={[
                    'ridex-input',
                    activeLocationField ===
                    'destination'
                      ? 'is-active'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <LocationIcon />

                  <input
                    id="ridex-destination"
                    value={destination}
                    placeholder="Going to"
                    autoComplete="off"
                    onFocus={() =>
                      setActiveLocationField(
                        'destination',
                      )
                    }
                    onChange={(event) => {
                      setDestination(
                        event.target.value,
                      )

                      setDate('')
                      setSearchError('')

                      setActiveLocationField(
                        'destination',
                      )
                    }}
                  />
                </div>

                {activeLocationField ===
                  'destination' &&
                  destinationSuggestions.length >
                    0 && (
                    <div className="ridex-suggestions">
                      {destinationSuggestions.map(
                        (location) => (
                          <button
                            key={location}
                            type="button"
                            onMouseDown={(
                              event,
                            ) =>
                              event.preventDefault()
                            }
                            onClick={() =>
                              selectLocation(
                                'destination',
                                location,
                              )
                            }
                          >
                            <LocationIcon />

                            <span>
                              {location}
                            </span>
                          </button>
                        ),
                      )}
                    </div>
                  )}
              </div>
            </div>

            <div className="ridex-search-bottom">
              <div className="ridex-date-field">
                <label>
                  DATE
                </label>

                <button
                  type="button"
                  className={[
                    'ridex-input',
                    'ridex-date-trigger',
                    !date
                      ? 'is-placeholder'
                      : '',
                    calendarOpen
                      ? 'is-active'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={
                    !origin.trim() ||
                    !destination.trim() ||
                    origin.trim().toLowerCase() ===
                      destination
                        .trim()
                        .toLowerCase()
                  }
                  onClick={() =>
                    setCalendarOpen(
                      (current) =>
                        !current,
                    )
                  }
                >
                  <CalendarIcon />

                  <span>
                    {date
                      ? formatSelectedDate(
                          date,
                        )
                      : 'Select travel date'}
                  </span>
                </button>

                {calendarOpen &&
                  origin.trim() &&
                  destination.trim() &&
                  origin.trim().toLowerCase() !==
                    destination
                      .trim()
                      .toLowerCase() && (
                    <div className="ridex-calendar">
                      <button
                        type="button"
                        className="calendar-close-button"
                        onClick={() =>
                          setCalendarOpen(
                            false,
                          )
                        }
                        aria-label="Close calendar"
                      >
                        ×
                      </button>

                      <div className="calendar-header">
                        <button
                          type="button"
                          className="calendar-nav-button"
                          aria-label="Previous month"
                          disabled={
                            isPreviousMonthDisabled
                          }
                          onClick={() =>
                            changeCalendarMonth(
                              -1,
                            )
                          }
                        >
                          ‹
                        </button>

                        <strong>
                          {getMonthLabel(
                            calendarMonth,
                          )}
                        </strong>

                        <button
                          type="button"
                          className="calendar-nav-button"
                          aria-label="Next month"
                          onClick={() =>
                            changeCalendarMonth(
                              1,
                            )
                          }
                        >
                          ›
                        </button>
                      </div>

                      <div className="calendar-route">
                        <span>
                          {origin}
                        </span>

                        <span>
                          →
                        </span>

                        <span>
                          {destination}
                        </span>
                      </div>

                      <div className="calendar-weekdays">
                        {[
                          'Sun',
                          'Mon',
                          'Tue',
                          'Wed',
                          'Thu',
                          'Fri',
                          'Sat',
                        ].map(
                          (day) => (
                            <span
                              key={day}
                            >
                              {day}
                            </span>
                          ),
                        )}
                      </div>

                      <div className="calendar-grid">
                        {availabilityLoading ? (
                          <div className="ridex-calendar-loading">
                            Checking available
                            rides...
                          </div>
                        ) : (
                          renderCalendarDays()
                        )}
                      </div>

                      <div className="calendar-footer">
                        {availabilityLoading && (
                          <span>
                            Checking rides...
                          </span>
                        )}

                        {!availabilityLoading &&
                          availabilityError && (
                            <span>
                              Availability
                              temporarily
                              unavailable
                            </span>
                          )}

                        {!availabilityLoading &&
                          !availabilityError &&
                          availableDates.size >
                            0 && (
                            <span className="calendar-legend">
                              <span className="calendar-legend-dot" />
                              Rides available
                            </span>
                          )}

                        {!availabilityLoading &&
                          !availabilityError &&
                          availableDates.size ===
                            0 && (
                            <span>
                              No rides this month
                            </span>
                          )}
                      </div>
                    </div>
                  )}
              </div>

              <button
                type="submit"
                className="ridex-search-button"
                disabled={
                  !origin.trim() ||
                  !destination.trim() ||
                  origin.trim().toLowerCase() ===
                    destination
                      .trim()
                      .toLowerCase()
                }
              >
                Search rides
                <ArrowRightIcon />
              </button>
            </div>

            {searchError && (
              <div className="ridex-search-error">
                {searchError}
              </div>
            )}
          </form>
        </div>

        <div className="ridex-hero-bottom">
          <span>
            RIDEX / 01
          </span>

          <span>
            MOVE TOGETHER
          </span>
        </div>
      </section>

      <section
        id="how-it-works"
        className="ridex-how-section"
      >
        <div className="ridex-section-inner">
          <div className="ridex-section-heading">
            <div>
              <span className="ridex-section-label">
                HOW IT WORKS
              </span>

              <h2>
                Simple travel.
                <br />
                <em>
                  Better together.
                </em>
              </h2>
            </div>

            <p>
              RIDEX connects riders and
              drivers travelling in the same
              direction, making everyday
              journeys more practical.
            </p>
          </div>

          <div className="ridex-feature-grid">
            <article className="ridex-feature-card">
              <span className="ridex-feature-number">
                01
              </span>

              <div className="ridex-feature-icon">
                <RouteIcon />
              </div>

              <h3>
                Find your route
              </h3>

              <p>
                Search real rides by route
                and available travel date.
              </p>
            </article>

            <article className="ridex-feature-card">
              <span className="ridex-feature-number">
                02
              </span>

              <div className="ridex-feature-icon">
                <UsersIcon />
              </div>

              <h3>
                Share the journey
              </h3>

              <p>
                Travel with people heading
                in the same direction.
              </p>
            </article>

            <article className="ridex-feature-card">
              <span className="ridex-feature-number">
                03
              </span>

              <div className="ridex-feature-icon">
                <ShieldIcon />
              </div>

              <h3>
                Ride with confidence
              </h3>

              <p>
                Clear ride information makes
                every decision easier.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="ridex-trust-section">
        <div className="ridex-trust-inner">
          <div className="ridex-trust-copy">
            <span className="ridex-section-label">
              WHY RIDEX
            </span>

            <h2>
              Less empty seats.
              <br />
              <em>
                More ways forward.
              </em>
            </h2>

            <p>
              One platform for finding rides,
              offering rides and moving
              together.
            </p>
          </div>

          <div className="ridex-trust-items">
            <div className="ridex-trust-item">
              <div className="ridex-trust-icon">
                <RouteIcon />
              </div>

              <div>
                <h3>
                  Route-first discovery
                </h3>

                <p>
                  Search around the journey
                  you actually want to make.
                </p>
              </div>
            </div>

            <div className="ridex-trust-item">
              <div className="ridex-trust-icon">
                <UsersIcon />
              </div>

              <div>
                <h3>
                  Shared travel
                </h3>

                <p>
                  Match with people travelling
                  your way.
                </p>
              </div>
            </div>

            <div className="ridex-trust-item">
              <div className="ridex-trust-icon">
                <ShieldIcon />
              </div>

              <div>
                <h3>
                  Clear information
                </h3>

                <p>
                  Know the route, date, seats
                  and price before continuing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ridex-driver-section">
        <div className="ridex-driver-inner">
          <div>
            <span className="ridex-section-label">
              FOR DRIVERS
            </span>

            <h2>
              Have an empty seat?
              <br />
              <em>
                Put it to work.
              </em>
            </h2>
          </div>

          <a
            className="ridex-driver-button"
            href="/offer-ride"
          >
            Offer a ride
            <ArrowRightIcon />
          </a>
        </div>
      </section>

      <footer className="ridex-home-footer">
        <div className="ridex-footer-brand">
          RIDEX
        </div>

        <div className="ridex-footer-center">
          Move together. Go further.
        </div>

        <div className="ridex-footer-right">
          © 2026 RIDEX
        </div>
      </footer>
    </div>
  )
}