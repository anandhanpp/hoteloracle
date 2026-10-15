import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ReservationProvider } from './context/ReservationContext';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import ArrivalsPage from './pages/ArrivalsPage';
import DeparturesPage from './pages/DeparturesPage';
import ReservationsPage from './pages/ReservationsPage';
import GuestsPage from './pages/GuestsPage';
import TodoPage from './pages/TodoPage';
import EventsPage from './pages/EventsPage';
import MaintenancePage from './pages/MaintenancePage';
import HousekeepingPage from './pages/HousekeepingPage';
import ClientRelationsPage from './pages/ClientRelationsPage';
import BookingsPage from './pages/BookingsPage';
import InventoryPage from './pages/InventoryPage';
import FinancialsPage from './pages/FinancialsPage';
import MiscellaneousPage from './pages/MiscellaneousPage';
import ReportsPage from './pages/ReportsPage';
import LoginPage from './pages/LoginPage';
import InHousePage from './pages/InHousePage';
import BillingDashboard from './components/billing/BillingDashboard';

export default function App() {
  return (
    <AuthProvider>
      <ReservationProvider>
        <BrowserRouter>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<LoginPage />} />

            {/* All routes below require a valid JWT */}
            <Route element={<PrivateRoute />}>
              <Route element={<Layout />}>
                {/* Default landing page (Analytics Dashboard) */}
                <Route index element={<DashboardPage />} />
                <Route path="home" element={<DashboardPage />} />
                <Route path="dashboard" element={<DashboardPage />} />

                {/* Tab bar pages */}
                <Route path="arrivals" element={<ArrivalsPage />} />
                <Route path="departures" element={<DeparturesPage />} />
                <Route path="reservations" element={<ReservationsPage />} />
                <Route path="guests" element={<GuestsPage />} />
                <Route path="todo" element={<TodoPage />} />
                <Route path="events" element={<EventsPage />} />
                <Route path="maintenance" element={<MaintenancePage />} />
                <Route path="housekeeping" element={<HousekeepingPage />} />

                {/* Top navigation pages */}
                <Route path="client-relations" element={<ClientRelationsPage />} />
                <Route path="bookings" element={<BookingsPage />} />
                <Route path="inventory" element={<InventoryPage />} />
                <Route path="financials" element={<FinancialsPage />} />
                <Route path="miscellaneous" element={<MiscellaneousPage />} />
                <Route path="reports" element={<ReportsPage />} />

                {/* Front Desk → In House → Billing */}
                <Route path="in-house" element={<InHousePage />} />
                <Route path="billing/:reservation_id" element={<BillingDashboard />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </ReservationProvider>
    </AuthProvider>
  );
}