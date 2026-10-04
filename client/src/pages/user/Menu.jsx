import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getMenu, getSettings, getFavorites, toggleFavorite } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { ErrorState, EmptyState } from '../../components/StateViews';
import { PizzaGridSkeleton } from '../../components/ui/Skeletons';
import PizzaCard from '../../components/ui/PizzaCard';
import { productToCart, drinkToCart, pickSize, formatINR } from '../../utils/cartItem';
import './Menu.css';

const ALL = 'All Pizzas';
const DRINKS = 'Cold Drinks';

const SORTS = [
  { key: 'recommended', label: 'Recommended' },
  { key: 'price-asc', label: 'Price: low to high' },
  { key: 'price-desc', label: 'Price: high to low' },
  { key: 'name', label: 'Name: A–Z' },
];

const Menu = () => {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();

  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [favorites, setFavorites] = useState(() => new Set());
  const [storeOpen, setStoreOpen] = useState(true);

  const [activeCategory, setActiveCategory] = useState(ALL);
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const [sort, setSort] = useState('recommended');
  const [vegOnly, setVegOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState(null);

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { data } = await getMenu();
      setMenu({
        bases: data.bases || [],
        sauces: data.sauces || [],
        cheeses: data.cheeses || [],
        veggies: data.veggies || [],
        meats: data.meats || [],
        drinks: data.drinks || [],
        addons: data.addons || [],
        products: data.products || [],
        sizes: data.sizes || [],
        categories: data.categories || [],
      });
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Could not load the menu.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchExtras = useCallback(async () => {
    try {
      const [settingsRes, favoritesRes] = await Promise.allSettled([getSettings(), getFavorites()]);
      if (settingsRes.status === 'fulfilled') setStoreOpen(settingsRes.value.data.storeOpen !== false);
      if (favoritesRes.status === 'fulfilled') {
        setFavorites(new Set((favoritesRes.value.data || []).map((f) => String(f._id || f))));
      }
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    fetchMenu();
    fetchExtras();
  }, [fetchMenu, fetchExtras, attempt]);

  // Keep the URL in sync so menu searches are shareable / bookmarkable.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (search.trim()) next.set('q', search.trim());
    else next.delete('q');
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const size = useMemo(() => pickSize(menu?.sizes), [menu]);

  const categoryNames = useMemo(
    () => (menu?.categories || []).filter((c) => c.isActive !== false).map((c) => c.name),
    [menu]
  );

  const priceBounds = useMemo(() => {
    const prices = (menu?.products || []).map((p) => Number(p.price) || 0);
    if (!prices.length) return { min: 0, max: 1000 };
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [menu]);

  useEffect(() => {
    if (menu && maxPrice === null) setMaxPrice(priceBounds.max);
  }, [menu, maxPrice, priceBounds.max]);

  const query = search.trim().toLowerCase();
  const isDrinksCategory = activeCategory === DRINKS;

  const visibleProducts = useMemo(() => {
    if (!menu) return [];
    const list = menu.products.filter((product) => {
      if (activeCategory !== ALL && product.categoryId?.name !== activeCategory) return false;
      if (query && !product.name.toLowerCase().includes(query) && !(product.description || '').toLowerCase().includes(query)) return false;
      if (vegOnly && /(chicken|pepperoni|meat|sausage|salami|ham|bacon|kebab|tikka|prawn|fish|egg)/i.test(`${product.name} ${product.description}`)) return false;
      if (inStockOnly && product.available === false) return false;
      if (maxPrice !== null && (Number(product.price) || 0) > maxPrice) return false;
      return true;
    });

    const sorted = [...list];
    if (sort === 'price-asc') sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
    else if (sort === 'price-desc') sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
    else if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [menu, activeCategory, query, vegOnly, inStockOnly, maxPrice, sort]);

  const visibleDrinks = useMemo(() => {
    if (!menu || !isDrinksCategory) return [];
    return menu.drinks.filter((drink) => {
      if (query && !drink.name.toLowerCase().includes(query)) return false;
      if (inStockOnly && Number(drink.quantity) <= 0) return false;
      return true;
    });
  }, [menu, isDrinksCategory, query, inStockOnly]);

  const filtersActive = Boolean(query) || vegOnly || inStockOnly || (maxPrice !== null && maxPrice < priceBounds.max);

  const clearFilters = () => {
    setSearch('');
    setVegOnly(false);
    setInStockOnly(false);
    setMaxPrice(priceBounds.max);
    setActiveCategory(ALL);
  };

  const handleAddProduct = (product) => {
    addItem(productToCart(product, size));
    toast.success(`${product.name} added to cart! 🛒`);
  };

  const handleAddDrink = (drink) => {
    addItem(drinkToCart(drink));
    toast.success(`${drink.name} added to cart! 🥤`);
  };

  const handleToggleFavorite = async (product) => {
    const id = String(product._id);
    const isFavorite = favorites.has(id);
    setFavorites((current) => {
      const next = new Set(current);
      if (isFavorite) next.delete(id);
      else next.add(id);
      return next;
    });
    try {
      const { data } = await toggleFavorite(id);
      toast[data.favorited ? 'success' : 'info'](
        data.favorited ? `♥ ${product.name} saved to favorites.` : `Removed ${product.name} from favorites.`
      );
    } catch (err) {
      setFavorites((current) => {
        const next = new Set(current);
        if (isFavorite) next.add(id);
        else next.delete(id);
        return next;
      });
      toast.error(err.response?.data?.message || 'Could not update favorites.');
    }
  };

  if (loading) {
    return (
      <div className="page container menu-page">
        <div className="page-header">
          <div className="page-header-text" style={{ width: 'min(440px, 100%)' }}>
            <span className="skeleton-line" style={{ height: 13, width: '130px', display: 'block' }} />
            <span className="skeleton-line" style={{ height: 40, width: '100%', display: 'block' }} />
            <span className="skeleton-line" style={{ height: 16, width: '70%', display: 'block' }} />
          </div>
        </div>
        <PizzaGridSkeleton count={8} />
      </div>
    );
  }

  if (loadError || !menu) {
    return (
      <div className="page container menu-page">
        <ErrorState message={loadError || 'Could not load the menu.'} onRetry={() => setAttempt((a) => a + 1)} />
      </div>
    );
  }

  const tabs = [
    { label: ALL, count: menu.products.length },
    ...categoryNames.map((name) => ({
      label: name,
      count: menu.products.filter((p) => p.categoryId?.name === name).length,
    })),
    { label: DRINKS, count: menu.drinks.length },
    { label: 'Build Your Pizza', count: null },
  ];

  const showPizzas = !isDrinksCategory;
  const showDrinks = isDrinksCategory;
  const noResults = (showPizzas && visibleProducts.length === 0) || (showDrinks && visibleDrinks.length === 0);

  return (
    <div className="page container menu-page">
      {!storeOpen && (
        <div className="store-banner" role="status">
          🔒 The store is currently closed — browsing is fine, but checkout is paused.
        </div>
      )}

      <header className="page-header menu-header">
        <div className="page-header-text">
          <span className="eyebrow">🍕 The full lineup</span>
          <h1 className="page-title">Find Your Perfect Pizza</h1>
          <p className="page-subtitle">
            Signature pies, sides and ice-cold drinks — filter by craving, then make any pizza your own.
          </p>
        </div>

        <div className="menu-header-stat" aria-hidden="true">
          <strong>{menu.products.length + menu.drinks.length}</strong>
          <span>items ready to order</span>
        </div>
      </header>

      {/* ---- Categories ---- */}
      <nav className="menu-categories" aria-label="Menu categories">
        <div className="segmented menu-segmented">
          {tabs.map((tab) => {
            const isActive = activeCategory === tab.label;
            if (tab.label === 'Build Your Pizza') {
              return (
                <button
                  key={tab.label}
                  type="button"
                  className="segment segment-highlight"
                  onClick={() => navigate('/build-pizza')}
                >
                  ✨ {tab.label}
                </button>
              );
            }
            return (
              <button
                key={tab.label}
                type="button"
                className={`segment ${isActive ? 'is-active' : ''}`}
                onClick={() => setActiveCategory(tab.label)}
                aria-pressed={isActive}
              >
                {tab.label}
                {tab.count !== null && <span className="segment-count">{tab.count}</span>}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ---- Search + filters ---- */}
      <div className="menu-controls" role="search">
        <div className="field-with-icon menu-search-field">
          <span className="field-icon" aria-hidden="true">🔍</span>
          <input
            type="search"
            id="menu-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pizzas, descriptions, drinks…"
            aria-label="Search the menu"
          />
        </div>

        <label className="menu-select">
          <span className="sr-only-field">Sort by</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort menu">
            {SORTS.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </label>

        <div className="menu-filter-group" role="group" aria-label="Filters">
          <button
            type="button"
            className={`chip-filter ${vegOnly ? 'is-active' : ''}`}
            aria-pressed={vegOnly}
            onClick={() => setVegOnly((v) => !v)}
          >
            🌿 Veg only
          </button>
          <button
            type="button"
            className={`chip-filter ${inStockOnly ? 'is-active' : ''}`}
            aria-pressed={inStockOnly}
            onClick={() => setInStockOnly((v) => !v)}
          >
            ✅ In stock
          </button>
          {filtersActive && (
            <button type="button" className="chip-filter" onClick={clearFilters}>
              ✕ Clear
            </button>
          )}
        </div>

        <div className="menu-price-filter">
          <label htmlFor="menu-price">Max price</label>
          <input
            id="menu-price"
            type="range"
            min={priceBounds.min}
            max={priceBounds.max}
            step={10}
            value={maxPrice ?? priceBounds.max}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
          />
          <output htmlFor="menu-price">{formatINR(maxPrice ?? priceBounds.max)}</output>
        </div>
      </div>

      <p className="menu-result-count" role="status">
        {showPizzas && `${visibleProducts.length} pizza${visibleProducts.length === 1 ? '' : 's'}`}
        {showDrinks && `${visibleDrinks.length} drink${visibleDrinks.length === 1 ? '' : 's'}`}
        {filtersActive && ' match your filters'}
      </p>

      {/* ---- Results ---- */}
      <main className="menu-main">
        {noResults ? (
          <EmptyState
            icon="🔎"
            title="No matches found"
            description="Try a different search, or clear the filters to see the whole menu again."
            action={
              <button type="button" className="btn btn-primary btn-sm" onClick={clearFilters}>
                Clear filters
              </button>
            }
          />
        ) : (
          <>
            {showPizzas && (
              <section aria-label="Pizzas">
                <div className="menu-section-head">
                  <h2 className="h3">{activeCategory === ALL ? 'Signature Pizzas' : activeCategory}</h2>
                  <span className="text-sm muted">Serves 1–2 · {size.name} by default</span>
                </div>
                <div className="pizza-grid">
                  {visibleProducts.map((product, index) => (
                    <PizzaCard
                      key={product._id}
                      product={product}
                      index={index}
                      sizeLabel={size.name}
                      isFavorite={favorites.has(String(product._id))}
                      onToggleFavorite={handleToggleFavorite}
                      onAdd={handleAddProduct}
                      footerNote={product.available === false ? 'Currently unavailable' : 'Add to cart in one tap'}
                    />
                  ))}
                </div>
              </section>
            )}

            {showDrinks && (
              <section aria-label="Cold drinks">
                <div className="menu-section-head">
                  <h2 className="h3">🥤 Cold Drinks</h2>
                  <span className="text-sm muted">Chilled and ready</span>
                </div>
                <div className="drink-grid">
                  {visibleDrinks.map((drink) => {
                    const outOfStock = Number(drink.quantity) <= 0;
                    return (
                      <article className="drink-card" key={drink._id}>
                        <div className="drink-card-image-wrap">
                          {drink.image ? (
                            <img src={drink.image} alt={drink.name} className="drink-card-image" loading="lazy" />
                          ) : (
                            <div className="drink-card-image drink-card-fallback" aria-hidden="true">🥤</div>
                          )}
                        </div>
                        <div className="drink-card-body">
                          <h3>{drink.name}</h3>
                          <span className="price">₹{drink.price}</span>
                          {outOfStock ? (
                            <span className="chip chip-out">Out of stock</span>
                          ) : (
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleAddDrink(drink)}>
                              Add to cart
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <section className="menu-builder-cta">
        <div>
          <span className="section-eyebrow">Can't decide?</span>
          <h2 className="h3">Build it from scratch in the Pizza Studio</h2>
          <p className="text-sm muted">Base, sauce, cheese, toppings, size — five steps, infinite combinations.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/build-pizza')}>
          ✨ Build Your Pizza
        </button>
      </section>
    </div>
  );
};

export default Menu;
