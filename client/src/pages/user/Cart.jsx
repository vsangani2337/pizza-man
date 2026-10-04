import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { EmptyState } from '../../components/StateViews';
import QuantitySelector from '../../components/ui/QuantitySelector';
import { resolveProductImage } from '../../utils/productImages';
import { customizationSummary, formatINR } from '../../utils/cartItem';
import { toast } from 'react-toastify';
import './Cart.css';

const Cart = () => {
  const navigate = useNavigate();
  const { items, itemCount, subtotal, setQuantity, removeItem, clearCart } = useCart();

  const handleClear = () => {
    if (items.length === 0) return;
    if (window.confirm('Remove all items from your cart?')) {
      clearCart();
      toast.info('Cart cleared.');
    }
  };

  if (items.length === 0) {
    return (
      <div className="page container cart-page">
        <header className="page-header">
          <div className="page-header-text">
            <span className="eyebrow">🛒 Your order</span>
            <h1 className="page-title">Your Cart</h1>
          </div>
        </header>

        <EmptyState
          icon="🧺"
          title="Your cart is feeling a little empty."
          description="Add a signature pizza or a chilled drink and we'll get the oven ready."
        >
          <button type="button" className="btn btn-primary" onClick={() => navigate('/dashboard')}>
            Explore Menu
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/build-pizza')}>
            Build a Pizza
          </button>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="page container cart-page">
      <header className="page-header">
        <div className="page-header-text">
          <span className="eyebrow">🛒 Your order</span>
          <h1 className="page-title">Your Cart</h1>
          <p className="page-subtitle">
            {itemCount} item{itemCount === 1 ? '' : 's'} ready for the oven — check the details before checkout.
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={handleClear}>
          Clear cart
        </button>
      </header>

      <div className="cart-layout">
        <section className="cart-items" aria-label="Cart items">
          {items.map((item) => {
            const key = item.key;
            const image = resolveProductImage(item);
            const isDrink = item.type === 'drink';

            return (
              <article className="cart-line animate-fade" key={key}>
                <div className="cart-line-media">
                  {image ? (
                    <img src={image} alt={item.name} loading="lazy" />
                  ) : (
                    <span className="cart-line-fallback" aria-hidden="true">{isDrink ? '🥤' : '🍕'}</span>
                  )}
                </div>

                <div className="cart-line-body">
                  <div className="cart-line-head">
                    <h2 className="cart-line-name">{item.name}</h2>
                    {item.sizeName && <span className="tag">{item.sizeName}</span>}
                  </div>

                  <p className="cart-line-config">{customizationSummary(item)}</p>
                  <p className="cart-line-unit">
                    {formatINR(item.unitPrice)} each
                    {!isDrink && <span className="cart-line-note"> · estimate, final price set at checkout</span>}
                  </p>

                  <div className="cart-line-foot">
                    <QuantitySelector
                      value={item.quantity}
                      onChange={(next) => setQuantity(key, next)}
                      max={50}
                      label={`${item.name} quantity`}
                    />
                    <strong className="cart-line-total">{formatINR(item.unitPrice * item.quantity)}</strong>
                    <button
                      type="button"
                      className="cart-line-remove"
                      onClick={() => removeItem(key)}
                      aria-label={`Remove ${item.name} from cart`}
                      title="Remove item"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </article>
            );
          })}

          <Link to="/dashboard" className="cart-continue">
            ← Continue shopping
          </Link>
        </section>

        <aside className="cart-summary" aria-label="Order summary">
          <div className="cart-summary-card">
            <h2 className="panel-title">
              <span className="panel-icon" aria-hidden="true">🧾</span>
              Summary
            </h2>

            <div className="cart-summary-row">
              <span>Items subtotal</span>
              <span>{formatINR(subtotal)}</span>
            </div>
            <div className="cart-summary-row is-muted">
              <span>Tax, delivery &amp; discounts</span>
              <span>At checkout</span>
            </div>

            <p className="cart-summary-note">
              Delivery fee, tax and the final total are calculated on the server at checkout —
              that amount is what you pay.
            </p>

            <div className="cart-summary-total">
              <span>Items</span>
              <strong>{formatINR(subtotal)}</strong>
            </div>

            <button type="button" className="btn btn-primary btn-lg btn-block cart-checkout" onClick={() => navigate('/checkout')}>
              Proceed to Checkout
              <span aria-hidden="true">→</span>
            </button>

            <Link to="/dashboard" className="cart-summary-link">Keep browsing the menu</Link>
          </div>

          <ul className="cart-assurances">
            <li><span aria-hidden="true">🔒</span> Secure Razorpay checkout</li>
            <li><span aria-hidden="true">⏱️</span> Fresh out of the oven in ~30 min</li>
            <li><span aria-hidden="true">↩️</span> Cancel free while the order is placed</li>
          </ul>
        </aside>
      </div>
    </div>
  );
};

export default Cart;
