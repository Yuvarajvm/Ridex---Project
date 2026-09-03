export interface Ride {
  id: string
  driver_id: string
  vehicle_id: string
  origin: string
  destination: string
  departure_at: string
  available_seats: number
  price_per_seat: string
  status: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface RideListResponse {
  items: Ride[]
  total: number
  page: number
  page_size: number
}