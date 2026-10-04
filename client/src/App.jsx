import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { CartProvider } from './context/CartContext';
import { useTheme } from './hooks/useTheme';
import ErrorBoundary from './components/ErrorBoundary';
import { LoadingState } from './components/StateViews';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AdminShell from './components/admin/AdminShell';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';

// Route-level code splitting keeps the initial bundle small.
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const VerifyEmail = lazy(() => import('./pages/auth/VerifyEmail'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const Home = lazy(() => import('./pages/user/Home'));
const Menu = lazy(() => import('./pages/user/Menu'));
const PizzaDetails = lazy(() => import('./pages/user/PizzaDetails'));
const BuildPizza = lazy(() => import('./pages/user/BuildPizza'));
const Cart = lazy(() => import('./pages/user/Cart'));
const Checkout = lazy(() => import('./pages/user/Checkout'));
const MyOrders = lazy(() => import('./pages/user/MyOrders'));
const Profile = lazy(() => import('./pages/user/Profile'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const Inventory = lazy(() => import('./pages/admin/Inventory'));
const Orders = lazy(() => import('./pages/admin/Orders'));
const Products = lazy(() => import('./pages/admin/Products'));
const Users = lazy(() => import('./pages/admin/Users'));
const Settings = lazy(() => import('./pages/admin/Settings'));
import './index.css';

const AppRoutes = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isAdminArea = location.pathname.startsWith('/admin');

  if (loading) {
    return <LoadingState message="Warming up the oven…" />;
  }

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Admin routes render their own shell (sidebar + top bar). */}
      {!isAdminArea && <Navbar />}

      <main id="main-content">
        <Suspense fallback={<LoadingState message="Loading page…" />}>
          <Routes>
            <Route
              path="/login"
              element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/home'} replace /> : <Login />}
            />
            <Route
              path="/register"
              element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/home'} replace /> : <Register />}
            />
            <Route path="/verify-email/:token" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />

            <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Menu /></ProtectedRoute>} />
            <Route path="/pizza/:id" element={<ProtectedRoute><PizzaDetails /></ProtectedRoute>} />
            <Route path="/build-pizza" element={<ProtectedRoute><BuildPizza /></ProtectedRoute>} />
            <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
            <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
            <Route path="/my-orders" element={<ProtectedRoute><MyOrders /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

            <Route path="/admin" element={<AdminRoute><AdminShell /></AdminRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="orders" element={<Orders />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="products" element={<Products />} />
              <Route path="users" element={<Users />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      {!isAdminArea && <Footer />}
    </>
  );
};

/**
 * Notification host.
 *
 * Lifecycle: `toast.success(...)` → toast enters → visible for `autoClose`
 * ms → library plays the exit transition → node is removed from the DOM.
 * The exit transition is CSS-animation driven, so global styles must never
 * override `animation` on `.Toastify__toast` (see the TOASTS block in
 * index.css) or notifications would get stuck on screen forever.
 */
const ToastHost = () => {
  const { theme } = useTheme();

  return (
    <ToastContainer
      position="top-right"
      autoClose={4000}
      limit={3}
      newestOnTop
      closeOnClick
      pauseOnHover
      pauseOnFocusLoss={false}
      draggable
      rtl={false}
      theme={theme === 'dark' ? 'dark' : 'light'}
      aria-label="Notifications"
    />
  );
};

const App = () => (
  <Router>
    <ThemeProvider>
      <AuthProvider>
        <CartProvider>
          <ErrorBoundary>
            <AppRoutes />
            <ToastHost />
          </ErrorBoundary>
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  </Router>
);

export default App;
