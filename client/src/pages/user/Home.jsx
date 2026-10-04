import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getMenu, getFavorites, toggleFavorite } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { EmptyState, ErrorState } from '../../components/StateViews';
import { PizzaGridSkeleton } from '../../components/ui/Skeletons';
import PizzaCard from '../../components/ui/PizzaCard';
import SectionHeader from '../../components/ui/SectionHeader';
import { productToCart, pickSize } from '../../utils/cartItem';
import heroPizza from '../../assets/margherita.jpg';
import './Home.css';

const FEATURES = [
  {
    icon: '🌿',
    title: 'Fresh Ingredients',
    text: 'Vegetables prepped every morning, cheese pulled daily and dough proofed for 24 hours.',
  },
  {
    icon: '🛠️',
    title: 'Fully Customizable',
    text: 'Pick your base, sauce, cheese and pile on toppings — down to the last jalapeño.',
  },
  {
    icon: '🛵',
    title: 'Fast Delivery',
    text: 'Out of the oven and at your door hot, with live order tracking the whole way.',
  },
  {
    icon: '🔒',
    title: 'Secure Checkout',
    text: 'Payments handled by Razorpay — encrypted end to end, with instant order confirmation.',
  },
];

const STEPS = ['Choose Base', 'Pick Sauce', 'Add Cheese', 'Choose Toppings', 'Bake & Enjoy'];

const Home = () => {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [favorites, setFavorites] = useState(() => new Set());

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { data } = await getMenu();
      setMenu(data);
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Could not load the menu.');
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

  const size = useMemo(() => pickSize(menu?.sizes), [menu]);

  const popular = useMemo(() => {
    const products = menu?.products || [];
    return products.slice(0, 8);
  }, [menu]);

  const handleAdd = (product) => {
    addItem(productToCart(product, size));
    toast.success(`${product.name} added to cart! 🛒`);
  };

  const handleFavorite = async (product) => {
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

  return (
    <div className="home-page">
      {/* ================= HERO ================= */}
      <section className="hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="container hero-inner">
          <div className="hero-copy">
            <span className="eyebrow hero-eyebrow">🔥 Fresh • Hot • Made for You</span>

            <h1 className="display hero-title">
              Your Perfect Pizza,
              <br />
              <span className="gradient-text">Your Way.</span>
            </h1>

            <p className="lead hero-lead">
              Craft your pizza, choose your toppings, and enjoy it fresh and hot — stone-baked to order
              and delivered in under 30 minutes.
            </p>

            <div className="btn-row hero-actions">
              <Link to="/build-pizza" className="btn btn-primary btn-lg">
                🍕 Build Your Pizza
              </Link>
              <Link to="/dashboard" className="btn btn-secondary btn-lg">
                Explore Menu
                <span aria-hidden="true">→</span>
              </Link>
            </div>

            <ul className="hero-points">
              <li><span aria-hidden="true">🌿</span> 24-hour proofed dough</li>
              <li><span aria-hidden="true">🔥</span> Wood-fired in 3 mins</li>
              <li><span aria-hidden="true">🛵</span> Hot delivery in 30</li>
            </ul>
          </div>

          <div className="hero-visual">
            <div className="hero-plate" aria-hidden="true" />
            <img
              src={heroPizza}
              alt="Freshly baked margherita pizza with basil"
              className="hero-img"
              width="640"
              height="640"
              fetchPriority="high"
            />

            <div className="hero-float hero-float-1 animate-float">
              <span className="hero-float-emoji" aria-hidden="true">🧀</span>
              <span>
                <strong>Extra cheese</strong>
                <small>on the house upgrades</small>
              </span>
            </div>

            <div className="hero-float hero-float-2 animate-float" style={{ animationDelay: '0.8s' }}>
              <span className="hero-float-emoji" aria-hidden="true">⏱️</span>
              <span>
                <strong>28 min</strong>
                <small>average delivery</small>
              </span>
            </div>

            <div className="hero-price-chip animate-pop">
              <span>Starting at</span>
              <strong>{menu?.products?.length ? `₹${Math.min(...menu.products.map((p) => Number(p.price) || 0))}` : '₹99'}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* ================= POPULAR PIZZAS ================= */}
      <section className="container section" aria-labelledby="popular-heading">
        <SectionHeader
          id="popular-heading"
          eyebrow="Customer favourites"
          title="Popular Pizzas"
          subtitle="The pies our customers keep coming back for — every one of them fully customisable."
          action={
            <Link to="/dashboard" className="btn btn-outline btn-sm">
              View full menu →
            </Link>
          }
        />

        {loading ? (
          <PizzaGridSkeleton count={4} />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={() => setAttempt((a) => a + 1)} />
        ) : popular.length === 0 ? (
          <EmptyState
            icon="🍕"
            title="The oven is warming up"
            description="No pizzas are listed right now. Check back in a few minutes."
            action={
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setAttempt((a) => a + 1)}>
                Refresh
              </button>
            }
          />
        ) : (
          <div className="pizza-grid">
            {popular.map((product, index) => (
              <PizzaCard
                key={product._id}
                product={product}
                index={index}
                sizeLabel={size.name}
                isFavorite={favorites.has(String(product._id))}
                onToggleFavorite={handleFavorite}
                onAdd={handleAdd}
              />
            ))}
          </div>
        )}
      </section>

      {/* ================= BUILD YOUR PIZZA CTA ================= */}
      <section className="build-cta">
        <div className="container build-cta-inner">
          <div className="build-cta-visual" aria-hidden="true">
            <div className="build-cta-disc">
              <span className="build-cta-slice">🍕</span>
            </div>
            <span className="build-cta-orbit build-cta-orbit-1">🌿</span>
            <span className="build-cta-orbit build-cta-orbit-2">🍅</span>
            <span className="build-cta-orbit build-cta-orbit-3">🧀</span>
            <span className="build-cta-orbit build-cta-orbit-4">🌶️</span>
          </div>

          <div className="build-cta-copy">
            <span className="section-eyebrow">The Pizza Studio</span>
            <h2 className="h2">Build Your Dream Pizza 🍕</h2>
            <p className="lead">
              Five simple steps between you and a pizza that is exactly — and only — what you wanted.
            </p>

            <ol className="build-steps">
              {STEPS.map((step, index) => (
                <li key={step}>
                  <span className="build-step-num">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <Link to="/build-pizza" className="btn btn-primary btn-lg">
              Build My Pizza
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ================= WHY PIZZA MAN ================= */}
      <section className="container section" aria-labelledby="why-heading">
        <SectionHeader
          id="why-heading"
          align="center"
          eyebrow="Why Pizza Man"
          title="Everything a great pizza deserves"
          subtitle="From the first knead to your front door, every step is built around one thing: a better bite."
        />

        <div className="feature-grid animate-stagger">
          {FEATURES.map((feature) => (
            <article className="feature-card" key={feature.title}>
              <span className="feature-icon" aria-hidden="true">{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>

        <div className="home-closer">
          <div className="home-closer-copy">
            <h2 className="h3">Hungry yet?</h2>
            <p>Order in seconds — your first custom pizza is five taps away.</p>
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/build-pizza')}>
              Start building
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
              Browse menu
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
