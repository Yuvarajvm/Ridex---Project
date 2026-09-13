import React, { useState, useEffect, useCallback } from 'react'
import {
  ShieldAlert,
  RefreshCw,
  AlertCircle,
  Calendar,
  ShieldCheck,
  FileText,
} from 'lucide-react'
import { adminService } from '../../services/adminService'
import type { IncidentReport } from '../../types'

export const AdminReportsPage: React.FC = () => {
  const [reports, setReports] = useState<IncidentReport[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [activeReport, setActiveReport] = useState<IncidentReport | null>(null)
  const [newStatus, setNewStatus] = useState<'pending' | 'investigating' | 'resolved' | 'dismissed'>('investigating')
  const [adminNotes, setAdminNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const loadReports = useCallback(async (status: string) => {
    try {
      setIsLoading(true)
      setErrorMsg('')
      const data = await adminService.getReports({
        status: status === 'all' ? undefined : status,
      })
      setReports(data.items || [])
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch incident reports.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    adminService.getReports({
      status: statusFilter === 'all' ? undefined : statusFilter,
    })
      .then((data) => {
        if (isMounted) {
          setReports(data.items || [])
          setErrorMsg('')
        }
      })
      .catch((err) => {
        if (isMounted) {
          setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch incident reports.')
        }
      })
    return () => { isMounted = false }
  }, [statusFilter])

  async function handleSaveResolution(e: React.FormEvent) {
    e.preventDefault()
    if (!activeReport) return

    setIsProcessing(true)
    try {
      await adminService.updateReport(activeReport.id, {
        status: newStatus,
        admin_notes: adminNotes.trim() || undefined,
      })
      setActiveReport(null)
      loadReports(statusFilter)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update report.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>Trust & Safety Incident Triage</h1>
          <p>Investigate policy violations, passenger complaints, and record official administrative resolutions.</p>
        </div>
        <button
          type="button"
          className="admin-action-btn admin-btn-dark"
          onClick={() => loadReports(statusFilter)}
          disabled={isLoading}
        >
          <RefreshCw size={14} className={isLoading ? 'admin-spin' : ''} />
          <span>{isLoading ? 'Refreshing...' : 'Refresh Reports'}</span>
        </button>
      </div>

      {errorMsg && (
        <div className="admin-alert-banner admin-alert-danger">
          <AlertCircle size={16} />
          <div style={{ flex: 1 }}>{errorMsg}</div>
          <button
            type="button"
            className="admin-action-btn"
            style={{ padding: '4px 10px', fontSize: '11px', background: '#dc2626', color: '#fff' }}
            onClick={() => loadReports(statusFilter)}
          >
            Retry
          </button>
        </div>
      )}

      <div className="admin-card">
        <div className="admin-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} color="#475569" />
            <h2>Incident Reports ({reports.length})</h2>
          </div>

          <div className="admin-tabs">
            {['all', 'pending', 'investigating', 'resolved', 'dismissed'].map((tab) => (
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

        {reports.length === 0 ? (
          <div className="admin-empty-state">
            <div className="admin-empty-icon">
              <ShieldCheck size={32} />
            </div>
            <h3>All clear</h3>
            <p>No safety incident reports matching status "{statusFilter}".</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>INCIDENT ID</th>
                  <th>CATEGORY</th>
                  <th>DESCRIPTION & NOTES</th>
                  <th>STATUS</th>
                  <th>DATE REPORTED</th>
                  <th>ADMIN ACTION</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((rep) => (
                  <tr key={rep.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#64748b' }}>
                      {rep.id.slice(0, 8)}...
                    </td>
                    <td>
                      <strong style={{ color: '#0f172a', textTransform: 'capitalize' }}>
                        {rep.category}
                      </strong>
                    </td>
                    <td style={{ maxWidth: '340px', color: '#475569' }}>
                      <div>{rep.description}</div>
                      {rep.admin_notes && (
                        <div className="admin-note-badge">
                          <FileText size={11} />
                          <span>Note: {rep.admin_notes}</span>
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`admin-pill admin-pill-${rep.status}`}>
                        <span className="admin-status-dot" />
                        {rep.status}
                      </span>
                    </td>
                    <td style={{ color: '#64748b', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={12} color="#94a3b8" />
                        <span>
                          {new Date(rep.created_at).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-action-btn admin-btn-secondary"
                        onClick={() => {
                          setActiveReport(rep)
                          setNewStatus(rep.status)
                          setAdminNotes(rep.admin_notes || '')
                        }}
                      >
                        <ShieldAlert size={13} />
                        <span>Triage</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Triage Modal */}
      {activeReport && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ background: '#eff6ff', color: '#2563eb', padding: '8px', borderRadius: '8px' }}>
                <ShieldAlert size={20} />
              </div>
              <h3 className="admin-modal-title" style={{ margin: 0 }}>Triage Incident Report</h3>
            </div>

            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', border: '1px solid #e2e8f0' }}>
              <div style={{ marginBottom: '4px' }}><strong>Category:</strong> {activeReport.category}</div>
              <div style={{ color: '#475569', lineHeight: 1.4 }}>{activeReport.description}</div>
            </div>

            <form onSubmit={handleSaveResolution}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                STATUS
              </label>
              <select
                className="admin-input-control"
                style={{ marginBottom: '14px' }}
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as any)}
              >
                <option value="pending">Pending</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
              </select>

              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                ADMIN RESOLUTION / INVESTIGATION NOTES
              </label>
              <textarea
                className="admin-input-control"
                rows={4}
                placeholder="Document findings or disciplinary actions taken..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />

              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-action-btn admin-btn-secondary"
                  onClick={() => setActiveReport(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-action-btn admin-action-btn-approve"
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Saving...' : 'Save Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
