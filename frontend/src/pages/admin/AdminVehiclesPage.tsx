import React, { useState, useEffect, useCallback } from 'react'
import {
  Car,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Calendar,
  AlertTriangle,
} from 'lucide-react'
import { adminService } from '../../services/adminService'
import type { AdminVehicleItem } from '../../types'

export const AdminVehiclesPage: React.FC = () => {
  const [vehicles, setVehicles] = useState<AdminVehicleItem[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null)

  // Rejection modal state
  const [rejectingVehicle, setRejectingVehicle] = useState<AdminVehicleItem | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const loadVehicles = useCallback(async (filter: string) => {
    try {
      setIsLoading(true)
      setErrorMsg('')
      const data = await adminService.getVehicles({
        status: filter === 'all' ? undefined : filter,
      })
      setVehicles(data.items || [])
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch vehicles.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    adminService.getVehicles({ status: statusFilter === 'all' ? undefined : statusFilter })
      .then((data) => {
        if (isMounted) {
          setVehicles(data.items || [])
          setErrorMsg('')
        }
      })
      .catch((err) => {
        if (isMounted) {
          setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch vehicles.')
        }
      })
    return () => { isMounted = false }
  }, [statusFilter])

  async function handleApprove(vehicle: AdminVehicleItem) {
    if (!window.confirm(`Approve vehicle ${vehicle.make} ${vehicle.model} (${vehicle.registration_number})?`)) {
      return
    }

    setIsProcessing(true)
    setActionSuccessMsg(null)
    try {
      await adminService.verifyVehicle(vehicle.id, {
        verification_status: 'verified',
      })
      setActionSuccessMsg(`Vehicle ${vehicle.registration_number} has been verified and approved.`)
      loadVehicles(statusFilter)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve vehicle.')
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleConfirmReject(e: React.FormEvent) {
    e.preventDefault()
    if (!rejectingVehicle) return

    setIsProcessing(true)
    setActionSuccessMsg(null)
    try {
      await adminService.verifyVehicle(rejectingVehicle.id, {
        verification_status: 'rejected',
        rejected_reason: rejectReason.trim() || 'Documentation rejected by administrator',
      })
      setActionSuccessMsg(`Vehicle ${rejectingVehicle.registration_number} has been rejected.`)
      setRejectingVehicle(null)
      setRejectReason('')
      loadVehicles(statusFilter)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject vehicle.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>Vehicle Fleet & Verifications</h1>
          <p>Authorize or reject driver vehicle registrations before they can publish marketplace rides.</p>
        </div>
        <button
          type="button"
          className="admin-action-btn admin-btn-dark"
          onClick={() => loadVehicles(statusFilter)}
          disabled={isLoading}
        >
          <RefreshCw size={14} className={isLoading ? 'admin-spin' : ''} />
          <span>{isLoading ? 'Refreshing...' : 'Refresh Fleet'}</span>
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
            onClick={() => loadVehicles(statusFilter)}
          >
            Retry
          </button>
        </div>
      )}

      <div className="admin-card">
        <div className="admin-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Car size={18} color="#475569" />
            <h2>Registered Vehicles ({vehicles.length})</h2>
          </div>

          <div className="admin-tabs">
            {['all', 'pending', 'verified', 'rejected'].map((tab) => (
              <button
                key={tab}
                type="button"
                className={`admin-tab ${statusFilter === tab ? 'active' : ''}`}
                onClick={() => setStatusFilter(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {vehicles.length === 0 ? (
          <div className="admin-empty-state">
            <div className="admin-empty-icon">
              <Car size={32} />
            </div>
            <h3>No vehicles found</h3>
            <p>No fleet registrations matching status "{statusFilter}".</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>PLATE NUMBER</th>
                  <th>VEHICLE INFO</th>
                  <th>TYPE / SEATS</th>
                  <th>OWNER EMAIL</th>
                  <th>VERIFICATION STATUS</th>
                  <th>REGISTRATION DATE</th>
                  <th>ADMIN ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <div className="admin-plate-badge">
                        {v.registration_number}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>
                        {v.make} {v.model}
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {v.year ? `${v.year} • ` : ''}{v.color || 'Standard color'}
                      </div>
                    </td>
                    <td>
                      <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{v.vehicle_type}</span>
                      <span style={{ color: '#94a3b8', fontSize: '12px', marginLeft: '6px' }}>
                        ({v.seat_capacity} seats)
                      </span>
                    </td>
                    <td>
                      <span style={{ color: '#334155', fontWeight: 500 }}>
                        {v.owner_email || 'Unknown owner'}
                      </span>
                    </td>
                    <td>
                      <span className={`admin-pill admin-pill-${v.verification_status}`}>
                        {v.verification_status === 'verified' && <CheckCircle2 size={11} />}
                        {v.verification_status === 'pending' && <Clock size={11} />}
                        {v.verification_status === 'rejected' && <XCircle size={11} />}
                        {v.verification_status}
                      </span>
                      {v.rejected_reason && (
                        <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px', maxWidth: '220px' }}>
                          Reason: {v.rejected_reason}
                        </div>
                      )}
                    </td>
                    <td style={{ color: '#64748b', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={12} color="#94a3b8" />
                        <span>
                          {new Date(v.created_at).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {v.verification_status !== 'verified' && (
                          <button
                            type="button"
                            className="admin-action-btn admin-action-btn-approve"
                            onClick={() => handleApprove(v)}
                            disabled={isProcessing}
                          >
                            <CheckCircle2 size={13} />
                            <span>Approve</span>
                          </button>
                        )}
                        {v.verification_status !== 'rejected' && (
                          <button
                            type="button"
                            className="admin-action-btn admin-action-btn-reject"
                            onClick={() => {
                              setRejectingVehicle(v)
                              setRejectReason('')
                            }}
                            disabled={isProcessing}
                          >
                            <XCircle size={13} />
                            <span>Reject</span>
                          </button>
                        )}
                        {v.verification_status === 'verified' && (
                          <span className="admin-verified-tag">
                            <ShieldCheck size={13} />
                            <span>Verified</span>
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Reason Modal */}
      {rejectingVehicle && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ background: '#fef2f2', color: '#dc2626', padding: '8px', borderRadius: '8px' }}>
                <AlertTriangle size={20} />
              </div>
              <h3 className="admin-modal-title" style={{ margin: 0 }}>Reject Vehicle Registration</h3>
            </div>
            <p className="admin-modal-text">
              Rejecting <strong>{rejectingVehicle.make} {rejectingVehicle.model} ({rejectingVehicle.registration_number})</strong> owned by <em>{rejectingVehicle.owner_email}</em>.
            </p>

            <form onSubmit={handleConfirmReject}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '6px' }}>
                REASON FOR REJECTION (VISIBLE TO DRIVER)
              </label>
              <textarea
                className="admin-input-control"
                rows={3}
                placeholder="e.g. Expired registration document, invalid plate number, or damaged vehicle photos..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
              />

              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-action-btn admin-btn-secondary"
                  onClick={() => setRejectingVehicle(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-action-btn admin-action-btn-reject"
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
