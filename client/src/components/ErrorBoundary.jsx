import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="state-view state-error error-boundary" role="alert">
        <span className="state-icon" aria-hidden="true">💥</span>
        <h2>Something went wrong</h2>
        <p>The page ran into an unexpected error. Your data is safe.</p>
        <div className="error-boundary-actions">
          <button type="button" className="btn btn-primary" onClick={this.handleReload}>
            Reload app
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
