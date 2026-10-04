import { useCallback, useEffect, useState } from 'react';
import { getUsers, getUserDetail, getUserOrders, updateUser } from '../../services/api';
import { ErrorState, EmptyState, Skeleton } from '../../components/StateViews';
import { Modal, ConfirmDialog } from '../../components/Modal';
import { formatMoney, formatDate, normalizeOrder } from '../../utils/normalizeOrder';
import { toast } from 'react-toastify';
import './Users.css';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);

  const [filters, setFilters] = useState({ search: '', role: '', status: '', page: 1 });
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const params = { page: filters.page, limit: 10 };
      if (filters.search) params.search = filters.search;
      if (filters.role) params.role = filters.role;
      if (filters.status) params.status = filters.status;
      const { data } = await getUsers(params);
      setUsers(data.users);
      setMeta({ total: data.total, page: data.page, pages: data.pages });
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Could not load customers.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(fetchUsers, filters.search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchUsers, filters.search, attempt]);

  const openDetail = async (id) => {
    setDetailId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const [{ data: userRes }, { data: ordersRes }] = await Promise.all([
        getUserDetail(id),
        getUserOrders(id, { limit: 5 }),
      ]);
      setDetail({
        ...userRes,
        orders: ordersRes.orders.map(normalizeOrder),
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load customer details.');
      setDetailId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const applyUpdate = async (id, payload, successMessage) => {
    try {
      await updateUser(id, payload);
      toast.success(successMessage);
      setConfirm(null);
      fetchUsers();
      if (detailId === id) openDetail(id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed.');
    }
  };

  const toggleActive = (user) => {
    setConfirm({
      title: user.isActive ? 'Disable account' : 'Enable account',
      message: user.isActive
        ? `${user.name} will no longer be able to log in. Their order history is kept.`
        : `${user.name} will be able to log in again.`,
      confirmLabel: user.isActive ? 'Disable' : 'Enable',
      danger: user.isActive,
      onConfirm: () =>
        applyUpdate(
          user.id,
          { isActive: !user.isActive },
          user.isActive ? 'Account disabled.' : 'Account enabled.'
        ),
    });
  };

  const toggleRole = (user) => {
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    setConfirm({
      title: `Change role to ${nextRole}`,
      message: `Change ${user.name}'s role from ${user.role} to ${nextRole}?`,
      confirmLabel: 'Change role',
      danger: nextRole === 'user',
      onConfirm: () => applyUpdate(user.id, { role: nextRole }, `Role updated to ${nextRole}.`),
    });
  };

  const hasFilters = Boolean(filters.search || filters.role || filters.status);
  const clearFilters = () => setFilters((f) => ({ ...f, search: '', role: '', status: '', page: 1 }));

  return (
    <div className="admin-page admin-users">
      <header className="page-header">
        <div className="page-header-text">
          <span className="eyebrow">👥 Customers</span>
          <h1 className="page-title">Customer management</h1>
          <p className="page-subtitle">
            Search accounts, review activity and control who can sign in or manage the store.
          </p>
        </div>
        <p className="users-summary">
          <strong>{meta.total}</strong>
          <span>customer{meta.total === 1 ? '' : 's'} on file</span>
        </p>
      </header>

      <div className="card users-toolbar animate-fade">
        <div className="toolbar" role="search" aria-label="Search customers">
          <label className="sr-only-field" htmlFor="user-search">
            Search customers
          </label>
          <input
            id="user-search"
            type="search"
            placeholder="Search name, email or phone…"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
          />
          <label className="sr-only-field" htmlFor="user-role">
            Role filter
          </label>
          <select
            id="user-role"
            value={filters.role}
            onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value, page: 1 }))}
          >
            <option value="">All roles</option>
            <option value="user">Customers</option>
            <option value="admin">Admins</option>
          </select>
          <label className="sr-only-field" htmlFor="user-status">
            Status filter
          </label>
          <select
            id="user-status"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
          >
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
          <span className="toolbar-spacer" />
        </div>
      </div>

      <div className="users-results animate-fade">
        {loading ? (
          <div className="section-card users-skeleton" role="status">
            <span className="sr-only-field">Loading customers…</span>
            <Skeleton lines={7} height={22} />
          </div>
        ) : loadError ? (
          <ErrorState
            title="Couldn’t load customers"
            message={loadError}
            onRetry={() => setAttempt((a) => a + 1)}
          />
        ) : users.length === 0 ? (
          <EmptyState
            icon="👥"
            title="No customers found"
            description={
              hasFilters ? 'Try a different search or filter.' : 'Registered customers will appear here.'
            }
          >
            {hasFilters && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </EmptyState>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <caption className="sr-only-field">Customer accounts</caption>
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Verified</th>
                  <th scope="col">Joined</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td data-label="Customer">
                      <span className="user-cell">
                        <span className="user-avatar" aria-hidden="true">
                          {user.name.trim().charAt(0).toUpperCase() || '?'}
                        </span>
                        <span className="user-cell-text">
                          <strong>{user.name}</strong>
                          <small>{user.phone || '—'}</small>
                        </span>
                      </span>
                    </td>
                    <td data-label="Email" className="user-email-cell">
                      {user.email}
                    </td>
                    <td data-label="Role">
                      <span className={`chip ${user.role === 'admin' ? 'chip-low' : 'chip-ok'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td data-label="Status">
                      <span className={`chip ${user.isActive ? 'chip-ok' : 'chip-out'}`}>
                        {user.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td data-label="Verified">
                      <span
                        className={`badge ${user.isVerified ? 'badge-delivered badge-dot' : 'badge-neutral'}`}
                      >
                        {user.isVerified ? 'Verified' : 'Unverified'}
                      </span>
                    </td>
                    <td data-label="Joined" className="nowrap">
                      {formatDate(user.createdAt)}
                    </td>
                    <td data-label="Actions">
                      <div className="row-actions">
                        <button
                          type="button"
                          className="row-action-view"
                          aria-label={`View ${user.name}`}
                          onClick={() => openDetail(user.id)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          aria-label={`${user.isActive ? 'Disable' : 'Enable'} ${user.name}`}
                          onClick={() => toggleActive(user)}
                        >
                          {user.isActive ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          aria-label={`Change ${user.name}'s role to ${user.role === 'admin' ? 'user' : 'admin'}`}
                          onClick={() => toggleRole(user)}
                        >
                          Make {user.role === 'admin' ? 'user' : 'admin'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <nav className="pagination" aria-label="Customer list pagination">
        <button
          type="button"
          disabled={meta.page <= 1}
          onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
        >
          ← Previous
        </button>
        <span className="page-info">
          Page {meta.page} of {meta.pages}
        </span>
        <button
          type="button"
          disabled={meta.page >= meta.pages}
          onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
        >
          Next →
        </button>
      </nav>

      <Modal
        open={detailId !== null}
        title="Customer details"
        onClose={() => setDetailId(null)}
        width="640px"
      >
        {detailLoading || !detail ? (
          <div role="status">
            <span className="sr-only-field">Loading customer details…</span>
            <Skeleton lines={5} height={20} />
          </div>
        ) : (
          <div className="user-detail">
            <div className="user-detail-head">
              <div className="user-detail-id">
                <span className="user-avatar user-avatar-lg" aria-hidden="true">
                  {detail.user.name.trim().charAt(0).toUpperCase() || '?'}
                </span>
                <div className="user-detail-text">
                  <h3>{detail.user.name}</h3>
                  <p className="user-detail-contact">
                    {detail.user.email}
                    {detail.user.phone ? ` · ${detail.user.phone}` : ''}
                  </p>
                  <p className="form-hint">Joined {formatDate(detail.user.createdAt)}</p>
                </div>
              </div>
              <div className="user-detail-chips">
                <span className={`chip ${detail.user.role === 'admin' ? 'chip-low' : 'chip-ok'}`}>
                  {detail.user.role}
                </span>
                <span className={`chip ${detail.user.isActive ? 'chip-ok' : 'chip-out'}`}>
                  {detail.user.isActive ? 'Active' : 'Disabled'}
                </span>
                <span
                  className={`badge ${detail.user.isVerified ? 'badge-delivered badge-dot' : 'badge-neutral'}`}
                >
                  {detail.user.isVerified ? 'Verified' : 'Unverified'}
                </span>
              </div>
            </div>

            <div className="user-stats">
              <div>
                <span>Orders</span>
                <strong>{detail.stats.orders}</strong>
              </div>
              <div>
                <span>Total spent</span>
                <strong>{formatMoney(detail.stats.spent)}</strong>
              </div>
              <div>
                <span>Addresses</span>
                <strong>{detail.addresses.length}</strong>
              </div>
            </div>

            {detail.addresses.length > 0 && (
              <section className="user-block">
                <div className="user-block-head">
                  <h4>Saved addresses</h4>
                  <span className="badge badge-neutral">{detail.addresses.length}</span>
                </div>
                <ul className="user-address-list">
                  {detail.addresses.map((address) => (
                    <li key={address._id}>
                      <div className="address-head">
                        <strong>{address.label}</strong>
                        {address.isDefault && <span className="chip chip-off">Default</span>}
                      </div>
                      <p className="address-lines">
                        {address.line1}
                        {address.line2 ? `, ${address.line2}` : ''}
                        {address.city ? `, ${address.city}` : ''} {address.pincode}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="user-block">
              <div className="user-block-head">
                <h4>Recent orders</h4>
              </div>
              {detail.orders.length === 0 ? (
                <p className="form-hint">No orders yet.</p>
              ) : (
                <ul className="user-orders-list">
                  {detail.orders.map((order) => (
                    <li key={order.id}>
                      <span className="order-no">{order.orderNumber}</span>
                      <span className="order-date">{formatDate(order.createdAt)}</span>
                      <span className={`chip ${order.cancelled ? 'chip-out' : 'chip-ok'}`}>
                        {order.status}
                      </span>
                      <strong className="order-total">{formatMoney(order.totalPrice)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title || ''}
        message={confirm?.message || ''}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger}
        onCancel={() => setConfirm(null)}
        onConfirm={confirm?.onConfirm}
      />
    </div>
  );
};

export default Users;
