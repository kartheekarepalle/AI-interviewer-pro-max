/**
 * Bug Reports Panel Component
 * 
 * User feedback and bug report management:
 * - View all bug reports
 * - Filter by status/severity
 * - Update report status
 * - Add admin notes
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Bug, RefreshCw, Filter, MessageSquare, Clock, User,
    Check, AlertTriangle, XCircle, ChevronDown, ExternalLink,
    Edit3, Save, X
} from 'lucide-react';
import { getToken } from '../../services/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Severity badge
const SeverityBadge = ({ severity }) => {
    const config = {
        critical: { color: '#dc2626', bg: '#fee2e2' },
        high: { color: '#f97316', bg: '#ffedd5' },
        medium: { color: '#f59e0b', bg: '#fef3c7' },
        low: { color: '#10b981', bg: '#d1fae5' }
    };

    const { color, bg } = config[severity] || config.medium;

    return (
        <span className="severity-badge" style={{ backgroundColor: bg, color }}>
            {severity}
        </span>
    );
};

// Status badge
const StatusBadge = ({ status }) => {
    const config = {
        new: { color: '#dc2626', bg: '#fee2e2', label: 'New' },
        in_progress: { color: '#f59e0b', bg: '#fef3c7', label: 'In Progress' },
        resolved: { color: '#10b981', bg: '#d1fae5', label: 'Resolved' },
        closed: { color: '#6b7280', bg: '#f3f4f6', label: 'Closed' },
        wont_fix: { color: '#8b5cf6', bg: '#ede9fe', label: "Won't Fix" }
    };

    const { color, bg, label } = config[status] || config.new;

    return (
        <span className="status-badge" style={{ backgroundColor: bg, color }}>
            {label}
        </span>
    );
};

// Bug report detail modal
const BugReportModal = ({ report, onClose, onUpdate }) => {
    const [status, setStatus] = useState(report.status);
    const [adminNotes, setAdminNotes] = useState(report.admin_notes || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onUpdate(report.id, { status, admin_notes: adminNotes });
            onClose();
        } catch (err) {
            console.error('Error updating report:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content bug-report-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>
                        <Bug size={20} />
                        Bug Report Details
                    </h3>
                    <button className="close-btn" onClick={onClose}>
                        <XCircle size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    <div className="report-header-info">
                        <SeverityBadge severity={report.severity} />
                        <StatusBadge status={report.status} />
                        <span className="report-category">{report.category}</span>
                    </div>

                    <h4 className="report-title">{report.title}</h4>
                    
                    <div className="report-meta">
                        <span><User size={14} /> User ID: {report.user_id?.substring(0, 8)}...</span>
                        <span><Clock size={14} /> {new Date(report.created_at).toLocaleString()}</span>
                    </div>

                    {report.page_url && (
                        <div className="report-url">
                            <ExternalLink size={14} />
                            <a href={report.page_url} target="_blank" rel="noopener noreferrer">
                                {report.page_url}
                            </a>
                        </div>
                    )}

                    <div className="report-description">
                        <label>Description</label>
                        <p>{report.description}</p>
                    </div>

                    {report.browser_info && (
                        <div className="report-browser">
                            <label>Browser Info</label>
                            <code>{report.browser_info}</code>
                        </div>
                    )}

                    <div className="report-actions">
                        <div className="status-selector">
                            <label>Status</label>
                            <select value={status} onChange={(e) => setStatus(e.target.value)}>
                                <option value="new">New</option>
                                <option value="in_progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                                <option value="closed">Closed</option>
                                <option value="wont_fix">Won't Fix</option>
                            </select>
                        </div>

                        <div className="admin-notes">
                            <label>Admin Notes</label>
                            <textarea
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                                placeholder="Add internal notes about this bug report..."
                                rows={4}
                            />
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn-secondary" onClick={onClose}>
                        Cancel
                    </button>
                    <button 
                        className="btn-primary" 
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? <RefreshCw size={16} className="spinning" /> : <Save size={16} />}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

function BugReportsPanel() {
    const [reports, setReports] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedReport, setSelectedReport] = useState(null);

    // Filters
    const [status, setStatus] = useState('');
    const [severity, setSeverity] = useState('');
    const [autoRefresh, setAutoRefresh] = useState(false);

    // Fetch reports
    const fetchReports = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = getToken();
            const params = new URLSearchParams();
            if (status) params.append('status', status);
            if (severity) params.append('severity', severity);

            const response = await fetch(`${API_BASE}/api/admin/bug-reports?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to fetch bug reports');

            const data = await response.json();
            if (data.success) {
                setReports(data.reports);
                setStats(data.stats);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [status, severity]);

    // Update report
    const updateReport = async (reportId, updates) => {
        const token = getToken();
        const response = await fetch(`${API_BASE}/api/admin/bug-reports/${reportId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updates)
        });

        if (!response.ok) throw new Error('Failed to update report');

        fetchReports();
    };

    // Initial fetch
    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    // Auto-refresh every 60 seconds
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchReports, 60000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchReports]);

    if (loading) {
        return (
            <div className="admin-loading">
                <RefreshCw className="spinning" size={40} />
                <p>Loading bug reports...</p>
            </div>
        );
    }

    return (
        <div className="bug-reports-panel">
            {/* Header */}
            <div className="panel-header">
                <div className="header-left">
                    <Bug size={24} />
                    <h2>Bug Reports</h2>
                    {stats && (
                        <span className="report-count">
                            {stats.total} total ({stats.open} open)
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
                    <button className="refresh-btn" onClick={fetchReports} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spinning' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="filters-bar">
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="">All Statuses</option>
                    <option value="new">New</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                    <option value="wont_fix">Won't Fix</option>
                </select>
                <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                    <option value="">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
            </div>

            {/* Reports List */}
            <div className="reports-list">
                {reports.length === 0 ? (
                    <div className="empty-state">
                        <Check size={48} />
                        <p>No bug reports found</p>
                    </div>
                ) : (
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Severity</th>
                                <th>Title</th>
                                <th>Category</th>
                                <th>Status</th>
                                <th>Submitted</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.map((report) => (
                                <tr key={report.id} className={`severity-${report.severity}`}>
                                    <td><SeverityBadge severity={report.severity} /></td>
                                    <td className="title-cell">{report.title}</td>
                                    <td className="category-cell">{report.category}</td>
                                    <td><StatusBadge status={report.status} /></td>
                                    <td className="time-cell">
                                        {new Date(report.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="actions-cell">
                                        <button 
                                            className="icon-btn"
                                            onClick={() => setSelectedReport(report)}
                                            title="View Details"
                                        >
                                            <Edit3 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Detail Modal */}
            {selectedReport && (
                <BugReportModal
                    report={selectedReport}
                    onClose={() => setSelectedReport(null)}
                    onUpdate={updateReport}
                />
            )}
        </div>
    );
}

export default BugReportsPanel;
