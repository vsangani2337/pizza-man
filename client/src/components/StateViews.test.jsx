import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoadingState, ErrorState, EmptyState, Skeleton, SkeletonCards } from './StateViews';

describe('StateViews', () => {
  it('renders LoadingState with an accessible live region', () => {
    render(<LoadingState message="Fetching the menu…" />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Fetching the menu…');
  });

  it('renders ErrorState and fires onRetry', () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Could not load the menu." onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load the menu.');
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('hides the retry button when no handler is provided', () => {
    render(<ErrorState message="Boom" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders EmptyState with title, description and actions', () => {
    render(
      <EmptyState icon="🛒" title="No orders" description="Nothing here yet.">
        <button type="button">Build pizza</button>
      </EmptyState>
    );
    expect(screen.getByRole('heading', { name: 'No orders' })).toBeInTheDocument();
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Build pizza' })).toBeInTheDocument();
  });

  it('renders decorative skeletons that are hidden from screen readers', () => {
    const { container } = render(<Skeleton lines={4} />);
    expect(container.querySelectorAll('.skeleton-line')).toHaveLength(4);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');

    const cards = render(<SkeletonCards count={3} />);
    expect(cards.container.querySelectorAll('.skeleton-card')).toHaveLength(3);
  });
});
