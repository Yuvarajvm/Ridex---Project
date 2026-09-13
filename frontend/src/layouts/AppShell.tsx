import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Bell,
  Car,
  CreditCard,
  MessageSquare,
  Star,
  Shield,
  LogOut,
  ArrowRight,
  ShieldCheck,
  CheckCheck,
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { apiClient } from '../services/apiClient'
import '../App.css'

interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  data?: { ride_id?: string; booking_id?: string; message_id?: string } | null
  is_read: boolean
  created_at: string
}

interface NotificationListResponse {
  items: NotificationItem[]
  total: number
  unread_count: number
}

function formatNotificationTime(value: string) {
  const diff = Date.now() - new Date(value).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric' }).format(new Date(value))
}

function renderNotificationIcon(type: string) {
  if (type.startsWith('booking_')) {
    return (
      <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Car size={14} />
      </div>
    )
  }
  if (type.startsWith('payment_')) {
    return (
      <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <CreditCard size={14} />
      </div>
    )
  }
  if (type === 'trip_message') {
    return (
      <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#faf5ff', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <MessageSquare size={14} />
      </div>
    )
  }
  if (type.startsWith('review_')) {
    return (
      <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Star size={14} />
      </div>
    )
  }
  return (
    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Bell size={14} />
    </div>
  )
}

export default function AppShell() {
  const { user, isAuthenticated, logout } = useAuthStore()
  const navigate = useNavigate()

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  function handleLogout() {
    logout()
    setNotifications([])
    setUnreadCount(0)
    navigate('/')
  }

  useEffect(() => {
    if (!isAuthenticated) return

    let isMounted = true

    async function fetchNotifications() {
      try {
        const res = await apiClient.get<NotificationListResponse>('/notifications?page=1&page_size=15')
        if (isMounted) {
          setNotifications(res.items || [])
          setUnreadCount(res.unread_count || 0)
        }
      } catch {
        // Silently handle if unauthenticated or network error
      }
    }

    fetchNotifications()
    const interval = setInterval(fetchNotifications, 25000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [isAuthenticated])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false)
      }
    }
    if (isNotifOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isNotifOpen])

  async function handleMarkAllRead() {
    try {
      await apiClient.post('/notifications/mark-all-read')
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch {
      // ignore
    }
  }

  async function handleNotificationClick(notif: NotificationItem) {
    if (!notif.is_read) {
      apiClient.patch(`/notifications/${notif.id}/read`).catch(() => {})
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)),
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    }
    setIsNotifOpen(false)

    if (notif.data?.ride_id) {
      navigate(`/rides/${notif.data.ride_id}`)
    } else if (notif.type.startsWith('booking_') || notif.type.startsWith('payment_')) {
      navigate('/bookings')
    }
  }

  function getUserInitials(): string {
    if (user?.profile?.first_name && user?.profile?.last_name) {
      return `${user.profile.first_name[0]}${user.profile.last_name[0]}`.toUpperCase()
    }
    if (user?.profile?.first_name) {
      return user.profile.first_name.slice(0, 2).toUpperCase()
    }
    return (user?.email || 'U').slice(0, 2).toUpperCase()
  }

  return (
    <div className="ridex-app-shell">
      <header className="ridex-header">
        <div className="ridex-header-inner">
          <Link to="/" className="ridex-logo" aria-label="RIDEX home">
            <div className="ridex-logo-badge">
              <ShieldCheck size={16} color="#a9dfc6" />
            </div>
            <span>RIDEX</span>
          </Link>

          <nav className="ridex-nav">
            <NavLink to="/" className={({ isActive }) => (isActive ? 'active' : '')}>
              Find a ride
            </NavLink>
            <NavLink to="/offer-ride" className={({ isActive }) => (isActive ? 'active' : '')}>
              Offer a ride
            </NavLink>
            {isAuthenticated && (
              <NavLink to="/bookings" className={({ isActive }) => (isActive ? 'active' : '')}>
                My Bookings
              </NavLink>
            )}
            {isAuthenticated && (
              <NavLink to="/vehicles" className={({ isActive }) => (isActive ? 'active' : '')}>
                My Vehicles
              </NavLink>
            )}
            {isAuthenticated && user?.role === 'admin' && (
              <Link to="/admin" className="ridex-admin-panel-link">
                <Shield size={13} />
                <span>Admin Portal</span>
              </Link>
            )}
          </nav>

          <div className="ridex-header-actions">
            {isAuthenticated && user ? (
              <>
                {/* Notification Bell with Lucide SVG */}
                <div style={{ position: 'relative' }} ref={notifRef}>
                  <button
                    type="button"
                    className="ridex-notif-btn"
                    onClick={() => setIsNotifOpen((prev) => !prev)}
                    aria-label="Notifications"
                  >
                    <Bell size={16} />
                    {unreadCount > 0 && (
                      <span className="ridex-notif-badge">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notification Dropdown */}
                  {isNotifOpen && (
                    <div className="ridex-notif-dropdown">
                      <div className="ridex-notif-head">
                        <strong>
                          Notifications {unreadCount > 0 && `(${unreadCount})`}
                        </strong>
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            className="ridex-notif-clear-btn"
                            onClick={handleMarkAllRead}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCheck size={13} />
                              <span>Mark all read</span>
                            </span>
                          </button>
                        )}
                      </div>

                      <div style={{ overflowY: 'auto', flex: 1, maxHeight: '360px' }}>
                        {notifications.length === 0 ? (
                          <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b' }}>
                            <Bell size={24} style={{ margin: '0 auto 8px', color: '#cbd5e1', display: 'block' }} />
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>No notifications yet</p>
                            <small style={{ fontSize: '11px', color: '#94a3b8' }}>We'll notify you about ride updates and bookings</small>
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              onClick={() => handleNotificationClick(n)}
                              style={{
                                padding: '12px 16px',
                                borderBottom: '1px solid #f1f5f9',
                                cursor: 'pointer',
                                background: n.is_read ? '#ffffff' : '#f8fafc',
                                display: 'flex',
                                gap: '12px',
                                alignItems: 'flex-start',
                                transition: 'background 0.15s',
                              }}
                            >
                              {renderNotificationIcon(n.type)}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                                  <span
                                    style={{
                                      fontSize: '13px',
                                      fontWeight: n.is_read ? 600 : 700,
                                      color: '#0f172a',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {n.title}
                                  </span>
                                  <small style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '6px' }}>
                                    {formatNotificationTime(n.created_at)}
                                  </small>
                                </div>
                                <p
                                  style={{
                                    margin: 0,
                                    fontSize: '12px',
                                    color: '#64748b',
                                    lineHeight: '1.4',
                                    wordBreak: 'break-word',
                                  }}
                                >
                                  {n.message}
                                </p>
                              </div>
                              {!n.is_read && (
                                <span
                                  style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    background: '#059669',
                                    marginTop: '6px',
                                    flexShrink: 0,
                                  }}
                                />
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <Link to="/profile" className="ridex-user-badge">
                  <div className="ridex-user-avatar">{getUserInitials()}</div>
                  <span className="ridex-user-name">
                    {user.profile?.first_name || user.email.split('@')[0]}
                  </span>
                  <span className="ridex-role-tag">{user.role}</span>
                </Link>

                <button
                  type="button"
                  className="ridex-logout-btn"
                  onClick={handleLogout}
                >
                  <LogOut size={13} />
                  <span>Log out</span>
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="ridex-login-link">
                  Log in
                </Link>
                <Link to="/register" className="ridex-get-started">
                  <span>Get started</span>
                  <ArrowRight size={13} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  )
}