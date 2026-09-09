import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { apiClient } from '../services/apiClient'

interface PlatformStats {
  total_users: number
  total_drivers: number
  total_rides: number
  total_bookings: number
  total_payments_amount: number
  open_reports_count: number
}

interface IncidentReport {
  id: string
  reporter_id: string
  reported_user_id?: string | null
  ride_id?: string | null
  category: string
  description: string
  status: string
  admin_notes?: string | null
  resolved_by?: string | null
  resolved_at?: string | null
  created_at: string
  updated_at: string
}

export function AdminDashboardPage() {
  const { user, isAuthenticated } = useAuthStore()

  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [reports, setReports] = useState<IncidentReport[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Report resolution modal state
  const [activeReport, setActiveReport] = useState<IncidentReport | null>(null)
  const [newStatus, setNewStatus] = useState<'pending' | 'investigating' | 'resolved' | 'dismissed'>('investigating')
  const [adminNotes, setAdminNotes] = useState('')
  const [isUpdatingReport, setIsUpdatingReport] = useState(false)

  // User suspension state
  const [suspendUserId, setSuspendUserId] = useState('')
  const [suspendAction, setSuspendAction] = useState<'suspended' | 'active'>('suspended')
  const [userActionMsg, setUserActionMsg] = useState<string | null>(null)
  const [isUpdatingUser, setIsUpdatingUser] = useState(false)

  const isAdmin = isAuthenticated && user?.role === 'admin'

  useEffect(() => {
    if (!isAdmin) return

    async function loadAdminData() {
      try {
        setIsLoading(true)
        setErrorMsg('')
        const [statsData, reportsData] = await Promise.all([
          apiClient.get<PlatformStats>('/admin/stats'),
          apiClient.get<{ items: IncidentReport[]; total: number }>('/admin/reports'),
        ])
        setStats(statsData)
        setReports(reportsData.items || [])
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Could not load admin dashboard.')
      } finally {
        setIsLoading(false)
      }
    }

    loadAdminData()
  }, [isAdmin])

  async function handleUpdateReport(e: React.FormEvent) {
    e.preventDefault()
    if (!activeReport) return

    setIsUpdatingReport(true)
    try {
      const updated = await apiClient.patch<IncidentReport>(`/admin/reports/${activeReport.id}`, {
        status: newStatus,
        admin_notes: adminNotes.trim() || undefined,
      })

      setReports((prev) =>
        prev.map((r) => (r.id === activeReport.id ? { ...r, ...updated } : r)),
      )
      setActiveReport(null)

      // Refresh stats
      apiClient.get<PlatformStats>('/admin/stats').then(setStats).catch(() => {})
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update report.')
    } finally {
      setIsUpdatingReport(false)
    }
  }

  async function handleUpdateUserStatus(e: React.FormEvent) {
    e.preventDefault()
    if (!suspendUserId.trim()) return

    setIsUpdatingUser(true)
    setUserActionMsg(null)

    try {
      await apiClient.patch(`/admin/users/${suspendUserId.trim()}/status`, {
        status: suspendAction,
      })
      setUserActionMsg(`User account successfully marked as ${suspendAction}.`)
      setSuspendUserId('')
    } catch (err) {
      setUserActionMsg(err instanceof Error ? `Error: ${err.message}` : 'Operation failed.')
    } finally {
      setIsUpdatingUser(false)
    }
  }

  if (!isAdmin) {
    return (
      <div style={{ minHeight: '80vh', background: '#f5f2ea', padding: '80px 24px' }}>
        <div
          style={{
            maxWidth: '540px',
            margin: '0 auto',
            background: '#fff',
            borderRadius: '24px',
            padding: '48px 32px',
            textAlign: 'center',
            border: '1px solid #e0e2e7',
            boxShadow: '0 12px 35px rgba(31, 43, 78, 0.05)',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#a64d3d', letterSpacing: '0.15em' }}>
            RESTRICTED ACCESS
          </span>
          <h1 style={{ fontSize: '28px', color: '#17203b', margin: '14px 0 10px' }}>
            Admin Access Required
          </h1>
          <p style={{ color: '#7c8495', lineHeight: '1.6', marginBottom: '28px' }}>
            This command center is reserved for RIDEX platform administrators and trust & safety moderators.
          </p>
          <Link
            to="/"
            style={{
              display: 'inline-block',
              background: '#26345f',
              color: '#fff',
              padding: '14px 28px',
              borderRadius: '12px',
              fontWeight: 800,
              textDecoration: 'none',
            }}
          >
            Return to Marketplace →
          </Link>
        </div>
      </div>
    )
  }

  const filteredReports = reports.filter((r) =>
    statusFilter === 'all' ? true : r.status === statusFilter,
  )

  return (
    <div style={{ minHeight: '90vh', background: '#f5f2ea', color: '#17203b' }}>
      <section
        style={{
          background: 'linear-gradient(135deg, #17203b 0%, #26345f 100%)',
          color: '#fff',
          padding: '48px 24px 64px',
          borderRadius: '0 0 34px 34px',
        }}
      >
        <div style={{ maxWidth: '1140px', margin: '0 auto' }}>
          <span style={{ color: '#a9dfc6', fontSize: '11px', fontWeight: 800, letterSpacing: '0.18em' }}>
            RIDEX PLATFORM OPERATIONS
          </span>
          <h1 style={{ fontSize: 'clamp(36px, 5vw, 52px)', margin: '12px 0 8px', letterSpacing: '-0.04em' }}>
            Admin & Safety <span style={{ color: '#a9dfc6' }}>Control</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.78)', maxWidth: '640px', fontSize: '16px', margin: 0 }}>
            Real-time platform telemetry, incident moderation, safety triage, and user account lifecycle controls.
          </p>
        </div>
      </section>

      <main style={{ maxWidth: '1140px', margin: '-30px auto 60px', padding: '0 24px', display: 'grid', gap: '30px' }}>
        {/* KPI Cards */}
        {stats && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: '16px',
            }}
          >
            {[
              { label: 'REGISTERED USERS', value: stats.total_users, accent: '#26345f' },
              { label: 'ACTIVE DRIVERS', value: stats.total_drivers, accent: '#26345f' },
              { label: 'PUBLISHED RIDES', value: stats.total_rides, accent: '#26345f' },
              { label: 'TOTAL BOOKINGS', value: stats.total_bookings, accent: '#26345f' },
              { label: 'SETTLED VOLUME', value: `₹${stats.total_payments_amount.toLocaleString('en-IN')}`, accent: '#2d7a54' },
              { label: 'OPEN INCIDENTS', value: stats.open_reports_count, accent: stats.open_reports_count > 0 ? '#a64d3d' : '#2d7a54' },
            ].map((kpi, idx) => (
              <div
                key={idx}
                style={{
                  background: '#fff',
                  borderRadius: '18px',
                  padding: '22px',
                  border: '1px solid #e0e2e7',
                  boxShadow: '0 8px 24px rgba(31, 43, 78, 0.04)',
                }}
              >
                <small style={{ color: '#7c8495', fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', display: 'block' }}>
                  {kpi.label}
                </small>
                <strong style={{ fontSize: '28px', color: kpi.accent, fontWeight: 900, marginTop: '4px', display: 'block' }}>
                  {kpi.value}
                </strong>
              </div>
            ))}
          </div>
        )}

        {/* Incidents Moderation */}
        <div
          style={{
            background: '#fff',
            borderRadius: '24px',
            padding: '32px',
            border: '1px solid #e0e2e7',
            boxShadow: '0 8px 24px rgba(31, 43, 78, 0.04)',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#a9dfc6', letterSpacing: '0.15em' }}>
                INCIDENT MANAGEMENT
              </span>
              <h2 style={{ fontSize: '24px', margin: '4px 0 0', color: '#17203b' }}>
                Safety & Conduct Reports ({filteredReports.length})
              </h2>
            </div>

            {/* Filter buttons */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['all', 'pending', 'investigating', 'resolved', 'dismissed'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatusFilter(f)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: 'none',
                    background: statusFilter === f ? '#26345f' : '#f0f3f6',
                    color: statusFilter === f ? '#fff' : '#17203b',
                    fontSize: '12px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    cursor: 'pointer',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <p style={{ textAlign: 'center', color: '#7c8495', padding: '30px' }}>Loading reports...</p>
          ) : errorMsg ? (
            <div style={{ padding: '16px', background: '#fff4f1', color: '#a64d3d', borderRadius: '12px' }}>{errorMsg}</div>
          ) : filteredReports.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#7c8495' }}>
              <p style={{ fontSize: '16px', margin: '0 0 4px', fontWeight: 700 }}>No reports found in this category.</p>
              <small>All community rides are compliant.</small>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              {filteredReports.map((report) => (
                <div
                  key={report.id}
                  style={{
                    padding: '20px',
                    borderRadius: '16px',
                    border: '1px solid #edf0f5',
                    background: '#fcfdfd',
                    display: 'grid',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          background: '#f4e9e7',
                          color: '#a64d3d',
                        }}
                      >
                        {report.category}
                      </span>
                      <small style={{ color: '#7c8495', fontSize: '12px' }}>
                        Report ID: {report.id.slice(0, 8)}
                      </small>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span
                        style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          background:
                            report.status === 'resolved'
                              ? '#edf5f0'
                              : report.status === 'dismissed'
                              ? '#f0f2f5'
                              : report.status === 'investigating'
                              ? '#fff8e6'
                              : '#fff4f1',
                          color:
                            report.status === 'resolved'
                              ? '#2d7a54'
                              : report.status === 'dismissed'
                              ? '#7c8495'
                              : report.status === 'investigating'
                              ? '#b27b00'
                              : '#a64d3d',
                        }}
                      >
                        {report.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveReport(report)
                          setNewStatus(report.status as any)
                          setAdminNotes(report.admin_notes || '')
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: '1px solid #dfe2e7',
                          background: '#fff',
                          color: '#26345f',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Triage / Edit →
                      </button>
                    </div>
                  </div>

                  <p style={{ margin: 0, color: '#17203b', fontSize: '14px', lineHeight: '1.5' }}>
                    "{report.description}"
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '12px', color: '#7c8495' }}>
                    <span>Reporter: {report.reporter_id.slice(0, 8)}</span>
                    {report.reported_user_id && <span>Target User: {report.reported_user_id.slice(0, 8)}</span>}
                    {report.ride_id && (
                      <Link to={`/rides/${report.ride_id}`} style={{ color: '#26345f', fontWeight: 700 }}>
                        View Ride →
                      </Link>
                    )}
                    <span>Date: {new Date(report.created_at).toLocaleDateString('en-IN')}</span>
                  </div>

                  {report.admin_notes && (
                    <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#edf5f0', color: '#2d7a54', fontSize: '13px' }}>
                      <strong>Resolution Note:</strong> {report.admin_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User Status Management */}
        <div
          style={{
            background: '#fff',
            borderRadius: '24px',
            padding: '32px',
            border: '1px solid #e0e2e7',
            boxShadow: '0 8px 24px rgba(31, 43, 78, 0.04)',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#e98570', letterSpacing: '0.15em' }}>
            ACCOUNT LIFECYCLE
          </span>
          <h2 style={{ fontSize: '24px', margin: '4px 0 16px', color: '#17203b' }}>
            User Account Moderation
          </h2>
          <form onSubmit={handleUpdateUserStatus} style={{ display: 'grid', gap: '16px', maxWidth: '640px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#7c8495', marginBottom: '6px' }}>
                TARGET USER UUID
              </label>
              <input
                type="text"
                value={suspendUserId}
                onChange={(e) => setSuspendUserId(e.target.value)}
                placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid #dfe2e7',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 700 }}>
                <input
                  type="radio"
                  name="user_action"
                  checked={suspendAction === 'suspended'}
                  onChange={() => setSuspendAction('suspended')}
                />
                Suspend User
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 700 }}>
                <input
                  type="radio"
                  name="user_action"
                  checked={suspendAction === 'active'}
                  onChange={() => setSuspendAction('active')}
                />
                Reactivate (Active)
              </label>
            </div>

            {userActionMsg && (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  background: userActionMsg.startsWith('Error') ? '#fff4f1' : '#edf5f0',
                  color: userActionMsg.startsWith('Error') ? '#a64d3d' : '#2d7a54',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                {userActionMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isUpdatingUser || !suspendUserId.trim()}
              style={{
                width: 'fit-content',
                padding: '12px 24px',
                borderRadius: '12px',
                background: suspendAction === 'suspended' ? '#a64d3d' : '#26345f',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {isUpdatingUser ? 'Updating Account...' : `Apply Status (${suspendAction})`}
            </button>
          </form>
        </div>
      </main>

      {/* Report Triage Modal */}
      {activeReport && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(23, 32, 59, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '24px',
              padding: '36px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 20px 45px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#a9dfc6', letterSpacing: '0.15em' }}>
                  SAFETY TRIAGE
                </span>
                <h3 style={{ fontSize: '22px', margin: '4px 0 0', color: '#17203b' }}>
                  Update Incident Report
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveReport(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '22px', color: '#7c8495', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateReport} style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#7c8495', marginBottom: '6px' }}>
                  STATUS
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1px solid #dfe2e7',
                    fontSize: '14px',
                  }}
                >
                  <option value="pending">Pending</option>
                  <option value="investigating">Investigating</option>
                  <option value="resolved">Resolved</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#7c8495', marginBottom: '6px' }}>
                  ADMIN RESOLUTION NOTES
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Notes on communication, investigation findings, or disciplinary action taken..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1px solid #dfe2e7',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isUpdatingReport}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: '#26345f',
                  color: '#fff',
                  fontWeight: 850,
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  marginTop: '8px',
                }}
              >
                {isUpdatingReport ? 'Saving Updates...' : 'Save Resolution'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
