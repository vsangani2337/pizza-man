import { useEffect, useState } from 'react';
import { getSettings, updateSettings } from '../../services/api';
import { LoadingState, ErrorState } from '../../components/StateViews';
import { toast } from 'react-toastify';
import './Settings.css';

const Settings = () => {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const { data } = await getSettings();
        if (!active) return;
        setSettings(data);
        setForm({ ...data });
      } catch (err) {
        if (active) setLoadError(err.response?.data?.message || 'Could not load settings.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [attempt]);

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async (event) => {
    event.preventDefault();
    const payload = {
      storeName: form.storeName,
      supportPhone: form.supportPhone || '',
      supportEmail: form.supportEmail || '',
      taxRate: Number(form.taxRate),
      deliveryFee: Number(form.deliveryFee),
      freeDeliveryAbove: Number(form.freeDeliveryAbove),
      minOrderAmount: Number(form.minOrderAmount),
      stockThreshold: Number(form.stockThreshold),
      storeOpen: Boolean(form.storeOpen),
      deliveryEnabled: Boolean(form.deliveryEnabled),
    };

    if (payload.taxRate < 0 || payload.taxRate > 100) return setError('Tax rate must be between 0 and 100.');
    if (
      payload.minOrderAmount > 0 &&
      payload.deliveryFee > 0 &&
      payload.freeDeliveryAbove > 0 &&
      payload.freeDeliveryAbove < payload.minOrderAmount
    ) {
      // allowed — just informational, no hard error
    }

    setSaving(true);
    setError('');
    try {
      const { data } = await updateSettings(payload);
      setSettings(data);
      setForm({ ...data });
      toast.success('Settings saved. New orders use them immediately.');
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !form) {
    return (
      <div className="admin-page admin-settings">
        <LoadingState message="Loading settings…" />
      </div>
    );
  }

  if (loadError && !form) {
    return (
      <div className="admin-page admin-settings">
        <ErrorState
          title="Couldn’t load settings"
          message={loadError}
          onRetry={() => setAttempt((a) => a + 1)}
        />
      </div>
    );
  }

  return (
    <div className="admin-page admin-settings">
      <header className="page-header">
        <div className="page-header-text">
          <span className="eyebrow">⚙️ Configuration</span>
          <h1 className="page-title">Store settings</h1>
          <p className="page-subtitle">
            Applies to pricing, checkout validation, low-stock alerts and the customer-facing store banner.
          </p>
        </div>
      </header>

      <form onSubmit={save} className="settings-form">
        <div className="settings-cards animate-stagger">
          <section className="section-card settings-card">
            <div className="settings-card-head">
              <span className="settings-card-icon" aria-hidden="true">
                🏪
              </span>
              <div className="settings-card-head-text">
                <h2>Store details</h2>
                <p className="form-hint">Name and contact details for the storefront.</p>
              </div>
            </div>
            <div className="form-grid">
              <label className="form-field">
                Store name
                <input
                  value={form.storeName || ''}
                  onChange={(e) => updateField('storeName', e.target.value)}
                  minLength={2}
                  maxLength={60}
                  required
                />
                <span className="form-hint">Between 2 and 60 characters.</span>
              </label>
              <label className="form-field">
                Support phone
                <input
                  value={form.supportPhone || ''}
                  onChange={(e) => updateField('supportPhone', e.target.value)}
                  maxLength={20}
                  placeholder="+91 …"
                />
                <span className="form-hint">Optional. Up to 20 characters.</span>
              </label>
              <label className="form-field">
                Support email
                <input
                  type="email"
                  value={form.supportEmail || ''}
                  onChange={(e) => updateField('supportEmail', e.target.value)}
                  maxLength={100}
                  placeholder="hello@pizzaman.com"
                />
                <span className="form-hint">Optional. Up to 100 characters.</span>
              </label>
            </div>
          </section>

          <section className="section-card settings-card">
            <div className="settings-card-head">
              <span className="settings-card-icon" aria-hidden="true">
                🕒
              </span>
              <div className="settings-card-head-text">
                <h2>Ordering &amp; availability</h2>
                <p className="form-hint">Control whether checkout and delivery are available.</p>
              </div>
            </div>
            <div className="switch-row">
              <label htmlFor="storeOpen">
                Store is open for orders
                <span className="form-hint">When closed, checkout is blocked for everyone.</span>
              </label>
              <input
                id="storeOpen"
                type="checkbox"
                checked={Boolean(form.storeOpen)}
                onChange={(e) => updateField('storeOpen', e.target.checked)}
              />
            </div>
            <div className="switch-row">
              <label htmlFor="deliveryEnabled">
                Delivery enabled
                <span className="form-hint">
                  Turn off to pause delivery while still accepting pickups/orders.
                </span>
              </label>
              <input
                id="deliveryEnabled"
                type="checkbox"
                checked={Boolean(form.deliveryEnabled)}
                onChange={(e) => updateField('deliveryEnabled', e.target.checked)}
              />
            </div>
          </section>

          <section className="section-card settings-card">
            <div className="settings-card-head">
              <span className="settings-card-icon" aria-hidden="true">
                💸
              </span>
              <div className="settings-card-head-text">
                <h2>Tax &amp; fees</h2>
                <p className="form-hint">Charged and validated at checkout.</p>
              </div>
            </div>
            <div className="form-grid">
              <label className="form-field">
                Tax rate (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.taxRate ?? 0}
                  onChange={(e) => updateField('taxRate', e.target.value)}
                />
                <span className="form-hint">Charged on the item subtotal.</span>
              </label>
              <label className="form-field">
                Delivery fee (₹)
                <input
                  type="number"
                  min="0"
                  max="10000"
                  step="1"
                  value={form.deliveryFee ?? 0}
                  onChange={(e) => updateField('deliveryFee', e.target.value)}
                />
                <span className="form-hint">Set 0 to remove the delivery charge.</span>
              </label>
              <label className="form-field">
                Free delivery above (₹)
                <input
                  type="number"
                  min="0"
                  max="100000"
                  step="1"
                  value={form.freeDeliveryAbove ?? 0}
                  onChange={(e) => updateField('freeDeliveryAbove', e.target.value)}
                />
                <span className="form-hint">0 disables the offer.</span>
              </label>
              <label className="form-field">
                Minimum order amount (₹)
                <input
                  type="number"
                  min="0"
                  max="100000"
                  step="1"
                  value={form.minOrderAmount ?? 0}
                  onChange={(e) => updateField('minOrderAmount', e.target.value)}
                />
                <span className="form-hint">Orders below this are rejected at checkout.</span>
              </label>
            </div>
          </section>

          <section className="section-card settings-card settings-card-single">
            <div className="settings-card-head">
              <span className="settings-card-icon" aria-hidden="true">
                📦
              </span>
              <div className="settings-card-head-text">
                <h2>Inventory alerts</h2>
                <p className="form-hint">When stock counts start running low.</p>
              </div>
            </div>
            <div className="form-grid">
              <label className="form-field">
                Low-stock threshold (units)
                <input
                  type="number"
                  min="0"
                  max="100000"
                  step="1"
                  value={form.stockThreshold ?? 20}
                  onChange={(e) => updateField('stockThreshold', e.target.value)}
                />
                <span className="form-hint">Items at or below this show a low-stock warning.</span>
              </label>
            </div>
          </section>
        </div>

        <div className="settings-footer">
          {error && (
            <p className="form-error-text settings-error" role="alert">
              {error}
            </p>
          )}
          <div className="settings-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setForm({ ...settings })}
              disabled={saving}
            >
              Reset
            </button>
            <button
              type="submit"
              className={`btn btn-primary ${saving ? 'is-loading' : ''}`}
              disabled={saving}
              aria-busy={saving}
            >
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default Settings;
