import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart, buildQuotePayload } from '../../context/CartContext';
import { createPaymentOrder, verifyPayment, quoteOrder } from '../../services/api';
import { toast } from 'react-toastify';
import { LoadingState, ErrorState } from '../../components/StateViews';
import './Checkout.css';

const CUSTOMER_KEY = 'pizza-customer';

const formatINR = (value) =>
  `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (document.getElementById('razorpay-script')) return resolve(true);
    const script = document.createElement('script');
    script.id = 'razorpay-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const loadSavedCustomer = (user) => {
  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOMER_KEY) || 'null');
    if (saved && typeof saved === 'object') {
      return {
        name: saved.name || user?.name || '',
        phone: saved.phone || user?.phone || '',
        address: saved.address || '',
      };
    }
  } catch {
    // ignore broken storage
  }
  return { name: user?.name || '', phone: user?.phone || '', address: '' };
};

const validateCustomer = (customer) => {
  const errors = {};
  if (customer.name.trim().length < 2) errors.name = 'Please enter your full name.';
  if (!/^[6-9]\d{9}$/.test(customer.phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, ''))) {
    errors.phone = 'Enter a valid 10-digit mobile number.';
  }
  if (customer.address.trim().length < 5) errors.address = 'Enter your delivery address (min 5 characters).';
  return errors;
};

const lineDescription = (quote) => {
  if (quote.type === 'drink') return 'Cold drink';
  const c = quote.customization || {};
  const parts = [c.base, c.sauce, c.cheese].filter(Boolean);
  if (c.veggies?.length) parts.push(c.veggies.join(', '));
  if (c.addons?.length) parts.push(`+ ${c.addons.join(', ')}`);
  return parts.join(' · ');
};

const Checkout = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, clearCart } = useCart();

  const payload = useMemo(() => buildQuotePayload(items), [items]);
  const payloadKey = JSON.stringify(payload);

  const [customer, setCustomer] = useState(() => loadSavedCustomer(user));
  const [fieldErrors, setFieldErrors] = useState({});

  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteError, setQuoteError] = useState('');
  const [quoteAttempt, setQuoteAttempt] = useState(0);

  const [paying, setPaying] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(null); // { orderNumber, total }
  const [verifyResponse, setVerifyResponse] = useState(null);
  const [verifyError, setVerifyError] = useState('');
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (items.length === 0) {
      setQuote(null);
      setQuoteLoading(false);
      return undefined;
    }
    let cancelled = false;
    setQuoteLoading(true);
    setQuoteError('');

    quoteOrder(payload)
      .then(({ data }) => {
        if (cancelled) return;
        setQuote(data);
        setQuoteLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setQuoteError(err.response?.data?.message || 'Unable to price this order.');
        setQuoteLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadKey, quoteAttempt]);

  const retryQuote = () => setQuoteAttempt((attempt) => attempt + 1);

  const handleVerify = async (payloadFromGateway, { isRetry = false } = {}) => {
    setVerifyResponse(payloadFromGateway);
    if (isRetry) setRetrying(true);
    try {
      const { data } = await verifyPayment({
        razorpay_order_id: payloadFromGateway.razorpay_order_id,
        razorpay_payment_id: payloadFromGateway.razorpay_payment_id,
        razorpay_signature: payloadFromGateway.razorpay_signature,
      });
      setVerifyError('');
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
      const order = data.order;
      setOrderPlaced({
        orderNumber: order?.orderNumber || null,
        total: order?.totalPrice ?? quote?.summary?.total ?? 0,
      });
      clearCart();
      toast.success('Payment successful! Order placed. 🍕');
    } catch (err) {
      setVerifyError(
        err.response?.data?.message ||
          'Payment verification failed. You were not charged twice — press "Retry confirmation".'
      );
      toast.error(err.response?.data?.message || 'Payment verification failed');
    } finally {
      setRetrying(false);
    }
  };

  const handlePayment = async () => {
    if (items.length === 0 || quoteLoading || quoteError || !quote) return;

    const errors = validateCustomer(customer);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error('Please fix the highlighted fields.');
      return;
    }

    setPaying(true);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error('Razorpay SDK failed to load. Check your internet connection.');
        return;
      }

      let order;
      try {
        const response = await createPaymentOrder(payload, customer);
        order = response.data;
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to create payment order');
        return;
      }

      if (!order?.id) {
        toast.error('Invalid order response from server');
        return;
      }

      const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!razorpayKey) {
        toast.error('Razorpay key not configured. Check your .env file.');
        return;
      }

      const options = {
        key: razorpayKey,
        amount: order.amount,
        currency: order.currency,
        name: 'Pizza Man',
        description: `Order — ${items.length} item${items.length === 1 ? '' : 's'}`,
        order_id: order.id,
        handler: (response) => handleVerify(response),
        prefill: {
          name: customer.name,
          email: user?.email || '',
          contact: customer.phone,
        },
        notes: { address: customer.address.slice(0, 180) },
        theme: { color: '#0EA5E9' },
        modal: {
          ondismiss: () => setPaying(false),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (event) => {
        toast.error(event.error?.description || 'Payment failed. Please try again.');
        setPaying(false);
      });
      rzp.open();
    } catch {
      toast.error('Error initiating payment. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  if (items.length === 0 && !orderPlaced) {
    return (
      <div className="page container checkout-page">
        <header className="page-header">
          <div className="page-header-text">
            <span className="eyebrow">💳 Secure checkout</span>
            <h1 className="page-title">Checkout</h1>
          </div>
        </header>
        <div className="checkout-card checkout-card--empty">
          <div className="checkout-empty-art" aria-hidden="true">🧺</div>
          <h2>Your cart is empty</h2>
          <p>Nothing to pay for yet — pick a favourite or design your own.</p>
          <div className="state-actions">
            <Link to="/dashboard" className="btn btn-primary">Browse the menu</Link>
            <Link to="/build-pizza" className="btn btn-secondary">Build a pizza</Link>
          </div>
        </div>
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="page container checkout-page">
        <div className="checkout-card checkout-success">
          <div className="checkout-success-icon" aria-hidden="true">🎉</div>
          <span className="eyebrow">Payment confirmed</span>
          <h1>Your order is in the oven!</h1>
          {orderPlaced.orderNumber && (
            <p className="checkout-order-number">Order #{orderPlaced.orderNumber}</p>
          )}
          <p className="checkout-success-paid">
            Paid <strong>{formatINR(orderPlaced.total)}</strong> — we&apos;ll start preparing it right away.
          </p>

          <ul className="checkout-success-steps">
            <li><span aria-hidden="true">1</span> Order received by the kitchen</li>
            <li><span aria-hidden="true">2</span> Freshly baked &amp; packed</li>
            <li><span aria-hidden="true">3</span> Delivered to your door</li>
          </ul>

          <div className="state-actions checkout-success-actions">
            <Link to="/my-orders" className="btn btn-primary">View my orders</Link>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
              Back to menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  const summary = quote?.summary;
  const quotes = quote?.quotes || [];
  const quoteReady = !quoteLoading && !quoteError && !!summary;

  return (
    <div className="page container checkout-page">
      <header className="page-header">
        <div className="page-header-text">
          <span className="eyebrow">💳 Secure checkout</span>
          <h1 className="page-title">Checkout</h1>
          <p className="page-subtitle">
            Confirm your delivery details — the price below is calculated on our server.
          </p>
        </div>
        <Link to="/cart" className="btn btn-ghost btn-sm">← Edit cart</Link>
      </header>

      <div className="checkout-grid">
        <div className="checkout-main">
          {/* ---- Delivery details ---- */}
          <section className="checkout-card checkout-section" aria-labelledby="delivery-heading">
            <h2 className="panel-title" id="delivery-heading">
              <span className="panel-icon" aria-hidden="true">📍</span>
              Delivery details
            </h2>

            <div className="checkout-customer-form">
              <label className="form-field">
                <span>Full name</span>
                <input
                  type="text"
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  placeholder="Your name"
                  maxLength={80}
                  autoComplete="name"
                  aria-invalid={Boolean(fieldErrors.name)}
                />
                {fieldErrors.name && <em className="field-error">{fieldErrors.name}</em>}
              </label>

              <label className="form-field">
                <span>Phone</span>
                <input
                  type="tel"
                  value={customer.phone}
                  onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                  placeholder="10-digit mobile number"
                  maxLength={16}
                  autoComplete="tel"
                  aria-invalid={Boolean(fieldErrors.phone)}
                />
                {fieldErrors.phone && <em className="field-error">{fieldErrors.phone}</em>}
              </label>

              <label className="form-field form-field--wide checkout-address-field">
                <span>Delivery address</span>
                <textarea
                  value={customer.address}
                  onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                  placeholder="Flat / street / landmark / city"
                  rows={3}
                  maxLength={300}
                  autoComplete="street-address"
                  aria-invalid={Boolean(fieldErrors.address)}
                />
                {fieldErrors.address && <em className="field-error">{fieldErrors.address}</em>}
              </label>
            </div>
          </section>

          {/* ---- Items ---- */}
          <section className="checkout-card checkout-section" aria-labelledby="items-heading">
            <h2 className="panel-title" id="items-heading">
              <span className="panel-icon" aria-hidden="true">🛍️</span>
              Your items
              <span className="tag checkout-item-count">{quotes.length || items.length}</span>
            </h2>

            {quoteLoading ? (
              <LoadingState message="Pricing your order…" />
            ) : quoteError ? (
              <ErrorState message={quoteError} onRetry={retryQuote} />
            ) : (
              <ul className="checkout-lines">
                {quotes.map((line, index) => (
                  <li className="checkout-line-card" key={`${line.name}-${index}`}>
                    <span className="checkout-line-emoji" aria-hidden="true">
                      {line.type === 'drink' ? '🥤' : '🍕'}
                    </span>
                    <div className="checkout-line-body">
                      <div className="checkout-line-head">
                        <span className="checkout-line-name">{line.name}</span>
                        {line.sizeName && <span className="checkout-line-size">{line.sizeName}</span>}
                        <span className="checkout-line-total">{formatINR(line.subtotal)}</span>
                      </div>
                      <p className="checkout-line-config">{lineDescription(line)}</p>
                      <p className="checkout-line-qty">
                        {formatINR(line.unitPrice)} × {line.quantity}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {verifyError && verifyResponse && (
            <div className="checkout-retry-panel" role="alert">
              <span className="checkout-retry-icon" aria-hidden="true">⚠️</span>
              <div>
                <strong>We could not confirm your payment.</strong>
                <p>{verifyError}</p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleVerify(verifyResponse, { isRetry: true })}
                disabled={retrying}
              >
                {retrying ? 'Confirming…' : 'Retry confirmation'}
              </button>
            </div>
          )}
        </div>

        {/* ---- Pay summary ---- */}
        <aside className="checkout-aside" aria-label="Payment summary">
          <div className="checkout-summary-card">
            <h2 className="panel-title">
              <span className="panel-icon" aria-hidden="true">🧾</span>
              Payment summary
            </h2>

            {!quoteReady ? (
              quoteLoading ? (
                <LoadingState message="Calculating charges…" />
              ) : (
                <ErrorState
                  title="Unable to price this order."
                  message={quoteError || 'Please try again.'}
                  onRetry={retryQuote}
                />
              )
            ) : (
              <>
                <div className="checkout-price-block">
                  <div className="checkout-price-row">
                    <span>Subtotal</span>
                    <span>{formatINR(summary.subtotal)}</span>
                  </div>
                  <div className="checkout-price-row">
                    <span>Delivery fee</span>
                    <span className={summary.deliveryFee === 0 ? 'is-free' : ''}>
                      {summary.deliveryFee > 0
                        ? formatINR(summary.deliveryFee)
                        : summary.freeDeliveryAbove > 0
                          ? 'Free'
                          : formatINR(0)}
                    </span>
                  </div>
                  {summary.tax > 0 && (
                    <div className="checkout-price-row">
                      <span>Tax{summary.taxRatePercent ? ` (${summary.taxRatePercent}%)` : ''}</span>
                      <span>{formatINR(summary.tax)}</span>
                    </div>
                  )}
                  {summary.discount > 0 && (
                    <div className="checkout-price-row is-discount">
                      <span>Discount</span>
                      <span>− {formatINR(summary.discount)}</span>
                    </div>
                  )}
                </div>

                <div className="checkout-total-row">
                  <span>Total</span>
                  <strong>{formatINR(summary.total)}</strong>
                </div>

                <p className="checkout-price-note">
                  Final amount is calculated on our server. The price you see here is what you pay.
                </p>

                <button
                  type="button"
                  className="btn btn-primary btn-lg btn-block checkout-pay-btn"
                  onClick={handlePayment}
                  disabled={paying || retrying}
                >
                  {paying ? (
                    <>Opening gateway…</>
                  ) : (
                    <>🔒 Pay {formatINR(summary.total)}</>
                  )}
                </button>

                <ul className="checkout-assurances">
                  <li><span aria-hidden="true">🔐</span> 256-bit encrypted Razorpay checkout</li>
                  <li><span aria-hidden="true">↩️</span> Instant refund on a failed payment</li>
                </ul>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Checkout;
