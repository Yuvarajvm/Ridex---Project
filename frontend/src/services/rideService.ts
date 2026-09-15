import { apiClient } from './apiClient'
import type { Ride } from '../types'

export interface SearchRidesParams {
  origin?: string
  destination?: string
  departure_from?: string
  departure_to?: string
  page?: number
  page_size?: number
}

export interface SearchRidesResponse {
  items: Ride[]
  total: number
  page: number
  page_size: number
}

export interface CreateRidePayload {
  vehicle_id: string
  origin: string
  destination: string
  departure_at: string
  available_seats: number
  price_per_seat: number
  is_women_only?: boolean
  notes?: string
}

export interface LocationSuggestion {
  name: string
}

export interface AvailabilityResponse {
  origin: string
  destination: string
  month: string
  dates: string[]
}

export const rideService = {
  async searchRides(params: SearchRidesParams): Promise<SearchRidesResponse> {
    return apiClient.get<SearchRidesResponse>('/rides', { params })
  },

  async getRide(rideId: string): Promise<Ride> {
    return apiClient.get<Ride>(`/rides/${rideId}`)
  },

  async createRide(payload: CreateRidePayload): Promise<Ride> {
    return apiClient.post<Ride>('/rides', payload)
  },

  async updateRideStatus(
    rideId: string,
    status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled',
  ): Promise<Ride> {
    return apiClient.patch<Ride>(`/rides/${rideId}/status`, { status })
  },

  async searchLocations(query: string): Promise<LocationSuggestion[]> {
    return apiClient.get<LocationSuggestion[]>('/rides/locations', {
      params: { query },
    })
  },

  async getAvailableDates(
    origin: string,
    destination: string,
    month?: string,
  ): Promise<AvailabilityResponse> {
    return apiClient.get<AvailabilityResponse>('/rides/availability', {
      params: { origin, destination, month },
    })
  },

  async getMyOfferedRides(page = 1, pageSize = 20): Promise<SearchRidesResponse> {
    return apiClient.get<SearchRidesResponse>('/rides/my', {
      params: { page, page_size: pageSize },
    })
  },

  async getRideBookings(rideId: string, page = 1, pageSize = 50): Promise<{ items: any[]; total: number }> {
    return apiClient.get<{ items: any[]; total: number }>(`/rides/${rideId}/bookings`, {
      params: { page, page_size: pageSize },
    })
  },

  async cancelOfferedRide(rideId: string, reason?: string): Promise<Ride> {
    return apiClient.post<Ride>(`/rides/${rideId}/cancel`, { reason })
  },
}
