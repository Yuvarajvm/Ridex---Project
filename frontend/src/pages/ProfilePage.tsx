import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Save,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react'
import { apiClient } from '../services/apiClient'
import { useAuthStore } from '../stores/authStore'
import type { UserProfile } from '../stores/authStore'
import './auth.css'

interface UserAccountResponse {
  id: string
  email: string
  phone_number: string | null
  role: string
  status: string
  profile: UserProfile | null
  created_at: string
}

export function ProfilePage() {
  const navigate = useNavigate()
  const { user, isAuthenticated, setAuth, token } = useAuthStore()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [bio, setBio] = useState('')

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/profile' } } })
      return
    }

    let isMounted = true
    apiClient<UserAccountResponse>('/users/me')
      .then((data) => {
        if (!isMounted) return
        if (data.profile) {
          setFirstName(data.profile.first_name || '')
          setLastName(data.profile.last_name || '')
          setDisplayName(data.profile.display_name || '')
          setCity(data.profile.city || '')
          setBio(data.profile.bio || '')
        }
      })
      .catch((err) => {
        if (!isMounted) return
        setErrorMessage(err instanceof Error ? err.message : 'Could not load profile.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isAuthenticated, navigate])

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!firstName.trim()) {
      setErrorMessage('First name is required.')
      return
    }

    setIsSaving(true)

    try {
      const updatedProfile = await apiClient<UserProfile>('/users/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim() || null,
          display_name: displayName.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          bio: bio.trim() || null,
        }),
      })

      if (user && token) {
        setAuth({ ...user, profile: updatedProfile }, token)
      }

      setSuccessMessage('Profile updated successfully.')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update profile.')
    } finally {
      setIsSaving(false)
    }
  }

  const initials = (firstName ? firstName[0] : user?.email ? user.email[0] : 'U').toUpperCase()

  if (isLoading) {
    return (
      <div className="ridex-auth-page" style={{ padding: '60px 16px' }}>
        <div className="ridex-auth-card" style={{ textAlign: 'center', padding: '48px' }}>
          <Clock size={28} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Loading profile details...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="ridex-auth-page" style={{ padding: '40px 16px' }}>
      <div className="ridex-auth-card" style={{ maxWidth: '580px', width: '100%' }}>
        {/* Profile Avatar Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0b1324 0%, #0f172a 100%)',
              color: '#a9dfc6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '22px',
              boxShadow: '0 4px 12px rgba(11, 19, 36, 0.15)',
              border: '2px solid #e2e8f0',
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '22px', margin: 0, color: '#0f172a', fontWeight: 800 }}>
                {displayName || `${firstName} ${lastName}`.trim() || 'My Account'}
              </h1>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: '#ecfdf5',
                  color: '#065f46',
                  border: '1px solid #a7f3d0',
                }}
              >
                {user?.role || 'Member'}
              </span>
            </div>
            <p style={{ margin: '3px 0 0', color: '#64748b', fontSize: '13px' }}>
              Manage your personal mobility profile and travel bio
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="ridex-auth-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div
            className="ridex-auth-error"
            style={{
              background: '#ecfdf5',
              borderColor: '#a7f3d0',
              color: '#065f46',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <CheckCircle2 size={16} />
            <span>{successMessage}</span>
          </div>
        )}

        <form className="ridex-auth-form" onSubmit={handleSave}>
          <div className="ridex-form-row">
            <div className="ridex-form-group">
              <label className="ridex-form-label" htmlFor="profileFirstName">
                First name
              </label>
              <input
                id="profileFirstName"
                type="text"
                className="ridex-form-input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={isSaving}
                required
              />
            </div>

            <div className="ridex-form-group">
              <label className="ridex-form-label" htmlFor="profileLastName">
                Last name
              </label>
              <input
                id="profileLastName"
                type="text"
                className="ridex-form-input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="ridex-form-group">
            <label className="ridex-form-label" htmlFor="profileDisplayName">
              Public display name
            </label>
            <input
              id="profileDisplayName"
              type="text"
              className="ridex-form-input"
              placeholder="e.g. Yuva R."
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="ridex-form-row">
            <div className="ridex-form-group">
              <label className="ridex-form-label" htmlFor="profileCity">
                City
              </label>
              <input
                id="profileCity"
                type="text"
                className="ridex-form-input"
                placeholder="e.g. Hyderabad"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={isSaving}
              />
            </div>

            <div className="ridex-form-group">
              <label className="ridex-form-label" htmlFor="profileState">
                State
              </label>
              <input
                id="profileState"
                type="text"
                className="ridex-form-input"
                placeholder="e.g. Andhra Pradesh, Telangana"
                value={state}
                onChange={(e) => setState(e.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="ridex-form-group">
            <label className="ridex-form-label" htmlFor="profileBio">
              About you / Travel bio
            </label>
            <textarea
              id="profileBio"
              className="ridex-form-input"
              rows={3}
              placeholder="Share travel preferences or daily commute details with your community..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="ridex-form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="ridex-form-label" style={{ margin: 0 }}>
                Email address
              </label>
              <span style={{ fontSize: '11px', color: '#059669', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 700 }}>
                <ShieldCheck size={13} />
                Verified
              </span>
            </div>
            <input
              type="text"
              className="ridex-form-input"
              value={user?.email || ''}
              disabled
              style={{ background: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }}
            />
          </div>

          <button
            type="submit"
            className="ridex-auth-submit"
            disabled={isSaving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '8px',
            }}
          >
            <Save size={16} />
            <span>{isSaving ? 'Saving Changes...' : 'Save Profile'}</span>
          </button>
        </form>
      </div>
    </div>
  )
}
