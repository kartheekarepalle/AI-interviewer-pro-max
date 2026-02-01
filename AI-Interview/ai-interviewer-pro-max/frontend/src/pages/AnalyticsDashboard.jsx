/**
 * Analytics Dashboard Page - Premium Design
 * 
 * Shows user's interview performance analytics with
 * modern charts and premium styling.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { analyticsApi, getStoredUser } from '../services/api';
import {
    BarChart3, Target, CheckCircle, TrendingUp, TrendingDown,
    HelpCircle, Flame, Award, BookOpen, Briefcase, Users,
    Loader2, AlertCircle, ArrowRight, Sparkles
} from 'lucide-react';

function AnalyticsDashboard() {
    const navigate = useNavigate();
    const user = getStoredUser();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dashboard, setDashboard] = useState(null);
    const [timeRange, setTimeRange] = useState(30);

    useEffect(() => {
        const loadDashboard = async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await analyticsApi.getDashboard(timeRange);
                if (response.success) {
                    setDashboard(response);
                } else {
                    throw new Error(response.message || 'Failed to load analytics');
                }
            } catch (err) {
                setError(err.message || 'Failed to load analytics data');
            } finally {
                setLoading(false);
            }
        };
        loadDashboard();
    }, [timeRange]);

    const getTrendDisplay = (trend, percent) => {
        if (trend === 'improving') {
            return { icon: <TrendingUp size={20} />, text: `+${percent}%`, className: 'trend-up' };
        } else if (trend === 'declining') {
            return { icon: <TrendingDown size={20} />, text: `${percent}%`, className: 'trend-down' };
        } else if (trend === 'stable') {
            return { icon: <ArrowRight size={20} />, text: 'Stable', className: 'trend-stable' };
        }
        return { icon: <Sparkles size={20} />, text: 'Start practicing!', className: 'trend-none' };
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    };

    const getScoreClass = (score) => {
        if (score >= 80) return 'score-excellent';
        if (score >= 60) return 'score-good';
        if (score >= 40) return 'score-fair';
        return 'score-needs-work';
    };

    const renderProgressChart = () => {
        const timeSeries = dashboard?.progress_summary?.time_series || [];

        if (timeSeries.length === 0) {
            return (
                <div className="chart-empty">
                    <BarChart3 size={48} />
                    <p>Complete more interviews to see your progress chart!</p>
                </div>
            );
        }

        return (
            <div className="progress-chart">
                <div className="chart-bars">
                    {timeSeries.map((point, index) => (
                        <div key={index} className="chart-bar-container">
                            <div
                                className={`chart-bar ${point.score ? 'has-data' : 'no-data'}`}
                                style={{ height: point.score ? `${(point.score / 100) * 100}%` : '5%' }}
                            >
                                {point.score && <span className="bar-value">{point.score}</span>}
                            </div>
                            <span className="bar-label">{point.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderSkillBars = (skills, title, icon) => {
        if (!skills || skills.length === 0) {
            return (
                <div className="skill-section">
                    <div className="skill-section-header">
                        {icon}
                        <h4>{title}</h4>
                    </div>
                    <p className="no-data-text">No data yet</p>
                </div>
            );
        }

        return (
            <div className="skill-section">
                <div className="skill-section-header">
                    {icon}
                    <h4>{title}</h4>
                </div>
                <div className="skill-bars">
                    {skills.map((skill, index) => (
                        <div key={index} className="skill-bar-item">
                            <div className="skill-info">
                                <span className="skill-name">{skill.skill}</span>
                                <span className={`skill-score ${getScoreClass(skill.average_score)}`}>
                                    {skill.average_score}%
                                </span>
                            </div>
                            <div className="skill-bar">
                                <div
                                    className={`skill-bar-fill ${getScoreClass(skill.average_score)}`}
                                    style={{ width: `${skill.average_score}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderQuestionTypes = () => {
        const breakdown = dashboard?.question_types?.breakdown || [];

        if (breakdown.length === 0) {
            return (
                <div className="chart-empty">
                    <HelpCircle size={48} />
                    <p>Answer more questions to see your breakdown!</p>
                </div>
            );
        }

        const typeIcons = {
            technical: <Briefcase size={24} />,
            behavioral: <Users size={24} />,
            situational: <Target size={24} />,
            hr: <BookOpen size={24} />,
        };

        return (
            <div className="question-type-grid">
                {breakdown.map((type, index) => (
                    <div key={index} className="question-type-card">
                        <div className="type-icon">
                            {typeIcons[type.type] || <HelpCircle size={24} />}
                        </div>
                        <div className="type-info">
                            <span className="type-label">{type.label}</span>
                            <span className={`type-score ${getScoreClass(type.average_score)}`}>
                                {type.average_score}%
                            </span>
                            <span className="type-count">{type.count} questions</span>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="analytics-container">
                <Navbar user={user} />
                <main className="analytics-loading">
                    <div className="loading-card">
                        <Loader2 size={48} className="spin" />
                        <h2>Loading Analytics</h2>
                        <p>Crunching your numbers...</p>
                    </div>
                </main>
            </div>
        );
    }

    if (error) {
        return (
            <div className="analytics-container">
                <Navbar user={user} />
                <main className="analytics-loading">
                    <div className="error-card">
                        <AlertCircle size={48} />
                        <h2>Something went wrong</h2>
                        <p>{error}</p>
                        <button className="btn btn-primary" onClick={() => window.location.reload()}>
                            Try Again
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    const overview = dashboard?.overview || {};
    const trendDisplay = getTrendDisplay(overview.trend, overview.trend_percent);

    return (
        <div className="analytics-container">
            <Navbar user={user} />

            <main className="analytics-main">
                {/* Page Header */}
                <header className="analytics-header">
                    <div className="header-content">
                        <div className="header-icon">
                            <BarChart3 size={32} />
                        </div>
                        <div>
                            <h1>Analytics Dashboard</h1>
                            <p>Track your interview preparation progress</p>
                        </div>
                    </div>
                    <div className="header-actions">
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(Number(e.target.value))}
                            className="form-select"
                        >
                            <option value={7}>Last 7 days</option>
                            <option value={30}>Last 30 days</option>
                            <option value={90}>Last 90 days</option>
                            <option value={365}>Last year</option>
                        </select>
                    </div>
                </header>

                {/* Overview Stats */}
                <section className="overview-section">
                    <div className="stats-grid analytics-stats">
                        <div className="stat-card">
                            <div className="stat-icon-wrapper">
                                <Target size={24} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-value">{overview.total_interviews || 0}</span>
                                <span className="stat-label">Total Interviews</span>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon-wrapper success">
                                <CheckCircle size={24} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-value">{overview.completed_interviews || 0}</span>
                                <span className="stat-label">Completed</span>
                                <span className="stat-sub">{overview.completion_rate || 0}% rate</span>
                            </div>
                        </div>

                        <div className="stat-card highlight">
                            <div className="stat-icon-wrapper primary">
                                <Award size={24} />
                            </div>
                            <div className="stat-content">
                                <span className={`stat-value gradient-text`}>
                                    {overview.average_score || 0}%
                                </span>
                                <span className="stat-label">Average Score</span>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className={`stat-icon-wrapper ${trendDisplay.className}`}>
                                {trendDisplay.icon}
                            </div>
                            <div className="stat-content">
                                <span className={`stat-value ${trendDisplay.className}`}>
                                    {trendDisplay.text}
                                </span>
                                <span className="stat-label">Trend</span>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon-wrapper">
                                <HelpCircle size={24} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-value">{overview.total_questions_answered || 0}</span>
                                <span className="stat-label">Questions Answered</span>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon-wrapper warning">
                                <Flame size={24} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-value">{overview.recent_activity_count || 0}</span>
                                <span className="stat-label">This Week</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Progress Chart */}
                <section className="analytics-section">
                    <div className="section-header">
                        <TrendingUp size={24} />
                        <div>
                            <h2>Score Progress</h2>
                            <p>Your performance over time</p>
                        </div>
                    </div>
                    <div className="chart-card">
                        {renderProgressChart()}
                        {dashboard?.progress_summary?.improvement_points !== 0 && (
                            <div className={`improvement-badge ${dashboard.progress_summary.improvement_points > 0 ? 'up' : 'down'}`}>
                                {dashboard.progress_summary.improvement_points > 0 ? (
                                    <>
                                        <Sparkles size={16} />
                                        You've improved by {dashboard.progress_summary.improvement_points} points!
                                    </>
                                ) : (
                                    'Keep practicing to improve your scores'
                                )}
                            </div>
                        )}
                    </div>
                </section>

                {/* Skills Section */}
                <section className="analytics-section">
                    <div className="section-header">
                        <Award size={24} />
                        <div>
                            <h2>Skill Performance</h2>
                            <p>Your strengths and areas for improvement</p>
                        </div>
                    </div>
                    <div className="skills-grid">
                        <div className="skill-card">
                            {renderSkillBars(dashboard?.skill_summary?.strengths, 'Your Strengths', <Award size={20} className="text-success" />)}
                        </div>
                        <div className="skill-card">
                            {renderSkillBars(dashboard?.skill_summary?.weaknesses, 'Focus Areas', <BookOpen size={20} className="text-warning" />)}
                        </div>
                    </div>
                </section>

                {/* Question Types */}
                <section className="analytics-section">
                    <div className="section-header">
                        <HelpCircle size={24} />
                        <div>
                            <h2>Question Type Breakdown</h2>
                            <p>Performance by question category</p>
                        </div>
                    </div>
                    <div className="chart-card">
                        {renderQuestionTypes()}
                    </div>
                </section>

                {/* Recent Interviews */}
                <section className="analytics-section">
                    <div className="section-header">
                        <Briefcase size={24} />
                        <div>
                            <h2>Recent Interviews</h2>
                            <p>Your latest practice sessions</p>
                        </div>
                    </div>
                    {(dashboard?.recent_interviews || []).length === 0 ? (
                        <div className="empty-state-card">
                            <Target size={48} />
                            <h3>No interviews yet</h3>
                            <p>Complete your first interview to see results here</p>
                            <button
                                className="btn btn-primary"
                                onClick={() => navigate('/select-domain')}
                            >
                                Start Your First Interview
                            </button>
                        </div>
                    ) : (
                        <div className="recent-interviews-grid">
                            {dashboard.recent_interviews.map((interview, index) => (
                                <div key={index} className="recent-interview-card" onClick={() => navigate(`/report/${interview.id}`)}>
                                    <div className="interview-header">
                                        <span className="interview-role">{interview.target_role}</span>
                                        <span className="interview-date">{formatDate(interview.date)}</span>
                                    </div>
                                    <div className="interview-meta">
                                        <span className="meta-badge">{interview.session_type}</span>
                                        <span className="meta-badge">{interview.difficulty}</span>
                                        <span className="meta-badge">{interview.questions_count} Qs</span>
                                    </div>
                                    <div className="interview-score">
                                        {interview.score !== null ? (
                                            <span className={`score-badge ${getScoreClass(interview.score)}`}>
                                                {interview.score}%
                                            </span>
                                        ) : (
                                            <span className="score-badge pending">Pending</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Disclaimer */}
                <section className="disclaimer-section">
                    <p>
                        {dashboard?.disclaimer ||
                            "Analytics are based on your interview history and provide insights for improvement. They do not predict actual job interview outcomes."}
                    </p>
                </section>

                {/* CTA */}
                <section className="cta-section">
                    <button
                        className="btn btn-primary btn-lg"
                        onClick={() => navigate('/select-domain')}
                    >
                        <Sparkles size={20} />
                        Start New Interview
                    </button>
                </section>
            </main>
        </div>
    );
}

export default AnalyticsDashboard;
