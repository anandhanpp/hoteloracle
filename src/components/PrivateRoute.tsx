import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * PrivateRoute
 * Wrap any <Route> with this component to require authentication.
 * Unauthenticated visitors are redirected to /login with the original
 * path stored in `location.state.from` so the login page can send
 * them back after a successful sign-in.
 */
export default function PrivateRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
}
