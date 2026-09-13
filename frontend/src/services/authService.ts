import { apiClient } from './apiClient'
import type { User } from '../types'

export interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: User
}

export interface RegisterPayload {
  email: string
  password: string
  first_name: string
  last_name?: string
  phone_number?: string
  role: 'rider' | 'driver'
}

export interface LoginPayload {
  email: string
  password: string
}

export interface MessageResponse {
  message: string
}

export const authService = {
  async register(payload: RegisterPayload): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>('/auth/register', payload)
  },

  async login(payload: LoginPayload): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>('/auth/login', payload)
  },

  async getMe(): Promise<User> {
    return apiClient.get<User>('/auth/me')
  },

  async forgotPassword(email: string): Promise<MessageResponse> {
    return apiClient.post<MessageResponse>('/auth/forgot-password', { email })
  },

  async resetPassword(token: string, new_password: string): Promise<MessageResponse> {
    return apiClient.post<MessageResponse>('/auth/reset-password', { token, new_password })
  },
}
