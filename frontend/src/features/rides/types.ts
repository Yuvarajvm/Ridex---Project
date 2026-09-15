export interface RideDriver {
  id: string
  full_name?: string | null
  avatar_url?: string | null
}

export interface RideVehicle {
  id: string
  vehicle_type: string
  make: string
  model: string
  color?: string | null
  registration_number: string
  seat_capacity: number
}

export interface Ride {
  id: string
  driver_id: string
  vehicle_id: string
  origin: string
  destination: string
  departure_at: string
  available_seats: number
  price_per_seat: string | number
  is_women_only?: boolean
  status: string
  notes: string | null
  created_at: string
  updated_at: string
  driver?: RideDriver | null
  vehicle?: RideVehicle | null
}

export interface RideListResponse {
  items: Ride[]
  total: number
  page: number
  page_size: number
}