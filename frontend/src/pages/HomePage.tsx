export function HomePage() {
  return (
    <section className="ridex-home">
      <div className="ridex-container">
        <div className="ridex-hero">
          <p className="ridex-eyebrow">SMARTER SHARED TRAVEL</p>

          <h1>Go together.<br />Go farther.</h1>

          <p className="ridex-hero-description">
            Find a ride, share your journey, and travel with people going
            your way.
          </p>

          <div className="ridex-search-card">
            <div className="ridex-search-field">
              <span>From</span>
              <strong>Choose starting point</strong>
            </div>

            <div className="ridex-search-divider" />

            <div className="ridex-search-field">
              <span>To</span>
              <strong>Choose destination</strong>
            </div>

            <button type="button" className="ridex-button ridex-button-primary">
              Find rides
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}