import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import './AdminShell.css';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: '📊', end: true },
  { to: '/admin/orders', label: 'Orders', icon: '🛒' },
  { to: '/admin/products', label: 'Menu & Pizzas', icon: '🍕' },
  { to: '/admin/inventory', label: 'Inventory', icon: '📦' },
  { to: '/admin/users', label: 'Customers', icon: '👥' },
  { to: '/admin/settings', label: 'Settings', icon: '⚙️' },
];

/**
 * Admin application shell: fixed sidebar (drawer on mobile) + sticky top bar.
 * Customer-facing pages keep the regular site navbar instead.
 */
const AdminShell = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = (user?.name || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="admin-shell">
      <a href="#admin-content" className="skip-link">Skip to admin content</a>

      <div className={`admin-backdrop ${open ? 'is-open' : ''}`} onClick={() => setOpen(false)} aria-hidden="true" />

      <aside className={`admin-sidebar ${open ? 'is-open' : ''}`} aria-label="Admin navigation">
        <div className="admin-sidebar-head">
          <Link to="/admin" className="nav-brand">
            <span className="nav-brand-mark" aria-hidden="true">🍕</span>
            <span className="nav-brand-name">
              Pizza <em>Man</em>
            </span>
          </Link>
          <span className="admin-badge">Admin</span>
          <button type="button" className="nav-icon-btn admin-sidebar-close" onClick={() => setOpen(false)} aria-label="Close menu">
            ✕
          </button>
        </div>

        <nav className="admin-nav">
          <span className="admin-nav-label">Operations</span>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `admin-nav-link ${isActive ? 'is-active' : ''}`}
            >
              <span className="admin-nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-foot">
          <Link to="/home" className="admin-nav-link">
            <span className="admin-nav-icon" aria-hidden="true">🛍️</span>
            <span>View storefront</span>
          </Link>

          <div className="admin-sidebar-user">
            <span className="nav-avatar">{initials}</span>
            <span className="admin-sidebar-user-text">
              <strong>{user?.name}</strong>
              <small>{user?.email}</small>
            </span>
            <button type="button" className="nav-icon-btn" onClick={toggleTheme} aria-label="Toggle colour theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>

          <button type="button" className="btn btn-secondary btn-sm btn-block" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className={`admin-topbar ${scrolled ? 'is-scrolled' : ''}`}>
          <button
            type="button"
            className="nav-icon-btn admin-burger"
            onClick={() => setOpen(true)}
            aria-label="Open admin menu"
            aria-expanded={open}
          >
            ☰
          </button>

          <div className="admin-topbar-title">
            <strong>Pizza Man Control Room</strong>
            <span>Manage orders, menu and stock</span>
          </div>

          <div className="admin-topbar-actions">
            <Link to="/admin/orders" className="admin-topbar-action">
              🛒 <span>Orders</span>
            </Link>
            <button type="button" className="nav-icon-btn" onClick={toggleTheme} aria-label="Toggle colour theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <Link to="/profile" className="nav-avatar" aria-label="Your profile">{initials}</Link>
          </div>
        </header>

        <main id="admin-content" className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminShell;
