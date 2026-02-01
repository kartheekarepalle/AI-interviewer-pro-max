/**
 * AI Interviewer Pro Max - Entry Point
 * 
 * PRODUCTION HARDENING:
 * - Global Error Boundary wraps everything
 * - Prevents blank page on ANY runtime error
 * - Shows friendly fallback UI on crashes
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { clearSessionData } from './services/api';
import './styles/theme.css';

console.log('[DEBUG] Main.jsx loaded');

// Clear stale session/interview/ATS data on app startup
// This ensures fresh state on every page reload
try {
    clearSessionData();
    console.log('[DEBUG] clearSessionData completed');
} catch (e) {
    console.error('[DEBUG] clearSessionData error:', e);
}

// Global error handler for uncaught errors outside React
window.onerror = function (message, source, lineno, colno, error) {
    console.error('[Global Error]', message, source, lineno, colno, error);
    return false; // Allow default handler to run as well
};

// Handle unhandled promise rejections
window.onunhandledrejection = function (event) {
    console.error('[Unhandled Promise Rejection]', event.reason);
};

// Get root element with safety check
const rootElement = document.getElementById('root');

console.log('[DEBUG] Root element:', rootElement);

if (!rootElement) {
    // Absolute fallback if root element is missing
    document.body.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui, sans-serif; background: #f5f5f5;">
            <div style="text-align: center; padding: 2rem;">
                <h1 style="color: #333;">Application Error</h1>
                <p style="color: #666;">Could not mount the application. Please refresh the page.</p>
                <button onclick="window.location.reload()" style="padding: 0.75rem 1.5rem; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem;">
                    Refresh Page
                </button>
            </div>
        </div>
    `;
} else {
    console.log('[DEBUG] About to render App');
    try {
        ReactDOM.createRoot(rootElement).render(
            <React.StrictMode>
                <ErrorBoundary>
                    <App />
                </ErrorBoundary>
            </React.StrictMode>
        );
        console.log('[DEBUG] Render called');
    } catch (e) {
        console.error('[DEBUG] Render error:', e);
        rootElement.innerHTML = `<div style="padding: 2rem; color: red;">Render Error: ${e.message}</div>`;
    }
}
