/**
 * Auth Context
 * 
 * Global authentication state management.
 * Provides user state and auth methods across the entire app.
 * 
 * Per MASTER CONSTRAINTS:
 * - All features locked behind authentication
 * - No access without login
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
    authApi,
    getToken,
    removeToken,
    getStoredUser,
    setStoredUser,
    clearAllAppData,
    clearSessionData
} from '../services/api';

// ===========================================
// CONTEXT SETUP
// ===========================================

const AuthContext = createContext(null);

/**
 * Hook to use auth context
 * Must be used within AuthProvider
 */
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// ===========================================
// AUTH PROVIDER COMPONENT
// ===========================================

export function AuthProvider({ children }) {
    // State
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // ===========================================
    // INITIALIZE AUTH STATE
    // ===========================================

    useEffect(() => {
        let isMounted = true; // Prevent state updates after unmount

        const initAuth = async () => {
            try {
                const token = getToken();

                // SAFETY: If no token, don't make any API calls
                if (!token) {
                    console.log('[Auth] No token found, user not authenticated');
                    if (isMounted) {
                        setLoading(false);
                    }
                    return;
                }

                // Try to get stored user first (fast, no API call)
                const storedUser = getStoredUser();
                if (storedUser && isMounted) {
                    setUser(storedUser);
                    setIsAuthenticated(true);
                }

                // Verify token with backend (only if token exists)
                // This is wrapped in try-catch to handle ECONNREFUSED
                try {
                    const isValid = await authApi.verifyToken();

                    if (!isMounted) return;

                    if (isValid) {
                        // Token valid - optionally fetch fresh user data
                        try {
                            const userData = await authApi.getCurrentUser();
                            if (isMounted) {
                                setUser(userData);
                                setStoredUser(userData);
                                setIsAuthenticated(true);
                            }
                        } catch (err) {
                            // User fetch failed but token valid - use stored user
                            console.warn('[Auth] Could not fetch fresh user data, using stored');
                            if (storedUser && isMounted) {
                                setIsAuthenticated(true);
                            }
                        }
                    } else {
                        // Token invalid - clear auth state
                        console.log('[Auth] Token invalid, clearing auth state');
                        removeToken();
                        if (isMounted) {
                            setUser(null);
                            setIsAuthenticated(false);
                        }
                    }
                } catch (verifyError) {
                    // ECONNREFUSED or other connection error
                    // Don't spam - just log once and use stored state
                    console.error('[Auth] Cannot connect to backend:', verifyError.message);

                    // If we have stored user, keep them logged in optimistically
                    // but mark that we couldn't verify
                    if (!storedUser && isMounted) {
                        removeToken();
                        setUser(null);
                        setIsAuthenticated(false);
                    }
                    // If storedUser exists, we already set isAuthenticated above
                }
            } catch (error) {
                console.error('[Auth] Initialization error:', error);
                // On any unexpected error, clear auth for safety
                removeToken();
                if (isMounted) {
                    setUser(null);
                    setIsAuthenticated(false);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        initAuth();

        // Cleanup function to prevent state updates after unmount
        return () => {
            isMounted = false;
        };
    }, []);

    // ===========================================
    // AUTH METHODS
    // ===========================================

    /**
     * Login user
     */
    const login = useCallback(async (email, password) => {
        const response = await authApi.login(email, password);

        if (response.success && response.user) {
            setUser(response.user);
            setIsAuthenticated(true);
        }

        return response;
    }, []);

    /**
     * Signup user
     */
    const signup = useCallback(async (name, email, password) => {
        const response = await authApi.signup(name, email, password);

        if (response.success && response.user) {
            setUser(response.user);
            setIsAuthenticated(true);
        }

        return response;
    }, []);

    /**
     * Logout user
     */
    const logout = useCallback(async () => {
        try {
            await authApi.logout();
        } catch (error) {
            console.warn('Logout API error:', error);
        } finally {
            // Clear ALL app data (preserves theme preference only)
            clearAllAppData();
            // Clear context state
            setUser(null);
            setIsAuthenticated(false);
        }
    }, []);

    /**
     * Update user in context
     */
    const updateUser = useCallback((userData) => {
        setUser(userData);
        setStoredUser(userData);
    }, []);

    /**
     * Refresh user data from backend
     */
    const refreshUser = useCallback(async () => {
        try {
            const userData = await authApi.getCurrentUser();
            setUser(userData);
            setStoredUser(userData);
            return userData;
        } catch (error) {
            console.error('Failed to refresh user:', error);
            throw error;
        }
    }, []);

    // ===========================================
    // CONTEXT VALUE
    // ===========================================

    const value = {
        // State
        user,
        loading,
        isAuthenticated,

        // Methods
        login,
        signup,
        logout,
        updateUser,
        refreshUser,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export default AuthContext;
