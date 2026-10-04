import { Link } from 'react-router-dom';
import { resolveProductImage } from '../../utils/productImages';
import './PizzaCard.css';

const formatINR = (value) =>
  `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const NON_VEG = /(chicken|pepperoni|meat|sausage|salami|ham|bacon|kebab|tikka|prawn|fish|egg)/i;

/** Products have no explicit veg flag — derive a display-only hint from what we do have. */
export const looksVegetarian = (product) => {
  const haystack = `${product?.name || ''} ${product?.description || ''}`;
  return !NON_VEG.test(haystack);
};

/**
 * The single pizza card used on Home, Menu and search results.
 * Card body links to the detail page; action buttons stop propagation.
 */
const PizzaCard = ({
  product,
  sizeLabel = 'Medium',
  price,
  isFavorite = false,
  onToggleFavorite,
  onAdd,
  tag,
  footerNote,
  index = 0,
}) => {
  const image = resolveProductImage(product);
  const veg = looksVegetarian(product);
  const displayPrice = price ?? product?.price;
  const available = product?.available !== false;
  const rating = Number(product?.rating);

  return (
    <article className="pizza-card animate-fade" style={{ animationDelay: `${Math.min(index, 8) * 0.05}s` }}>
      <Link to={`/pizza/${product._id}`} className="pizza-card-media" aria-label={`View ${product.name}`}>
        {image ? (
          <img
            src={image}
            alt={product.name}
            className="pizza-card-img"
            loading="lazy"
            decoding="async"
            width="400"
            height="300"
          />
        ) : (
          <div className="pizza-card-img pizza-card-img-fallback" aria-hidden="true">🍕</div>
        )}

        <span className={`veg-dot ${veg ? 'is-veg' : 'is-nonveg'}`} title={veg ? 'Vegetarian' : 'Non-vegetarian'}>
          <span />
        </span>

        {!available && <span className="pizza-card-soldout">Sold out</span>}

        <span className="pizza-card-price">{formatINR(displayPrice)}</span>

        {onToggleFavorite && (
          <button
            type="button"
            className={`fav-btn ${isFavorite ? 'is-active' : ''}`}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? `Remove ${product.name} from favorites` : `Save ${product.name} to favorites`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggleFavorite(product);
            }}
          >
            {isFavorite ? '♥' : '♡'}
          </button>
        )}
      </Link>

      <div className="pizza-card-body">
        <div className="pizza-card-meta">
          <span className="pizza-card-tag">{tag || product?.categoryId?.name || 'Signature'}</span>
          {Number.isFinite(rating) && rating > 0 && (
            <span className="pizza-card-rating" aria-label={`Rated ${rating} out of 5`}>
              ★ {rating.toFixed(1)}
            </span>
          )}
        </div>

        <h3 className="pizza-card-title">
          <Link to={`/pizza/${product._id}`}>{product.name}</Link>
        </h3>

        <p className="pizza-card-desc">{product.description}</p>

        <div className="pizza-card-footer">
          <div className="pizza-card-price-block">
            <span className="price">{formatINR(displayPrice)}</span>
            <span className="pizza-card-size">{sizeLabel}</span>
          </div>

          <div className="pizza-card-actions">
            <Link to={`/pizza/${product._id}`} className="btn btn-secondary btn-sm">
              Customize
            </Link>
            {onAdd && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onAdd(product)}
                disabled={!available}
              >
                Add
              </button>
            )}
          </div>
        </div>

        {footerNote && <p className="pizza-card-note">{footerNote}</p>}
      </div>
    </article>
  );
};

export default PizzaCard;
