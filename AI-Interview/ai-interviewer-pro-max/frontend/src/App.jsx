/**
 * AI Interviewer Pro Max - Main App Component
 * 
 * Sets up routing, auth provider, and global providers.
 * 
 * AUTHENTICATION RULES (per MASTER CONSTRAINTS):
 * - All features locked behind authentication
 * - Login/Signup are the only public routes
 * - After login → Dashboard
 * - After logout → Login
 * 
 * MAINTENANCE MODE:
 * - When enabled, all users see only the MaintenancePage
 * - Admins can still access the system
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Context Providers
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Pages
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import DomainSelection from './pages/DomainSelection';
import Interview from './pages/Interview';
import LiveInterview from './pages/LiveInterview';
import InterviewReadiness from './pages/InterviewReadiness';
import InterviewReport from './pages/InterviewReport';
import CareerRoadmap from './pages/CareerRoadmap';
import Resumes from './pages/Resumes';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import UserProfile from './pages/UserProfile';
import AdminDashboard from './pages/AdminDashboard';
import AvatarTest from './pages/AvatarTest';

// Components
import ProtectedRoute from './components/ProtectedRoute';
import BugReportButton from './components/common/BugReportButton';
import MaintenancePage from './components/MaintenancePage';

// Services
import { getStoredUser } from './services/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Maintenance Mode Wrapper Component
function MaintenanceWrapper({ children }) {
    const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
    const [maintenanceMessage, setMaintenanceMessage] = useState('');
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const checkMaintenance = async () => {
            try {
                // Allow login page during maintenance
                const currentPath = window.location.pathname;
                if (currentPath === '/login' || currentPath === '/') {
                    setIsMaintenanceMode(false);
                    setChecking(false);
                    return;
                }

                const response = await fetch(`${API_BASE}/api/public/maintenance-status`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.maintenance_mode) {
                        // Check if current user is admin
                        const user = getStoredUser();
                        if (user?.is_admin) {
                            // Admin can access everything
                            setIsMaintenanceMode(false);
                        } else {
                            // Non-admin user logged in - show maintenance page
                            setIsMaintenanceMode(true);
                            setMaintenanceMessage(data.message || '');
                        }
                    } else {
                        setIsMaintenanceMode(false);
                    }
                }
            } catch (err) {
                console.log('Maintenance check failed:', err);
                // Don't block on error
                setIsMaintenanceMode(false);
            } finally {
                setChecking(false);
            }
        };

        checkMaintenance();
        
        // Check periodically
        const interval = setInterval(checkMaintenance, 30000);
        return () => clearInterval(interval);
    }, []);

    // Show loading while checking
    if (checking) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)'
            }}>
                <div style={{ textAlign: 'center', color: '#fff' }}>
                    <div className="spinner" style={{
                        width: '40px',
                        height: '40px',
                        border: '3px solid rgba(139, 92, 246, 0.2)',
                        borderTop: '3px solid #8b5cf6',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 16px'
                    }}></div>
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    // Show maintenance page for non-admin users
    if (isMaintenanceMode) {
        return <MaintenancePage message={maintenanceMessage} />;
    }

    // Normal app flow
    return children;
}

// Maintenance page wrapper for the /maintenance route
function MaintenancePageWithNav() {
    const [message, setMessage] = useState('');
    
    useEffect(() => {
        const fetchMaintenanceMessage = async () => {
            try {
                const response = await fetch(`${API_BASE}/api/public/maintenance-status`);
                if (response.ok) {
                    const data = await response.json();
                    setMessage(data.message || '');
                }
            } catch (err) {
                console.log('Failed to fetch maintenance message:', err);
            }
        };
        fetchMaintenanceMessage();
    }, []);
    
    return <MaintenancePage message={message} />;
}

function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <MaintenanceWrapper>
                    <BrowserRouter>
                        <Routes>
                            {/* ===========================================
                                PUBLIC ROUTES (No auth required)
                                =========================================== */}
                            <Route path="/login" element={<Login />} />
                            <Route path="/signup" element={<Signup />} />
                            <Route path="/avatar-test" element={<AvatarTest />} />
                            <Route path="/maintenance" element={<MaintenancePageWithNav />} />

                            {/* ===========================================
                            PROTECTED ROUTES (Auth required)
                            All features locked behind authentication
                            =========================================== */}

                            {/* Dashboard - Main hub after login */}
                            <Route
                            path="/dashboard"
                            element={
                                <ProtectedRoute>
                                    <Dashboard />
                                </ProtectedRoute>
                            }
                        />

                        {/* Domain Selection - Choose interview field */}
                        <Route
                            path="/select-domain"
                            element={
                                <ProtectedRoute>
                                    <DomainSelection />
                                </ProtectedRoute>
                            }
                        />

                        {/* User Profile */}
                        <Route
                            path="/profile"
                            element={
                                <ProtectedRoute>
                                    <UserProfile />
                                </ProtectedRoute>
                            }
                        />

                        {/* Interview - Mock interview session (legacy) */}
                        <Route
                            path="/interview-old"
                            element={
                                <ProtectedRoute>
                                    <Interview />
                                </ProtectedRoute>
                            }
                        />

                        {/* Live Interview - Active interview session */}
                        <Route
                            path="/interview"
                            element={
                                <ProtectedRoute>
                                    <LiveInterview />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/interview/:sessionId"
                            element={
                                <ProtectedRoute>
                                    <LiveInterview />
                                </ProtectedRoute>
                            }
                        />

                        {/* Interview Readiness - Plan and prepare */}
                        <Route
                            path="/interview-prep"
                            element={
                                <ProtectedRoute>
                                    <InterviewReadiness />
                                </ProtectedRoute>
                            }
                        />

                        {/* Report - Interview results */}
                        <Route
                            path="/report/:sessionId"
                            element={
                                <ProtectedRoute>
                                    <InterviewReport />
                                </ProtectedRoute>
                            }
                        />

                        {/* Resumes - Resume management */}
                        <Route
                            path="/resumes"
                            element={
                                <ProtectedRoute>
                                    <Resumes />
                                </ProtectedRoute>
                            }
                        />

                        {/* Career Roadmap */}
                        <Route
                            path="/roadmap/:sessionId"
                            element={
                                <ProtectedRoute>
                                    <CareerRoadmap />
                                </ProtectedRoute>
                            }
                        />

                        {/* Analytics Dashboard */}
                        <Route
                            path="/analytics"
                            element={
                                <ProtectedRoute>
                                    <AnalyticsDashboard />
                                </ProtectedRoute>
                            }
                        />

                        {/* Admin Dashboard */}
                        <Route
                            path="/admin"
                            element={
                                <ProtectedRoute>
                                    <AdminDashboard />
                                </ProtectedRoute>
                            }
                        />

                        {/* ===========================================
                        REDIRECTS
                        =========================================== */}

                        {/* Root → Dashboard (ProtectedRoute will redirect to login if needed) */}
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />

                        {/* Catch-all → Dashboard */}
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                    
                    {/* Global Bug Report Button - Available on all pages */}
                    <BugReportButton />
                </BrowserRouter>
                </MaintenanceWrapper>
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;