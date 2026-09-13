import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react'
import { authService } from '../services/authService'
import { useAuthStore } from '../stores/authStore'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import './auth.css'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setAuth = useAuthStore((state) => state.setAuth)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Forgot password modal state
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [isSendingReset, setIsSendingReset] = useState(false)
  const [forgotStatusMsg, setForgotStatusMsg] = useState<string | null>(null)
  const [forgotErrorMsg, setForgotErrorMsg] = useState<string | null>(null)

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
      const response = await authService.login({
        email: email.trim(),
        password,
      })

      setAuth(response.user as any, response.access_token)
      if (response.user?.role === 'admin') {
        const dest = from && from !== '/' && from.startsWith('/admin') ? from : '/admin/dashboard'
        navigate(dest, { replace: true })
      } else {
        const dest = from && !from.startsWith('/admin') ? from : '/'
        navigate(dest, { replace: true })
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Invalid login credentials.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault()
    if (!forgotEmail.trim()) return

    setIsSendingReset(true)
    setForgotStatusMsg(null)
    setForgotErrorMsg(null)

    try {
      const res = await authService.forgotPassword(forgotEmail.trim())
      setForgotStatusMsg(
        res.message || 'If an account exists, a password reset link has been dispatched.',
      )
      setForgotEmail('')
    } catch (err) {
      setForgotErrorMsg(err instanceof Error ? err.message : 'Failed to request password reset.')
    } finally {
      setIsSendingReset(false)
    }
  }

  return (
    <div className="ridex-auth-page">
      <div className="ridex-auth-card">
        <div className="ridex-auth-header">
          <span className="ridex-auth-badge">
            <ShieldCheck size={12} />
            <span>Secure Access</span>
          </span>
          <h1 className="ridex-auth-title">Log in to RIDEX</h1>
          <p className="ridex-auth-subtitle">Access your rides, bookings, and verified profile</p>
        </div>

        {errorMessage && (
          <div className="ridex-auth-error">
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form className="ridex-auth-form" onSubmit={handleSubmit}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
              <label className="ridex-form-label" htmlFor="password">
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgotStatusMsg(null)
                  setForgotErrorMsg(null)
                  setForgotEmail(email)
                  setIsForgotModalOpen(true)
                }}
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#059669',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Forgot password?
              </button>
            </div>
            <div className="ridex-input-wrap">
              <Lock size={15} className="ridex-input-icon" />
              <input
                id="password"
                type="password"
                className="ridex-form-input has-icon"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            className="ridex-auth-submit"
            disabled={isLoading}
          >
            <span>{isLoading ? 'Signing in...' : 'Sign in'}</span>
            <ArrowRight size={15} />
          </button>
        </form>

        <div className="ridex-auth-footer">
          Don't have an account yet?
          <Link to="/register">Create an account</Link>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        title="Reset your password"
        description="Enter your registered email address to receive password recovery instructions."
        footer={
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
            <Button
              variant="outline"
              onClick={() => setIsForgotModalOpen(false)}
              disabled={isSendingReset}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleForgotPassword}
              isLoading={isSendingReset}
              disabled={!forgotEmail.trim()}
            >
              Send Reset Link
            </Button>
          </div>
        }
      >
        <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {forgotStatusMsg && (
            <div style={{ padding: '12px 14px', background: '#ecfdf5', color: '#059669', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} />
              <span>{forgotStatusMsg}</span>
            </div>
          )}

          {forgotErrorMsg && (
            <div style={{ padding: '12px 14px', background: '#fef2f2', color: '#dc2626', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>{forgotErrorMsg}</span>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '6px' }}>
              Registered Email
            </label>
            <div className="ridex-input-wrap">
              <Mail size={15} className="ridex-input-icon" />
              <input
                type="email"
                className="ridex-form-input has-icon"
                placeholder="you@example.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                disabled={isSendingReset}
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
