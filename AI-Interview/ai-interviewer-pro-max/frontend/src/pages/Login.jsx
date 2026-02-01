/**
 * Login Page - Premium Professional Design
 * 
 * Split-screen layout with animated branding panel and clean form.
 * Handles both login and signup with smooth transitions.
 * 
 * Note: Maintenance mode is now handled at App.jsx level.
 * This page will not be shown during maintenance (except for admin login).
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi, isAuthenticated } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { 
    Mail, Lock, User, AlertCircle, CheckCircle, Loader2, 
    Sun, Moon, Eye, EyeOff, Sparkles, Target, 
    Brain, Award, TrendingUp, ArrowRight, Zap, Shield
} from 'lucide-react';
import '../styles/auth.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const { isDark, toggleTheme } = useTheme();

    // Check if coming from /signup route
    const initialMode = location.state?.mode === 'signup' ? false : true;
    const [isLogin, setIsLogin] = useState(initialMode);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
    });

    // UI state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [focusedField, setFocusedField] = useState(null);

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated()) {
            const from = location.state?.from?.pathname || '/dashboard';
            navigate(from, { replace: true });
        }
    }, [navigate, location]);

    // Handle input changes
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError('');
        setSuccess('');
    };

    // Validate form
    const validateForm = () => {
        if (!formData.email.trim()) {
            setError('Email is required');
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setError('Please enter a valid email address');
            return false;
        }

        if (!formData.password) {
            setError('Password is required');
            return false;
        }

        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters');
            return false;
        }

        if (!isLogin) {
            if (!formData.name.trim()) {
                setError('Name is required');
                return false;
            }
            if (formData.name.trim().length < 2) {
                setError('Name must be at least 2 characters');
                return false;
            }
            if (!/[a-zA-Z]/.test(formData.password)) {
                setError('Password must contain at least one letter');
                return false;
            }
            if (!/\d/.test(formData.password)) {
                setError('Password must contain at least one number');
                return false;
            }
        }

        return true;
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            let response;
            if (isLogin) {
                response = await authApi.login(formData.email, formData.password);
            } else {
                response = await authApi.signup(formData.name, formData.email, formData.password);
            }
            
            // Redirect admin to admin panel, regular users to dashboard
            if (response?.user?.is_admin) {
                navigate('/admin', { replace: true });
            } else {
                // Check maintenance mode for non-admin users after login
                try {
                    const maintenanceResponse = await fetch(`${API_BASE}/api/public/maintenance-status`);
                    if (maintenanceResponse.ok) {
                        const maintenanceData = await maintenanceResponse.json();
                        if (maintenanceData.maintenance_mode) {
                            // Redirect to maintenance page
                            navigate('/maintenance', { replace: true });
                            return;
                        }
                    }
                } catch (maintenanceErr) {
                    console.log('Maintenance check failed:', maintenanceErr);
                }
                
                const from = location.state?.from?.pathname || '/dashboard';
                navigate(from, { replace: true });
            }
        } catch (err) {
            const message = err.message || 'Authentication failed. Please try again.';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    // Switch between login and signup
    const handleModeSwitch = () => {
        setIsLogin(!isLogin);
        setFormData({ name: '', email: '', password: '' });
        setError('');
        setSuccess('');
        setShowPassword(false);
    };

    const features = [
        { icon: Brain, title: 'AI-Powered Practice', desc: 'Real interview simulations with intelligent feedback' },
        { icon: Target, title: 'Personalized Questions', desc: 'Tailored to your experience and target role' },
        { icon: TrendingUp, title: 'Track Progress', desc: 'Detailed analytics to improve over time' },
        { icon: Award, title: 'Get Certified', desc: 'Earn badges and showcase your skills' },
    ];

    return (
        <div className="auth-page">
            {/* Left Panel - Branding */}
            <div className="auth-branding">
                {/* Animated Background Elements */}
                <div className="auth-bg-shapes">
                    <div className="shape shape-1"></div>
                    <div className="shape shape-2"></div>
                    <div className="shape shape-3"></div>
                    <div className="shape shape-4"></div>
                </div>

                <div className="auth-branding-content">
                    {/* Logo */}
                    <div className="auth-logo">
                        <div className="auth-logo-icon">
                            <Sparkles size={32} />
                        </div>
                        <span className="auth-logo-text">AI Interviewer</span>
                    </div>

                    {/* Hero Text */}
                    <div className="auth-hero">
                        <h1>
                            Master Your
                            <span className="gradient-text"> Dream Interview</span>
                        </h1>
                        <p>
                            Practice with AI, get instant feedback, and land your dream job 
                            with confidence.
                        </p>
                    </div>

                    {/* Features */}
                    <div className="auth-features">
                        {features.map((feature, index) => (
                            <div 
                                key={index} 
                                className="auth-feature"
                                style={{ animationDelay: `${index * 0.1}s` }}
                            >
                                <div className="auth-feature-icon">
                                    <feature.icon size={20} />
                                </div>
                                <div className="auth-feature-text">
                                    <h4>{feature.title}</h4>
                                    <p>{feature.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Stats */}
                    <div className="auth-stats">
                        <div className="auth-stat">
                            <span className="auth-stat-number">10K+</span>
                            <span className="auth-stat-label">Users</span>
                        </div>
                        <div className="auth-stat-divider"></div>
                        <div className="auth-stat">
                            <span className="auth-stat-number">50K+</span>
                            <span className="auth-stat-label">Interviews</span>
                        </div>
                        <div className="auth-stat-divider"></div>
                        <div className="auth-stat">
                            <span className="auth-stat-number">95%</span>
                            <span className="auth-stat-label">Success Rate</span>
                        </div>
                    </div>
                </div>

                {/* Floating Elements */}
                <div className="auth-floating-elements">
                    <div className="floating-card floating-card-1">
                        <Zap size={16} />
                        <span>Interview Started</span>
                    </div>
                    <div className="floating-card floating-card-2">
                        <Award size={16} />
                        <span>Score: 92%</span>
                    </div>
                </div>
            </div>

            {/* Right Panel - Form */}
            <div className="auth-form-panel">
                {/* Theme Toggle */}
                <button
                    className="auth-theme-toggle"
                    onClick={toggleTheme}
                    aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                    {isDark ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                <div className="auth-form-container">
                    {/* Welcome Text */}
                    <div className="auth-form-header">
                        <h2>{isLogin ? 'Welcome back' : 'Create account'}</h2>
                        <p>
                            {isLogin 
                                ? 'Enter your credentials to access your account' 
                                : 'Start your interview preparation journey'}
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="auth-alert auth-alert-error">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Success Message */}
                    {success && (
                        <div className="auth-alert auth-alert-success">
                            <CheckCircle size={18} />
                            <span>{success}</span>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="auth-form">
                        {/* Name field (signup only) */}
                        {!isLogin && (
                            <div className={`auth-input-group ${focusedField === 'name' ? 'focused' : ''} ${formData.name ? 'has-value' : ''}`}>
                                <div className="auth-input-icon">
                                    <User size={18} />
                                </div>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    onFocus={() => setFocusedField('name')}
                                    onBlur={() => setFocusedField(null)}
                                    placeholder="Full Name"
                                    autoComplete="name"
                                    disabled={loading}
                                    required={!isLogin}
                                />
                                <div className="auth-input-highlight"></div>
                            </div>
                        )}

                        {/* Email field */}
                        <div className={`auth-input-group ${focusedField === 'email' ? 'focused' : ''} ${formData.email ? 'has-value' : ''}`}>
                            <div className="auth-input-icon">
                                <Mail size={18} />
                            </div>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                onFocus={() => setFocusedField('email')}
                                onBlur={() => setFocusedField(null)}
                                placeholder="Email Address"
                                autoComplete="email"
                                disabled={loading}
                                required
                            />
                            <div className="auth-input-highlight"></div>
                        </div>

                        {/* Password field */}
                        <div className={`auth-input-group ${focusedField === 'password' ? 'focused' : ''} ${formData.password ? 'has-value' : ''}`}>
                            <div className="auth-input-icon">
                                <Lock size={18} />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                id="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                onFocus={() => setFocusedField('password')}
                                onBlur={() => setFocusedField(null)}
                                placeholder={isLogin ? "Password" : "Create Password"}
                                autoComplete={isLogin ? "current-password" : "new-password"}
                                disabled={loading}
                                required
                                minLength={8}
                            />
                            <button
                                type="button"
                                className="auth-password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                            <div className="auth-input-highlight"></div>
                        </div>

                        {!isLogin && (
                            <p className="auth-password-hint">
                                Min 8 characters with at least 1 letter and 1 number
                            </p>
                        )}

                        {/* Submit button */}
                        <button
                            type="submit"
                            className="auth-submit-btn"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={20} className="auth-spinner" />
                                    <span>{isLogin ? 'Signing in...' : 'Creating account...'}</span>
                                </>
                            ) : (
                                <>
                                    <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="auth-divider">
                        <span>or</span>
                    </div>

                    {/* Switch Mode */}
                    <p className="auth-switch-text">
                        {isLogin ? "Don't have an account? " : 'Already have an account? '}
                        <button
                            type="button"
                            className="auth-switch-btn"
                            onClick={handleModeSwitch}
                            disabled={loading}
                        >
                            {isLogin ? 'Sign up free' : 'Sign in'}
                        </button>
                    </p>

                    {/* Security Badge */}
                    <div className="auth-security">
                        <Shield size={14} />
                        <span>256-bit SSL encryption • Your data is secure</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;
