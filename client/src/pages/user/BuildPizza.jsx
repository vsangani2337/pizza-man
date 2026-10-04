import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getMenu } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { LoadingState, ErrorState, EmptyState } from '../../components/StateViews';
import QuantitySelector from '../../components/ui/QuantitySelector';
import { formatINR, round2 } from '../../utils/cartItem';
import { toast } from 'react-toastify';
import './BuildPizza.css';

const steps = [
  { key: 'base', label: 'Base', icon: '🍕', blurb: 'Pick your crust' },
  { key: 'sauce', label: 'Sauce', icon: '🍅', blurb: 'Choose the base sauce' },
  { key: 'cheese', label: 'Cheese', icon: '🧀', blurb: 'Make it melt' },
  { key: 'toppings', label: 'Toppings', icon: '🌶️', blurb: 'Veggies & meats' },
  { key: 'review', label: 'Review', icon: '✅', blurb: 'Check & add to cart' },
];

const REVIEW_STEP = steps.length - 1;

const CATEGORY_FALLBACK = {
  base: '🍕',
  sauce: '🍅',
  cheese: '🧀',
  veggie: '🥬',
  meat: '🥓',
  addon: '✨',
};

const isUrl = (value) => typeof value === 'string' && (value.startsWith('http') || value.startsWith('/'));

const toOption = (item, category) => ({ ...item, category, price: Number(item.price) || 0 });
const getItemId = (item) => item?._id || item?.id || item?.name;

const OptionVisual = ({ item }) => {
  const source = item?.image;
  if (source && isUrl(source)) {
    return <img className="option-img" src={source} alt="" loading="lazy" aria-hidden="true" />;
  }
  return (
    <span className="option-emoji" aria-hidden="true">
      {source || CATEGORY_FALLBACK[item?.category] || '🍴'}
    </span>
  );
};

