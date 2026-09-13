import React from 'react'
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Car,
  Users,
  Navigation,
  ShieldAlert,
  ArrowUpRight,
  LogOut,
  Shield,
  Lock,
} from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import './admin.css'

export const AdminLayout: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuthStore()
  const navigate = useNavigate()

  const isAdmin = isAuthenticated && user?.role === 'admin'

  if (!isAdmin) {
    return (
      <div className="admin-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', padding: '40px', borderRadius: '16px', border: '1px solid #e2e8f0', maxWidth: '420px', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'inline-flex', padding: '10px', borderRadius: '50%', background: '#fef2f2', color: '#dc2626', marginBottom: '12px' }}>
            <Lock size={24} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '8px 0', color: '#0f172a' }}>
            Administrator Portal
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, marginBottom: '24px' }}>
            {!isAuthenticated
              ? 'Please sign in with administrator credentials to access platform controls.'
              : `Signed in as ${user?.email} (${user?.role}). Administrator privileges are required.`}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              className="admin-action-btn admin-action-btn-approve"
              style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              onClick={() => {
                logout()
                navigate('/login')
              }}
            >
              <span>Sign In as Administrator</span>
              <ArrowUpRight size={16} />
            </button>
            <Link to="/" style={{ textDecoration: 'none' }}>
              <button
                type="button"
                className="admin-action-btn"
                style={{ width: '100%', padding: '10px', background: '#f1f5f9', color: '#0f172a' }}
              >
                Return to Marketplace
              </button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-shell">
      {/* Top Navigation */}
      <header className="admin-topbar">
        <div className="admin-brand-group">
          <Link to="/admin/dashboard" style={{ textDecoration: 'none' }} className="admin-brand-logo">
            <div className="admin-brand-icon">
              <Shield size={16} color="#a9dfc6" />
            </div>
            <span>RIDEX</span>
            <span className="admin-portal-pill">Admin</span>
          </Link>

          <nav className="admin-nav-links">
            <NavLink
              to="/admin/dashboard"
              className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
            >
              <LayoutDashboard size={15} />
              <span>Overview</span>
            </NavLink>
            <NavLink
              to="/admin/vehicles"
              className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
            >
              <Car size={15} />
              <span>Vehicles</span>
            </NavLink>
            <NavLink
              to="/admin/users"
              className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
            >
              <Users size={15} />
              <span>Users</span>
            </NavLink>
            <NavLink
              to="/admin/rides"
              className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
            >
              <Navigation size={15} />
              <span>Rides</span>
            </NavLink>
            <NavLink
              to="/admin/reports"
              className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
            >
              <ShieldAlert size={15} />
              <span>Reports</span>
            </NavLink>
          </nav>
        </div>

        <div className="admin-user-group">
          <span className="admin-user-email">{user?.email}</span>
          <Link to="/" className="admin-exit-btn">
            <span>Marketplace</span>
            <ArrowUpRight size={13} />
          </Link>
          <button
            type="button"
            className="admin-logout-btn"
            onClick={() => {
              logout()
              navigate('/login')
            }}
          >
            <LogOut size={13} />
            <span>Sign out</span>
          </button>
        </div>
      </header>

      {/* Main Content View */}
      <main className="admin-page-container">
        <Outlet />
      </main>
    </div>
  )
}
