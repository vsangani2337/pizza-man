import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getProfile,
  updateProfile,
  updateAddresses,
  changePassword,
  toggleFavorite,
  getMenu,
} from '../../services/api';
import { LoadingState, ErrorState } from '../../components/StateViews';
import { Modal, ConfirmDialog } from '../../components/Modal';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import './Profile.css';

const EMPTY_ADDRESS = { label: 'Home', line1: '', line2: '', city: '', pincode: '', isDefault: false };

const Profile = () => {
  const { user: sessionUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);

  const [detailsForm, setDetailsForm] = useState({ name: '', phone: '' });
  const [savingDetails, setSavingDetails] = useState(false);

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPw, setSavingPw] = useState(false);

  const [addressModal, setAddressModal] = useState(null);
  const [addressError, setAddressError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const [favorites, setFavorites] = useState([]);
  const [productsById, setProductsById] = useState({});

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { data } = await getProfile();
      setProfile(data);
      setDetailsForm({ name: data.name || '', phone: data.phone || '' });
      setFavorites((data.favorites || []).map((f) => String(f._id || f)));
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMenuMap = useCallback(async () => {
    try {
      const { data } = await getMenu();
      const map = {};
      for (const product of data.products || []) map[String(product._id)] = product;
      setProductsById(map);
    } catch {
      /* optional */
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchMenuMap();
  }, [fetchProfile, fetchMenuMap, attempt]);

  const saveDetails = async (event) => {
    event.preventDefault();
    setSavingDetails(true);
    try {
      await updateProfile(detailsForm);
      toast.success('Profile updated.');
      fetchProfile();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed.');
    } finally {
      setSavingDetails(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      return toast.error('New passwords do not match.');
    }
    setSavingPw(true);
    try {
      await changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast.success('Password changed.');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Password change failed.');
    } finally {
      setSavingPw(false);
    }
  };

  const openAddress = (address = null) => {
    setAddressError('');
    setAddressModal({
      index: address ? profile.addresses.findIndex((a) => a._id === address._id) : -1,
      form: address
        ? { label: address.label, line1: address.line1, line2: address.line2 || '', city: address.city || '', pincode: address.pincode, isDefault: Boolean(address.isDefault) }
        : { ...EMPTY_ADDRESS, isDefault: profile.addresses.length === 0 },
    });
  };

  const saveAddress = async (event) => {
    event.preventDefault();
    const form = addressModal.form;
    if (!form.line1.trim()) return setAddressError('Address line is required.');
    if (!/^\d{6}$/.test(String(form.pincode).trim())) return setAddressError('PIN code must be 6 digits.');

    const next = [...profile.addresses];
    const entry = {
      label: form.label.trim() || 'Address',
      line1: form.line1.trim(),
      line2: form.line2.trim(),
      city: form.city.trim(),
      pincode: String(form.pincode).trim(),
      isDefault: Boolean(form.isDefault),
    };
    if (addressModal.index >= 0) next[addressModal.index] = { ...next[addressModal.index], ...entry };
    else next.push(entry);

    setBusy(true);
    setAddressError('');
    try {
      const { data } = await updateAddresses(next);
      setProfile((p) => ({ ...p, addresses: data.addresses }));
      setAddressModal(null);
      toast.success('Addresses saved.');
    } catch (err) {
      setAddressError(err.response?.data?.message || 'Could not save addresses.');
    } finally {
      setBusy(false);
    }
  };

  const removeAddress = (address) => {
    setConfirm({
      title: 'Remove address',
      message: `Remove "${address.label}" from your saved addresses?`,
      confirmLabel: 'Remove',
      danger: true,
      onConfirm: async () => {
        setBusy(true);
        try {
          const next = profile.addresses.filter((a) => a._id !== address._id);
          const { data } = await updateAddresses(next);
          setProfile((p) => ({ ...p, addresses: data.addresses }));
          setConfirm(null);
          toast.success('Address removed.');
        } catch (err) {
          toast.error(err.response?.data?.message || 'Remove failed.');
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const setDefaultAddress = async (address) => {
    const next = profile.addresses.map((a) => ({ ...a, isDefault: a._id === address._id }));
    try {
      const { data } = await updateAddresses(next);
      setProfile((p) => ({ ...p, addresses: data.addresses }));
      toast.success('Default address updated.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed.');
    }
  };

  const removeFavorite = async (productId) => {
    try {
      await toggleFavorite(productId);
      setFavorites((current) => current.filter((id) => id !== productId));
      toast.success('Removed from favorites.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update favorites.');
    }
  };

  if (loading && !profile) {
    return (
      <div className="page container profile-page">
        <header className="page-header">
          <div className="page-header-text">
            <span className="eyebrow">👤 Your account</span>
            <h1 className="page-title">Profile</h1>
          </div>
        </header>
        <LoadingState message="Loading profile…" />
      </div>
    );
  }
  if (loadError && !profile) {
    return (
      <div className="page container profile-page">
        <header className="page-header">
          <div className="page-header-text">
            <span className="eyebrow">👤 Your account</span>
            <h1 className="page-title">Profile</h1>
          </div>
        </header>
        <ErrorState message={loadError} onRetry={() => setAttempt((a) => a + 1)} />
      </div>
    );
  }

  const isAdmin = sessionUser?.role === 'admin';

  return (
    <div className="page container profile-page">
      <header className="profile-hero">
        <div className="profile-avatar" aria-hidden="true">
          {(profile.name || 'U').charAt(0).toUpperCase()}
        </div>

        <div className="profile-hero-text">
          <span className="eyebrow">👤 Your account</span>
          <h1 className="page-title">{profile.name}</h1>
          <p className="profile-meta">
            <span className="profile-email">{profile.email}</span>
            <span className={`chip ${profile.isVerified ? 'chip-ok' : 'chip-off'}`}>
              {profile.isVerified ? 'Verified ✓' : 'Unverified'}
            </span>
            {isAdmin && <span className="chip chip-off">Admin</span>}
          </p>
        </div>

        <Link to="/my-orders" className="btn btn-ghost btn-sm profile-hero-link">
          📦 My orders
        </Link>
      </header>

      <div className="profile-grid">
        <section className="section-card">
          <div className="profile-section-head">
            <h2>Profile details</h2>
          </div>
          <form onSubmit={saveDetails} className="form-grid">
            <label className="form-field">
              <span>Full name</span>
              <input value={detailsForm.name} onChange={(e) => setDetailsForm((f) => ({ ...f, name: e.target.value }))} minLength={2} maxLength={60} required />
            </label>
            <label className="form-field">
              <span>Phone</span>
              <input value={detailsForm.phone} onChange={(e) => setDetailsForm((f) => ({ ...f, phone: e.target.value }))} maxLength={20} placeholder="+91 …" />
            </label>
            <div className="form-actions full-span">
              <button type="submit" className="btn btn-primary" disabled={savingDetails}>
                {savingDetails ? 'Saving…' : 'Save details'}
              </button>
            </div>
          </form>
        </section>

        <section className="section-card">
          <div className="profile-section-head">
            <h2>Change password</h2>
          </div>
          <form onSubmit={savePassword} className="form-grid">
            <label className="form-field full-span">
              <span>Current password</span>
              <input type="password" autoComplete="current-password" value={pwForm.currentPassword} onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))} required />
            </label>
            <label className="form-field">
              <span>New password</span>
              <input type="password" autoComplete="new-password" value={pwForm.newPassword} onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))} minLength={8} required />
            </label>
            <label className="form-field">
              <span>Confirm new password</span>
              <input type="password" autoComplete="new-password" value={pwForm.confirmPassword} onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))} minLength={8} required />
            </label>
            <p className="form-hint full-span">Must be at least 8 characters and different from your current password.</p>
            <div className="form-actions full-span">
              <button type="submit" className="btn btn-primary" disabled={savingPw}>
                {savingPw ? 'Updating…' : 'Change password'}
              </button>
            </div>
          </form>
        </section>

        <section className="section-card full-span">
          <div className="profile-section-head">
            <h2>Saved addresses <span className="faint">({profile.addresses.length}/8)</span></h2>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => openAddress()} disabled={profile.addresses.length >= 8}>
              + Add address
            </button>
          </div>
          {profile.addresses.length === 0 ? (
            <div className="profile-empty">
              <span aria-hidden="true">📍</span>
              <p>No saved addresses yet. Add one to speed up checkout.</p>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => openAddress()}>Add address</button>
            </div>
          ) : (
            <div className="address-grid">
              {profile.addresses.map((address) => (
                <div className={`address-card ${address.isDefault ? 'default' : ''}`} key={address._id}>
                  <div className="address-card-head">
                    <strong>{address.label}</strong>
                    {address.isDefault && <span className="chip chip-ok">Default</span>}
                  </div>
                  <p>
                    {address.line1}{address.line2 ? `, ${address.line2}` : ''}
                    <br />
                    {address.city ? `${address.city}, ` : ''}PIN {address.pincode}
                  </p>
                  <div className="row-actions">
                    {!address.isDefault && <button type="button" onClick={() => setDefaultAddress(address)}>Set default</button>}
                    <button type="button" onClick={() => openAddress(address)}>Edit</button>
                    <button type="button" onClick={() => removeAddress(address)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="section-card full-span">
          <div className="profile-section-head">
            <h2>Favorite pizzas <span className="faint">({favorites.length})</span></h2>
            <Link className="btn btn-secondary btn-sm" to="/dashboard">Browse menu</Link>
          </div>
          {favorites.length === 0 ? (
            <div className="profile-empty">
              <span aria-hidden="true">❤️</span>
              <p>Tap the ♥ on any pizza in the menu to save it here.</p>
            </div>
          ) : (
            <ul className="favorites-list">
              {favorites.map((id) => {
                const product = productsById[id];
                return (
                  <li key={id}>
                    <span aria-hidden="true">🍕</span>
                    <div>
                      <strong>{product?.name || 'Saved pizza'}</strong>
                      {product && <p className="form-hint">₹{product.price}</p>}
                    </div>
                    <div className="row-actions">
                      <Link className="btn btn-secondary btn-sm" to="/dashboard">View</Link>
                      <button type="button" onClick={() => removeFavorite(id)}>Remove</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <Modal
        open={Boolean(addressModal)}
        title={addressModal?.index >= 0 ? 'Edit address' : 'Add address'}
        onClose={() => setAddressModal(null)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setAddressModal(null)} disabled={busy}>Cancel</button>
            <button type="submit" form="address-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save address'}</button>
          </>
        }
      >
        {addressModal && (
          <form id="address-form" className="form-grid" onSubmit={saveAddress}>
            <label className="form-field">
              Label
              <input value={addressModal.form.label} onChange={(e) => setAddressModal((m) => ({ ...m, form: { ...m.form, label: e.target.value } }))} maxLength={30} />
            </label>
            <label className="form-field">
              City
              <input value={addressModal.form.city} onChange={(e) => setAddressModal((m) => ({ ...m, form: { ...m.form, city: e.target.value } }))} maxLength={60} />
            </label>
            <label className="form-field full-span">
              Address line 1 *
              <input value={addressModal.form.line1} onChange={(e) => setAddressModal((m) => ({ ...m, form: { ...m.form, line1: e.target.value } }))} maxLength={120} required />
            </label>
            <label className="form-field full-span">
              Address line 2
              <input value={addressModal.form.line2} onChange={(e) => setAddressModal((m) => ({ ...m, form: { ...m.form, line2: e.target.value } }))} maxLength={120} />
            </label>
            <label className="form-field">
              PIN code *
              <input value={addressModal.form.pincode} onChange={(e) => setAddressModal((m) => ({ ...m, form: { ...m.form, pincode: e.target.value } }))} maxLength={6} inputMode="numeric" required />
            </label>
            <label className="switch-row">
              <span>Default address</span>
              <input type="checkbox" checked={addressModal.form.isDefault} onChange={(e) => setAddressModal((m) => ({ ...m, form: { ...m.form, isDefault: e.target.checked } }))} />
            </label>
            {addressError && <p className="form-error-text full-span" role="alert">{addressError}</p>}
          </form>
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

export default Profile;
