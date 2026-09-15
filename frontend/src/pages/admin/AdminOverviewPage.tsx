import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Users,
  Car,
  Navigation,
  CheckCircle2,
  TrendingUp,
  ShieldAlert,
} from 'lucide-react'
import { adminService } from '../../services/adminService'
import type { AdminPlatformStats } from '../../types'

export const AdminOverviewPage: React.FC = () => {
  const [stats, setStats] = useState<AdminPlatformStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const loadStats = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMsg('')
      const data = await adminService.getStats()
      setStats(data)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load telemetry stats.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    adminService.getStats()
      .then((res) => { if (isMounted) setStats(res) })
      .catch((err) => { if (isMounted) setErrorMsg(err instanceof Error ? err.message : 'Failed to load stats.') })
    return () => { isMounted = false }
  }, [])

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>Platform Overview & Telemetry</h1>
          <p>Real-time PostgreSQL aggregates across all active RIDEX modules. Zero mock data.</p>
        </div>
        <button
          type="button"
          className="admin-action-btn admin-btn-dark"
          onClick={loadStats}
          disabled={isLoading}
        >
          <RefreshCw size={14} className={isLoading ? 'admin-spin' : ''} />
          <span>{isLoading ? 'Refreshing...' : 'Refresh Data'}</span>
        </button>
      </div>

      {errorMsg && (
        <div className="admin-alert-banner admin-alert-danger">
          <AlertTriangle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Action banner if pending vehicles exist */}
      {(stats?.pending_vehicles ?? 0) > 0 && (
        <div className="admin-pending-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="admin-banner-icon-warning">
              <AlertTriangle size={20} />
            </div>
            <div>
              <strong style={{ color: '#92400e', fontSize: '14px', display: 'block' }}>
                {stats?.pending_vehicles} Vehicle Registration{stats?.pending_vehicles === 1 ? '' : 's'} Awaiting Verification
              </strong>
              <span style={{ color: '#b45309', fontSize: '13px' }}>
                Drivers cannot publish marketplace rides until their vehicle registration is inspected and approved.
              </span>
            </div>
          </div>
          <Link to="/admin/vehicles" style={{ textDecoration: 'none' }}>
            <button type="button" className="admin-action-btn admin-action-btn-approve">
              <span>Review Vehicles</span>
              <ArrowRight size={14} />
            </button>
          </Link>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span className="admin-stat-label">Total Users</span>
            <div className="admin-stat-icon" style={{ background: '#f1f5f9', color: '#475569' }}>
              <Users size={16} />
            </div>
          </div>
          <span className="admin-stat-number">{stats?.total_users ?? 0}</span>
          <span className="admin-stat-sub">
            {stats?.active_users ?? 0} active • {stats?.suspended_users ?? 0} suspended
          </span>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span className="admin-stat-label">Drivers</span>
            <div className="admin-stat-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <Car size={16} />
            </div>
          </div>
          <span className="admin-stat-number" style={{ color: '#2563eb' }}>
            {stats?.total_drivers ?? 0}
          </span>
          <span className="admin-stat-sub">Verified driver accounts</span>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span className="admin-stat-label">Riders</span>
            <div className="admin-stat-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
              <Users size={16} />
            </div>
          </div>
          <span className="admin-stat-number" style={{ color: '#16a34a' }}>
            {stats?.total_riders ?? 0}
          </span>
          <span className="admin-stat-sub">Registered passengers</span>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span className="admin-stat-label">Fleet Vehicles</span>
            <div className="admin-stat-icon" style={{ background: '#faf5ff', color: '#9333ea' }}>
              <Car size={16} />
            </div>
          </div>
          <span className="admin-stat-number">
            {stats?.total_vehicles ?? 0}
          </span>
          <span className="admin-stat-sub">
            {stats?.verified_vehicles ?? 0} verified • {stats?.pending_vehicles ?? 0} pending
          </span>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span className="admin-stat-label">Active Rides</span>
            <div className="admin-stat-icon" style={{ background: '#f0f9ff', color: '#0284c7' }}>
              <Navigation size={16} />
            </div>
          </div>
          <span className="admin-stat-number">
            {(stats?.scheduled_rides ?? 0) + (stats?.in_progress_rides ?? 0)}
          </span>
          <span className="admin-stat-sub">
            {stats?.total_rides ?? 0} lifetime published
          </span>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span className="admin-stat-label">Confirmed Bookings</span>
            <div className="admin-stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <span className="admin-stat-number">
            {stats?.confirmed_bookings ?? 0}
          </span>
          <span className="admin-stat-sub">
            {stats?.total_bookings ?? 0} total requests
          </span>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span className="admin-stat-label">Gross Volume</span>
            <div className="admin-stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
              <TrendingUp size={16} />
            </div>
          </div>
          <span className="admin-stat-number" style={{ color: '#059669' }}>
            ₹{(stats?.total_revenue ?? 0).toLocaleString('en-IN')}
          </span>
          <span className="admin-stat-sub">
            {stats?.succeeded_payments ?? 0} succeeded transactions
          </span>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span className="admin-stat-label">Safety Incidents</span>
            <div className="admin-stat-icon" style={{ background: (stats?.open_reports ?? 0) > 0 ? '#fffbeb' : '#f8fafc', color: (stats?.open_reports ?? 0) > 0 ? '#d97706' : '#64748b' }}>
              <ShieldAlert size={16} />
            </div>
          </div>
          <span className="admin-stat-number" style={{ color: (stats?.open_reports ?? 0) > 0 ? '#d97706' : '#0f172a' }}>
            {stats?.open_reports ?? 0}
          </span>
          <span className="admin-stat-sub">
            {stats?.total_reports ?? 0} total reported
          </span>
        </div>
      </div>

      {/* Quick Access Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        <div className="admin-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div className="admin-card-badge-icon" style={{ background: '#faf5ff', color: '#9333ea' }}>
              <Car size={18} />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Vehicle Verification</h3>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px', lineHeight: 1.5 }}>
            Review driver vehicle documents and registration details. Authorize vehicles for marketplace ride publishing.
          </p>
          <Link to="/admin/vehicles" style={{ textDecoration: 'none' }}>
            <button type="button" className="admin-action-btn admin-btn-secondary">
              <span>Manage Vehicles ({stats?.total_vehicles ?? 0})</span>
              <ArrowRight size={13} />
            </button>
          </Link>
        </div>

        <div className="admin-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div className="admin-card-badge-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <Users size={18} />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0f172a' }}>User Account Moderation</h3>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px', lineHeight: 1.5 }}>
            Inspect registered riders and drivers. Suspend malicious accounts or reactivate verified members.
          </p>
          <Link to="/admin/users" style={{ textDecoration: 'none' }}>
            <button type="button" className="admin-action-btn admin-btn-secondary">
              <span>Manage Users ({stats?.total_users ?? 0})</span>
              <ArrowRight size={13} />
            </button>
          </Link>
        </div>

        <div className="admin-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div className="admin-card-badge-icon" style={{ background: '#fffbeb', color: '#d97706' }}>
              <ShieldAlert size={18} />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Trust & Safety Triage</h3>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px', lineHeight: 1.5 }}>
            Resolve incident reports, investigate safety concerns, and record official administration resolution notes.
          </p>
          <Link to="/admin/reports" style={{ textDecoration: 'none' }}>
            <button type="button" className="admin-action-btn admin-btn-secondary">
              <span>Review Incidents ({stats?.open_reports ?? 0} open)</span>
              <ArrowRight size={13} />
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}