const BuildPizza = () => {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [currentStep, setCurrentStep] = useState(0);
  const [options, setOptions] = useState({
    bases: [], sauces: [], cheeses: [], veggies: [], meats: [], addons: [], sizes: [],
  });
  const [selection, setSelection] = useState({
    base: null, sauce: null, cheese: null, veggies: [], meats: [], addons: [],
    size: 'medium', quantity: 1,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');

    getMenu()
      .then(({ data }) => {
        if (cancelled) return;
        const sizes = Array.isArray(data.sizes) && data.sizes.length > 0
          ? data.sizes
          : [
              { key: 'small', name: 'Small', label: '7"', multiplier: 0.85 },
              { key: 'medium', name: 'Medium', label: '10"', multiplier: 1 },
              { key: 'large', name: 'Large', label: '13"', multiplier: 1.3 },
            ];
        setOptions({
          bases: (data.bases || []).map((item) => toOption(item, 'base')),
          sauces: (data.sauces || []).map((item) => toOption(item, 'sauce')),
          cheeses: (data.cheeses || []).map((item) => toOption(item, 'cheese')),
          veggies: (data.veggies || []).map((item) => toOption(item, 'veggie')),
          meats: (data.meats || []).map((item) => toOption(item, 'meat')),
          addons: (data.addons || []).map((item) => toOption(item, 'addon')),
          sizes,
        });
        setSelection((prev) => ({
          ...prev,
          size: sizes.some((s) => s.key === prev.size) ? prev.size : 'medium',
        }));
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err.response?.data?.message || 'Failed to load menu options');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const sizeObj = useMemo(
    () => options.sizes.find((s) => s.key === selection.size) || options.sizes[1] || { name: 'Medium', multiplier: 1 },
    [options.sizes, selection.size]
  );

  const handleToggle = (key, item) => {
    setSelection((prev) => {
      const itemId = getItemId(item);
      const list = prev[key];
      const exists = list.some((entry) => getItemId(entry) === itemId);
      return {
        ...prev,
        [key]: exists ? list.filter((entry) => getItemId(entry) !== itemId) : [...list, item],
      };
    });
  };

  const handleSingle = (key, item) => setSelection((prev) => ({ ...prev, [key]: item }));

  const ingredientSum = useMemo(() => {
    const parts = [
      selection.base, selection.sauce, selection.cheese,
      ...selection.veggies, ...selection.meats,
    ].filter(Boolean);
    return parts.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  }, [selection]);

  const addonSum = useMemo(
    () => selection.addons.reduce((sum, item) => sum + (Number(item.price) || 0), 0),
    [selection.addons]
  );

  // Indicative estimate only — checkout always shows the server's final price.
  const unitEstimate = useMemo(
    () => round2(ingredientSum * (sizeObj.multiplier || 1) + addonSum),
    [ingredientSum, addonSum, sizeObj]
  );
  const totalEstimate = round2(unitEstimate * selection.quantity);

  const toppingCount = selection.veggies.length + selection.meats.length;

  const validateStep = (index) => {
    const key = steps[index].key;
    if (key === 'base' && !selection.base) { toast.error('Please select a crust base. 🍕'); return false; }
    if (key === 'sauce' && !selection.sauce) { toast.error('Please select a sauce. 🍅'); return false; }
    if (key === 'cheese' && !selection.cheese) { toast.error('Please select a cheese. 🧀'); return false; }
    if (key === 'toppings' && toppingCount === 0) { toast.error('Please choose at least one topping. 🫑'); return false; }
    return true;
  };

  const validateAll = () => {
    if (!selection.base) { toast.error('Please select a crust base. 🍕'); return false; }
    if (!selection.sauce) { toast.error('Please select a sauce. 🍅'); return false; }
    if (!selection.cheese) { toast.error('Please select a cheese. 🧀'); return false; }
    if (toppingCount === 0) { toast.error('Please choose at least one topping (veggie or meat). 🫑'); return false; }
    return true;
  };

  const goToStep = (target) => {
    if (target > currentStep) {
      for (let step = currentStep; step < target; step += 1) {
        if (!validateStep(step)) {
          setCurrentStep(step);
          return;
        }
      }
    }
    setCurrentStep(target);
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    setCurrentStep((step) => Math.min(step + 1, REVIEW_STEP));
  };

  const handleAddToCart = () => {
    if (!validateAll()) {
      // Send the user to the first step they still owe an answer for.
      const firstIncomplete = steps.findIndex((step, index) => !validateStep(index));
      if (firstIncomplete >= 0) setCurrentStep(firstIncomplete);
      return;
    }
    const toppings = [...selection.veggies, ...selection.meats].map((item) => item.name);
    addItem({
      type: 'pizza',
      productId: null,
      name: 'Custom Pizza',
      image: '',
      size: sizeObj.key,
      sizeName: sizeObj.name,
      quantity: selection.quantity,
      unitPrice: unitEstimate,
      customization: {
        base: selection.base.name,
        sauce: selection.sauce.name,
        cheese: selection.cheese.name,
        veggies: toppings,
        addons: selection.addons.map((item) => item.name),
        size: sizeObj.key,
        sizeName: sizeObj.name,
      },
    });
    toast.success(`${sizeObj.name} pizza added to cart! 🛒`);
    navigate('/cart');
  };

  /* ---------- step renderers ---------- */

  const renderOptionGrid = (key, items, { multi = false, title, blurb }) => {
    if (loading) return <LoadingState message="Arranging ingredients…" />;
    if (loadError) return <ErrorState message={loadError} onRetry={() => setAttempt((a) => a + 1)} />;
    if (!items || items.length === 0) {
      return (
        <EmptyState
          icon="🧺"
          title="Nothing on this shelf yet"
          description="This step has no options available right now. Try again shortly."
          action={<button type="button" className="btn btn-secondary btn-sm" onClick={() => setAttempt((a) => a + 1)}>Refresh</button>}
        />
      );
    }

    return (
      <div className="option-group">
        <div className="option-group-head">
          <h2 className="h3">{title}</h2>
          <p className="text-sm muted">{blurb}</p>
        </div>

        <div className={`option-grid ${multi ? 'is-multi' : ''}`} role={multi ? 'group' : 'radiogroup'} aria-label={title}>
          {items.map((item, index) => {
            const itemId = getItemId(item);
            const isSelected = multi
              ? selection[key].some((entry) => getItemId(entry) === itemId)
              : getItemId(selection[key]) === itemId;

            return (
              <button
                type="button"
                key={itemId}
                className={`option-card ${isSelected ? 'is-selected' : ''}`}
                aria-pressed={multi ? isSelected : undefined}
                aria-checked={!multi ? isSelected : undefined}
                role={multi ? undefined : 'radio'}
                style={{ animationDelay: `${Math.min(index, 10) * 0.03}s` }}
                onClick={() => (multi ? handleToggle(key, item) : handleSingle(key, item))}
              >
                <span className="option-check" aria-hidden="true">{isSelected ? '✓' : ''}</span>
                <OptionVisual item={item} />
                <span className="option-name">{item.name}</span>
                <span className="option-price">{item.price > 0 ? `+${formatINR(item.price)}` : 'Free'}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderToppings = () => (
    <div className="option-group">
      <div className="option-group-head">
        <h2 className="h3">Choose your toppings</h2>
        <p className="text-sm muted">Pick as many as you like — at least one is required.</p>
      </div>
      {renderOptionGrid('veggies', options.veggies, { multi: true, title: 'Veggies', blurb: 'Fresh, crunchy, garden-picked.' })}
      <div className="option-divider" />
      {renderOptionGrid('meats', options.meats, { multi: true, title: 'Meats', blurb: 'For the serious carnivores.' })}
    </div>
  );

  const renderReview = () => {
    const toppings = [...selection.veggies, ...selection.meats];
    const rows = [
      { label: 'Base', value: selection.base?.name, price: selection.base?.price },
      { label: 'Sauce', value: selection.sauce?.name, price: selection.sauce?.price },
      { label: 'Cheese', value: selection.cheese?.name, price: selection.cheese?.price },
      { label: 'Toppings', value: toppings.map((t) => t.name).join(', '), price: toppings.reduce((s, t) => s + (t.price || 0), 0) },
      { label: 'Size', value: `${sizeObj.name}${sizeObj.label ? ` · ${sizeObj.label}` : ''}`, price: null },
      ...(selection.addons.length
        ? [{ label: 'Add-ons', value: selection.addons.map((a) => a.name).join(', '), price: addonSum }]
        : []),
    ];

    return (
      <div className="review">
        <div className="option-group-head">
          <h2 className="h3">Your custom creation</h2>
          <p className="text-sm muted">Give it one last look before it hits the oven.</p>
        </div>

        <div className="review-visual" aria-hidden="true">
          <span className="review-disc">🍕</span>
        </div>

        <dl className="review-list">
          {rows.map((row) => (
            <div className={`review-row ${!row.value ? 'is-missing' : ''}`} key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value || 'Not chosen yet'}</dd>
              <span className="review-price">{row.price ? `+${formatINR(row.price)}` : row.value ? '—' : ''}</span>
            </div>
          ))}
          <div className="review-row is-total">
            <dt>Estimated total</dt>
            <dd>{selection.quantity} × {formatINR(unitEstimate)}</dd>
            <span className="review-price">{formatINR(totalEstimate)}</span>
          </div>
        </dl>

        <p className="estimate-disclaimer">
          Estimate based on current menu prices — the final amount is calculated on our server at checkout.
        </p>
      </div>
    );
  };

  const renderStep = () => {
    if (currentStep === REVIEW_STEP) return renderReview();
    if (steps[currentStep].key === 'toppings') return renderToppings();

    const listMap = { base: 'bases', sauce: 'sauces', cheese: 'cheeses' };
    const key = steps[currentStep].key;
    const copy = {
      base: 'Everything starts with the crust — thin, classic or cheese-loaded.',
      sauce: 'Tomato, BBQ or fiery red chilli — pick your personality.',
      cheese: 'Stretchy mozzarella, sharp cheddar or double the melt.',
    };

    return renderOptionGrid(key, options[listMap[key]], {
      title: steps[currentStep].label,
      blurb: copy[key],
    });
  };

  const step = steps[currentStep];
  const completionPct = Math.round(((currentStep + 1) / steps.length) * 100);

  return (
    <div className="page container builder-page">
      <header className="page-header builder-header">
        <div className="page-header-text">
          <span className="eyebrow">✨ Pizza Studio</span>
          <h1 className="page-title">Build Your Pizza</h1>
          <p className="page-subtitle">Five steps to a pizza that is exactly — and only — what you wanted.</p>
        </div>
        <Link to="/dashboard" className="btn btn-ghost btn-sm">← Back to menu</Link>
      </header>

      {/* ---- Progress ---- */}
      <nav className="builder-progress" aria-label="Builder steps">
        <div className="builder-progress-bar" aria-hidden="true">
          <span style={{ width: `${completionPct}%` }} />
        </div>
        <ol className="builder-steps">
          {steps.map((entry, index) => {
            const state = index < currentStep ? 'done' : index === currentStep ? 'current' : 'todo';
            return (
              <li key={entry.key}>
                <button
                  type="button"
                  className={`builder-step is-${state}`}
                  onClick={() => goToStep(index)}
                  aria-current={state === 'current' ? 'step' : undefined}
                >
                  <span className="builder-step-dot" aria-hidden="true">
                    {state === 'done' ? '✓' : index + 1}
                  </span>
                  <span className="builder-step-text">
                    <strong>{entry.label}</strong>
                    <small>{entry.blurb}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="builder-grid">
        {/* ---- Main column ---- */}
        <section className="builder-main card" aria-label={`${step.label} step`}>
          <div className="builder-viewport">{renderStep()}</div>

          <div className="builder-dock">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCurrentStep((p) => Math.max(0, p - 1))}
              disabled={currentStep === 0}
            >
              ← Back
            </button>
            <span className="builder-dock-status" aria-live="polite">
              Step {currentStep + 1} of {steps.length}
            </span>
            {currentStep < REVIEW_STEP ? (
              <button type="button" className="btn btn-primary" onClick={handleNext}>
                Next: {steps[currentStep + 1].label} →
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={handleAddToCart}>
                🛒 Add to Cart
              </button>
            )}
          </div>
        </section>

        {/* ---- Sticky summary ---- */}
        <aside className="builder-summary" aria-label="Live order summary">
          <div className="builder-summary-inner">
            <div className="builder-summary-head">
              <h2 className="panel-title">
                <span className="panel-icon" aria-hidden="true">🧾</span>
                Your pizza
              </h2>
              <span className="tag">{sizeObj.name}</span>
            </div>

            <ul className="builder-recap">
              <li className={!selection.base ? 'is-missing' : ''}>
                <span>Base</span>
                <strong>{selection.base?.name || 'Not chosen'}</strong>
              </li>
              <li className={!selection.sauce ? 'is-missing' : ''}>
                <span>Sauce</span>
                <strong>{selection.sauce?.name || 'Not chosen'}</strong>
              </li>
              <li className={!selection.cheese ? 'is-missing' : ''}>
                <span>Cheese</span>
                <strong>{selection.cheese?.name || 'Not chosen'}</strong>
              </li>
              <li className={toppingCount === 0 ? 'is-missing' : ''}>
                <span>Toppings</span>
                <strong>
                  {toppingCount === 0
                    ? 'None yet'
                    : [...selection.veggies, ...selection.meats].map((t) => t.name).join(', ')}
                </strong>
              </li>
            </ul>

            <div className="builder-summary-block">
              <h3 className="detail-label">Size</h3>
              <div className="builder-size-row" role="radiogroup" aria-label="Pizza size">
                {options.sizes.map((size) => (
                  <button
                    type="button"
                    key={size.key}
                    role="radio"
                    aria-checked={selection.size === size.key}
                    className={`builder-size ${selection.size === size.key ? 'is-active' : ''}`}
                    onClick={() => setSelection((prev) => ({ ...prev, size: size.key }))}
                  >
                    <strong>{size.name}</strong>
                    <small>{size.label || `×${size.multiplier}`}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="builder-summary-block">
              <h3 className="detail-label">Add-ons <span className="text-muted">(optional)</span></h3>
              {options.addons.length === 0 ? (
                <p className="form-hint">No add-ons available right now.</p>
              ) : (
                <div className="builder-addon-row">
                  {options.addons.map((addon) => {
                    const selected = selection.addons.some((entry) => getItemId(entry) === getItemId(addon));
                    return (
                      <button
                        type="button"
                        key={getItemId(addon)}
                        className={`chip-filter ${selected ? 'is-active' : ''}`}
                        aria-pressed={selected}
                        onClick={() => handleToggle('addons', addon)}
                      >
                        {addon.name} · {formatINR(addon.price)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="builder-summary-block builder-qty-block">
              <h3 className="detail-label">Quantity</h3>
              <QuantitySelector
                value={selection.quantity}
                onChange={(quantity) => setSelection((prev) => ({ ...prev, quantity }))}
                max={50}
                label="pizza quantity"
              />
            </div>

            <div className="builder-total">
              <span className="builder-total-label">Estimated total</span>
              <strong className="builder-total-value">{formatINR(totalEstimate)}</strong>
              <small>{selection.quantity} × {formatINR(unitEstimate)}</small>
            </div>

            <button type="button" className="btn btn-primary btn-lg btn-block builder-add" onClick={handleAddToCart}>
              🛒 Add to Cart
            </button>

            <p className="estimate-disclaimer">
              Final price is set by our server at checkout.
            </p>
          </div>
        </aside>
      </div>

      {/* ---- Mobile action bar ---- */}
      <div className="builder-mobile-bar" role="region" aria-label="Order total">
        <div className="builder-mobile-total">
          <span>{currentStep < REVIEW_STEP ? 'Estimated' : 'Total'}</span>
          <strong>{formatINR(totalEstimate)}</strong>
        </div>
        {currentStep < REVIEW_STEP ? (
          <button type="button" className="btn btn-primary" onClick={handleNext}>
            Next: {steps[currentStep + 1].label} →
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={handleAddToCart}>
            🛒 Add to Cart
          </button>
        )}
      </div>
    </div>
  );
};

export default BuildPizza;
