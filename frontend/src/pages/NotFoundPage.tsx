import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="ridex-container ridex-not-found">
      <p className="ridex-eyebrow">404</p>

      <h1>Page not found</h1>

      <p>
        The page you are looking for does not exist.
      </p>

      <Link to="/" className="ridex-button ridex-button-primary">
        Back to home
      </Link>
    </section>
  )
}