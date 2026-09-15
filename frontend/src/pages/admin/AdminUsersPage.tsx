import React, { useState, useEffect, useCallback } from 'react'
import {
  Users,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  UserX,
  UserCheck,
  Shield,
  Calendar,
  Mail,
  Fingerprint,
} from 'lucide-react'
import { adminService } from '../../services/adminService'
import type { AdminUserItem } from '../../types'

export const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<AdminUserItem[]>([])
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMsg('')
      const data = await adminService.getUsers({
        role: roleFilter === 'all' ? undefined : roleFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: searchQuery.trim() || undefined,
      })
      setUsers(data.items || [])
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch users.')
    } finally {
      setIsLoading(false)
    }
  }, [roleFilter, statusFilter, searchQuery])

  useEffect(() => {
    let isMounted = true
    adminService.getUsers({
      role: roleFilter === 'all' ? undefined : roleFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
      search: searchQuery.trim() || undefined,
    })
      .then((data) => {
        if (isMounted) {
          setUsers(data.items || [])
          setErrorMsg('')
        }
      })
      .catch((err) => {
        if (isMounted) {
          setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch users.')
        }
      })
    return () => { isMounted = false }
  }, [roleFilter, statusFilter, searchQuery])

  async function handleToggleStatus(user: AdminUserItem) {
    const nextStatus = user.status === 'active' ? 'suspended' : 'active'
    const confirmMsg = nextStatus === 'suspended'
      ? `Are you sure you want to suspend account ${user.email}? They will not be able to log in or book rides.`
      : `Reactivate account ${user.email}?`

    if (!window.confirm(confirmMsg)) return

    setIsProcessing(true)
    setSuccessMsg(null)
    try {
      await adminService.updateUserStatus(user.id, {
        status: nextStatus,
      })
      setSuccessMsg(`User ${user.email} status changed to ${nextStatus}.`)
      loadUsers()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update user status.')
    } finally {
      setIsProcessing(false)
    }
  }

  function getUserInitials(user: AdminUserItem): string {
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    }
    if (user.first_name) {
      return user.first_name.slice(0, 2).toUpperCase()
    }
    return user.email.slice(0, 2).toUpperCase()
  }

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>User Accounts & Security</h1>
          <p>Inspect registered riders, drivers, and administrators. Enforce suspensions for policy violations.</p>
        </div>
        <button
          type="button"
          className="admin-action-btn admin-btn-dark"
          onClick={loadUsers}
          disabled={isLoading}
        >
          <RefreshCw size={14} className={isLoading ? 'admin-spin' : ''} />
          <span>{isLoading ? 'Refreshing...' : 'Refresh Users'}</span>
        </button>
      </div>

      {successMsg && (
        <div className="admin-alert-banner admin-alert-success">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
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
            onClick={loadUsers}
          >
            Retry
          </button>
        </div>
      )}

      <div className="admin-card">
        <div className="admin-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} color="#475569" />
            <h2>Registered Users ({users.length})</h2>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="admin-search-wrap">
              <Search size={14} className="admin-search-icon" />
              <input
                type="text"
                className="admin-input-control admin-search-input"
                placeholder="Search by email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="admin-tabs">
              {['all', 'driver', 'rider', 'admin'].map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`admin-tab ${roleFilter === r ? 'active' : ''}`}
                  onClick={() => setRoleFilter(r)}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>

            <div className="admin-tabs">
              {['all', 'active', 'suspended'].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`admin-tab ${statusFilter === s ? 'active' : ''}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {users.length === 0 ? (
          <div className="admin-empty-state">
            <div className="admin-empty-icon">
              <Users size={32} />
            </div>
            <h3>No users found</h3>
            <p>No registered accounts match your current filter criteria.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ACCOUNT & IDENTITY</th>
                  <th>FULL NAME</th>
                  <th>ROLE</th>
                  <th>STATUS</th>
                  <th>REGISTERED DATE</th>
                  <th>SECURITY ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className={`admin-avatar admin-avatar-${u.role}`}>
                          {getUserInitials(u)}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Mail size={12} color="#64748b" />
                            <strong style={{ color: '#0f172a' }}>{u.email}</strong>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace', marginTop: '2px' }}>
                            <Fingerprint size={10} />
                            <span>{u.id.slice(0, 8)}...{u.id.slice(-4)}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {u.first_name || u.last_name ? (
                        <span style={{ fontWeight: 600, color: '#334155' }}>
                          {`${u.first_name || ''} ${u.last_name || ''}`.trim()}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Not specified</span>
                      )}
                    </td>
                    <td>
                      <span className={`admin-pill admin-pill-${u.role}`}>
                        {u.role === 'admin' && <Shield size={11} />}
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`admin-pill admin-pill-${u.status}`}>
                        <span className="admin-status-dot" />
                        {u.status}
                      </span>
                    </td>
                    <td style={{ color: '#64748b', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={12} color="#94a3b8" />
                        <span>
                          {new Date(u.created_at).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </td>
                    <td>
                      {u.role !== 'admin' ? (
                        <button
                          type="button"
                          className={`admin-action-btn ${u.status === 'active' ? 'admin-action-btn-suspend' : 'admin-action-btn-activate'}`}
                          onClick={() => handleToggleStatus(u)}
                          disabled={isProcessing}
                        >
                          {u.status === 'active' ? (
                            <>
                              <UserX size={13} />
                              <span>Suspend</span>
                            </>
                          ) : (
                            <>
                              <UserCheck size={13} />
                              <span>Reactivate</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="admin-protected-tag">
                          <Shield size={12} />
                          <span>Protected Root</span>
                        </span>
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
