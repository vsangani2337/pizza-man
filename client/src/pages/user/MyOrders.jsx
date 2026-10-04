import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getMyOrders, cancelOrder, getSettings } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { normalizeOrder, formatMoney, formatOrderStamp, formatOrderMeta } from '../../utils/normalizeOrder';
import { ErrorState, EmptyState } from '../../components/StateViews';
import { SkeletonLine } from '../../components/ui/Skeletons';
import StatusBadge from '../../components/ui/StatusBadge';
import Icon from '../../components/ui/Icon';
import Receipt from '../../components/Receipt';
import { resolveProductImage } from '../../utils/productImages';
import { toast } from 'react-toastify';
import './MyOrders.css';

const STATUS_FLOW = [
  { label: 'Order Placed', icon: 'package' },
  { label: 'Order Received', icon: 'check' },
  { label: 'In the Kitchen', icon: 'chef' },
  { label: 'Sent to Delivery', icon: 'car' },
  { label: 'Delivered', icon: 'location' },
];

const customizationLines = (item) => {
  if (item.type === 'drink') return ['Chilled drink'];
  const c = item.customization || {};
  const base = [c.base, c.sauce, c.cheese].filter(Boolean).join(' • ');
  const extras = [
    ...(c.veggies || []).join(', '),
    ...(c.addons || []).length ? [`+ ${c.addons.join(', ')}`] : [],
  ].filter(Boolean);
  return [base, extras.join(' ')].filter(Boolean);
};

const fallbackIcon = (item) => (item?.type === 'drink' ? 'cup' : 'pizza');

