import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import AppShell from '../layouts/AppShell'
import { HomePage } from '../pages/HomePage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { OfferRidePage } from '../pages/OfferRidePage'
import { ProfilePage } from '../pages/ProfilePage'
import { RegisterPage } from '../pages/RegisterPage'
import { RideDetailsPage } from '../pages/RideDetailsPage'
import { RidesPage } from '../pages/RidesPage'
import { VehiclesPage } from '../pages/VehiclesPage'
import { MyBookingsPage } from '../pages/MyBookingsPage'
import { ResetPasswordPage } from '../pages/ResetPasswordPage'
import {
  AdminLayout,
  AdminOverviewPage,
  AdminVehiclesPage,
  AdminUsersPage,
  AdminRidesPage,
  AdminReportsPage,
} from '../pages/admin'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Dedicated Admin Portal with Independent Layout */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminOverviewPage />} />
          <Route path="vehicles" element={<AdminVehiclesPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="rides" element={<AdminRidesPage />} />
          <Route path="reports" element={<AdminReportsPage />} />
        </Route>

        {/* Public & Customer Platform with User AppShell */}
        <Route element={<AppShell />}>
          <Route
            path="/"
            element={<HomePage />}
          />

          <Route
            path="/rides"
            element={<RidesPage />}
          />

          <Route
            path="/rides/:rideId"
            element={<RideDetailsPage />}
          />

          <Route
            path="/offer-ride"
            element={<OfferRidePage />}
          />

          <Route
            path="/login"
            element={<LoginPage />}
          />

          <Route
            path="/reset-password"
            element={<ResetPasswordPage />}
          />

          <Route
            path="/register"
            element={<RegisterPage />}
          />

          <Route
            path="/profile"
            element={<ProfilePage />}
          />

          <Route
            path="/vehicles"
            element={<VehiclesPage />}
          />

          <Route
            path="/bookings"
            element={<MyBookingsPage />}
          />

          <Route
            path="*"
            element={<NotFoundPage />}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}