import { useCallback, useEffect, useState } from 'react';
import { getAllOrders, updateOrderStatus } from '../../services/api';
import { normalizeOrder, formatDate, formatMoney } from '../../utils/normalizeOrder';
import { LoadingState, ErrorState, EmptyState } from '../../components/StateViews';
import { SkeletonLine } from '../../components/ui/Skeletons';
import StatusBadge from '../../components/ui/StatusBadge';
import { toast } from 'react-toastify';
import './Orders.css';

const statusOptions = ['Order Placed', 'Order Received', 'In the Kitchen', 'Sent to Delivery', 'Delivered', 'Cancelled'];

// Mirrors the server-side transition rules (server enforces; this keeps the UI honest).
const NEXT_STATUSES = {
  'Order Placed': ['Order Received', 'Cancelled'],
  'Order Received': ['In the Kitchen', 'Cancelled'],
  'In the Kitchen': ['Sent to Delivery'],
  'Sent to Delivery': ['Delivered'],
  Delivered: [],
  Cancelled: [],
};

// Column share of the loading skeleton — mirrors the table header order.
const SK_WIDTHS = ['15%', '20%', '15%', '8%', '11%', '11%', '12%', '8%'];

const itemConfig = (item) => {
  if (item.type === 'drink') return 'Cold drink';
  if (item.type === 'addon') return 'Add-on';
  const c = item.customization || {};
  const parts = [c.base, c.sauce, c.cheese].filter(Boolean);
  if (c.veggies?.length) parts.push(c.veggies.join(', '));
  if (c.addons?.length) parts.push(`+ ${c.addons.join(', ')}`);
  return parts.join(' · ');
};

