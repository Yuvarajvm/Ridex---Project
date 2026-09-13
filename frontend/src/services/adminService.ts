import { apiClient } from './apiClient'
import type {
  AdminPlatformStats,
  AdminRideItem,
  AdminUserItem,
  AdminVehicleItem,
  IncidentReport,
  User,
} from '../types'

export interface PaginatedReports {
  items: IncidentReport[]
  total: number
  page?: number
  page_size?: number
}

export interface PaginatedVehicles {
  items: AdminVehicleItem[]
  total: number
}

export interface PaginatedUsers {
  items: AdminUserItem[]
  total: number
}

export interface PaginatedRides {
  items: AdminRideItem[]
  total: number
}

export const adminService = {
  async getStats(): Promise<AdminPlatformStats> {
    return apiClient.get<AdminPlatformStats>('/admin/stats')
  },

  async getUsers(params?: {
    role?: string
    status?: string
    search?: string
    page?: number
    page_size?: number
  }): Promise<PaginatedUsers> {
    return apiClient.get<PaginatedUsers>('/admin/users', { params })
  },

  async updateUserStatus(
    userId: string,
    payload: { status: 'active' | 'suspended' | 'pending_verification' | 'deactivated' },
  ): Promise<User> {
    return apiClient.patch<User>(`/admin/users/${userId}/status`, payload)
  },

  async getVehicles(params?: {
    status?: string
    page?: number
    page_size?: number
  }): Promise<PaginatedVehicles> {
    return apiClient.get<PaginatedVehicles>('/admin/vehicles', { params })
  },

  async verifyVehicle(
    vehicleId: string,
    payload: { verification_status: 'verified' | 'rejected'; rejected_reason?: string },
  ): Promise<AdminVehicleItem> {
    return apiClient.patch<AdminVehicleItem>(`/admin/vehicles/${vehicleId}/verification`, payload)
  },

  async getRides(params?: {
    status?: string
    page?: number
    page_size?: number
  }): Promise<PaginatedRides> {
    return apiClient.get<PaginatedRides>('/admin/rides', { params })
  },

  async cancelRide(rideId: string): Promise<any> {
    return apiClient.patch<any>(`/admin/rides/${rideId}/cancel`)
  },

  async getReports(params?: {
    status?: string
    category?: string
    page?: number
    page_size?: number
  }): Promise<PaginatedReports> {
    return apiClient.get<PaginatedReports>('/admin/reports', { params })
  },

  async updateReport(
    reportId: string,
    payload: { status: string; admin_notes?: string },
  ): Promise<IncidentReport> {
    return apiClient.patch<IncidentReport>(`/admin/reports/${reportId}`, payload)
  },
}
