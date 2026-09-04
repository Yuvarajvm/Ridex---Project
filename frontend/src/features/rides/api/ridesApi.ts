import type { RideListResponse } from '../types'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1'

export interface SearchRidesParams {
  origin?: string
  destination?: string
  date?: string
}

function buildSearchParams(params: SearchRidesParams): string {
  const searchParams = new URLSearchParams()

  if (params.origin) {
    searchParams.set('origin', params.origin)
  }

  if (params.destination) {
    searchParams.set('destination', params.destination)
  }

  if (params.date) {
    searchParams.set('departure_from', `${params.date}T00:00:00`)
    searchParams.set('departure_to', `${params.date}T23:59:59`)
  }

  searchParams.set('page', '1')
  searchParams.set('page_size', '20')

  return searchParams.toString()
}

export async function searchRides(
  params: SearchRidesParams,
): Promise<RideListResponse> {
  const query = buildSearchParams(params)

  const response = await fetch(`${API_BASE_URL}/rides?${query}`)

  if (!response.ok) {
    throw new Error('Unable to load rides right now.')
  }

  return response.json() as Promise<RideListResponse>
}

export interface LocationSuggestion {
  name: string
}

export interface RideAvailabilityResponse {
  origin: string
  destination: string
  month: string
  available_dates: string[]
}

export async function searchLocations(
  query: string,
): Promise<LocationSuggestion[]> {
  const params = new URLSearchParams()

  if (query.trim()) {
    params.set('query', query.trim())
  }

  const response = await fetch(
    `${API_BASE_URL}/rides/locations?${params.toString()}`,
  )

  if (!response.ok) {
    throw new Error('Unable to load locations.')
  }

  return response.json() as Promise<LocationSuggestion[]>
}

export async function getRideAvailability(
  origin: string,
  destination: string,
  month: string,
): Promise<RideAvailabilityResponse> {
  const params = new URLSearchParams({
    origin,
    destination,
    month,
  })

  const response = await fetch(
    `${API_BASE_URL}/rides/availability?${params.toString()}`,
  )

  if (!response.ok) {
    throw new Error('Unable to load ride availability.')
  }

  return response.json() as Promise<RideAvailabilityResponse>
}
