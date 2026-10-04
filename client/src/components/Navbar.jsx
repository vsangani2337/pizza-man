import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useTheme } from '../hooks/useTheme';
import Icon from './ui/Icon';
import './Navbar.css';

const CUSTOMER_LINKS = [
  { to: '/home', label: 'Home' },
  { to: '/dashboard', label: 'Menu' },
  { to: '/build-pizza', label: 'Build Pizza' },
  { to: '/my-orders', label: 'Orders' },
];

const ADMIN_LINKS = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/products', label: 'Menu' },
  { to: '/admin/inventory', label: 'Inventory' },
  { to: '/admin/users', label: 'Customers' },
  { to: '/admin/settings', label: 'Settings' },
];

const isActive = (pathname, to) => (to === '/admin' ? pathname === '/admin' : pathname === to || pathname.startsWith(`${to}/`));

const Navbar = () => {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState('');

  const searchRef = useRef(null);
  const profileRef = useRef(null);

  const isAdmin = user?.role === 'admin';
  const links = isAdmin ? ADMIN_LINKS : CUSTOMER_LINKS;

  // Sticky treatment: stronger surface + shadow once the page scrolls.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close every overlay whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      setProfileOpen(false);
      setSearchOpen(false);
    };
    const onClick = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) setProfileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, []);

  // Lock background scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  if (!user) return null;

  const handleLogout = () => {
    setMenuOpen(false);
    setProfileOpen(false);
    logout();
    navigate('/login');
  };

  const runSearch = (event) => {
    event.preventDefault();
    const value = query.trim();
    setSearchOpen(false);
    setMenuOpen(false);
    navigate(isAdmin ? `/admin/products?q=${encodeURIComponent(value)}` : `/dashboard?q=${encodeURIComponent(value)}`);
  };

  const initials = (user.name || '?').trim().charAt(0).toUpperCase();

  return (
    <header className={`site-nav ${scrolled ? 'is-scrolled' : ''} ${menuOpen ? 'is-menu-open' : ''}`}>
      <div className="container site-nav-inner">
        <Link to={isAdmin ? '/admin' : '/home'} className="nav-brand" aria-label="Pizza Man home">
          <span className="nav-brand-mark" aria-hidden="true"><Icon name="pizza" size={22} strokeWidth={1.7} /></span>
          <span className="nav-brand-name">
            Pizza <em>Man</em>
          </span>
        </Link>

        <nav className="nav-links" aria-label="Primary">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`nav-link ${isActive(location.pathname, link.to) ? 'is-active' : ''}`}
              aria-current={isActive(location.pathname, link.to) ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="nav-actions">
          <button
            type="button"
            className="nav-icon-btn"
            aria-label="Search the menu"
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((open) => !open)}
          >
            <Icon name="search" size={19} strokeWidth={2} />
          </button>

          <Link to="/cart" className="nav-icon-btn nav-cart-btn" aria-label={`Cart, ${itemCount} item${itemCount === 1 ? '' : 's'}`}>
            <Icon name="cart" size={19} strokeWidth={2} />
            {itemCount > 0 && <span className="nav-cart-badge">{itemCount > 99 ? '99+' : itemCount}</span>}
          </Link>

          <button
            type="button"
            className="nav-icon-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} />
          </button>

          <div className="nav-profile" ref={profileRef}>
            <button
              type="button"
              className="nav-avatar-btn"
              onClick={() => setProfileOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              aria-label="Account menu"
            >
              <span className="nav-avatar">{initials}</span>
              <span className="nav-username">{user.name}</span>
              <Icon name="chevronDown" size={15} className="nav-caret" />
            </button>

            <div className={`nav-menu ${profileOpen ? 'is-open' : ''}`} role="menu">
              <div className="nav-menu-head">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </div>
              <Link to="/profile" role="menuitem" className="nav-menu-item"><Icon name="user" size={17} /> Profile</Link>
              <Link to="/my-orders" role="menuitem" className="nav-menu-item"><Icon name="receipt" size={17} /> My Orders</Link>
              <Link to="/cart" role="menuitem" className="nav-menu-item"><Icon name="cart" size={17} /> Cart</Link>
              {isAdmin && (
                <Link to="/dashboard" role="menuitem" className="nav-menu-item"><Icon name="pizza" size={17} /> Customer view</Link>
              )}
              <button type="button" role="menuitem" className="nav-menu-item is-danger" onClick={handleLogout}>
                <Icon name="logout" size={17} /> Log out
              </button>
            </div>
          </div>

          <button
            type="button"
            className="nav-burger"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
          >
            <span className={`nav-burger-icon ${menuOpen ? 'is-open' : ''}`}>
              <i />
              <i />
              <i />
            </span>
          </button>
        </div>
      </div>

      {/* Search bar — slides down below the navbar */}
      <div className={`nav-search ${searchOpen ? 'is-open' : ''}`} aria-hidden={!searchOpen}>
        <form className="container nav-search-inner" onSubmit={runSearch} role="search">
          <Icon name="search" size={18} className="nav-search-icon" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={isAdmin ? 'Search products…' : 'Search pizzas, drinks, categories…'}
            aria-label="Search"
            tabIndex={searchOpen ? 0 : -1}
          />
          <button type="submit" className="btn btn-primary btn-sm">Search</button>
        </form>
      </div>

      {/* Mobile drawer */}
      <div className={`nav-backdrop ${menuOpen ? 'is-open' : ''}`} onClick={() => setMenuOpen(false)} aria-hidden="true" />
      <div
        id="mobile-navigation"
        className={`nav-drawer ${menuOpen ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!menuOpen}
      >
        <div className="nav-drawer-head">
          <div className="nav-drawer-user">
            <span className="nav-avatar">{initials}</span>
            <span className="nav-drawer-user-text">
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </span>
          </div>
          <button type="button" className="nav-icon-btn" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <Icon name="close" size={18} />
          </button>
        </div>

        <nav className="nav-drawer-links" aria-label="Mobile">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`nav-drawer-link ${isActive(location.pathname, link.to) ? 'is-active' : ''}`}
              tabIndex={menuOpen ? 0 : -1}
            >
              <span>{link.label}</span>
              <Icon name="arrowRight" size={17} className="nav-drawer-arrow" />
            </Link>
          ))}
        </nav>

        <div className="nav-drawer-secondary">
          <Link to="/cart" className="nav-drawer-link" tabIndex={menuOpen ? 0 : -1}>
            <span><Icon name="cart" size={17} /> Cart</span>
            {itemCount > 0 && <span className="nav-cart-badge">{itemCount}</span>}
          </Link>
          <Link to="/profile" className="nav-drawer-link" tabIndex={menuOpen ? 0 : -1}>
            <span><Icon name="user" size={17} /> Profile</span>
          </Link>
          <button
            type="button"
            className="nav-drawer-link"
            onClick={toggleTheme}
            tabIndex={menuOpen ? 0 : -1}
          >
            <span><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} /> {theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
        </div>

        <button type="button" className="btn btn-secondary btn-block nav-drawer-logout" onClick={handleLogout} tabIndex={menuOpen ? 0 : -1}>
          Log out
        </button>
      </div>
    </header>
  );
};

export default Navbar;
