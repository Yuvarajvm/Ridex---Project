import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { apiClient } from '../services/apiClient'
import { useAuthStore } from '../stores/authStore'
import type { AuthUser } from '../stores/authStore'
import './auth.css'

interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: AuthUser
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setAuth = useAuthStore((state) => state.setAuth)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.')
      return
    }

    setIsLoading(true)

    try {
      const response = await apiClient<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      })

      setAuth(response.user, response.access_token)
      navigate(from, { replace: true })
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Invalid login credentials.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="ridex-auth-page">
      <div className="ridex-auth-card">
        <div className="ridex-auth-header">
          <span className="ridex-auth-badge">Welcome back</span>
          <h1 className="ridex-auth-title">Log in to RIDEX</h1>
          <p className="ridex-auth-subtitle">Access your rides, bookings, and profile</p>
        </div>

        {errorMessage && <div className="ridex-auth-error">{errorMessage}</div>}

        <form className="ridex-auth-form" onSubmit={handleSubmit}>
          <div className="ridex-form-group">
            <label className="ridex-form-label" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              className="ridex-form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
              autoComplete="email"
            />
          </div>

          <div className="ridex-form-group">
            <label className="ridex-form-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="ridex-form-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="ridex-auth-submit"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="ridex-auth-footer">
          Don't have an account yet?
          <Link to="/register">Create an account</Link>
        </div>
      </div>
    </div>
  )
}
