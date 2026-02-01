/**
 * Usage Stats Panel Component
 * 
 * Platform usage statistics dashboard:
 * - User stats (total, new, active)
 * - Interview stats
 * - Daily activity charts
 * - Resume uploads
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    BarChart3, RefreshCw, Users, FileText, MessageSquare,
    TrendingUp, Calendar, Activity, Clock, ArrowUp, ArrowDown
} from 'lucide-react';
import { getToken } from '../../services/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Stats card component
const StatsCard = ({ icon: Icon, title, value, change, changeType, subtitle }) => {
    return (
        <div className="usage-stat-card">
            <div className="stat-icon">
                <Icon size={24} />
            </div>
            <div className="stat-content">
                <span className="stat-value">{value.toLocaleString()}</span>
                <span className="stat-title">{title}</span>
                {change !== undefined && (
                    <span className={`stat-change ${changeType}`}>
                        {changeType === 'up' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                        {change}%
                    </span>
                )}
                {subtitle && <span className="stat-subtitle">{subtitle}</span>}
            </div>
        </div>
    );
};

// Simple bar chart component
const SimpleBarChart = ({ data, dataKey, labelKey, title }) => {
    if (!data || data.length === 0) return null;

    const maxValue = Math.max(...data.map(d => d[dataKey] || 0));

    return (
        <div className="simple-bar-chart">
            <h4>{title}</h4>
            <div className="chart-bars">
                {data.map((item, idx) => (
                    <div key={idx} className="bar-container">
                        <div 
                            className="bar"
                            style={{ 
                                height: `${maxValue > 0 ? (item[dataKey] / maxValue) * 100 : 0}%` 
                            }}
                        >
                            <span className="bar-value">{item[dataKey]}</span>
                        </div>
                        <span className="bar-label">
                            {new Date(item[labelKey]).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric' 
                            })}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

function UsageStatsPanel() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [days, setDays] = useState(7);

    // Fetch stats
    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = getToken();
            const response = await fetch(`${API_BASE}/api/admin/usage-stats?days=${days}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to fetch usage stats');

            const data = await response.json();
            if (data.success) {
                setStats(data.stats);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [days]);

    // Initial fetch
    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    if (loading) {
        return (
            <div className="admin-loading">
                <RefreshCw className="spinning" size={40} />
                <p>Loading usage statistics...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="admin-error">
                <p>Error: {error}</p>
                <button onClick={fetchStats}>Retry</button>
            </div>
        );
    }

    const { users, interviews, resumes, daily } = stats || {};

    return (
        <div className="usage-stats-panel">
            {/* Header */}
            <div className="panel-header">
                <div className="header-left">
                    <BarChart3 size={24} />
                    <h2>Usage Statistics</h2>
                </div>
                <div className="header-right">
                    <select 
                        value={days} 
                        onChange={(e) => setDays(Number(e.target.value))}
                        className="period-selector"
                    >
                        <option value={7}>Last 7 days</option>
                        <option value={14}>Last 14 days</option>
                        <option value={30}>Last 30 days</option>
                    </select>
                    <button className="refresh-btn" onClick={fetchStats} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spinning' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Main Stats Cards */}
            <div className="stats-grid">
                <StatsCard
                    icon={Users}
                    title="Total Users"
                    value={users?.total || 0}
                    subtitle={`${users?.new || 0} new in last ${days} days`}
                />
                <StatsCard
                    icon={Activity}
                    title="Active Users"
                    value={users?.active || 0}
                    subtitle={`Active in last ${days} days`}
                />
                <StatsCard
                    icon={MessageSquare}
                    title="Total Interviews"
                    value={interviews?.total || 0}
                    subtitle={`${interviews?.recent || 0} recent`}
                />
                <StatsCard
                    icon={FileText}
                    title="Total Resumes"
                    value={resumes?.total || 0}
                />
            </div>

            {/* Charts Section */}
            <div className="charts-section">
                <div className="chart-container">
                    <SimpleBarChart
                        data={daily}
                        dataKey="interviews"
                        labelKey="date"
                        title="Daily Interviews"
                    />
                </div>
                <div className="chart-container">
                    <SimpleBarChart
                        data={daily}
                        dataKey="signups"
                        labelKey="date"
                        title="Daily Signups"
                    />
                </div>
                <div className="chart-container">
                    <SimpleBarChart
                        data={daily}
                        dataKey="api_requests"
                        labelKey="date"
                        title="Daily API Requests"
                    />
                </div>
            </div>

            {/* Daily Breakdown Table */}
            {daily && daily.length > 0 && (
                <div className="daily-breakdown">
                    <h3><Calendar size={18} /> Daily Breakdown</h3>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Interviews</th>
                                <th>Signups</th>
                                <th>API Requests</th>
                            </tr>
                        </thead>
                        <tbody>
                            {daily.map((day, idx) => (
                                <tr key={idx}>
                                    <td>{new Date(day.date).toLocaleDateString()}</td>
                                    <td>{day.interviews}</td>
                                    <td>{day.signups}</td>
                                    <td>{day.api_requests}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default UsageStatsPanel;