const MyOrders = () => {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [storeName, setStoreName] = useState('Pizza Man');
  const trackingRef = useRef(null);

  const fetchOrders = useCallback(async ({ initial = false } = {}) => {
    try {
      const { data } = await getMyOrders();
      const list = (Array.isArray(data) ? data : []).map(normalizeOrder);
      setOrders(list);
      setLoadError('');
      setSelectedId((prev) => prev ?? (list[0] && list[0].id));
    } catch (err) {
      if (initial) {
        setLoadError(err.response?.data?.message || 'Could not load your orders.');
      }
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders({ initial: true });
    getSettings()
      .then(({ data }) => data.storeName && setStoreName(data.storeName))
      .catch(() => {});

    // Refetch when the tab regains focus (cheap, no polling while idle).
    const handleFocus = () => fetchOrders();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    // Light poll — but only while at least one order is still in progress.
    let interval = null;
    const start = () => {
      if (interval !== null) return;
      interval = setInterval(() => {
        setOrders((current) => {
          const hasActive = current.some(
            (order) => !order.cancelled && order.status !== 'Delivered'
          );
          if (hasActive) fetchOrders();
          return current;
        });
      }, 15000);
    };
    const stop = () => {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
    };
    const handleVisibility = () => {
      if (document.hidden) stop();
      else {
        fetchOrders();
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      stop();
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchOrders]);

  const handleCancel = async (order) => {
    if (!window.confirm(`Cancel order ${order.orderNumber}? This cannot be undone.`)) return;
    setCancelling(order.id);
    try {
      await cancelOrder(order.id);
      toast.success('Order cancelled.');
      await fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not cancel this order.');
    } finally {
      setCancelling(null);
    }
  };

  const handleReorder = (order) => {
    order.items.forEach((item) => {
      if (item.type === 'drink') {
        addItem({
          type: 'drink',
          productId: null,
          name: item.name,
          image: item.image || '',
          size: null,
          sizeName: null,
          quantity: item.quantity,
          unitPrice: item.unitPrice || 0,
          customization: null,
        });
        return;
      }
      const c = item.customization || {};
      addItem({
        type: 'pizza',
        productId: item.productId || null,
        name: item.name,
        image: item.image || '',
        size: item.size || c.size || 'medium',
        sizeName: item.sizeName || c.sizeName || 'Medium',
        quantity: item.quantity,
        unitPrice: item.unitPrice || 0,
        customization: {
          base: c.base,
          sauce: c.sauce,
          cheese: c.cheese,
          veggies: c.veggies || [],
          addons: c.addons || [],
          size: item.size || c.size || 'medium',
          sizeName: item.sizeName || c.sizeName || 'Medium',
        },
      });
    });
    toast.success('Items added to your cart! 🛒');
    navigate('/cart');
  };

  const revealTracking = () => {
    trackingRef.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center',
    });
  };

  /* ---------- Loading skeleton ---------- */
  if (loading && orders.length === 0) {
    return (
      <div className="page container my-orders">
        <header className="page-header">
          <div className="page-header-text">
            <span className="eyebrow">Order history</span>
            <h1 className="page-title">Your Pizza Journey</h1>
            <p className="page-subtitle">Track your orders, revisit your favorites, and order again.</p>
          </div>
        </header>

        <div className="orders-layout" role="status" aria-label="Loading your orders">
          <div className="orders-list-panel">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="order-card order-card--skeleton" key={index}>
                <SkeletonLine width="44px" height={44} />
                <div className="order-card-body">
                  <SkeletonLine width="70%" height={13} />
                  <SkeletonLine width="50%" height={11} />
                  <SkeletonLine width="40%" height={11} />
                </div>
              </div>
            ))}
          </div>
          <div className="order-detail-panel order-detail--skeleton">
            <SkeletonLine width="180px" height={26} />
            <SkeletonLine width="240px" height={14} />
            <div className="skeleton-group">
              <SkeletonLine width="100%" height={72} />
              <SkeletonLine width="100%" height={72} />
            </div>
            <SkeletonLine width="60%" height={16} />
            <SkeletonLine width="100%" height={120} />
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Error ---------- */
  if (loadError && orders.length === 0) {
    return (
      <div className="page container my-orders">
        <header className="page-header">
          <div className="page-header-text">
            <span className="eyebrow">Order history</span>
            <h1 className="page-title">Your Pizza Journey</h1>
          </div>
        </header>
        <ErrorState
          title="We couldn’t load your orders."
          message="Something went wrong on our side. Give it another try in a moment."
          onRetry={() => {
            setLoading(true);
            fetchOrders({ initial: true });
          }}
        />
      </div>
    );
  }

  const selectedOrder = orders.find((o) => o.id === selectedId) || orders[0];
  const activeCount = orders.filter((o) => !o.cancelled && o.status !== 'Delivered').length;

  return (
    <div className="page container my-orders">
      <header className="page-header">
        <div className="page-header-text">
          <span className="eyebrow">
            <Icon name="receipt" size={14} strokeWidth={2.1} />
            Order history
          </span>
          <h1 className="page-title">Your Pizza Journey</h1>
          <p className="page-subtitle">Track your orders, revisit your favorites, and order again.</p>
        </div>

        <div className="orders-header-stats" aria-label="Order summary">
          <div className="orders-stat">
            <strong>{orders.length}</strong>
            <span>total</span>
          </div>
          <div className="orders-stat is-live">
            <strong>{activeCount}</strong>
            <span>in progress</span>
          </div>
          <Link to="/dashboard" className="btn btn-secondary btn-sm">
            <Icon name="pizza" size={16} />
            Browse menu
          </Link>
        </div>
      </header>

      {orders.length === 0 ? (
        <EmptyState
          icon="🍕"
          title="No orders yet"
          description="Your next pizza is waiting — build one exactly the way you like it."
          action={<Link to="/dashboard" className="btn btn-primary">Explore Menu</Link>}
        />
      ) : (
        <div className="orders-layout">
          {/* ---- Recent orders ---- */}
          <aside className="orders-list-panel" aria-label="Recent orders">
            <div className="orders-list-head">
              <h2>Recent orders</h2>
              <span className="orders-list-count">{orders.length}</span>
            </div>

            <div className="orders-list">
              {orders.map((order) => {
                const first = order.items[0];
                const thumb = first ? resolveProductImage({ image: first.image }) : null;
                const active = Boolean(selectedOrder && order.id === selectedOrder.id);

                return (
                  <button
                    key={order.id}
                    type="button"
                    aria-current={active ? 'true' : undefined}
                    aria-label={`View order ${order.orderNumber}`}
                    className={`order-card ${active ? 'is-active' : ''} ${order.cancelled ? 'is-cancelled' : ''}`}
                    onClick={() => setSelectedId(order.id)}
                  >
                    <span className="order-card-thumb">
                      {thumb ? (
                        <img src={thumb} alt="" loading="lazy" />
                      ) : (
                        <Icon name={fallbackIcon(first)} size={20} strokeWidth={1.7} />
                      )}
                    </span>

                    <span className="order-card-body">
                      <span className="order-card-top">
                        <span className="order-card-number">{order.orderNumber}</span>
                        <span className="order-card-total">{formatMoney(order.totalPrice)}</span>
                      </span>

                      <span className="order-card-meta">
                        <Icon name="clock" size={12} />
                        <time dateTime={order.createdAt}>{formatOrderMeta(order.createdAt)}</time>
                      </span>

                      <span className="order-card-foot">
                        <StatusBadge status={order.status} dot />
                        <span className="order-card-items">
                          {order.quantity} item{order.quantity === 1 ? '' : 's'}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* ---- Order detail ---- */}
          {selectedOrder && (
            <section className="order-detail-panel" aria-label={`Order ${selectedOrder.orderNumber} details`}>
              {/* Header */}
              <header className="order-detail-head">
                <div className="order-detail-head-text">
                  <span className="detail-label">Order number</span>
                  <h2 className="order-number">{selectedOrder.orderNumber}</h2>
                  <p className="order-stamp">
                    <Icon name="clock" size={14} />
                    <time dateTime={selectedOrder.createdAt}>{formatOrderStamp(selectedOrder.createdAt)}</time>
                  </p>
                </div>

                <div className="order-detail-pills">
                  <span className="order-pill-group">
                    <span className="detail-label">Payment</span>
                    <StatusBadge
                      kind="payment"
                      status={selectedOrder.paymentStatus}
                      size="lg"
                      icon
                    />
                  </span>
                  <span className="order-pill-group">
                    <span className="detail-label">Status</span>
                    <StatusBadge status={selectedOrder.status} size="lg" icon />
                  </span>
                </div>
              </header>

              {/* Items */}
              <div className="order-section">
                <h3 className="order-section-title">
                  <Icon name="pizza" size={16} />
                  Your order
                  <span className="order-section-count">
                    {selectedOrder.quantity} item{selectedOrder.quantity === 1 ? '' : 's'}
                  </span>
                </h3>

                <ul className="order-items-list">
                  {selectedOrder.items.map((item, index) => {
                    const image = resolveProductImage({ image: item.image });
                    const lines = customizationLines(item);

                    return (
                      <li className="order-line" key={`${item.name}-${index}`}>
                        <span className="order-line-thumb">
                          {image ? (
                            <img src={image} alt="" loading="lazy" />
                          ) : (
                            <Icon name={fallbackIcon(item)} size={22} strokeWidth={1.7} />
                          )}
                        </span>

                        <div className="order-line-body">
                          <div className="order-line-head">
                            <span className="order-line-name">{item.name}</span>
                            {item.sizeName && <span className="tag">{item.sizeName}</span>}
                          </div>

                          {lines.map((line) => (
                            <p className="order-line-config" key={line}>{line}</p>
                          ))}

                          <span className="order-line-qty">Qty {item.quantity} × {formatMoney(item.unitPrice)}</span>
                        </div>

                        <strong className="order-line-price">{formatMoney(item.subtotal)}</strong>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Delivery */}
              <div className="order-section order-delivery">
                <span className="order-section-icon" aria-hidden="true">
                  <Icon name="location" size={17} />
                </span>
                <div className="order-delivery-body">
                  <h3 className="detail-label">Delivery address</h3>
                  {selectedOrder.customer &&
                  (selectedOrder.customer.name || selectedOrder.customer.address) ? (
                    <>
                      <p className="order-delivery-person">
                        <strong>{selectedOrder.customer.name || 'Customer'}</strong>
                        {selectedOrder.customer.phone && (
                          <span className="order-delivery-phone">
                            <Icon name="phone" size={13} />
                            {selectedOrder.customer.phone}
                          </span>
                        )}
                      </p>
                      <p className="order-delivery-address">
                        {selectedOrder.customer.address || 'Address not available for this order.'}
                      </p>
                    </>
                  ) : (
                    <p className="order-delivery-empty">
                      No delivery address was saved with this order.
                    </p>
                  )}
                </div>
              </div>

              {/* Totals */}
              <div className="order-section order-totals">
                <div className="order-charge-row">
                  <span>Subtotal</span>
                  <span>{formatMoney(selectedOrder.subtotal)}</span>
                </div>
                <div className="order-charge-row">
                  <span>Delivery</span>
                  <span>{selectedOrder.deliveryFee > 0 ? formatMoney(selectedOrder.deliveryFee) : 'Free'}</span>
                </div>
                <div className="order-charge-row">
                  <span>Tax</span>
                  <span>{formatMoney(selectedOrder.tax)}</span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className="order-charge-row is-discount">
                    <span>Discount</span>
                    <span>− {formatMoney(selectedOrder.discount)}</span>
                  </div>
                )}

                <div className="order-total">
                  <span>Total</span>
                  <strong>{formatMoney(selectedOrder.totalPrice)}</strong>
                </div>

                {selectedOrder.paymentId && (
                  <p className="order-payment-id">Payment ID · {selectedOrder.paymentId}</p>
                )}
              </div>

              {/* Tracking */}
              {selectedOrder.cancelled ? (
                <div className="order-cancelled-banner" role="status">
                  <Icon name="close" size={17} />
                  <span>
                    This order was cancelled. Any payment made will be refunded by our team.
                  </span>
                </div>
              ) : (
                <div className="order-section" id="order-tracking" ref={trackingRef}>
                  <h3 className="order-section-title">
                    <Icon name="location" size={16} />
                    Track your order
                  </h3>

                  <ol className="order-timeline">
                    {STATUS_FLOW.map((step, i) => {
                      const done = i < selectedOrder.statusIndex;
                      const current = i === selectedOrder.statusIndex;

                      return (
                        <li
                          className={`timeline-step ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`}
                          key={step.label}
                          aria-current={current ? 'step' : undefined}
                        >
                          <span className="timeline-marker">
                            <span className="timeline-dot">
                              <Icon name={done ? 'check' : step.icon} size={15} strokeWidth={2.2} />
                            </span>
                            {i < STATUS_FLOW.length - 1 && <span className="timeline-connector" />}
                          </span>

                          <span className="timeline-body">
                            <strong>{step.label}</strong>
                            <small>
                              {current
                                ? selectedOrder.status === 'Delivered'
                                  ? 'Delivered — enjoy!'
                                  : 'Happening now'
                                : done
                                  ? 'Completed'
                                  : 'Pending'}
                            </small>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              {/* Actions */}
              <div className="order-actions">
                {!selectedOrder.cancelled && selectedOrder.status !== 'Delivered' && (
                  <button type="button" className="btn btn-secondary" onClick={revealTracking}>
                    <Icon name="location" size={16} />
                    Track order
                  </button>
                )}
                <button type="button" className="btn btn-primary" onClick={() => handleReorder(selectedOrder)}>
                  <Icon name="refresh" size={16} />
                  Order again
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setReceiptOrder(selectedOrder)}>
                  <Icon name="receipt" size={16} />
                  Receipt
                </button>
                {selectedOrder.status === 'Order Placed' && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-danger-text"
                    onClick={() => handleCancel(selectedOrder)}
                    disabled={cancelling === selectedOrder.id}
                  >
                    {cancelling === selectedOrder.id ? 'Cancelling…' : 'Cancel order'}
                  </button>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      <Receipt
        open={Boolean(receiptOrder)}
        order={receiptOrder}
        storeName={storeName}
        onClose={() => setReceiptOrder(null)}
      />
    </div>
  );
};

export default MyOrders;
