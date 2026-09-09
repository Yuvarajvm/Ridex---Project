import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
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

    async function loadProfile() {
      setIsLoading(true)
      try {
        const data = await apiClient<UserAccountResponse>('/users/me')
        if (data.profile) {
          setFirstName(data.profile.first_name || '')
          setLastName(data.profile.last_name || '')
          setDisplayName(data.profile.display_name || '')
          setCity(data.profile.city || '')
          setBio(data.profile.bio || '')
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Could not load profile.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadProfile()
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

  if (isLoading) {
    return (
      <div className="ridex-auth-page">
        <div className="ridex-auth-card" style={{ textAlign: 'center' }}>
          <p>Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="ridex-auth-page">
      <div className="ridex-auth-card" style={{ maxWidth: '560px' }}>
        <div className="ridex-auth-header">
          <span className="ridex-auth-badge">{user?.role?.toUpperCase()} ACCOUNT</span>
          <h1 className="ridex-auth-title">Your Profile</h1>
          <p className="ridex-auth-subtitle">Manage your personal mobility profile</p>
        </div>

        {errorMessage && <div className="ridex-auth-error">{errorMessage}</div>}
        {successMessage && (
          <div
            className="ridex-auth-error"
            style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' }}
          >
            {successMessage}
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
                placeholder="e.g. Telangana"
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
              placeholder="Share travel preferences or daily commute details..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="ridex-form-group">
            <label className="ridex-form-label">Email address (Verified)</label>
            <input
              type="text"
              className="ridex-form-input"
              value={user?.email || ''}
              disabled
              style={{ background: '#f0f0ee', cursor: 'not-allowed' }}
            />
          </div>

          <button
            type="submit"
            className="ridex-auth-submit"
            disabled={isSaving}
          >
            {isSaving ? 'Saving changes...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  )
}
