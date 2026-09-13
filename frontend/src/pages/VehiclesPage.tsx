import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Car,
  Plus,
  Trash2,
  ShieldCheck,
  Clock,
  XCircle,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
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

    let isMounted = true
    apiClient<VehicleListResponse>('/vehicles')
      .then((data) => {
        if (!isMounted) return
        setVehicles(data.items || [])
      })
      .catch((err) => {
        if (!isMounted) return
        setErrorMessage(err instanceof Error ? err.message : 'Could not load vehicles.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isAuthenticated, navigate])

  async function reloadVehicles() {
    try {
      const data = await apiClient<VehicleListResponse>('/vehicles')
      setVehicles(data.items || [])
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not load vehicles.')
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

      setSuccessMessage('Vehicle registered successfully! Awaiting verification.')
      setMake('')
      setModel('')
      setColor('')
      setRegistrationNumber('')
      await reloadVehicles()
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
      setSuccessMessage('Vehicle removed successfully.')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete vehicle.')
    }
  }

  return (
    <div className="ridex-auth-page" style={{ alignItems: 'flex-start', padding: '40px 16px' }}>
      <div className="ridex-auth-card" style={{ maxWidth: '760px', width: '100%' }}>
        <div className="ridex-auth-header">
          <span className="ridex-auth-badge">
            <Car size={13} style={{ display: 'inline', marginRight: '4px' }} />
            DRIVER FLEET
          </span>
          <h1 className="ridex-auth-title">My Vehicles</h1>
          <p className="ridex-auth-subtitle">
            Manage registered vehicles used to offer and publish rides on RIDEX
          </p>
        </div>

        {errorMessage && (
          <div className="ridex-auth-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div
            className="ridex-auth-error"
            style={{
              background: '#ecfdf5',
              borderColor: '#a7f3d0',
              color: '#065f46',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <CheckCircle2 size={16} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Existing vehicles section */}
        <section style={{ marginBottom: '36px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', color: '#0f172a', fontWeight: 800, margin: 0 }}>
              Registered Vehicles ({vehicles.length})
            </h2>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Requires admin verification before first trip
            </span>
          </div>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#64748b', fontSize: '14px' }}>
              <Clock size={20} style={{ display: 'inline', marginRight: '6px' }} />
              Loading vehicles...
            </div>
          ) : vehicles.length === 0 ? (
            <div
              style={{
                background: '#f8fafc',
                padding: '36px 24px',
                borderRadius: '14px',
                textAlign: 'center',
                color: '#64748b',
                border: '1px dashed #cbd5e1',
              }}
            >
              <Car size={32} style={{ margin: '0 auto 10px', color: '#94a3b8' }} />
              <p style={{ margin: 0, fontWeight: 600, fontSize: '14.5px', color: '#334155' }}>
                No vehicles registered yet
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '13px' }}>
                Add your vehicle below to start offering rides to the RIDEX community.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {vehicles.map((v) => {
                const isVerified = v.verification_status === 'verified'
                const isPending = v.verification_status === 'pending'

                return (
                  <div
                    key={v.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '14px',
                      padding: '16px 20px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <strong style={{ fontSize: '16px', color: '#0f172a', fontWeight: 800 }}>
                          {v.make} {v.model}
                        </strong>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            padding: '3px 10px',
                            borderRadius: '999px',
                            background: isVerified ? '#ecfdf5' : isPending ? '#fef3c7' : '#fef2f2',
                            color: isVerified ? '#065f46' : isPending ? '#92400e' : '#991b1b',
                            border: `1px solid ${
                              isVerified ? '#a7f3d0' : isPending ? '#fde68a' : '#fecaca'
                            }`,
                          }}
                        >
                          {isVerified ? (
                            <ShieldCheck size={12} />
                          ) : isPending ? (
                            <Clock size={12} />
                          ) : (
                            <XCircle size={12} />
                          )}
                          {v.verification_status}
                        </span>
                      </div>
                      <div style={{ color: '#64748b', fontSize: '13px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 800,
                            background: '#f1f5f9',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            color: '#0f172a',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {v.registration_number}
                        </span>
                        <span>•</span>
                        <span>{v.seat_capacity} passenger seats</span>
                        <span>•</span>
                        <span style={{ textTransform: 'capitalize' }}>{v.vehicle_type}</span>
                        {v.manufacture_year && (
                          <>
                            <span>•</span>
                            <span>{v.manufacture_year}</span>
                          </>
                        )}
                        {v.color && (
                          <>
                            <span>•</span>
                            <span>{v.color}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteVehicle(v.id)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#fef2f2',
                        color: '#b91c1c',
                        border: '1px solid #fecaca',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Remove</span>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Add new vehicle section */}
        <section style={{ borderTop: '1px solid #e2e8f0', paddingTop: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
            <Plus size={18} style={{ color: '#059669' }} />
            <h2 style={{ fontSize: '16px', color: '#0f172a', fontWeight: 800, margin: 0 }}>
              Add a New Vehicle
            </h2>
          </div>

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
                  <option value="car">Car / Sedan / SUV</option>
                  <option value="bike">Motorcycle / Scooter</option>
                  <option value="auto">Auto Rickshaw</option>
                  <option value="van">Van / MUV</option>
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
                  Make / Manufacturer
                </label>
                <input
                  id="make"
                  type="text"
                  placeholder="e.g. Maruti Suzuki, Hyundai"
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
                  placeholder="e.g. Swift, Creta, City"
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
                  Registration Number (Plate)
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
                  style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 700 }}
                />
              </div>

              <div className="ridex-form-group">
                <label className="ridex-form-label" htmlFor="manufactureYear">
                  Manufacture Year
                </label>
                <input
                  id="manufactureYear"
                  type="number"
                  min="1995"
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
                placeholder="e.g. Pearl White, Silver, Dark Blue"
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
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '10px',
              }}
            >
              <Car size={16} />
              <span>{isSubmitting ? 'Registering Vehicle...' : 'Register Vehicle'}</span>
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
