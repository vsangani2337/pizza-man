import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingState } from './StateViews';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState message="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

export default ProtectedRoute;
