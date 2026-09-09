import {
  BrowserRouter,
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
import { AdminDashboardPage } from '../pages/AdminDashboardPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
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
            path="/admin"
            element={<AdminDashboardPage />}
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