import { useCallback, useEffect, useState } from 'react';
import {
  getInventory,
  getInventoryStats,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  restockInventoryItem,
  getStockLog,
} from '../../services/api';
import { LoadingState, ErrorState, EmptyState, Skeleton } from '../../components/StateViews';
import { SkeletonLine } from '../../components/ui/Skeletons';
import { Modal, ConfirmDialog } from '../../components/Modal';
import { toast } from 'react-toastify';
import './Inventory.css';

const CATEGORIES = ['base', 'sauce', 'cheese', 'veggie', 'meat', 'drink', 'addon'];

const catIcons = {
  base: '🥖',
  sauce: '🍅',
  cheese: '🧀',
  veggie: '🥬',
  meat: '🥓',
  drink: '🥤',
  addon: '✨',
};

const EMPTY_FORM = { category: 'base', name: '', quantity: 100, maxStock: 100, price: 0, image: '🍕', available: true };

const Inventory = () => {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, threshold: 20 });
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({ search: '', category: '', status: '', page: 1 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const [restockItem, setRestockItem] = useState(null);
  const [restockQty, setRestockQty] = useState(50);

  const [logOpen, setLogOpen] = useState(false);
  const [logEntries, setLogEntries] = useState(null);
  const [logLoading, setLogLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const params = { page: filters.page, limit: 20 };
      if (filters.search) params.search = filters.search;
      if (filters.category) params.category = filters.category;
      if (filters.status) params.status = filters.status;
      const [invRes, statsRes] = await Promise.all([getInventory(params), getInventoryStats()]);
      setItems(invRes.data.items || []);
      setMeta({
        total: invRes.data.total,
        page: invRes.data.page,
        pages: invRes.data.pages,
        threshold: invRes.data.threshold || 20,
      });
      setStats(statsRes.data);
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(fetchData, filters.search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchData, filters.search, attempt]);

  const getQtyClass = (item) => (item.status === 'out' ? 'low' : item.status === 'low' ? 'warn' : 'ok');
  const getQtyPct = (item) => {
    const max = Number(item.maxStock) > 0 ? Number(item.maxStock) : 100;
    return Math.max(0, Math.min(100, Math.round((Number(item.quantity) / max) * 100)));
  };

  const openAdd = () => {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      category: item.category,
      name: item.name,
      quantity: item.quantity,
      maxStock: item.maxStock ?? 100,
      price: item.price,
      image: item.image,
      available: item.available !== false,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (editItem) {
        await updateInventoryItem(editItem._id, form);
        toast.success('Item updated');
      } else {
        await addInventoryItem(form);
        toast.success('Item added');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving item');
    } finally {
      setBusy(false);
    }
  };

  const toggleAvailable = async (item) => {
    const next = item.available === false;
    try {
      await updateInventoryItem(item._id, { available: next });
      toast.success(next ? `"${item.name}" is now available.` : `"${item.name}" hidden from orders.`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed.');
    }
  };

  const handleDelete = (item) => {
    setConfirm({
      title: 'Delete inventory item',
      message: `Delete "${item.name}"? Existing orders keep their history.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        setBusy(true);
        try {
          await deleteInventoryItem(item._id);
          toast.success('Item deleted');
          setConfirm(null);
          fetchData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Error deleting item');
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const submitRestock = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await restockInventoryItem(restockItem._id, Number(restockQty));
      toast.success(`Restocked ${restockItem.name} (+${restockQty}).`);
      setRestockItem(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Restock failed.');
    } finally {
      setBusy(false);
    }
  };

  const openLog = async () => {
    setLogOpen(true);
    setLogLoading(true);
    setLogEntries(null);
    try {
      const { data } = await getStockLog({ limit: 30 });
      setLogEntries(data.entries || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load stock log.');
      setLogOpen(false);
    } finally {
      setLogLoading(false);
    }
  };

  const initialLoading = loading && items.length === 0 && !loadError;
  const initialError = Boolean(loadError) && items.length === 0;
  const inStock = stats ? Math.max(0, stats.totalItems - stats.lowStockCount) : 0;

  return (
    <div className="admin-page admin-inventory animate-fade">
      <header className="page-header">
        <div className="page-header-text">
          <span className="eyebrow">📦 Stock control</span>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">Stock here powers pricing: orders fail if an ingredient runs out.</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-secondary" onClick={openLog}>Stock log</button>
          <button type="button" className="btn btn-primary" onClick={openAdd}>+ Add Item</button>
        </div>
      </header>

      {stats && (
        <div className="inv-stats animate-stagger">
          <div className="inv-stat">
            <span className="inv-stat-label">Total items</span>
            <strong className="inv-stat-value">{stats.totalItems}</strong>
          </div>
          <div className={`inv-stat ${inStock > 0 ? 'is-ok' : ''}`}>
            <span className="inv-stat-label">In stock</span>
            <strong className="inv-stat-value">{inStock}</strong>
          </div>
          <div className={`inv-stat ${stats.lowStockCount > 0 ? 'is-warn' : ''}`}>
            <span className="inv-stat-label">Low stock</span>
            <strong className="inv-stat-value">{stats.lowStockCount}</strong>
          </div>
          <div className={`inv-stat ${stats.outOfStockCount > 0 ? 'is-bad' : ''}`}>
            <span className="inv-stat-label">Out of stock</span>
            <strong className="inv-stat-value">{stats.outOfStockCount}</strong>
          </div>
          <div className="inv-stat">
            <span className="inv-stat-label">Low-stock threshold</span>
            <strong className="inv-stat-value">≤ {stats.threshold}</strong>
          </div>
        </div>
      )}

      <section className="admin-panel" aria-label="Inventory items">
        <h2 className="sr-only-field">Inventory items</h2>

        <div className="card toolbar-card">
          <div className="toolbar" role="search" aria-label="Filter inventory">
            <label className="sr-only-field" htmlFor="inv-search">Search inventory</label>
            <div className="field-with-icon">
              <span className="field-icon" aria-hidden="true">🔍</span>
              <input
                id="inv-search"
                type="search"
                placeholder="Search items…"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
              />
            </div>
            <label className="sr-only-field" htmlFor="inv-category">Category</label>
            <select id="inv-category" value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value, page: 1 }))}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{catIcons[c]} {c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
            <label className="sr-only-field" htmlFor="inv-status">Stock status</label>
            <select id="inv-status" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}>
              <option value="">Any status</option>
              <option value="ok">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
            <span className="toolbar-spacer" />
            <span className="toolbar-note">{meta.total} item{meta.total === 1 ? '' : 's'}</span>
          </div>
        </div>

        {initialLoading ? (
          <LoadingState message="Loading inventory…" />
        ) : initialError ? (
          <ErrorState message={loadError} onRetry={() => setAttempt((a) => a + 1)} />
        ) : loading ? (
          <div className="data-table-wrap" role="status" aria-label="Loading inventory">
            <div className="sk-table" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, index) => (
                <div className="sk-table-row" key={index}>
                  <SkeletonLine width="24%" height={14} />
                  <SkeletonLine width="14%" height={14} />
                  <SkeletonLine width="20%" height={14} />
                  <SkeletonLine width="10%" height={14} />
                  <SkeletonLine width="14%" height={14} />
                  <SkeletonLine width="18%" height={14} />
                </div>
              ))}
            </div>
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon="📦" title="No inventory items found" description="Adjust filters or add your first item.">
            <button type="button" className="btn btn-primary" onClick={openAdd}>+ Add Item</button>
          </EmptyState>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <caption className="sr-only-field">Inventory items</caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Category</th>
                  <th scope="col">Stock</th>
                  <th scope="col">Price</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item._id}>
                    <td data-label="Item" className="col-item">
                      <div className="item-cell">
                        <span className="item-emoji" aria-hidden="true">{item.image}</span>
                        <span className="item-name">{item.name}</span>
                      </div>
                    </td>
                    <td data-label="Category">
                      <span className="inv-cat">{catIcons[item.category] || '📦'} {item.category}</span>
                    </td>
                    <td data-label="Stock">
                      <div className="stock-cell">
                        <div className="stock-bar" aria-hidden="true">
                          <div className={`stock-bar-fill ${getQtyClass(item)}`} style={{ width: `${getQtyPct(item)}%` }} />
                        </div>
                        <span className={`stock-value ${getQtyClass(item)}`}>{item.quantity}</span>
                      </div>
                    </td>
                    <td data-label="Price" className="price-cell">₹{item.price}</td>
                    <td data-label="Status">
                      <span className="status-chips">
                        <span className={`chip ${item.status === 'out' ? 'chip-out' : item.status === 'low' ? 'chip-low' : 'chip-ok'}`}>
                          {item.status === 'out' ? 'Out' : item.status === 'low' ? 'Low' : 'In stock'}
                        </span>
                        {item.available === false && <span className="chip chip-off">Hidden</span>}
                      </span>
                    </td>
                    <td data-label="Actions" className="col-actions">
                      <div className="row-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          title="Restock"
                          aria-label={`Restock ${item.name}`}
                          onClick={() => { setRestockItem(item); setRestockQty(50); }}
                        >
                          ＋
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          title={item.available === false ? 'Make available' : 'Hide from orders'}
                          aria-label={item.available === false ? `Make ${item.name} available` : `Hide ${item.name} from orders`}
                          onClick={() => toggleAvailable(item)}
                        >
                          {item.available === false ? '🚫' : '👁'}
                        </button>
                        <button
                          type="button"
                          className="icon-btn edit"
                          title="Edit"
                          aria-label={`Edit ${item.name}`}
                          onClick={() => openEdit(item)}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="icon-btn delete"
                          title="Delete"
                          aria-label={`Delete ${item.name}`}
                          onClick={() => handleDelete(item)}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!initialLoading && !initialError && (
          <div className="pagination">
            <button type="button" disabled={meta.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>← Previous</button>
            <span className="page-info">Page {meta.page} of {meta.pages}</span>
            <button type="button" disabled={meta.page >= meta.pages} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>Next →</button>
          </div>
        )}
      </section>

      <Modal
        open={showModal}
        title={editItem ? 'Edit Item' : 'Add New Item'}
        onClose={() => setShowModal(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={busy}>Cancel</button>
            <button
              type="submit"
              form="inv-form"
              className={`btn btn-primary ${busy ? 'is-loading' : ''}`}
              disabled={busy}
            >
              {busy ? 'Saving…' : editItem ? 'Update' : 'Add'}
            </button>
          </>
        }
      >
        <form id="inv-form" onSubmit={handleSubmit} className="form-grid">
          <div className="form-field">
            <label htmlFor="inv-form-category">Category</label>
            <select
              id="inv-form-category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
            <span className="form-hint">Bases, sauces, cheeses and veggies are checked at checkout.</span>
          </div>
          <div className="form-field">
            <label htmlFor="inv-form-name">Name</label>
            <input
              id="inv-form-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <span className="form-hint">Up to 80 characters, unique within the category.</span>
          </div>
          <div className="form-field">
            <label htmlFor="inv-form-quantity">Quantity</label>
            <input
              id="inv-form-quantity"
              type="number"
              min="0"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })}
              required
            />
            <span className="form-hint">Whole units currently on the shelf.</span>
          </div>
          <div className="form-field">
            <label htmlFor="inv-form-maxstock">Full Stock Level</label>
            <input
              id="inv-form-maxstock"
              type="number"
              min="1"
              value={form.maxStock}
              onChange={(e) => setForm({ ...form, maxStock: parseInt(e.target.value) || 1 })}
              required
            />
            <span className="form-hint">Reference value used for the stock health bar.</span>
          </div>
          <div className="form-field">
            <label htmlFor="inv-form-price">Price (₹)</label>
            <input
              id="inv-form-price"
              type="number"
              min="0"
              step="0.5"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
              required
            />
            <span className="form-hint">Unit price of ₹0 or more.</span>
          </div>
          <div className="form-field">
            <label htmlFor="inv-form-image">Image (emoji or URL)</label>
            <input
              id="inv-form-image"
              value={form.image}
              onChange={(e) => setForm({ ...form, image: e.target.value })}
            />
            <span className="form-hint">Shown as the item icon in this list.</span>
          </div>
          <label className="switch-row full-span">
            <span>Available for orders</span>
            <input type="checkbox" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} />
          </label>
        </form>
      </Modal>

      <Modal
        open={Boolean(restockItem)}
        title={`Restock ${restockItem?.name || ''}`}
        onClose={() => setRestockItem(null)}
        width="420px"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setRestockItem(null)} disabled={busy}>Cancel</button>
            <button
              type="submit"
              form="restock-form"
              className={`btn btn-primary ${busy ? 'is-loading' : ''}`}
              disabled={busy}
            >
              {busy ? 'Restocking…' : 'Restock'}
            </button>
          </>
        }
      >
        <form id="restock-form" onSubmit={submitRestock}>
          <p className="form-hint restock-current">Current stock: {restockItem?.quantity} units.</p>
          <div className="form-field">
            <label htmlFor="restock-qty">Quantity to add</label>
            <input
              id="restock-qty"
              type="number"
              min="1"
              max="10000"
              value={restockQty}
              onChange={(e) => setRestockQty(e.target.value)}
              autoFocus
              required
            />
            <span className="form-hint">Whole number between 1 and 10000.</span>
          </div>
        </form>
      </Modal>

      <Modal open={logOpen} title="Stock log (recent 30)" onClose={() => setLogOpen(false)} width="640px">
        {logLoading || !logEntries ? (
          <Skeleton lines={6} height={18} />
        ) : logEntries.length === 0 ? (
          <EmptyState
            icon="🧾"
            title="No stock movements yet"
            description="Restocks and manual edits will be recorded here."
          >
            <button type="button" className="btn btn-secondary" onClick={() => setLogOpen(false)}>Close</button>
          </EmptyState>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table log-table">
              <caption className="sr-only-field">Recent stock movements</caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Change</th>
                  <th scope="col">Balance</th>
                  <th scope="col">Reason</th>
                  <th scope="col">When</th>
                </tr>
              </thead>
              <tbody>
                {logEntries.map((entry) => (
                  <tr key={entry._id}>
                    <td data-label="Item">{entry.name}</td>
                    <td data-label="Change" className={`log-delta ${entry.delta > 0 ? 'is-pos' : 'is-neg'}`}>
                      {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                    </td>
                    <td data-label="Balance">{entry.balance}</td>
                    <td data-label="Reason">{entry.reason}</td>
                    <td data-label="When">{new Date(entry.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title || ''}
        message={confirm?.message || ''}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={confirm?.onConfirm}
      />
    </div>
  );
};

export default Inventory;
