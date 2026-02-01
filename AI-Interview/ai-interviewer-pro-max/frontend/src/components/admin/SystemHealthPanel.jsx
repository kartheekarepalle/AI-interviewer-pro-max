/**
 * System Health Panel Component
 * 
 * Real-time system monitoring dashboard showing:
 * - CPU usage
 * - Memory usage
 * - Disk usage
 * - Database health
 * - Recent activity metrics
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Activity, Cpu, HardDrive, Database, Server, RefreshCw,
    CheckCircle, AlertTriangle, XCircle, Wifi, Clock, Users,
    Zap, TrendingUp, BarChart3
} from 'lucide-react';
import { getToken } from '../../services/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Status indicator component
const StatusIndicator = ({ status }) => {
    const getStatusConfig = () => {
        switch (status) {
            case 'healthy':
            case 'connected':
                return { icon: CheckCircle, color: '#10b981', label: 'Healthy' };
            case 'warning':
            case 'degraded':
                return { icon: AlertTriangle, color: '#f59e0b', label: 'Warning' };
            case 'critical':
            case 'error':
            case 'disconnected':
                return { icon: XCircle, color: '#ef4444', label: 'Critical' };
            default:
                return { icon: Activity, color: '#6b7280', label: 'Unknown' };
        }
    };

    const { icon: Icon, color, label } = getStatusConfig();

    return (
        <div className="status-indicator" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Icon size={16} color={color} />
            <span style={{ color }}>{label}</span>
        </div>
    );
};

// Metric Card Component
const MetricCard = ({ icon: Icon, title, value, unit, percentage, status, description }) => {
    const getBarColor = (pct) => {
        if (pct < 60) return '#10b981';
        if (pct < 80) return '#f59e0b';
        return '#ef4444';
    };

    return (
        <div className="admin-stat-card metric-card">
            <div className="metric-header">
                <div className="metric-icon">
                    <Icon size={24} />
                </div>
                <StatusIndicator status={status} />
            </div>
            <div className="metric-content">
                <h3>{title}</h3>
                <div className="metric-value">
                    <span className="value">{value}</span>
                    {unit && <span className="unit">{unit}</span>}
                </div>
                {percentage !== undefined && (
                    <div className="progress-bar-container">
                        <div
                            className="progress-bar"
                            style={{
                                width: `${Math.min(percentage, 100)}%`,
                                backgroundColor: getBarColor(percentage)
                            }}
                        />
                    </div>
                )}
                {description && <p className="metric-description">{description}</p>}
            </div>
        </div>
    );
};

// Realtime Stats Row
const RealtimeStats = ({ metrics }) => {
    if (!metrics) return null;

    return (
        <div className="realtime-stats-row">
            <div className="realtime-stat">
                <Zap size={18} className="stat-icon" />
                <span className="stat-value">{metrics.requests_per_hour || 0}</span>
                <span className="stat-label">Requests/hr</span>
            </div>
            <div className="realtime-stat">
                <AlertTriangle size={18} className="stat-icon warning" />
                <span className="stat-value">{metrics.errors_per_hour || 0}</span>
                <span className="stat-label">Errors/hr</span>
            </div>
            <div className="realtime-stat">
                <Users size={18} className="stat-icon" />
                <span className="stat-value">{metrics.active_users || 0}</span>
                <span className="stat-label">Active Users</span>
            </div>
        </div>
    );
};

function SystemHealthPanel() {
    const [health, setHealth] = useState(null);
    const [realtime, setRealtime] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [autoRefresh, setAutoRefresh] = useState(true);

    // Fetch full health data
    const fetchHealth = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = getToken();
            const response = await fetch(`${API_BASE}/api/admin/health`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to fetch health data');

            const data = await response.json();
            if (data.success) {
                setHealth(data.health);
                setLastUpdate(new Date());
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch lightweight realtime metrics
    const fetchRealtime = useCallback(async () => {
        try {
            const token = getToken();
            const response = await fetch(`${API_BASE}/api/admin/health/realtime`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setRealtime(data.metrics);
                    setLastUpdate(new Date());
                }
            }
        } catch (err) {
            console.error('Realtime fetch error:', err);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchHealth();
    }, [fetchHealth]);

    // Auto-refresh realtime metrics every 5 seconds
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(fetchRealtime, 5000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchRealtime]);

    if (loading) {
        return (
            <div className="admin-loading">
                <RefreshCw className="spinning" size={40} />
                <p>Loading system health...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="admin-error">
                <XCircle size={40} />
                <p>Error: {error}</p>
                <button onClick={fetchHealth}>Retry</button>
            </div>
        );
    }

    const cpu = health?.cpu || {};
    const memory = health?.memory || {};
    const disk = health?.disk || {};
    const database = health?.database || {};
    const overallStatus = realtime?.overall_status || health?.overall_status || 'unknown';

    return (
        <div className="system-health-panel">
            {/* Header */}
            <div className="panel-header">
                <div className="header-left">
                    <Server size={24} />
                    <h2>System Health</h2>
                    <StatusIndicator status={overallStatus} />
                </div>
                <div className="header-right">
                    <label className="auto-refresh-toggle">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                        />
                        Auto-refresh
                    </label>
                    <button className="refresh-btn" onClick={fetchHealth} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spinning' : ''} />
                        Refresh
                    </button>
                    {lastUpdate && (
                        <span className="last-update">
                            <Clock size={14} />
                            {lastUpdate.toLocaleTimeString()}
                        </span>
                    )}
                </div>
            </div>

            {/* Realtime Stats */}
            <RealtimeStats metrics={realtime} />

            {/* Metric Cards */}
            <div className="metrics-grid">
                <MetricCard
                    icon={Cpu}
                    title="CPU Usage"
                    value={realtime?.cpu_percent ?? cpu.usage_percent ?? 0}
                    unit="%"
                    percentage={realtime?.cpu_percent ?? cpu.usage_percent ?? 0}
                    status={cpu.status || 'unknown'}
                    description={`${cpu.cores || 0} cores available`}
                />
                <MetricCard
                    icon={Activity}
                    title="Memory Usage"
                    value={realtime?.memory_percent ?? memory.usage_percent ?? 0}
                    unit="%"
                    percentage={realtime?.memory_percent ?? memory.usage_percent ?? 0}
                    status={memory.status || 'unknown'}
                    description={`${memory.used_gb?.toFixed(1) || 0} / ${memory.total_gb?.toFixed(1) || 0} GB`}
                />
                <MetricCard
                    icon={HardDrive}
                    title="Disk Usage"
                    value={disk.usage_percent ?? 0}
                    unit="%"
                    percentage={disk.usage_percent ?? 0}
                    status={disk.status || 'unknown'}
                    description={`${disk.used_gb?.toFixed(1) || 0} / ${disk.total_gb?.toFixed(1) || 0} GB`}
                />
                <MetricCard
                    icon={Database}
                    title="Database"
                    value={database.connected ? 'Connected' : 'Disconnected'}
                    status={database.connected ? 'connected' : 'error'}
                    description={database.response_time_ms ? `${database.response_time_ms.toFixed(2)}ms response` : ''}
                />
            </div>

            {/* Database Stats */}
            {database.table_stats && (
                <div className="database-stats">
                    <h3><Database size={18} /> Database Tables</h3>
                    <div className="table-stats-grid">
                        {Object.entries(database.table_stats).map(([table, count]) => (
                            <div key={table} className="table-stat">
                                <span className="table-name">{table}</span>
                                <span className="table-count">{count.toLocaleString()} rows</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Process Info */}
            {health?.process && (
                <div className="process-info">
                    <h3><Activity size={18} /> Process Info</h3>
                    <div className="process-stats">
                        <div className="process-stat">
                            <span className="label">Process Memory</span>
                            <span className="value">{health.process.memory_mb?.toFixed(1)} MB</span>
                        </div>
                        <div className="process-stat">
                            <span className="label">CPU Usage</span>
                            <span className="value">{health.process.cpu_percent?.toFixed(1)}%</span>
                        </div>
                        <div className="process-stat">
                            <span className="label">Threads</span>
                            <span className="value">{health.process.threads}</span>
                        </div>
                        <div className="process-stat">
                            <span className="label">Open Files</span>
                            <span className="value">{health.process.open_files}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SystemHealthPanel;
