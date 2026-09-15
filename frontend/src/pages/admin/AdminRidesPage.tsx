import React, { useState, useEffect, useCallback } from 'react'
import {
  Navigation,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Ban,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { adminService } from '../../services/adminService'
import type { AdminRideItem } from '../../types'

export const AdminRidesPage: React.FC = () => {
  const [rides, setRides] = useState<AdminRideItem[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const loadRides = useCallback(async (status: string) => {
    try {
      setIsLoading(true)
      setErrorMsg('')
      const data = await adminService.getRides({
        status: status === 'all' ? undefined : status,
      })
      setRides(data.items || [])
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch rides.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    adminService.getRides({ status: statusFilter === 'all' ? undefined : statusFilter })
      .then((data) => {
        if (isMounted) {
          setRides(data.items || [])
          setErrorMsg('')
        }
      })
      .catch((err) => {
        if (isMounted) {
          setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch rides.')
        }
      })
    return () => { isMounted = false }
  }, [statusFilter])

  async function handleCancelRide(ride: AdminRideItem) {
    if (!window.confirm(`Cancel ride from ${ride.origin} to ${ride.destination} (driver: ${ride.driver_email})?`)) {
      return
    }

    setIsProcessing(true)
    setActionSuccessMsg(null)
    try {
      await adminService.cancelRide(ride.id)
      setActionSuccessMsg(`Ride ${ride.id} has been cancelled by administrator.`)
      loadRides(statusFilter)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel ride.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>Marketplace Rides & Oversight</h1>
          <p>Monitor intercity routes, driver fares in INR (₹), and intervene to cancel non-compliant rides.</p>
        </div>
        <button
          type="button"
          className="admin-action-btn admin-btn-dark"
          onClick={() => loadRides(statusFilter)}
          disabled={isLoading}
        >
          <RefreshCw size={14} className={isLoading ? 'admin-spin' : ''} />
          <span>{isLoading ? 'Refreshing...' : 'Refresh Rides'}</span>
        </button>
      </div>

      {actionSuccessMsg && (
        <div className="admin-alert-banner admin-alert-success">
          <CheckCircle2 size={16} />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="admin-alert-banner admin-alert-danger">
          <AlertCircle size={16} />
          <div style={{ flex: 1 }}>{errorMsg}</div>
          <button
            type="button"
            className="admin-action-btn"
            style={{ padding: '4px 10px', fontSize: '11px', background: '#dc2626', color: '#fff' }}
            onClick={() => loadRides(statusFilter)}
          >
            Retry
          </button>
        </div>
      )}

      <div className="admin-card">
        <div className="admin-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Navigation size={18} color="#475569" />
            <h2>Published Rides ({rides.length})</h2>
          </div>

          <div className="admin-tabs">
            {['all', 'scheduled', 'in_progress', 'completed', 'cancelled'].map((tab) => (
              <button
                key={tab}
                type="button"
                className={`admin-tab ${statusFilter === tab ? 'active' : ''}`}
                onClick={() => setStatusFilter(tab)}
              >
                {tab.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {rides.length === 0 ? (
          <div className="admin-empty-state">
            <div className="admin-empty-icon">
              <Navigation size={32} />
            </div>
            <h3>No rides found</h3>
            <p>No published marketplace rides matching status "{statusFilter}".</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ROUTE PATHWAY</th>
                  <th>DRIVER EMAIL</th>
                  <th>DEPARTURE TIME</th>
                  <th>AVAILABLE SEATS</th>
                  <th>PRICE / SEAT</th>
                  <th>POLICY</th>
                  <th>STATUS</th>
                  <th>ADMIN ACTION</th>
                </tr>
              </thead>
              <tbody>
                {rides.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ color: '#0f172a' }}>{r.origin}</strong>
                        <ArrowRight size={13} color="#94a3b8" />
                        <strong style={{ color: '#0f172a' }}>{r.destination}</strong>
                      </div>
                    </td>
                    <td>
                      <span style={{ color: '#334155', fontWeight: 500 }}>
                        {r.driver_email || 'Unknown driver'}
                      </span>
                    </td>
                    <td style={{ color: '#64748b', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={12} color="#94a3b8" />
                        <span>
                          {new Date(r.departure_time).toLocaleString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{r.available_seats} seats</span>
                    </td>
                    <td>
                      <strong style={{ color: '#059669', display: 'inline-flex', alignItems: 'center' }}>
                        ₹{r.price_per_seat}
                      </strong>
                    </td>
                    <td>
                      {r.is_women_only ? (
                        <span className="admin-women-tag">
                          <Sparkles size={11} />
                          <span>Women Only</span>
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>Standard</span>
                      )}
                    </td>
                    <td>
                      <span className={`admin-pill admin-pill-${r.status}`}>
                        <span className="admin-status-dot" />
                        {r.status}
                      </span>
                    </td>
                    <td>
                      {['scheduled', 'in_progress'].includes(r.status) && (
                        <button
                          type="button"
                          className="admin-action-btn admin-action-btn-cancel"
                          onClick={() => handleCancelRide(r)}
                          disabled={isProcessing}
                        >
                          <Ban size={12} />
                          <span>Cancel Ride</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
