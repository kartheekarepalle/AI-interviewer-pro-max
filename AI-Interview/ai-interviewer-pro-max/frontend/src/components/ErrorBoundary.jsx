/**
 * Global Error Boundary
 * 
 * Catches all runtime JS errors and shows a friendly fallback UI
 * instead of a blank page. This is critical for production stability.
 * 
 * CRITICAL: Prevents blank page on ANY uncaught error
 */

import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error) {
        // Update state so next render shows fallback UI
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // Log error for debugging
        console.error('[ErrorBoundary] Caught error:', error);
        console.error('[ErrorBoundary] Error info:', errorInfo);

        this.setState({ errorInfo });

        // In production, you'd send this to an error reporting service
        // e.g., Sentry, LogRocket, etc.
    }

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        // Go directly to dashboard instead of root to avoid redirect loops
        window.location.href = '/dashboard';
    };

    handleClearAndReload = () => {
        // Clear localStorage tokens that might be corrupted
        try {
            localStorage.removeItem('ai_interviewer_token');
            localStorage.removeItem('ai_interviewer_user');
        } catch (e) {
            console.warn('Could not clear localStorage:', e);
        }
        window.location.href = '/login';
    };

    render() {
        if (this.state.hasError) {
            // Fallback UI
            return (
                <div className="error-boundary-container">
                    <div className="error-boundary-content">
                        <div className="error-boundary-icon">⚠️</div>
                        <h1 className="error-boundary-title">Something went wrong</h1>
                        <p className="error-boundary-message">
                            We apologize for the inconvenience. An unexpected error occurred.
                        </p>

                        {/* Show error details - ALWAYS visible for debugging */}
                        {this.state.error && (
                            <details className="error-boundary-details" open>
                                <summary>Error Details (Development Only)</summary>
                                <pre>{this.state.error.toString()}</pre>
                                {this.state.errorInfo && (
                                    <pre>{this.state.errorInfo.componentStack}</pre>
                                )}
                            </details>
                        )}

                        <div className="error-boundary-actions">
                            <button
                                className="error-boundary-btn primary"
                                onClick={this.handleReload}
                            >
                                Try Again
                            </button>
                            <button
                                className="error-boundary-btn secondary"
                                onClick={this.handleGoHome}
                            >
                                Go to Home
                            </button>
                            <button
                                className="error-boundary-btn ghost"
                                onClick={this.handleClearAndReload}
                            >
                                Clear Session & Login
                            </button>
                        </div>

                        <p className="error-boundary-hint">
                            If this problem persists, please try refreshing the page or clearing your browser cache.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
