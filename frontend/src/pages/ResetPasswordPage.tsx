import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import {
  Lock,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react'
import { authService } from '../services/authService'
import './auth.css'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!token) {
      setErrorMessage('Missing password reset token in URL. Please request a new link.')
      return
    }

    if (newPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.')
      return
    }

    setIsLoading(true)
    try {
      const res = await authService.resetPassword(token, newPassword)
      setSuccessMessage(res.message || 'Password reset successfully!')
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to reset password.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="ridex-auth-page">
      <div className="ridex-auth-card">
        <div className="ridex-auth-header">
          <span className="ridex-auth-badge">
            <KeyRound size={12} />
            <span>Account Security</span>
          </span>
          <h1 className="ridex-auth-title">Set new password</h1>
          <p className="ridex-auth-subtitle">Choose a strong, confidential password for your RIDEX account</p>
        </div>

        {errorMessage && (
          <div className="ridex-auth-error">
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div style={{ padding: '12px 14px', background: '#ecfdf5', color: '#059669', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <CheckCircle2 size={16} />
            <span>{successMessage} Redirecting to login...</span>
          </div>
        )}

        <form className="ridex-auth-form" onSubmit={handleSubmit}>
          <div className="ridex-form-group">
            <label className="ridex-form-label" htmlFor="newPassword">
              New Password
            </label>
            <div className="ridex-input-wrap">
              <Lock size={15} className="ridex-input-icon" />
              <input
                id="newPassword"
                type="password"
                className="ridex-form-input has-icon"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isLoading}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="ridex-form-group">
            <label className="ridex-form-label" htmlFor="confirmPassword">
              Confirm New Password
            </label>
            <div className="ridex-input-wrap">
              <Lock size={15} className="ridex-input-icon" />
              <input
                id="confirmPassword"
                type="password"
                className="ridex-form-input has-icon"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
            <span>{isLoading ? 'Updating password...' : 'Update Password'}</span>
            <ArrowRight size={15} />
          </button>
        </form>

        <div className="ridex-auth-footer">
          Remembered your credentials?
          <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
