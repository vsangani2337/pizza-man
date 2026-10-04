import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => (
  <footer className="site-footer">
    <div className="container site-footer-grid">
      <div className="site-footer-brand">
        <Link to="/home" className="nav-brand">
          <span className="nav-brand-mark" aria-hidden="true">🍕</span>
          <span className="nav-brand-name">
            Pizza <em>Man</em>
          </span>
        </Link>
        <p>Hand-stretched bases, slow-simmered sauce and cheese pulled fresh — baked the moment you order.</p>
        <div className="site-footer-badges">
          <span className="chip chip-ok">🔥 Wood-fired</span>
          <span className="chip chip-ok">⚡ 30 min delivery</span>
          <span className="chip chip-ok">🔒 Secure checkout</span>
        </div>
      </div>

      <nav className="site-footer-col" aria-label="Order">
        <h3>Order</h3>
        <Link to="/dashboard">Menu</Link>
        <Link to="/build-pizza">Build your pizza</Link>
        <Link to="/cart">Cart</Link>
        <Link to="/my-orders">Track an order</Link>
      </nav>

      <nav className="site-footer-col" aria-label="Account">
        <h3>Account</h3>
        <Link to="/profile">Profile</Link>
        <Link to="/profile">Saved addresses</Link>
        <Link to="/login">Sign in</Link>
        <Link to="/register">Create account</Link>
      </nav>

      <div className="site-footer-col">
        <h3>Visit us</h3>
        <span>MG Road, Bengaluru</span>
        <span>11:00 AM – 11:00 PM</span>
        <a href="tel:+919000000000">+91 90000 00000</a>
        <a href="mailto:hello@pizzaman.in">hello@pizzaman.in</a>
      </div>
    </div>

    <div className="container site-footer-bottom">
      <span>© {new Date().getFullYear()} Pizza Man. All rights reserved.</span>
      <span>Made fresh, daily.</span>
    </div>
  </footer>
);

export default Footer;
