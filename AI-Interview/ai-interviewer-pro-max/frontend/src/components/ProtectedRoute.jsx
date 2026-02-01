/**
 * ProtectedRoute Component
 * 
 * Wrapper component that protects routes requiring authentication.
 * Redirects to login if user is not authenticated.
 * 
 * Per MASTER CONSTRAINTS:
 * - All features are locked behind authentication
 * - No access without login
 * - Clear, user-friendly error handling
 * 
 * SAFETY FIXES:
 * - Handles ECONNREFUSED gracefully
 * - No retry spam on backend failure
 * - Single clean error message
 * 
 * Note: Maintenance mode is now handled at App.jsx level
 */

import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isAuthenticated, authApi, removeToken } from '../services/api';

function ProtectedRoute({ children }) {
    const location = useLocation();
    const [checking, setChecking] = useState(true);
    const [isValid, setIsValid] = useState(false);
    const [connectionError, setConnectionError] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const checkAuth = async () => {
            // First check if we have a token locally
            if (!isAuthenticated()) {
                if (isMounted) {
                    setIsValid(false);
                    setChecking(false);
                }
                return;
            }

            // Verify token with backend
            try {
                const valid = await authApi.verifyToken();

                if (!isMounted) return;

                setIsValid(valid);

                if (!valid) {
                    // Token invalid - clear it
                    removeToken();
                }
            } catch (error) {
                if (!isMounted) return;

                // Check if this is a connection error (ECONNREFUSED)
                const isConnectionError =
                    error.message.includes('Unable to connect') ||
                    error.message.includes('Backend is unreachable') ||
                    error.message.includes('Failed to fetch');

                if (isConnectionError) {
                    console.error('[ProtectedRoute] Backend unreachable:', error.message);
                    setConnectionError(true);
                    // Don't clear token on connection error - backend might just be temporarily down
                } else {
                    // Token verification failed for other reasons - clear it
                    console.warn('[ProtectedRoute] Token verification failed:', error.message);
                    removeToken();
                }

                setIsValid(false);
            }

            if (isMounted) {
                setChecking(false);
            }
        };

        checkAuth();

        return () => {
            isMounted = false;
        };
    }, []);

    // Show loading while checking
    if (checking) {
        return (
            <div className="loading-container">
                <div className="loading-content">
                    <div className="spinner"></div>
                    <p className="loading-text">Verifying authentication...</p>
                </div>
            </div>
        );
    }

    // Show connection error message if backend is unreachable
    if (connectionError) {
        return (
            <div className="loading-container">
                <div className="loading-content error-content">
                    <div className="error-icon">⚠️</div>
                    <h2 className="error-title">Unable to Connect</h2>
                    <p className="error-text">
                        Cannot reach the server. Please ensure the backend is running.
                    </p>
                    <button
                        className="retry-button"
                        onClick={() => window.location.reload()}
                    >
                        Retry
                    </button>
                    <button
                        className="login-button"
                        onClick={() => {
                            removeToken();
                            window.location.href = '/login';
                        }}
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    // Redirect if not authenticated
    if (!isValid) {
        // Redirect to login, preserving the intended destination
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Authenticated - render protected content
    return children;
}

export default ProtectedRoute;