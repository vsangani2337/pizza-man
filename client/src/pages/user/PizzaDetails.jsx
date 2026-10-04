import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getMenu, getFavorites, toggleFavorite } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { ErrorState, EmptyState } from '../../components/StateViews';
import { PizzaGridSkeleton } from '../../components/ui/Skeletons';
import PizzaCard, { looksVegetarian } from '../../components/ui/PizzaCard';
import QuantitySelector from '../../components/ui/QuantitySelector';
import { resolveProductImage } from '../../utils/productImages';
import { productToCart, formatINR, round2 } from '../../utils/cartItem';
import './PizzaDetails.css';

const PizzaDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [favorites, setFavorites] = useState(() => new Set());

  const [sizeKey, setSizeKey] = useState('medium');
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { data } = await getMenu();
      setMenu(data);
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Could not load this pizza.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMenu();
    getFavorites()
      .then(({ data }) => setFavorites(new Set((data || []).map((f) => String(f._id || f)))))
      .catch(() => {});
  }, [fetchMenu, attempt]);

  const product = useMemo(
    () => (menu?.products || []).find((item) => String(item._id) === String(id)),
    [menu, id]
  );

  const size = useMemo(
    () => (menu?.sizes || []).find((s) => s.key === sizeKey) || { key: 'medium', name: 'Medium', multiplier: 1 },
    [menu, sizeKey]
  );

  const related = useMemo(() => {
    if (!menu || !product) return [];
    const categoryName = product.categoryId?.name;
    return (menu.products || [])
      .filter((item) => String(item._id) !== String(product._id))
      .sort((a, b) => Number(b.categoryId?.name === categoryName) - Number(a.categoryId?.name === categoryName))
      .slice(0, 4);
  }, [menu, product]);

  if (loading) {
    return (
      <div className="page container">
        <div className="page-header">
          <div className="page-header-text" style={{ width: 'min(360px, 100%)' }}>
            <span className="skeleton-line" style={{ height: 13, width: '40%', display: 'block' }} />
            <span className="skeleton-line" style={{ height: 36, width: '100%', display: 'block' }} />
          </div>
        </div>
        <PizzaGridSkeleton count={4} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="page container">
        <ErrorState message={loadError} onRetry={() => setAttempt((a) => a + 1)} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="page container">
        <EmptyState
          icon="🍕"
          title="We couldn't find that pizza"
          description="It may have been removed from the menu, or the link is out of date."
          action={
            <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/dashboard')}>
              Back to menu
            </button>
          }
        />
      </div>
    );
  }

  const image = resolveProductImage(product);
  const veg = looksVegetarian(product);
  const unitPrice = round2((Number(product.price) || 0) * (size.multiplier || 1));
  const total = round2(unitPrice * quantity);
  const isFavorite = favorites.has(String(product._id));
  const composition = product.pizza || {};
  const ingredientChips = [
    composition.base && `Base: ${composition.base}`,
    composition.sauce && `Sauce: ${composition.sauce}`,
    composition.cheese && `Cheese: ${composition.cheese}`,
    ...(composition.veggies || []).map((v) => v),
  ].filter(Boolean);

  const handleFavorite = async () => {
    setFavorites((current) => {
      const next = new Set(current);
      if (isFavorite) next.delete(String(product._id));
      else next.add(String(product._id));
      return next;
    });
    try {
      const { data } = await toggleFavorite(String(product._id));
      toast[data.favorited ? 'success' : 'info'](
        data.favorited ? `♥ ${product.name} saved to favorites.` : `Removed ${product.name} from favorites.`
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update favorites.');
    }
  };

  const handleAdd = () => {
    setAdding(true);
    addItem({ ...productToCart(product, size), quantity });
    toast.success(`${quantity} × ${product.name} added to cart! 🛒`);
    window.setTimeout(() => setAdding(false), 600);
  };

  return (
    <div className="page container pizza-detail-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/dashboard">Menu</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="pizza-detail">
        {/* ---- Gallery ---- */}
        <div className="pizza-detail-gallery">
          <div className="pizza-detail-image-wrap">
            {image ? (
              <img src={image} alt={product.name} className="pizza-detail-image" width="720" height="540" />
            ) : (
              <div className="pizza-detail-image pizza-detail-image-fallback" aria-hidden="true">🍕</div>
            )}
            <span className={`veg-dot ${veg ? 'is-veg' : 'is-nonveg'}`} title={veg ? 'Vegetarian' : 'Non-vegetarian'}>
              <span />
            </span>
            <button
              type="button"
              className={`fav-btn ${isFavorite ? 'is-active' : ''}`}
              aria-pressed={isFavorite}
              aria-label={isFavorite ? `Remove ${product.name} from favorites` : `Save ${product.name} to favorites`}
              onClick={handleFavorite}
            >
              {isFavorite ? '♥' : '♡'}
            </button>
          </div>

          <div className="pizza-detail-highlights">
            <div className="highlight">
              <span aria-hidden="true">🔥</span>
              <span><strong>Stone baked</strong><small>at 400°C</small></span>
            </div>
            <div className="highlight">
              <span aria-hidden="true">🌿</span>
              <span><strong>Fresh dough</strong><small>proofed 24h</small></span>
            </div>
            <div className="highlight">
              <span aria-hidden="true">🛵</span>
              <span><strong>Delivered hot</strong><small>in ~30 min</small></span>
            </div>
          </div>
        </div>

        {/* ---- Details ---- */}
        <div className="pizza-detail-info">
          <div className="pizza-detail-tags">
            <span className="tag">{product.categoryId?.name || 'Signature'}</span>
            <span className={`tag ${veg ? 'tag-veg' : 'tag-nonveg'}`}>{veg ? 'Veg' : 'Non-veg'}</span>
            {product.available === false && <span className="tag tag-warn">Sold out</span>}
          </div>

          <h1 className="pizza-detail-title">{product.name}</h1>

          {product.description && <p className="lead">{product.description}</p>}

          <div className="pizza-detail-price-row">
            <span className="price price-lg">{formatINR(unitPrice)}</span>
            <span className="text-sm muted">{size.name}{size.label ? ` · ${size.label}` : ''} · inclusive of taxes at checkout</span>
          </div>

          <div className="pizza-detail-block">
            <h2 className="detail-label">Choose size</h2>
            <div className="size-options" role="radiogroup" aria-label="Pizza size">
              {(menu.sizes || []).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  role="radio"
                  aria-checked={sizeKey === option.key}
                  className={`size-option ${sizeKey === option.key ? 'is-active' : ''}`}
                  onClick={() => setSizeKey(option.key)}
                >
                  <strong>{option.name}</strong>
                  <small>{option.label || ''}</small>
                  <span>{formatINR(round2((Number(product.price) || 0) * (option.multiplier || 1)))}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pizza-detail-block">
            <h2 className="detail-label">What's on it</h2>
            <ul className="ingredient-chips">
              {ingredientChips.map((chip) => (
                <li key={chip}>{chip}</li>
              ))}
            </ul>
          </div>

          <div className="pizza-detail-buy">
            <QuantitySelector value={quantity} onChange={setQuantity} label="quantity" size="lg" />
            <button
              type="button"
              className="btn btn-primary btn-lg pizza-detail-add"
              onClick={handleAdd}
              disabled={product.available === false || adding}
            >
              {product.available === false ? 'Out of stock' : `Add to cart · ${formatINR(total)}`}
            </button>
          </div>

          <div className="pizza-detail-alt">
            <Link to="/build-pizza" className="btn btn-outline btn-block">
              🛠️ Build it your own way instead
            </Link>
            <p className="form-hint">
              Change the base, sauce, cheese and pile on extra toppings in the Pizza Studio.
            </p>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="pizza-detail-related" aria-labelledby="related-heading">
          <header className="section-header">
            <div className="section-header-text">
              <span className="section-eyebrow">Keep exploring</span>
              <h2 className="section-title" id="related-heading">You might also like</h2>
            </div>
          </header>
          <div className="pizza-grid">
            {related.map((item, index) => (
              <PizzaCard
                key={item._id}
                product={item}
                index={index}
                sizeLabel={size.name}
                isFavorite={favorites.has(String(item._id))}
                onToggleFavorite={async (target) => {
                  const targetId = String(target._id);
                  const wasFavorite = favorites.has(targetId);
                  setFavorites((current) => {
                    const next = new Set(current);
                    if (wasFavorite) next.delete(targetId);
                    else next.add(targetId);
                    return next;
                  });
                  try {
                    await toggleFavorite(targetId);
                  } catch {
                    setFavorites((current) => {
                      const next = new Set(current);
                      if (wasFavorite) next.add(targetId);
                      else next.delete(targetId);
                      return next;
                    });
                  }
                }}
                onAdd={(target) => {
                  addItem(productToCart(target, size));
                  toast.success(`${target.name} added to cart! 🛒`);
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default PizzaDetails;
