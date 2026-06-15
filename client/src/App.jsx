import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import VerifyEmail from './pages/auth/VerifyEmail';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import Dashboard from './pages/user/Dashboard';
import BuildPizza from './pages/user/BuildPizza';
import Checkout from './pages/user/Checkout';
import MyOrders from './pages/user/MyOrders';
import AdminDashboard from './pages/admin/AdminDashboard';
import Inventory from './pages/admin/Inventory';
import Orders from './pages/admin/Orders';
import './index.css';

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '64px' }}>
        <span style={{ animation: 'spin 2s linear infinite', display: 'inline-block' }}>🍕</span>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/build-pizza" element={<ProtectedRoute><BuildPizza /></ProtectedRoute>} />
        <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
        <Route path="/my-orders" element={<ProtectedRoute><MyOrders /></ProtectedRoute>} />

        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/inventory" element={<AdminRoute><Inventory /></AdminRoute>} />
        <Route path="/admin/orders" element={<AdminRoute><Orders /></AdminRoute>} />

        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </>
  );
};

const CloseButton = ({ closeToast }) => (
  <i
    onClick={closeToast}
    style={{
      cursor: 'pointer',
      fontSize: '20px',
      padding: '0 10px',
      fontStyle: 'normal',
      fontWeight: 'bold'
    }}
  >
    ✕
  </i>
);

const App = () => (
  <Router>
    <AuthProvider>
      <AppRoutes />
      <ToastContainer
        position="top-right"
        autoClose={3000}
        theme="dark"
        closeButton={<CloseButton />} // Passing the component directly
        newestOnTop
        pauseOnHover
      />
    </AuthProvider>
  </Router>
);


export default App;