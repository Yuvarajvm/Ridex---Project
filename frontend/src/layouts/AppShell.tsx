import { Link, Outlet } from 'react-router-dom'

export function AppShell() {
  return (
    <div className="ridex-app">
      <header className="ridex-header">
        <div className="ridex-container ridex-header-inner">
          <Link className="ridex-brand" to="/">
            RIDEX
          </Link>

          <nav className="ridex-nav" aria-label="Primary navigation">
            <Link to="/">Home</Link>
          </nav>

          <div className="ridex-header-actions">
            <button type="button" className="ridex-button ridex-button-secondary">
              Log in
            </button>

            <button type="button" className="ridex-button ridex-button-primary">
              Sign up
            </button>
          </div>
        </div>
      </header>

      <main className="ridex-main">
        <Outlet />
      </main>

      <footer className="ridex-footer">
        <div className="ridex-container">
          <p>RIDEX</p>
        </div>
      </footer>
    </div>
  )
}