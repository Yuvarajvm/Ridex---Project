import { Link } from 'react-router-dom'
import { Navigation, Home, Search } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div style={{ minHeight: '80vh', background: '#f8fafc', padding: '80px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          maxWidth: '520px',
          width: '100%',
          margin: '0 auto',
          background: '#ffffff',
          borderRadius: '20px',
          padding: '48px 36px',
          textAlign: 'center',
          border: '1px solid #e2e8f0',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.06)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'rgba(169, 223, 198, 0.15)',
            border: '1px solid rgba(169, 223, 198, 0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
            color: '#059669',
          }}
        >
          <Navigation size={30} />
        </div>

        <div>
          <span
            style={{
              display: 'inline-block',
              fontSize: '11px',
              fontWeight: 800,
              color: '#059669',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              background: '#ecfdf5',
              padding: '3px 10px',
              borderRadius: '999px',
              border: '1px solid #a7f3d0',
              marginBottom: '12px',
            }}
          >
            Error 404 • Route Not Found
          </span>
        </div>

        <h1 style={{ fontSize: '28px', color: '#0f172a', margin: '8px 0 12px', fontWeight: 800, letterSpacing: '-0.03em' }}>
          Destination Off-Grid
        </h1>

        <p style={{ color: '#64748b', lineHeight: '1.6', marginBottom: '32px', fontSize: '14.5px' }}>
          The page or itinerary waypoint you are looking for has been moved, completed, or does not exist on RIDEX.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: '#0b1324',
              color: '#ffffff',
              padding: '12px 24px',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '14px',
              textDecoration: 'none',
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            <Home size={16} />
            <span>Return to Marketplace</span>
          </Link>

          <Link
            to="/rides"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: '#f1f5f9',
              color: '#0f172a',
              border: '1px solid #e2e8f0',
              padding: '12px 24px',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '14px',
              textDecoration: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Search size={16} />
            <span>Search Active Rides</span>
          </Link>
        </div>
      </div>
    </div>
  )
}