/**
 * Dashboard Page - Cosmic Premium Design with AI Robot
 * 
 * Featuring AI Robot interviewer as hero background
 * Inspired by futuristic AI interface with cosmic purple theme
 * 
 * USES: userDataService - SAME source as Profile page
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Announcements from '../components/Announcements';
import { userApi, getStoredUser } from '../services/api';
import { loadDashboardData } from '../services/userDataService';
import { getCachedAnalytics, getInterviewHistory } from '../services/interviewStorage';
import {
    Target, FileText, BarChart3, TrendingUp, Award,
    ChevronRight, Sparkles, Zap, Calendar, Star, Play, ScanSearch, Rocket, Crown
} from 'lucide-react';
import './Dashboard.css';

function Dashboard() {
    const navigate = useNavigate();

    // Redirect admin to admin panel
    useEffect(() => {
        const storedUser = getStoredUser();
        if (storedUser?.is_admin) {
            navigate('/admin', { replace: true });
        }
    }, [navigate]);

    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [analytics, setAnalytics] = useState({
        total_interviews: 0,
        completed_interviews: 0,
        average_score: null,
        best_score: null,
        last_interview_at: null,
    });
    const [recentInterviews, setRecentInterviews] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                // Get stored user first
                const storedUser = getStoredUser();
                if (storedUser) setUser(storedUser);

                // Load profile
                try {
                    const profileResponse = await userApi.getProfile();
                    if (profileResponse.success && profileResponse.user) {
                        setUser(profileResponse.user);
                    }
                } catch (profileErr) {
                    console.warn('Profile load failed, using stored user');
                }

                // Use UNIFIED data service (SAME as Profile page)
                try {
                    const data = await loadDashboardData();
                    setAnalytics(data.analytics);
                    setRecentInterviews(data.recentInterviews);
                } catch (dataErr) {
                    console.warn('Dashboard data load failed, using cache');
                    setAnalytics(getCachedAnalytics());
                    setRecentInterviews(getInterviewHistory(5));
                }

            } catch (err) {
                setError('Failed to load data. Please try again.');
                console.error('Dashboard load error:', err);

                // Full fallback to localStorage
                setAnalytics(getCachedAnalytics());
                setRecentInterviews(getInterviewHistory(5));
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    const handleStartInterview = () => navigate('/select-domain');

    // Calculate rating from average score
    const rating = analytics.average_score
        ? Math.min(5, Math.round((analytics.average_score / 100) * 5 * 10) / 10)
        : 0;

    if (loading) {
        return (
            <div className="cosmic-loading">
                <div className="cosmic-loading-content">
                    <div className="cosmic-spinner">
                        <div className="spinner-ring"></div>
                        <div className="spinner-ring"></div>
                        <div className="spinner-ring"></div>
                    </div>
                    <p>Initializing AI Interviewer...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="cosmic-dashboard">
            {/* Animated Background */}
            <div className="cosmic-bg">
                <div className="stars"></div>
                <div className="stars2"></div>
                <div className="stars3"></div>
                <div className="cosmic-gradient"></div>
            </div>

            {/* AI Robot Background Image */}
            <div className="ai-robot-bg">
                <img
                    src="/ai-robot.png"
                    alt=""
                    className="ai-robot-bg-image"
                    aria-hidden="true"
                />
            </div>

            <Navbar user={user} />

            <main className="cosmic-main">
                {/* Announcements Banner */}
                <Announcements />

                {error && (
                    <div className="cosmic-error">
                        <span>{error}</span>
                        <button onClick={() => setError(null)}>×</button>
                    </div>
                )}

                {/* Hero Section with AI Robot */}
                <section className="cosmic-hero">
                    {/* Hero Title Badge */}
                    <div className="hero-title-badge">
                        <Sparkles size={22} />
                        <span>AI Interviewer</span>
                    </div>

                    {/* Main CTA - Start Interview */}
                    <button className="cosmic-cta" onClick={handleStartInterview}>
                        <div className="cta-glow"></div>
                        <Rocket size={26} />
                        <span>Start Interview</span>
                        <ChevronRight size={22} />
                    </button>

                    {/* Quick Action Buttons */}
                    <div className="quick-action-row">
                        <button className="quick-action-btn" onClick={() => navigate('/resumes')}>
                            <FileText size={20} />
                            <span>Upload Resume</span>
                        </button>
                        <button className="quick-action-btn" onClick={() => navigate('/analytics')}>
                            <BarChart3 size={20} />
                            <span>View Analytics</span>
                        </button>
                        <button className="quick-action-btn" onClick={() => navigate('/resumes', { state: { activeTab: 'analyze' } })}>
                            <ScanSearch size={20} />
                            <span>ATS Analyser</span>
                        </button>
                    </div>
                </section>

                {/* Stats Overview Section */}
                <section className="cosmic-stats-section">
                    <div className="section-header">
                        <h2>Interview Overview</h2>
                        <span className="section-subtitle">Your Performance Stats</span>
                    </div>

                    <div className="cosmic-stats-grid">
                        <div className="cosmic-stat-card">
                            <div className="stat-icon">
                                <Zap size={20} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-label">Total Sessions</span>
                                <span className="stat-value">{analytics.total_interviews}</span>
                            </div>
                        </div>

                        <div className="cosmic-stat-card">
                            <div className="stat-icon completed">
                                <Award size={20} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-label">Completed</span>
                                <span className="stat-value">{analytics.completed_interviews}</span>
                            </div>
                            <div className="stat-visual">
                                <div className="mini-bars">
                                    <div className="mini-bar" style={{ height: '40%' }}></div>
                                    <div className="mini-bar" style={{ height: '70%' }}></div>
                                    <div className="mini-bar" style={{ height: '55%' }}></div>
                                    <div className="mini-bar" style={{ height: '85%' }}></div>
                                    <div className="mini-bar" style={{ height: '60%' }}></div>
                                </div>
                            </div>
                        </div>

                        <div className="cosmic-stat-card rating">
                            <div className="stat-icon rating">
                                <Star size={20} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-label">Overall Rating</span>
                                <div className="rating-display">
                                    <span className="stat-value">{rating.toFixed(1)}</span>
                                    <div className="star-rating">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <Star
                                                key={star}
                                                size={12}
                                                className={star <= Math.round(rating) ? 'filled' : ''}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button className="cosmic-stat-card action" onClick={() => navigate('/analytics')}>
                            <TrendingUp size={20} />
                            <span>Manage</span>
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </section>

                {/* Recent Interviews Section */}
                <section className="cosmic-recent-section">
                    <div className="section-header">
                        <h2>Recent Mock Interviews</h2>
                    </div>

                    {analytics.total_interviews === 0 ? (
                        <div className="cosmic-empty-state">
                            <div className="empty-icon">🎯</div>
                            <h3>No interviews yet</h3>
                            <p>Start your first AI-powered mock interview and track your progress</p>
                            <button className="cosmic-cta small" onClick={handleStartInterview}>
                                <Target size={18} />
                                <span>Start Your First Interview</span>
                            </button>
                        </div>
                    ) : recentInterviews.length > 0 ? (
                        <div className="cosmic-recent-list">
                            {recentInterviews.map((interview) => (
                                <div
                                    key={interview.id}
                                    className="cosmic-recent-item"
                                    onClick={() => navigate(`/report/${interview.id}`)}
                                >
                                    <div className="recent-icon">
                                        <FileText size={18} />
                                    </div>
                                    <div className="recent-info">
                                        <strong>{interview.job_role || 'Mock Interview'}</strong>
                                        <span className="recent-date">
                                            <Calendar size={12} />
                                            {new Date(interview.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="recent-status">
                                        <span className={`status-badge ${interview.score ? 'completed' : 'progress'}`}>
                                            {interview.score ? `${Math.round(interview.score)}%` : 'In Progress'}
                                        </span>
                                        <ChevronRight size={16} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="cosmic-muted">Loading recent interviews...</p>
                    )}
                </section>

                {/* User Card */}
                <div className="cosmic-user-card">
                    <div className="user-avatar">
                        {user?.name?.charAt(0) || 'U'}
                    </div>
                    <div className="user-info">
                        <strong>{user?.name || 'User'}</strong>
                        <span>{user?.target_role || 'AI Interviewer'}</span>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default Dashboard;
