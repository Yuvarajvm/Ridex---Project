import { useState, useEffect, useRef } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { apiClient } from '../services/apiClient'

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

function getNotificationIcon(type: string) {
  if (type.startsWith('booking_')) return '🚗'
  if (type.startsWith('payment_')) return '💳'
  if (type === 'trip_message') return '💬'
  if (type.startsWith('review_')) return '★'
  return '🔔'
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

  return (
    <div className="ridex-app-shell">
      <header className="ridex-header">
        <div className="ridex-header-inner">
          <Link
            to="/"
            className="ridex-logo"
            aria-label="RIDEX home"
          >
            RID<span>EX</span>
          </Link>

          <nav className="ridex-nav">
            <Link to="/">Find a ride</Link>
            <Link to="/offer-ride">Offer a ride</Link>
            {isAuthenticated && <Link to="/bookings">My Bookings</Link>}
            {isAuthenticated && <Link to="/vehicles">My Vehicles</Link>}
            {isAuthenticated && user?.role === 'admin' && (
              <Link to="/admin" style={{ color: '#a9dfc6', fontWeight: 800 }}>
                Admin Panel
              </Link>
            )}
            <a href="/#how-it-works">How it works</a>
          </nav>

          <div className="ridex-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isAuthenticated && user ? (
              <>
                {/* Notification Bell */}
                <div style={{ position: 'relative' }} ref={notifRef}>
                  <button
                    type="button"
                    onClick={() => setIsNotifOpen((prev) => !prev)}
                    aria-label="Notifications"
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '50%',
                      width: '38px',
                      height: '38px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '16px',
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    🔔
                    {unreadCount > 0 && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '-4px',
                          right: '-4px',
                          background: '#e98570',
                          color: '#fff',
                          fontSize: '10px',
                          fontWeight: 800,
                          borderRadius: '10px',
                          padding: '2px 5px',
                          lineHeight: 1,
                          border: '2px solid #26345f',
                        }}
                      >
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notification Dropdown */}
                  {isNotifOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: '46px',
                        width: '340px',
                        maxHeight: '440px',
                        background: '#fff',
                        borderRadius: '16px',
                        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.22)',
                        border: '1px solid #e0e2e7',
                        overflow: 'hidden',
                        zIndex: 9999,
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div
                        style={{
                          padding: '14px 18px',
                          borderBottom: '1px solid #f0f2f5',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: '#fafbfc',
                        }}
                      >
                        <strong style={{ fontSize: '14px', color: '#17203b', fontWeight: 800 }}>
                          Notifications {unreadCount > 0 && `(${unreadCount})`}
                        </strong>
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAllRead}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#26345f',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div style={{ overflowY: 'auto', flex: 1 }}>
                        {notifications.length === 0 ? (
                          <div style={{ padding: '32px 20px', textAlign: 'center', color: '#7c8495' }}>
                            <p style={{ margin: 0, fontSize: '13px' }}>No notifications yet</p>
                            <small style={{ fontSize: '11px' }}>We'll notify you about ride updates & chats</small>
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              onClick={() => handleNotificationClick(n)}
                              style={{
                                padding: '12px 16px',
                                borderBottom: '1px solid #f5f6f8',
                                cursor: 'pointer',
                                background: n.is_read ? '#fff' : '#f4f9f6',
                                display: 'flex',
                                gap: '12px',
                                alignItems: 'flex-start',
                                transition: 'background 0.15s',
                              }}
                            >
                              <span style={{ fontSize: '18px', lineHeight: 1.2 }}>{getNotificationIcon(n.type)}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                                  <span
                                    style={{
                                      fontSize: '13px',
                                      fontWeight: n.is_read ? 600 : 800,
                                      color: '#17203b',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {n.title}
                                  </span>
                                  <small style={{ fontSize: '10px', color: '#9ba2b0', marginLeft: '6px' }}>
                                    {formatNotificationTime(n.created_at)}
                                  </small>
                                </div>
                                <p
                                  style={{
                                    margin: 0,
                                    fontSize: '12px',
                                    color: '#555d6e',
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
                                    width: '7px',
                                    height: '7px',
                                    borderRadius: '50%',
                                    background: '#2d7a54',
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
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="ridex-login-link"
                >
                  Log in
                </Link>

                <Link
                  to="/register"
                  className="ridex-get-started"
                >
                  Get started
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