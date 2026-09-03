import { Link, Outlet, useLocation } from 'react-router-dom'

export default function AppShell() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <div className="ridex-app">
      <header className={`site-header ${isHome ? 'site-header-home' : ''}`}>
        <div className="header-inner">
          <Link to="/" className="brand" aria-label="RIDEX home">
            <span className="brand-mark">
              <span />
              <span />
            </span>

            <span className="brand-name">RIDEX</span>
          </Link>

          <nav className="desktop-nav" aria-label="Primary navigation">
            <Link
              className={
                location.pathname === '/'
                  ? 'nav-link active'
                  : 'nav-link'
              }
              to="/"
            >
              Find a ride
            </Link>

            <Link
              className={
                location.pathname === '/offer-ride'
                  ? 'nav-link active'
                  : 'nav-link'
              }
              to="/offer-ride"
            >
              Offer a ride
            </Link>

            <a className="nav-link" href="#how-it-works">
              How it works
            </a>
          </nav>

          <div className="header-actions">
            <button className="header-login" type="button">
              Log in
            </button>

            <button className="header-signup" type="button">
              Get started
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div>
            <div className="footer-brand">RIDEX</div>
            <p>Move together. Go further.</p>
          </div>

          <div className="footer-meta">
            <span>Ride sharing, reimagined.</span>
            <span>© 2026 RIDEX</span>
          </div>
        </div>
      </footer>
    </div>
  )
}