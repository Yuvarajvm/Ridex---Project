/**
 * RIDEX Core Domain Types & API Contracts
 */

export type UserRole = 'rider' | 'driver' | 'admin'
export type UserStatus = 'active' | 'suspended' | 'pending_verification' | 'deactivated'
export type Gender = 'male' | 'female' | 'other'

export interface UserProfile {
  id: string
  first_name: string
  last_name?: string | null
  display_name?: string | null
  avatar_url?: string | null
  gender?: Gender | null
  city?: string | null
  bio?: string | null
}

export interface User {
  id: string
  email: string
  phone_number?: string | null
  role: UserRole
  status: UserStatus
  profile?: UserProfile | null
}

export interface Vehicle {
  id: string
  owner_id: string
  vehicle_type: 'car' | 'bike' | 'auto' | 'van'
  make: string
  model: string
  color?: string | null
  registration_number: string
  registration_state?: string | null
  seat_capacity: number
  manufacture_year?: number | null
  verification_status: 'pending' | 'verified' | 'rejected' | 'expired'
  is_active: boolean
}

export interface Ride {
  id: string
  driver_id: string
  vehicle_id: string
  origin: string
  destination: string
  departure_at: string
  available_seats: number
  price_per_seat: number
  is_women_only: boolean
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  notes?: string | null
  created_at: string
  updated_at: string
  driver?: {
    id: string
    full_name?: string | null
    avatar_url?: string | null
  }
  vehicle?: {
    id: string
    vehicle_type: string
    make: string
    model: string
    color?: string | null
    registration_number: string
    seat_capacity: number
  }
}

export interface Booking {
  id: string
  ride_id: string
  rider_id: string
  seats_booked: number
  total_fare: number
  status: 'requested' | 'confirmed' | 'rejected' | 'cancelled' | 'completed'
  cancellation_reason?: string | null
  created_at: string
  ride?: Ride
  rider?: {
    id: string
    full_name?: string | null
    email?: string | null
    phone_number?: string | null
    avatar_url?: string | null
  } | null
}

export interface IncidentReport {
  id: string
  reporter_id: string
  reported_user_id?: string | null
  ride_id?: string | null
  category: 'safety' | 'harassment' | 'conduct' | 'driving' | 'fraud' | 'other'
  description: string
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed'
  admin_notes?: string | null
  created_at: string
  resolved_at?: string | null
}

export interface AdminPlatformStats {
  // Users
  total_users: number
  active_users: number
  suspended_users: number
  total_drivers: number
  total_riders: number

  // Vehicles
  total_vehicles: number
  verified_vehicles: number
  pending_vehicles: number
  rejected_vehicles: number

  // Rides
  total_rides: number
  scheduled_rides: number
  in_progress_rides: number
  completed_rides: number
  cancelled_rides: number

  // Bookings
  total_bookings: number
  confirmed_bookings: number
  completed_bookings: number
  cancelled_bookings: number
  rejected_bookings: number

  // Financials (INR)
  total_transactions: number
  succeeded_payments: number
  failed_payments: number
  refunded_payments: number
  total_revenue: number
  total_payments_amount?: number

  // Safety
  total_reports: number
  open_reports: number
  open_reports_count?: number
  resolved_reports: number
  dismissed_reports: number
}

export interface AdminVehicleItem {
  id: string
  owner_id: string
  owner_email?: string | null
  make: string
  model: string
  year?: number | null
  color?: string | null
  registration_number: string
  vehicle_type: string
  seat_capacity: number
  verification_status: 'pending' | 'verified' | 'rejected' | 'expired'
  created_at: string
  verified_at?: string | null
  rejected_reason?: string | null
}

export interface AdminUserItem {
  id: string
  email: string
  phone_number?: string | null
  role: UserRole
  status: UserStatus
  first_name?: string | null
  last_name?: string | null
  created_at: string
}

export interface AdminRideItem {
  id: string
  driver_id: string
  driver_email?: string | null
  origin: string
  destination: string
  departure_time: string
  available_seats: number
  price_per_seat: number
  status: string
  is_women_only: boolean
  created_at: string
}

