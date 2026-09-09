import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../services/apiClient'
import { useAuthStore } from '../stores/authStore'
import './auth.css'

export interface VehicleItem {
  id: string
  owner_id: string
  vehicle_type: string
  make: string
  model: string
  color: string | null
  registration_number: string
  registration_state: string | null
  manufacture_year: number | null
  seat_capacity: number
  verification_status: 'pending' | 'verified' | 'rejected' | 'expired' | string
  verified_at: string | null
  is_active: boolean
  created_at: string
}

interface VehicleListResponse {
  items: VehicleItem[]
  total: number
}

export function VehiclesPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()

  const [vehicles, setVehicles] = useState<VehicleItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Form state
  const [vehicleType, setVehicleType] = useState('car')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [color, setColor] = useState('')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [seatCapacity, setSeatCapacity] = useState('4')
  const [manufactureYear, setManufactureYear] = useState('2022')

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/vehicles' } } })
      return
    }

    void loadVehicles()
  }, [isAuthenticated, navigate])

  async function loadVehicles() {
    setIsLoading(true)
    try {
      const data = await apiClient<VehicleListResponse>('/vehicles')
      setVehicles(data.items || [])
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not load vehicles.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleAddVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!make.trim() || !model.trim() || !registrationNumber.trim()) {
      setErrorMessage('Please fill in make, model, and registration number.')
      return
    }

    const regNorm = registrationNumber.trim().toUpperCase()
    setIsSubmitting(true)

    try {
      await apiClient('/vehicles', {
        method: 'POST',
        body: JSON.stringify({
          vehicle_type: vehicleType,
          make: make.trim(),
          model: model.trim(),
          color: color.trim() || null,
          registration_number: regNorm,
          seat_capacity: Number(seatCapacity),
          manufacture_year: Number(manufactureYear) || null,
        }),
      })

      setSuccessMessage('Vehicle registered successfully!')
      setMake('')
      setModel('')
      setColor('')
      setRegistrationNumber('')
      await loadVehicles()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to register vehicle.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteVehicle(id: string) {
    if (!window.confirm('Are you sure you want to remove this vehicle?')) return

    try {
      await apiClient(`/vehicles/${id}`, { method: 'DELETE' })
      setVehicles((prev) => prev.filter((v) => v.id !== id))
      setSuccessMessage('Vehicle removed.')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete vehicle.')
    }
  }

  return (
    <div className="ridex-auth-page" style={{ alignItems: 'flex-start' }}>
      <div className="ridex-auth-card" style={{ maxWidth: '720px' }}>
        <div className="ridex-auth-header">
          <span className="ridex-auth-badge">Driver Fleet</span>
          <h1 className="ridex-auth-title">My Vehicles</h1>
          <p className="ridex-auth-subtitle">
            Manage vehicles used to publish rides on RIDEX
          </p>
        </div>

        {errorMessage && <div className="ridex-auth-error">{errorMessage}</div>}
        {successMessage && (
          <div
            className="ridex-auth-error"
            style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' }}
          >
            {successMessage}
          </div>
        )}

        {/* Existing vehicles */}
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '1.15rem', color: '#26345f', margin: '0 0 16px' }}>
            Registered Vehicles ({vehicles.length})
          </h2>

          {isLoading ? (
            <p style={{ color: '#636b78' }}>Loading vehicles...</p>
          ) : vehicles.length === 0 ? (
            <div
              style={{
                background: '#f9f8f5',
                padding: '24px',
                borderRadius: '12px',
                textAlign: 'center',
                color: '#636b78',
              }}
            >
              No vehicles registered yet. Add your vehicle below to start offering rides.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {vehicles.map((v) => (
                <div
                  key={v.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderRadius: '12px',
                    border: '1.5px solid #e8e6df',
                    background: '#ffffff',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <strong style={{ fontSize: '1.05rem', color: '#26345f' }}>
                        {v.make} {v.model}
                      </strong>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background:
                            v.verification_status === 'verified'
                              ? '#d1fae5'
                              : '#fef3c7',
                          color:
                            v.verification_status === 'verified'
                              ? '#065f46'
                              : '#92400e',
                        }}
                      >
                        {v.verification_status}
                      </span>
                    </div>
                    <div style={{ color: '#636b78', fontSize: '0.875rem', marginTop: '4px' }}>
                      Reg: <strong>{v.registration_number}</strong> • {v.seat_capacity} seats • {v.vehicle_type}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteVehicle(v.id)}
                    style={{
                      background: '#fee2e2',
                      color: '#b91c1c',
                      border: 'none',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Add new vehicle */}
        <section style={{ borderTop: '1px solid #e8e6df', paddingTop: '24px' }}>
          <h2 style={{ fontSize: '1.15rem', color: '#26345f', margin: '0 0 16px' }}>
            Add a New Vehicle
          </h2>

          <form className="ridex-auth-form" onSubmit={handleAddVehicle}>
            <div className="ridex-form-row">
              <div className="ridex-form-group">
                <label className="ridex-form-label" htmlFor="vehicleType">
                  Vehicle type
                </label>
                <select
                  id="vehicleType"
                  className="ridex-form-input"
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="car">Car</option>
                  <option value="bike">Bike</option>
                  <option value="auto">Auto</option>
                  <option value="van">Van</option>
                </select>
              </div>

              <div className="ridex-form-group">
                <label className="ridex-form-label" htmlFor="seatCapacity">
                  Seat capacity (excluding driver)
                </label>
                <input
                  id="seatCapacity"
                  type="number"
                  min="1"
                  max="8"
                  className="ridex-form-input"
                  value={seatCapacity}
                  onChange={(e) => setSeatCapacity(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>

            <div className="ridex-form-row">
              <div className="ridex-form-group">
                <label className="ridex-form-label" htmlFor="make">
                  Make / Brand
                </label>
                <input
                  id="make"
                  type="text"
                  placeholder="e.g. Toyota, Maruti"
                  className="ridex-form-input"
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="ridex-form-group">
                <label className="ridex-form-label" htmlFor="model">
                  Model
                </label>
                <input
                  id="model"
                  type="text"
                  placeholder="e.g. Etios, Swift"
                  className="ridex-form-input"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>

            <div className="ridex-form-row">
              <div className="ridex-form-group">
                <label className="ridex-form-label" htmlFor="regNum">
                  Registration Number
                </label>
                <input
                  id="regNum"
                  type="text"
                  placeholder="e.g. AP39AB1234"
                  className="ridex-form-input"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="ridex-form-group">
                <label className="ridex-form-label" htmlFor="manufactureYear">
                  Manufacture Year
                </label>
                <input
                  id="manufactureYear"
                  type="number"
                  min="1990"
                  max="2030"
                  className="ridex-form-input"
                  value={manufactureYear}
                  onChange={(e) => setManufactureYear(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="ridex-form-group">
              <label className="ridex-form-label" htmlFor="color">
                Color (optional)
              </label>
              <input
                id="color"
                type="text"
                placeholder="e.g. White"
                className="ridex-form-input"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <button
              type="submit"
              className="ridex-auth-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Registering...' : 'Register Vehicle'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
