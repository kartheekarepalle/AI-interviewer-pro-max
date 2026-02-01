/**
 * Error Logs Panel Component
 * 
 * Real-time error monitoring with:
 * - Error list with filtering
 * - Severity-based sorting
 * - Error acknowledgment and resolution
 * - Error statistics
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    AlertTriangle, AlertCircle, AlertOctagon, Info, RefreshCw,
    Check, Eye, Filter, Clock, Search, ChevronDown, ChevronUp,
    User, Code, XCircle
} from 'lucide-react';
import { getToken } from '../../services/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Severity badge component
const SeverityBadge = ({ severity }) => {
    const config = {
        critical: { icon: AlertOctagon, color: '#ef4444', bg: '#fee2e2' },
        error: { icon: AlertCircle, color: '#f97316', bg: '#ffedd5' },
        warning: { icon: AlertTriangle, color: '#f59e0b', bg: '#fef3c7' },
        info: { icon: Info, color: '#3b82f6', bg: '#dbeafe' }
    };

    const { icon: Icon, color, bg } = config[severity] || config.info;

    return (
        <span 
            className="severity-badge" 
            style={{ backgroundColor: bg, color, borderColor: color }}
        >
            <Icon size={12} />
            {severity}
        </span>
    );
};

// Status badge component
const StatusBadge = ({ status }) => {
    const config = {
        new: { color: '#ef4444', bg: '#fee2e2', label: 'New' },
        acknowledged: { color: '#f59e0b', bg: '#fef3c7', label: 'Acknowledged' },
        resolved: { color: '#10b981', bg: '#d1fae5', label: 'Resolved' },
        ignored: { color: '#6b7280', bg: '#f3f4f6', label: 'Ignored' }
    };

    const { color, bg, label } = config[status] || config.new;

    return (
        <span className="status-badge" style={{ backgroundColor: bg, color }}>
            {label}
        </span>
    );
};

// Error detail modal
const ErrorDetailModal = ({ error, onClose, onAcknowledge, onResolve }) => {
    if (!error) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content error-detail-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>
                        <SeverityBadge severity={error.severity} />
                        Error Details
                    </h3>
                    <button className="close-btn" onClick={onClose}>
                        <XCircle size={20} />
                    </button>
                </div>
                <div className="modal-body">
                    <div className="detail-row">
                        <label>Error Type:</label>
                        <span className="mono">{error.error_type}</span>
                    </div>
                    <div className="detail-row">
                        <label>Message:</label>
                        <p>{error.error_message}</p>
                    </div>
                    <div className="detail-row">
                        <label>Endpoint:</label>
                        <span className="mono">{error.method} {error.endpoint}</span>
                    </div>
                    <div className="detail-row">
                        <label>Time:</label>
                        <span>{new Date(error.created_at).toLocaleString()}</span>
                    </div>
                    <div className="detail-row">
                        <label>Status:</label>
                        <StatusBadge status={error.status} />
                    </div>
                    {error.stack_trace && (
                        <div className="detail-row stack-trace">
                            <label>Stack Trace:</label>
                            <pre>{error.stack_trace}</pre>
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    {error.status === 'new' && (
                        <button 
                            className="btn-secondary"
                            onClick={() => onAcknowledge(error.id)}
                        >
                            <Eye size={16} /> Acknowledge
                        </button>
                    )}
                    {(error.status === 'new' || error.status === 'acknowledged') && (
                        <button 
                            className="btn-primary"
                            onClick={() => onResolve(error.id)}
                        >
                            <Check size={16} /> Mark Resolved
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

function ErrorLogsPanel() {
    const [errors, setErrors] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedError, setSelectedError] = useState(null);
    
    // Filters
    const [severity, setSeverity] = useState('');
    const [status, setStatus] = useState('');
    const [hours, setHours] = useState(24);
    const [limit, setLimit] = useState(50);
    const [autoRefresh, setAutoRefresh] = useState(true);

    // Fetch errors
    const fetchErrors = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = getToken();
            const params = new URLSearchParams({ hours: hours.toString(), limit: limit.toString() });
            if (severity) params.append('severity', severity);
            if (status) params.append('status', status);

            const response = await fetch(`${API_BASE}/api/admin/errors?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to fetch errors');

            const data = await response.json();
            if (data.success) {
                setErrors(data.errors);
                setStats(data.stats);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [severity, status, hours, limit]);

    // Acknowledge error
    const acknowledgeError = async (errorId) => {
        try {
            const token = getToken();
            const response = await fetch(`${API_BASE}/api/admin/errors/${errorId}/acknowledge`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                fetchErrors();
                setSelectedError(null);
            }
        } catch (err) {
            console.error('Error acknowledging:', err);
        }
    };

    // Resolve error
    const resolveError = async (errorId) => {
        try {
            const token = getToken();
            const response = await fetch(`${API_BASE}/api/admin/errors/${errorId}/resolve`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                fetchErrors();
                setSelectedError(null);
            }
        } catch (err) {
            console.error('Error resolving:', err);
        }
    };

    // Initial fetch
    useEffect(() => {
        fetchErrors();
    }, [fetchErrors]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchErrors, 30000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchErrors]);

    if (loading) {
        return (
            <div className="admin-loading">
                <RefreshCw className="spinning" size={40} />
                <p>Loading error logs...</p>
            </div>
        );
    }

    return (
        <div className="error-logs-panel">
            {/* Header */}
            <div className="panel-header">
                <div className="header-left">
                    <AlertCircle size={24} />
                    <h2>Error Logs</h2>
                    {stats && (
                        <span className="error-count">
                            {stats.total} total ({stats.by_status?.new || 0} new)
                        </span>
                    )}
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
                    <button className="refresh-btn" onClick={fetchErrors} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spinning' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stats Bar */}
            {stats && (
                <div className="error-stats-bar">
                    <div className="stat-item critical">
                        <AlertOctagon size={16} />
                        <span>{stats.by_severity?.critical || 0} Critical</span>
                    </div>
                    <div className="stat-item error">
                        <AlertCircle size={16} />
                        <span>{stats.by_severity?.error || 0} Errors</span>
                    </div>
                    <div className="stat-item warning">
                        <AlertTriangle size={16} />
                        <span>{stats.by_severity?.warning || 0} Warnings</span>
                    </div>
                    <div className="stat-item info">
                        <Info size={16} />
                        <span>{stats.by_severity?.info || 0} Info</span>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="filters-bar">
                <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                    <option value="">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="error">Error</option>
                    <option value="warning">Warning</option>
                    <option value="info">Info</option>
                </select>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="">All Statuses</option>
                    <option value="new">New</option>
                    <option value="acknowledged">Acknowledged</option>
                    <option value="resolved">Resolved</option>
                    <option value="ignored">Ignored</option>
                </select>
                <select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                    <option value={1}>Last 1 hour</option>
                    <option value={6}>Last 6 hours</option>
                    <option value={24}>Last 24 hours</option>
                    <option value={48}>Last 48 hours</option>
                    <option value={168}>Last 7 days</option>
                </select>
            </div>

            {/* Error List */}
            <div className="error-list">
                {errors.length === 0 ? (
                    <div className="empty-state">
                        <Check size={48} />
                        <p>No errors found for the selected filters</p>
                    </div>
                ) : (
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Severity</th>
                                <th>Error Type</th>
                                <th>Message</th>
                                <th>Endpoint</th>
                                <th>Time</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {errors.map((err) => (
                                <tr key={err.id} className={`severity-${err.severity}`}>
                                    <td><SeverityBadge severity={err.severity} /></td>
                                    <td className="mono">{err.error_type}</td>
                                    <td className="message-cell" title={err.error_message}>
                                        {err.error_message?.substring(0, 50)}...
                                    </td>
                                    <td className="mono endpoint-cell">
                                        {err.method} {err.endpoint}
                                    </td>
                                    <td className="time-cell">
                                        {new Date(err.created_at).toLocaleTimeString()}
                                    </td>
                                    <td><StatusBadge status={err.status} /></td>
                                    <td className="actions-cell">
                                        <button 
                                            className="icon-btn"
                                            onClick={() => setSelectedError(err)}
                                            title="View Details"
                                        >
                                            <Eye size={16} />
                                        </button>
                                        {err.status === 'new' && (
                                            <button 
                                                className="icon-btn"
                                                onClick={() => acknowledgeError(err.id)}
                                                title="Acknowledge"
                                            >
                                                <Check size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Error Detail Modal */}
            {selectedError && (
                <ErrorDetailModal
                    error={selectedError}
                    onClose={() => setSelectedError(null)}
                    onAcknowledge={acknowledgeError}
                    onResolve={resolveError}
                />
            )}
        </div>
    );
}

export default ErrorLogsPanel;
