/**
 * Shared loading / error / empty states.
 * Every API-backed screen should render one of these instead of a blank page.
 */

export const LoadingState = ({ message = 'Loading…' }) => (
  <div className="state-view state-loading" role="status" aria-live="polite">
    <span className="spinner spinner-lg" aria-hidden="true" />
    <p>{message}</p>
  </div>
);

export const ErrorState = ({ title = 'Something went wrong.', message, onRetry, retryLabel = 'Try again' }) => (
  <div className="state-view state-error" role="alert">
    <span className="state-icon" aria-hidden="true">⚠️</span>
    <h3>{title}</h3>
    <p>{message || 'We could not load this right now. Please check your connection and try again.'}</p>
    {onRetry && (
      <div className="state-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={onRetry}>
          {retryLabel}
        </button>
      </div>
    )}
  </div>
);

export const EmptyState = ({ icon = '🍕', title, description, action, children }) => (
  <div className="state-view state-card" role="status">
    <span className="state-icon" aria-hidden="true">{icon}</span>
    {title && <h3>{title}</h3>}
    {description && <p>{description}</p>}
    {(action || children) && (
      <div className="state-actions">
        {action}
        {children}
      </div>
    )}
  </div>
);

export const Skeleton = ({ lines = 3, height = 16, className = '' }) => (
  <div className={`skeleton-group ${className}`} aria-hidden="true">
    {Array.from({ length: lines }).map((_, index) => (
      <span
        className="skeleton-line"
        key={index}
        style={{ height: `${height}px`, width: index === lines - 1 ? '60%' : '100%' }}
      />
    ))}
  </div>
);

export const SkeletonCards = ({ count = 4 }) => (
  <div className="skeleton-cards" aria-hidden="true">
    {Array.from({ length: count }).map((_, index) => (
      <div className="skeleton-card" key={index}>
        <Skeleton lines={3} />
      </div>
    ))}
  </div>
);

export default { LoadingState, ErrorState, EmptyState, Skeleton, SkeletonCards };
