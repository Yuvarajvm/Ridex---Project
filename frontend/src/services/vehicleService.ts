import { apiClient } from './apiClient'
import type { Vehicle } from '../types'

export interface RegisterVehiclePayload {
  vehicle_type: 'car' | 'bike' | 'auto' | 'van'
  make: string
  model: string
  color?: string
  registration_number: string
  registration_state?: string
  seat_capacity: number
  manufacture_year?: number
}

export const vehicleService = {
  async getMyVehicles(): Promise<Vehicle[]> {
    return apiClient.get<Vehicle[]>('/vehicles/me')
  },

  async registerVehicle(payload: RegisterVehiclePayload): Promise<Vehicle> {
    return apiClient.post<Vehicle>('/vehicles', payload)
  },
}
