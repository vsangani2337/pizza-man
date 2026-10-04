/** Shimmer placeholders — never leave the user staring at a blank screen. */

export const SkeletonLine = ({ width = '100%', height = 14 }) => (
  <span className="skeleton-line" style={{ width, height: `${height}px`, display: 'block' }} />
);

export const SkeletonText = ({ lines = 3 }) => (
  <div className="skeleton-group" aria-hidden="true">
    {Array.from({ length: lines }).map((_, index) => (
      <SkeletonLine key={index} width={index === lines - 1 ? '55%' : '100%'} />
    ))}
  </div>
);

export const PizzaCardSkeleton = () => (
  <div className="skeleton-pizza-card" aria-hidden="true">
    <div className="skeleton-block sk-image" />
    <div className="sk-body">
      <SkeletonLine width="38%" height={11} />
      <SkeletonLine width="72%" height={20} />
      <SkeletonLine width="100%" height={12} />
      <SkeletonLine width="84%" height={12} />
      <SkeletonLine width="46%" height={18} />
    </div>
  </div>
);

export const PizzaGridSkeleton = ({ count = 8 }) => (
  <div className="pizza-grid" role="status" aria-label="Loading pizzas">
    {Array.from({ length: count }).map((_, index) => (
      <PizzaCardSkeleton key={index} />
    ))}
  </div>
);

export const CardSkeleton = ({ height = 150 }) => (
  <div className="skeleton-card" style={{ height: `${height}px` }} aria-hidden="true">
    <SkeletonText lines={3} />
  </div>
);

export const PageSkeleton = ({ title = 'Loading…' }) => (
  <div className="page container" role="status" aria-live="polite">
    <div className="page-header">
      <div className="page-header-text" style={{ width: 'min(420px, 100%)' }}>
        <SkeletonLine width="140px" height={13} />
        <SkeletonLine width="100%" height={34} />
        <SkeletonLine width="70%" height={15} />
      </div>
    </div>
    <span className="sr-only-field">{title}</span>
    <div className="skeleton-cards">
      {Array.from({ length: 6 }).map((_, index) => (
        <div className="skeleton-card" key={index} style={{ height: '170px' }} />
      ))}
    </div>
  </div>
);

export default { SkeletonLine, SkeletonText, PizzaCardSkeleton, PizzaGridSkeleton, CardSkeleton, PageSkeleton };
