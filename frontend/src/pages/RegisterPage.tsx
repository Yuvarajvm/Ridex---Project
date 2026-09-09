import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiClient } from '../services/apiClient'
import { useAuthStore } from '../stores/authStore'
import type { AuthUser } from '../stores/authStore'
import './auth.css'

interface RegisterResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: AuthUser
}

export function RegisterPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'rider' | 'driver'>('rider')

  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    if (!firstName.trim() || !email.trim() || !password) {
      setErrorMessage('Please fill in your name, email, and password.')
      return
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.')
      return
    }

    setIsLoading(true)

    try {
      const response = await apiClient<RegisterResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim() || null,
          email: email.trim(),
          phone_number: phoneNumber.trim() || null,
          password,
          role,
        }),
      })

      setAuth(response.user, response.access_token)
      navigate('/', { replace: true })
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Registration failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="ridex-auth-page">
      <div className="ridex-auth-card">
        <div className="ridex-auth-header">
          <span className="ridex-auth-badge">Join RIDEX</span>
          <h1 className="ridex-auth-title">Create your account</h1>
          <p className="ridex-auth-subtitle">Share rides, save costs, and travel smarter</p>
        </div>

        {errorMessage && <div className="ridex-auth-error">{errorMessage}</div>}

        <form className="ridex-auth-form" onSubmit={handleSubmit}>
          <div className="ridex-form-group">
            <label className="ridex-form-label">I want to</label>
            <div className="ridex-role-selector">
              <button
                type="button"
                className={`ridex-role-btn ${role === 'rider' ? 'active' : ''}`}
                onClick={() => setRole('rider')}
              >
                <span>Find rides</span>
                <span className="role-hint">Book seats easily</span>
              </button>
              <button
                type="button"
                className={`ridex-role-btn ${role === 'driver' ? 'active' : ''}`}
                onClick={() => setRole('driver')}
              >
                <span>Offer rides</span>
                <span className="role-hint">Share your travel</span>
              </button>
            </div>
          </div>

          <div className="ridex-form-row">
            <div className="ridex-form-group">
              <label className="ridex-form-label" htmlFor="firstName">
                First name
              </label>
              <input
                id="firstName"
                type="text"
                className="ridex-form-input"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className="ridex-form-group">
              <label className="ridex-form-label" htmlFor="lastName">
                Last name
              </label>
              <input
                id="lastName"
                type="text"
                className="ridex-form-input"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

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
            <label className="ridex-form-label" htmlFor="phone">
              Phone number (optional)
            </label>
            <input
              id="phone"
              type="tel"
              className="ridex-form-input"
              placeholder="+91 98765 43210"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={isLoading}
              autoComplete="tel"
            />
          </div>

          <div className="ridex-form-group">
            <label className="ridex-form-label" htmlFor="password">
              Password (min 8 characters)
            </label>
            <input
              id="password"
              type="password"
              className="ridex-form-input"
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            className="ridex-auth-submit"
            disabled={isLoading}
          >
            {isLoading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div className="ridex-auth-footer">
          Already have an account?
          <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
