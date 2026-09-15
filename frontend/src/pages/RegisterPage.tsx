import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Users,
  Car,
  User,
  Mail,
  Phone,
  Lock,
  ArrowRight,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
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

    if (firstName.trim().length < 2) {
      setErrorMessage('First name must be at least 2 characters.')
      return
    }

    const cleanPhone = phoneNumber.trim()
    if (cleanPhone && cleanPhone.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.')
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
          last_name: lastName.trim() || undefined,
          email: email.trim(),
          password,
          role,
          phone_number: cleanPhone || undefined,
        }),
      })

      setAuth(response.user, response.access_token)
      navigate('/', { replace: true })
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not create account.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="ridex-auth-page">
      <div className="ridex-auth-card">
        <div className="ridex-auth-header">
          <span className="ridex-auth-badge">
            <Sparkles size={12} />
            <span>Join Community</span>
          </span>
          <h1 className="ridex-auth-title">Create your account</h1>
          <p className="ridex-auth-subtitle">Share verified rides, save costs, and travel safer across India</p>
        </div>

        {errorMessage && (
          <div className="ridex-auth-error">
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form className="ridex-auth-form" onSubmit={handleSubmit}>
          <div className="ridex-form-group">
            <label className="ridex-form-label">Primary Purpose</label>
            <div className="ridex-role-selector">
              <button
                type="button"
                className={`ridex-role-btn ${role === 'rider' ? 'active' : ''}`}
                onClick={() => setRole('rider')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={15} />
                  <span>Passenger</span>
                </div>
                <span className="role-hint">Find & book rides</span>
              </button>
              <button
                type="button"
                className={`ridex-role-btn ${role === 'driver' ? 'active' : ''}`}
                onClick={() => setRole('driver')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Car size={15} />
                  <span>Driver</span>
                </div>
                <span className="role-hint">Offer seats & travel</span>
              </button>
            </div>
          </div>

          <div className="ridex-form-row">
            <div className="ridex-form-group">
              <label className="ridex-form-label" htmlFor="firstName">
                First name
              </label>
              <div className="ridex-input-wrap">
                <User size={15} className="ridex-input-icon" />
                <input
                  id="firstName"
                  type="text"
                  className="ridex-form-input has-icon"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\p{L}\s'-]/gu, '')
                    setFirstName(value)
                  }}
                  maxLength={50}
                  disabled={isLoading}
                  required
                />
              </div>
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
                onChange={(e) => {
                  const value = e.target.value.replace(/[^\p{L}\s'-]/gu, '')
                  setLastName(value)
                }}
                maxLength={50}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="ridex-form-group">
            <label className="ridex-form-label" htmlFor="email">
              Email address
            </label>
            <div className="ridex-input-wrap">
              <Mail size={15} className="ridex-input-icon" />
              <input
                id="email"
                type="email"
                className="ridex-form-input has-icon"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="ridex-form-group">
            <label className="ridex-form-label" htmlFor="phone">
              Phone number (optional)
            </label>
            <div className="ridex-input-wrap">
              <Phone size={15} className="ridex-input-icon" />
              <input
                id="phone"
                type="tel"
                className="ridex-form-input has-icon"
                placeholder="10-digit mobile number"
                value={phoneNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '')
                  setPhoneNumber(value)
                }}
                maxLength={10}
                disabled={isLoading}
                autoComplete="tel"
              />
            </div>
          </div>

          <div className="ridex-form-group">
            <label className="ridex-form-label" htmlFor="password">
              Password (min 8 characters)
            </label>
            <div className="ridex-input-wrap">
              <Lock size={15} className="ridex-input-icon" />
              <input
                id="password"
                type="password"
                className="ridex-form-input has-icon"
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
          </div>

          <button
            type="submit"
            className="ridex-auth-submit"
            disabled={isLoading}
          >
            <span>{isLoading ? 'Creating account...' : 'Create account'}</span>
            <ArrowRight size={15} />
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
