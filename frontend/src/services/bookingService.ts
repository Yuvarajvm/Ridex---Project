import { apiClient } from './apiClient'
import type { Booking } from '../types'

export interface CreateBookingPayload {
  ride_id: string
  seats_booked: number
}

export interface BookingListResponse {
  items: Booking[]
  total: number
  page: number
  page_size: number
}

export const bookingService = {
  async createBooking(payload: CreateBookingPayload): Promise<Booking> {
    return apiClient.post<Booking>('/bookings', payload)
  },

  async getMyBookings(page = 1, pageSize = 20): Promise<BookingListResponse> {
    return apiClient.get<BookingListResponse>('/bookings/my', {
      params: { page, page_size: pageSize },
    })
  },

  async getRideBookings(rideId: string, page = 1, pageSize = 50): Promise<BookingListResponse> {
    return apiClient.get<BookingListResponse>(`/bookings/ride/${rideId}`, {
      params: { page, page_size: pageSize },
    })
  },

  async cancelBooking(bookingId: string, reason?: string): Promise<Booking> {
    return apiClient.post<Booking>(`/bookings/${bookingId}/cancel`, {
      reason,
    })
  },
}