const EMPTY_FILTERS = { search: '', status: '', paymentStatus: '', from: '', to: '', page: 1 };

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async (keepSelection = false) => {
    if (!keepSelection) {
      setLoading(true);
      setLoadError('');
    }
    try {
      const params = { page: filters.page, limit: 12 };
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.paymentStatus) params.paymentStatus = filters.paymentStatus;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;

      const { data } = await getAllOrders(params);
      const list = (data.orders || []).map(normalizeOrder);
      setOrders(list);
      setMeta({ total: data.total, page: data.page, pages: data.pages });
      if (keepSelection) {
        setSelectedId((current) => (list.some((o) => o.id === current) ? current : list[0]?.id ?? null));
      } else {
        setSelectedId(list[0]?.id ?? null);
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to load orders';
      if (keepSelection) toast.error(message);
      else setLoadError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(() => fetchOrders(false), filters.search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchOrders, filters.search, attempt]);

  const updateFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value, ...(key !== 'page' ? { page: 1 } : {}) }));

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      toast.success(`Status updated to "${newStatus}"`);
      fetchOrders(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  const selected = orders.find((o) => o.id === selectedId);
  const allowedNext = selected ? (NEXT_STATUSES[selected.status] || []) : [];

  const hasFilters = Boolean(filters.search || filters.status || filters.paymentStatus || filters.from || filters.to);
  const initialLoading = loading && orders.length === 0 && !loadError;
  const initialError = Boolean(loadError) && orders.length === 0;
  const clearFilters = () => setFilters(EMPTY_FILTERS);
  const refreshOrders = () => {
    setRefreshing(true);
    fetchOrders(true);
  };

  // Breakdown of the rows currently loaded (never a server-side total).
  const statusTally = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});
  const pageStatusCounts = Object.entries(statusTally).sort(
    (a, b) => statusOptions.indexOf(a[0]) - statusOptions.indexOf(b[0])
  );

  return (
    <div className="admin-page admin-orders animate-fade">
      <header className="page-header">
        <div className="page-header-text">
          <span className="eyebrow">🛒 Order desk</span>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">Search, filter and move every order from placement to delivery.</p>
        </div>
        <div className="page-header-actions">
          {!initialLoading && !initialError && (
            <span className="chip orders-count" role="status">
              {meta.total} order{meta.total === 1 ? '' : 's'}
            </span>
          )}
          {pageStatusCounts.length > 0 && (
            <div className="orders-breakdown" role="group" aria-label="Order statuses on this page">
              <span className="orders-breakdown-label">This page</span>
              <div className="orders-breakdown-chips animate-stagger">
                {pageStatusCounts.map(([status, count]) => (
                  <span className="chip" key={status}>
                    {status} <strong className="orders-breakdown-count">{count}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
          <button type="button" className="btn btn-secondary" onClick={refreshOrders} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      </header>

      <section className="admin-panel" aria-label="Orders" aria-busy={loading}>
        <div className="card toolbar-card">
          <div className="toolbar" role="search" aria-label="Filter orders">
            <label className="sr-only-field" htmlFor="order-search">Search orders</label>
            <div className="field-with-icon">
              <span className="field-icon" aria-hidden="true">🔍</span>
              <input
                id="order-search"
                type="search"
                placeholder="Search order #, name, phone, email…"
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
              />
            </div>
            <label className="sr-only-field" htmlFor="order-status">Status</label>
            <select id="order-status" value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
              <option value="">All statuses</option>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <label className="sr-only-field" htmlFor="order-payment">Payment</label>
            <select id="order-payment" value={filters.paymentStatus} onChange={(e) => updateFilter('paymentStatus', e.target.value)}>
              <option value="">Any payment</option>
              <option value="paid">Paid</option>
              <option value="created">Created (unpaid)</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
            <div className="orders-date-range" role="group" aria-labelledby="orders-date-label">
              <span className="orders-date-label" id="orders-date-label">Range</span>
              <label className="sr-only-field" htmlFor="order-from">From date</label>
              <input id="order-from" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => updateFilter('from', e.target.value)} />
              <span className="orders-date-sep" aria-hidden="true">–</span>
              <label className="sr-only-field" htmlFor="order-to">To date</label>
              <input id="order-to" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => updateFilter('to', e.target.value)} />
            </div>
            <span className="toolbar-spacer" />
            {hasFilters && (
              <button type="button" className="btn btn-secondary" onClick={clearFilters}>✕ Clear filters</button>
            )}
          </div>
        </div>

        {initialLoading ? (
          <LoadingState message="Loading orders…" />
        ) : initialError ? (
          <ErrorState message={loadError} onRetry={() => setAttempt((a) => a + 1)} />
        ) : loading ? (
          <div className="data-table-wrap" role="status" aria-label="Loading orders">
            <div className="sk-table" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, index) => (
                <div className="sk-table-row" key={index}>
                  {SK_WIDTHS.map((width, colIndex) => (
                    <SkeletonLine key={colIndex} width={width} height={14} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon="🛒"
            title="No orders found"
            description={
              hasFilters
                ? 'No orders match these filters. Try a wider date range or clear the filters.'
                : 'No orders yet — new orders appear here as soon as they are placed.'
            }
          >
            {hasFilters ? (
              <button type="button" className="btn btn-primary" onClick={clearFilters}>Clear filters</button>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={refreshOrders}>Refresh</button>
            )}
          </EmptyState>
        ) : (
          <>
            <div className="data-table-wrap">
              <table className="data-table">
                <caption className="sr-only-field">Orders matching the current filters</caption>
                <thead>
                  <tr>
                    <th scope="col">Order</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Date</th>
                    <th scope="col">Items</th>
                    <th scope="col">Total</th>
                    <th scope="col">Payment</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody className="animate-stagger">
                  {orders.map((order) => {
                    const expanded = order.id === selectedId;
                    return (
                      <tr
                        key={order.id}
                        className={expanded ? 'is-selected' : undefined}
                        onClick={() => setSelectedId(order.id)}
                      >
                        <td data-label="Order">
                          <button
                            type="button"
                            className="order-link"
                            aria-expanded={expanded}
                            aria-controls="order-detail-panel"
                            onClick={() => setSelectedId(order.id)}
                          >
                            <span className="order-number">{order.orderNumber}</span>
                          </button>
                        </td>
                        <td data-label="Customer">
                          <span className="cust-cell">
                            <span className="cust-name">{order.user?.name || order.customer?.name || 'Unknown'}</span>
                            {(order.user?.email || order.customer?.phone) && (
                              <span className="cust-contact">{order.user?.email || order.customer?.phone}</span>
                            )}
                          </span>
                        </td>
                        <td data-label="Date" className="date-cell">{formatDate(order.createdAt)}</td>
                        <td data-label="Items" className="items-cell">{order.quantity}</td>
                        <td data-label="Total" className="total-cell">{formatMoney(order.totalPrice)}</td>
                        <td data-label="Payment">
                          <StatusBadge kind="payment" status={order.paymentStatus} dot />
                        </td>
                        <td data-label="Status">
                          <StatusBadge status={order.status} dot />
                        </td>
                        <td data-label="Actions" className="col-actions">
                          <div className="row-actions">
                            <button
                              type="button"
                              aria-expanded={expanded}
                              aria-controls="order-detail-panel"
                              onClick={() => setSelectedId(order.id)}
                            >
                              Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <section className="card order-detail" id="order-detail-panel" aria-label="Order details">
              {!selected ? (
                <div className="detail-empty">
                  <span className="detail-empty-icon" aria-hidden="true">🧾</span>
                  <p>Select an order to see its details here.</p>
                </div>
              ) : (
                <>
                  <header className="detail-header">
                    <div className="detail-head-text">
                      <span className="detail-eyebrow">Order details</span>
                      <h2 className="detail-number">{selected.orderNumber}</h2>
                      <p className="detail-meta">{formatDate(selected.createdAt)}</p>
                    </div>
                    <div className="detail-badges">
                      <StatusBadge status={selected.status} dot size="lg" />
                      <StatusBadge kind="payment" status={selected.paymentStatus} size="lg" />
                    </div>
                  </header>

                  <div className="detail-grid">
                    <div className="detail-section">
                      <h3 className="detail-section-title">
                        Items
                        <span className="detail-section-hint">
                          {selected.quantity} item{selected.quantity === 1 ? '' : 's'}
                        </span>
                      </h3>
                      <ul className="detail-items">
                        {selected.items.map((item, index) => {
                          const config = itemConfig(item);
                          return (
                            <li className="detail-item" key={`${item.name}-${index}`}>
                              <div className="detail-item-top">
                                <span className="detail-item-name">
                                  {item.name}
                                  {item.sizeName ? ` (${item.sizeName})` : ''}
                                  {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                                </span>
                                <strong className="detail-item-price">{formatMoney(item.subtotal)}</strong>
                              </div>
                              {config && <span className="detail-item-config">{config}</span>}
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    <div className="detail-side">
                      <div className="detail-section">
                        <h3 className="detail-section-title">Customer</h3>
                        <div className="detail-customer">
                          <span className="detail-customer-name">
                            {selected.user?.name || selected.customer?.name || 'Unknown'}
                          </span>
                          {selected.user?.email && <span className="detail-customer-line">{selected.user.email}</span>}
                          {selected.customer?.phone && (
                            <span className="detail-customer-line">{selected.customer.phone}</span>
                          )}
                          {selected.customer?.address && (
                            <span className="detail-customer-line detail-address">{selected.customer.address}</span>
                          )}
                        </div>
                      </div>

                      <div className="detail-section">
                        <h3 className="detail-section-title">Charges</h3>
                        <div className="detail-charges">
                          <div className="charge-row">
                            <span>Subtotal</span>
                            <strong>{formatMoney(selected.subtotal)}</strong>
                          </div>
                          <div className="charge-row">
                            <span>Delivery fee</span>
                            <strong>{formatMoney(selected.deliveryFee)}</strong>
                          </div>
                          <div className="charge-row">
                            <span>Tax</span>
                            <strong>{formatMoney(selected.tax)}</strong>
                          </div>
                          {selected.discount > 0 && (
                            <div className="charge-row is-discount">
                              <span>Discount</span>
                              <strong>−{formatMoney(selected.discount)}</strong>
                            </div>
                          )}
                          <div className="charge-row is-total">
                            <span>Total</span>
                            <strong className="charge-total">{formatMoney(selected.totalPrice)}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <footer className="detail-footer">
                    <div className="detail-status-control">
                      <label htmlFor="detail-status-select">Update status</label>
                      {allowedNext.length > 0 ? (
                        <select
                          id="detail-status-select"
                          className="status-select"
                          value={selected.status}
                          onChange={(e) => handleStatusChange(selected.id, e.target.value)}
                        >
                          <option value={selected.status}>{selected.status} (current)</option>
                          {allowedNext.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <span className="form-hint">No further transitions (terminal).</span>
                      )}
                    </div>
                  </footer>
                </>
              )}
            </section>
          </>
        )}

        {!initialLoading && !initialError && orders.length > 0 && (
          <div className="pagination">
            <button type="button" disabled={meta.page <= 1} onClick={() => updateFilter('page', meta.page - 1)}>← Previous</button>
            <span className="page-info">Page {meta.page} of {meta.pages}</span>
            <button type="button" disabled={meta.page >= meta.pages} onClick={() => updateFilter('page', meta.page + 1)}>Next →</button>
          </div>
        )}
      </section>
    </div>
  );
};

export default Orders;
