/**
 * API Logs Panel Component
 * 
 * Real-time API request monitoring with:
 * - Request list with filtering
 * - Response time statistics
 * - Top endpoints
 * - Status code breakdown
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Activity, RefreshCw, Filter, Clock, ArrowUpRight, ArrowDownRight,
    Check, XCircle, AlertTriangle, Zap, BarChart3, TrendingUp
} from 'lucide-react';
import { getToken } from '../../services/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// HTTP Method badge
const MethodBadge = ({ method }) => {
    const colors = {
        GET: { bg: '#dbeafe', color: '#2563eb' },
        POST: { bg: '#d1fae5', color: '#059669' },
        PUT: { bg: '#fef3c7', color: '#d97706' },
        DELETE: { bg: '#fee2e2', color: '#dc2626' },
        PATCH: { bg: '#ede9fe', color: '#7c3aed' }
    };

    const { bg, color } = colors[method] || { bg: '#f3f4f6', color: '#374151' };

    return (
        <span className="method-badge" style={{ backgroundColor: bg, color }}>
            {method}
        </span>
    );
};

// Status code badge
const StatusBadge = ({ code }) => {
    let bg, color;
    if (code >= 500) {
        bg = '#fee2e2'; color = '#dc2626';
    } else if (code >= 400) {
        bg = '#fef3c7'; color = '#d97706';
    } else if (code >= 300) {
        bg = '#dbeafe'; color = '#2563eb';
    } else {
        bg = '#d1fae5'; color = '#059669';
    }

    return (
        <span className="status-code-badge" style={{ backgroundColor: bg, color }}>
            {code}
        </span>
    );
};

// Response time indicator
const ResponseTimeIndicator = ({ ms }) => {
    let color;
    if (ms < 100) color = '#10b981';
    else if (ms < 500) color = '#f59e0b';
    else color = '#ef4444';

    return (
        <span className="response-time" style={{ color }}>
            {ms.toFixed(0)}ms
        </span>
    );
};

function APILogsPanel() {
    const [logs, setLogs] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const [endpoint, setEndpoint] = useState('');
    const [method, setMethod] = useState('');
    const [statusCode, setStatusCode] = useState('');
    const [limit, setLimit] = useState(100);
    const [autoRefresh, setAutoRefresh] = useState(true);

    // Fetch logs
    const fetchLogs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = getToken();
            const params = new URLSearchParams({ limit: limit.toString() });
            if (endpoint) params.append('endpoint', endpoint);
            if (method) params.append('method', method);
            if (statusCode) params.append('status_code', statusCode);

            const response = await fetch(`${API_BASE}/api/admin/api-logs?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to fetch API logs');

            const data = await response.json();
            if (data.success) {
                setLogs(data.logs);
                setStats(data.stats);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [endpoint, method, statusCode, limit]);

    // Initial fetch
    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    // Auto-refresh every 10 seconds
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchLogs, 10000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchLogs]);

    if (loading) {
        return (
            <div className="admin-loading">
                <RefreshCw className="spinning" size={40} />
                <p>Loading API logs...</p>
            </div>
        );
    }

    return (
        <div className="api-logs-panel">
            {/* Header */}
            <div className="panel-header">
                <div className="header-left">
                    <Activity size={24} />
                    <h2>API Request Logs</h2>
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
                    <button className="refresh-btn" onClick={fetchLogs} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spinning' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="stats-cards">
                    <div className="stat-card">
                        <Zap size={20} />
                        <div className="stat-content">
                            <span className="stat-value">{stats.total_requests || 0}</span>
                            <span className="stat-label">Total Requests (24h)</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <Clock size={20} />
                        <div className="stat-content">
                            <span className="stat-value">{stats.avg_response_time?.toFixed(0) || 0}ms</span>
                            <span className="stat-label">Avg Response Time</span>
                        </div>
                    </div>
                    <div className="stat-card success">
                        <Check size={20} />
                        <div className="stat-content">
                            <span className="stat-value">{stats.status_breakdown?.['2xx'] || 0}</span>
                            <span className="stat-label">Successful (2xx)</span>
                        </div>
                    </div>
                    <div className="stat-card error">
                        <XCircle size={20} />
                        <div className="stat-content">
                            <span className="stat-value">
                                {(stats.status_breakdown?.['4xx'] || 0) + (stats.status_breakdown?.['5xx'] || 0)}
                            </span>
                            <span className="stat-label">Errors (4xx/5xx)</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Top Endpoints */}
            {stats?.top_endpoints && stats.top_endpoints.length > 0 && (
                <div className="top-endpoints">
                    <h3><TrendingUp size={18} /> Top Endpoints</h3>
                    <div className="endpoints-list">
                        {stats.top_endpoints.map((ep, idx) => (
                            <div key={idx} className="endpoint-item">
                                <span className="rank">#{idx + 1}</span>
                                <span className="endpoint-path">{ep.endpoint}</span>
                                <span className="endpoint-count">{ep.count} requests</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="filters-bar">
                <select value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="">All Methods</option>
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                </select>
                <input
                    type="text"
                    placeholder="Filter by endpoint..."
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                />
                <select value={statusCode} onChange={(e) => setStatusCode(e.target.value)}>
                    <option value="">All Status Codes</option>
                    <option value="200">200 OK</option>
                    <option value="201">201 Created</option>
                    <option value="400">400 Bad Request</option>
                    <option value="401">401 Unauthorized</option>
                    <option value="403">403 Forbidden</option>
                    <option value="404">404 Not Found</option>
                    <option value="500">500 Internal Error</option>
                </select>
                <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
                    <option value={50}>Show 50</option>
                    <option value={100}>Show 100</option>
                    <option value={200}>Show 200</option>
                </select>
            </div>

            {/* Logs Table */}
            <div className="logs-table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Method</th>
                            <th>Endpoint</th>
                            <th>Status</th>
                            <th>Response Time</th>
                            <th>IP Address</th>
                            <th>Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="empty-row">
                                    No API logs found
                                </td>
                            </tr>
                        ) : (
                            logs.map((log) => (
                                <tr key={log.id}>
                                    <td><MethodBadge method={log.method} /></td>
                                    <td className="endpoint-cell mono">{log.endpoint}</td>
                                    <td><StatusBadge code={log.status_code} /></td>
                                    <td><ResponseTimeIndicator ms={log.response_time_ms} /></td>
                                    <td className="mono">{log.ip_address}</td>
                                    <td className="time-cell">
                                        {new Date(log.created_at).toLocaleTimeString()}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default APILogsPanel;
