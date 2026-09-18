import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { selectIsAuthenticated, selectIsInitializing } from '../../store/slices/authSlice';
import { RefreshCw } from 'lucide-react';

/**
 * Wraps any route that requires the user to be logged in.
 * Waits for the session check (checkAuth) to finish before
 * deciding — prevents the redirect-to-login flash on hard refresh.
 */
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isInitializing  = useSelector(selectIsInitializing);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F0F4FC]">
        <RefreshCw className="animate-spin text-brand-blue w-8 h-8" />
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/epcr/login" replace />;
};

export default ProtectedRoute;

