import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAnalytics, getAllOrders } from '../../services/api';
import { ErrorState, EmptyState } from '../../components/StateViews';
import { SkeletonLine } from '../../components/ui/Skeletons';
import StatusBadge from '../../components/ui/StatusBadge';
import { LineChart, BarChart, TopList } from '../../components/Charts';
import { normalizeOrder, formatMoney, formatDate } from '../../utils/normalizeOrder';
import './AdminDashboard.css';

const daysAgo = (days) => {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
};

const PRESETS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

/** Real half-vs-half comparison of the returned series — never an invented number. */
const trendFor = (series, key) => {
  if (!Array.isArray(series) || series.length < 4) return null;
  const mid = Math.floor(series.length / 2);
  const earlier = series.slice(0, mid).reduce((sum, point) => sum + (Number(point[key]) || 0), 0);
  const later = series.slice(mid).reduce((sum, point) => sum + (Number(point[key]) || 0), 0);
  if (earlier === 0) return null;
  const pct = Math.round(((later - earlier) / earlier) * 100);
  if (!Number.isFinite(pct)) return null;
  return { direction: pct >= 0 ? 'up' : 'down', pct: Math.abs(pct) };
};

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [range, setRange] = useState({ from: daysAgo(29), to: daysAgo(0) });
  const [recent, setRecent] = useState({ items: [], status: 'idle' });

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { data: result } = await getAnalytics({ from: range.from, to: range.to });
      setData(result);
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Could not load dashboard analytics.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  const fetchRecent = useCallback(async () => {
    setRecent((prev) => ({ ...prev, status: 'loading' }));
    try {
      const { data } = await getAllOrders({ page: 1, limit: 5 });
      setRecent({ items: (data.orders || []).map(normalizeOrder), status: 'ready' });
    } catch {
      setRecent((prev) => ({ ...prev, status: 'error' }));
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    fetchRecent();
  }, [fetchAnalytics, fetchRecent, attempt]);

  const applyPreset = (days) => setRange({ from: daysAgo(days - 1), to: daysAgo(0) });

  if (loading && !data) {
    return (
      <div className="admin-page admin-dash">
        <div className="page-header">
          <div className="page-header-text" style={{ width: 'min(420px, 100%)' }}>
            <SkeletonLine width="140px" height={13} />
            <SkeletonLine width="100%" height={34} />
            <SkeletonLine width="70%" height={15} />
          </div>
        </div>
        <div className="kpi-grid" role="status" aria-label="Loading dashboard">
          {Array.from({ length: 8 }).map((_, index) => (
            <div className="kpi-card kpi-skeleton" key={index}>
              <SkeletonLine width="55%" height={12} />
              <SkeletonLine width="70%" height={28} />
              <SkeletonLine width="45%" height={12} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loadError && !data) {
    return (
      <div className="admin-page admin-dash">
        <ErrorState message={loadError} onRetry={() => setAttempt((a) => a + 1)} />
      </div>
    );
  }

  const totals = data?.totals || {};
  const series = data?.series || [];
  const orderSeries = series.map((point) => ({ date: point.date.slice(5), orders: point.orders }));

  const revenueTrend = trendFor(series, 'revenue');
  const ordersTrend = trendFor(series, 'orders');

  const kpis = [
    {
      key: 'revenue',
      title: 'Revenue',
      value: formatMoney(totals.revenue),
      icon: '💰',
      tone: 'featured',
      trend: revenueTrend,
      caption: 'in selected range',
    },
    { key: 'orders', title: 'Orders', value: totals.orders ?? 0, icon: '📦', tone: 'primary', trend: ordersTrend, caption: 'in selected range' },
    { key: 'customers', title: 'Customers', value: totals.customers ?? 0, icon: '👥', caption: 'ordered in range' },
    { key: 'pending', title: 'Pending', value: totals.pending ?? 0, icon: '⏳', tone: 'warning', caption: 'awaiting delivery' },
    { key: 'completed', title: 'Delivered', value: totals.completed ?? 0, icon: '✅', tone: 'success', caption: 'completed orders' },
    { key: 'cancelled', title: 'Cancelled', value: totals.cancelled ?? 0, icon: '❌', tone: 'danger', caption: 'cancelled orders' },
    {
      key: 'low-stock',
      title: 'Low stock',
      value: totals.lowStock ?? 0,
      icon: '⚠️',
      tone: (totals.lowStock ?? 0) > 0 ? 'warning' : 'success',
      caption: `below ${totals.stockThreshold ?? 20} units`,
      to: '/admin/inventory',
    },
    { key: 'all-time', title: 'All-time orders', value: totals.allTimeOrders ?? 0, icon: '🗂️', caption: 'since launch' },
  ];

  return (
    <div className="admin-page admin-dash">
      <header className="page-header">
        <div className="page-header-text">
          <span className="eyebrow">📊 Store performance</span>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Everything the kitchen and the counter need, computed on the server.</p>
        </div>

        <div className="dash-range" role="search" aria-label="Analytics date range">
          <label className="dash-range-field">
            <span>From</span>
            <input
              id="range-from"
              type="date"
              value={range.from}
              max={range.to}
              onChange={(e) => setRange((prev) => ({ ...prev, from: e.target.value }))}
            />
          </label>
          <span className="dash-range-sep" aria-hidden="true">→</span>
          <label className="dash-range-field">
            <span>To</span>
            <input
              id="range-to"
              type="date"
              value={range.to}
              min={range.from}
              onChange={(e) => setRange((prev) => ({ ...prev, to: e.target.value }))}
            />
          </label>
          <div className="dash-presets" role="group" aria-label="Quick ranges">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="chip-filter"
                onClick={() => applyPreset(preset.days)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {loading && <span className="dash-updating" role="status">Updating…</span>}
        </div>
      </header>

      {/* ---- KPIs ---- */}
      <section className="kpi-grid animate-stagger" aria-label="Key performance indicators">
        {kpis.map((card) => {
          const inner = (
            <>
              <div className="kpi-top">
                <span className="kpi-title">{card.title}</span>
                <span className="kpi-icon" aria-hidden="true">{card.icon}</span>
              </div>
              <div className="kpi-value">{card.value}</div>
              <div className="kpi-foot">
                {card.trend ? (
                  <span className={`kpi-trend is-${card.trend.direction}`}>
                    {card.trend.direction === 'up' ? '▲' : '▼'} {card.trend.pct}%
                    <em>vs earlier days</em>
                  </span>
                ) : (
                  <span className="kpi-caption">{card.caption}</span>
                )}
              </div>
            </>
          );

          return card.to ? (
            <Link className={`kpi-card kpi-${card.tone || 'neutral'}`} to={card.to} key={card.key}>
              {inner}
            </Link>
          ) : (
            <article className={`kpi-card kpi-${card.tone || 'neutral'}`} key={card.key}>
              {inner}
            </article>
          );
        })}
      </section>

      {/* ---- Analytics ---- */}
      <section className="analytics-grid" aria-label="Charts">
        <div className="admin-panel">
          <LineChart
            title="Revenue (daily)"
            data={series}
            xKey="date"
            yKey="revenue"
            format={(v) => formatMoney(v)}
            height={200}
          />
        </div>
        <div className="admin-panel">
          <BarChart title="Orders (daily)" data={orderSeries} labelKey="date" valueKey="orders" height={200} />
        </div>
        <div className="admin-panel">
          <TopList title="Popular pizzas" items={data?.topProducts || []} valueKey="qty" format={(v) => `${v} sold`} />
        </div>
        <div className="admin-panel">
          <TopList title="Popular toppings" items={data?.topToppings || []} valueKey="qty" format={(v) => `${v}×`} />
        </div>
      </section>

      {/* ---- Low stock alert ---- */}
      {(totals.lowStock ?? 0) > 0 && (
        <Link to="/admin/inventory" className={`stock-alert ${totals.lowStock > 3 ? 'is-critical' : ''}`}>
          <span className="stock-alert-icon" aria-hidden="true">⚠️</span>
          <span className="stock-alert-text">
            <strong>{totals.lowStock} item{totals.lowStock === 1 ? '' : 's'} running low</strong>
            <small>Stock levels below {totals.stockThreshold ?? 20} units — restock before the dinner rush.</small>
          </span>
          <span className="stock-alert-cta">Open inventory →</span>
        </Link>
      )}

      {/* ---- Recent orders ---- */}
      <section className="admin-panel recent-orders" aria-labelledby="recent-orders-heading">
        <div className="panel-title">
          <span className="panel-icon" aria-hidden="true">🕒</span>
          <span id="recent-orders-heading">Recent orders</span>
          <Link to="/admin/orders" className="btn btn-ghost btn-sm recent-orders-all">View all →</Link>
        </div>

        {recent.status === 'loading' && (
          <div className="recent-list" role="status" aria-label="Loading recent orders">
            {Array.from({ length: 3 }).map((_, index) => (
              <div className="recent-row" key={index}>
                <SkeletonLine width="90px" height={14} />
                <SkeletonLine width="140px" height={14} />
                <SkeletonLine width="70px" height={14} />
              </div>
            ))}
          </div>
        )}

        {recent.status === 'error' && (
          <EmptyState
            icon="📦"
            title="Could not load recent orders"
            description="The rest of the dashboard is still up to date."
            action={
              <button type="button" className="btn btn-secondary btn-sm" onClick={fetchRecent}>
                Try again
              </button>
            }
          />
        )}

        {recent.status === 'ready' && recent.items.length === 0 && (
          <EmptyState icon="🍕" title="No orders yet" description="New orders will appear here the moment they come in." />
        )}

        {recent.status === 'ready' && recent.items.length > 0 && (
          <ul className="recent-list">
            {recent.items.map((order) => (
              <li className="recent-row" key={order.id}>
                <span className="recent-number">#{order.orderNumber}</span>
                <span className="recent-customer">{order.customer?.name || 'Customer'}</span>
                <span className="recent-date">{formatDate(order.createdAt)}</span>
                <span className="recent-total">{formatMoney(order.totalPrice)}</span>
                <StatusBadge status={order.status} dot />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Quick links ---- */}
      <div className="admin-quick-links">
        <Link to="/admin/inventory" className="quick-link-card">
          <span className="quick-link-icon" aria-hidden="true">📦</span>
          <span className="quick-link-text">
            <span className="quick-link-title">Manage Inventory</span>
            <span className="quick-link-desc">Restock, prices &amp; availability</span>
          </span>
          <span className="quick-link-arrow" aria-hidden="true">→</span>
        </Link>

        <Link to="/admin/orders" className="quick-link-card">
          <span className="quick-link-icon" aria-hidden="true">🛒</span>
          <span className="quick-link-text">
            <span className="quick-link-title">Manage Orders</span>
            <span className="quick-link-desc">Search, filter &amp; update status</span>
          </span>
          <span className="quick-link-arrow" aria-hidden="true">→</span>
        </Link>

        <Link to="/admin/products" className="quick-link-card">
          <span className="quick-link-icon" aria-hidden="true">🍕</span>
          <span className="quick-link-text">
            <span className="quick-link-title">Products</span>
            <span className="quick-link-desc">Pizzas, drinks &amp; categories</span>
          </span>
          <span className="quick-link-arrow" aria-hidden="true">→</span>
        </Link>

        <Link to="/admin/users" className="quick-link-card">
          <span className="quick-link-icon" aria-hidden="true">👥</span>
          <span className="quick-link-text">
            <span className="quick-link-title">Customers</span>
            <span className="quick-link-desc">Search, details &amp; account status</span>
          </span>
          <span className="quick-link-arrow" aria-hidden="true">→</span>
        </Link>

        <Link to="/admin/settings" className="quick-link-card">
          <span className="quick-link-icon" aria-hidden="true">⚙️</span>
          <span className="quick-link-text">
            <span className="quick-link-title">Store Settings</span>
            <span className="quick-link-desc">Tax, fees, open/closed</span>
          </span>
          <span className="quick-link-arrow" aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
};

export default AdminDashboard;
