/** Accessible −/+ quantity control shared by cart, builder and detail pages. */
const QuantitySelector = ({
  value,
  onChange,
  min = 1,
  max = 50,
  size = 'md',
  label = 'quantity',
  disabled = false,
}) => {
  const clamp = (next) => Math.min(Math.max(next, min), max);

  return (
    <div className={`qty ${size === 'lg' ? 'qty-lg' : ''}`} role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        aria-label={`Decrease ${label}`}
      >
        −
      </button>
      <output aria-live="polite" aria-label={`${label}: ${value}`}>
        {value}
      </output>
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        aria-label={`Increase ${label}`}
      >
        +
      </button>
    </div>
  );
};

export default QuantitySelector;
