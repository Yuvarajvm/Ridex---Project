import { create } from 'zustand'

export interface UserProfile {
  id: string
  first_name: string
  last_name?: string | null
  display_name?: string | null
  avatar_url?: string | null
  city?: string | null
  state?: string | null
  bio?: string | null
}

export interface AuthUser {
  id: string
  email: string
  phone_number?: string | null
  role: 'rider' | 'driver' | 'admin' | string
  status: string
  profile?: UserProfile | null
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  isAuthenticated: boolean
  setAuth: (user: AuthUser, token: string) => void
  logout: () => void
}

const STORAGE_TOKEN_KEY = 'ridex_auth_token'
const STORAGE_USER_KEY = 'ridex_auth_user'

function getInitialToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_TOKEN_KEY)
}

function getInitialUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(STORAGE_USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: getInitialToken(),
  user: getInitialUser(),
  isAuthenticated: Boolean(getInitialToken()),

  setAuth: (user, token) => {
    localStorage.setItem(STORAGE_TOKEN_KEY, token)
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user))
    set({
      user,
      token,
      isAuthenticated: true,
    })
  },

  logout: () => {
    localStorage.removeItem(STORAGE_TOKEN_KEY)
    localStorage.removeItem(STORAGE_USER_KEY)
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    })
  },
}))
