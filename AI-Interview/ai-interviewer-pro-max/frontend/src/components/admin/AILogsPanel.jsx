/**
 * AI API Logs Panel Component
 * 
 * Monitor Gemini and Groq API calls with:
 * - Call list with filtering by provider
 * - Token usage statistics
 * - Response time tracking
 * - Error monitoring
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Zap, RefreshCw, Filter, Clock, Brain, Bot,
    Check, XCircle, AlertTriangle, BarChart3, TrendingUp,
    Cpu, Activity, Hash
} from 'lucide-react';
import { getToken } from '../../services/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Provider badge (Gemini or Groq)
const ProviderBadge = ({ provider }) => {
    const config = {
        gemini: { bg: '#dbeafe', color: '#2563eb', icon: '🌟', label: 'Gemini' },
        groq: { bg: '#fef3c7', color: '#d97706', icon: '⚡', label: 'Groq' }
    };

    const { bg, color, icon, label } = config[provider] || config.gemini;

    return (
        <span className="provider-badge" style={{ 
            backgroundColor: bg, 
            color, 
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '0.8rem',
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
        }}>
            {icon} {label}
        </span>
    );
};

// Status badge
const StatusBadge = ({ status }) => {
    const config = {
        success: { bg: '#d1fae5', color: '#059669', icon: <Check size={12} /> },
        error: { bg: '#fee2e2', color: '#dc2626', icon: <XCircle size={12} /> },
        timeout: { bg: '#fef3c7', color: '#d97706', icon: <Clock size={12} /> }
    };

    const { bg, color, icon } = config[status] || config.success;

    return (
        <span className="status-badge" style={{ 
            backgroundColor: bg, 
            color,
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: '500',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
        }}>
            {icon} {status}
        </span>
    );
};

// Response time indicator
const ResponseTimeIndicator = ({ ms }) => {
    if (!ms) return <span style={{ color: '#9ca3af' }}>-</span>;
    
    let color;
    if (ms < 1000) color = '#10b981';
    else if (ms < 3000) color = '#f59e0b';
    else color = '#ef4444';

    return (
        <span style={{ color, fontWeight: '500' }}>
            {ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`}
        </span>
    );
};

// Token display
const TokenDisplay = ({ tokens }) => {
    if (!tokens) return <span style={{ color: '#9ca3af' }}>-</span>;
    
    return (
        <span style={{ 
            color: '#8b5cf6', 
            fontWeight: '500',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
        }}>
            <Hash size={12} />
            {tokens.toLocaleString()}
        </span>
    );
};

function AILogsPanel() {
    const [logs, setLogs] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const [provider, setProvider] = useState('');
    const [operation, setOperation] = useState('');
    const [status, setStatus] = useState('');
    const [hours, setHours] = useState(24);
    const [limit, setLimit] = useState(100);
    const [autoRefresh, setAutoRefresh] = useState(true);

    // Fetch logs
    const fetchLogs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = getToken();
            const params = new URLSearchParams({ 
                limit: limit.toString(),
                hours: hours.toString()
            });
            if (provider) params.append('provider', provider);
            if (operation) params.append('operation', operation);
            if (status) params.append('status', status);

            const response = await fetch(`${API_BASE}/api/admin/ai-logs?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setLogs(data.logs || []);
                    setStats(data.stats || null);
                }
            } else {
                throw new Error('Failed to fetch AI logs');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [provider, operation, status, hours, limit]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    // Auto-refresh every 10 seconds
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchLogs, 10000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchLogs]);

    // Format timestamp
    const formatTime = (isoString) => {
        if (!isoString) return '-';
        const date = new Date(isoString);
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
    };

    return (
        <div className="ai-logs-panel">
            {/* Header */}
            <div className="panel-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem'
            }}>
                <div>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Brain size={24} />
                        AI API Logs
                    </h2>
                    <p style={{ margin: '0.5rem 0 0', color: '#9ca3af', fontSize: '0.9rem' }}>
                        Monitor Gemini and Groq API calls in real-time
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <label style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        color: '#9ca3af'
                    }}>
                        <input 
                            type="checkbox" 
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                        />
                        Auto-refresh
                    </label>
                    <button onClick={fetchLogs} className="btn-secondary" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1rem'
                    }}>
                        <RefreshCw size={16} className={loading ? 'spinning' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="stats-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '1rem',
                    marginBottom: '1.5rem'
                }}>
                    <div className="admin-stat-card">
                        <div className="stat-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                            <Activity size={20} style={{ color: '#3b82f6' }} />
                        </div>
                        <div className="stat-content">
                            <span className="stat-value">{stats.total_calls?.toLocaleString() || 0}</span>
                            <span className="stat-label">Total Calls ({hours}h)</span>
                        </div>
                    </div>
                    
                    <div className="admin-stat-card">
                        <div className="stat-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                            <span style={{ fontSize: '1.2rem' }}>🌟</span>
                        </div>
                        <div className="stat-content">
                            <span className="stat-value">{stats.gemini_calls?.toLocaleString() || 0}</span>
                            <span className="stat-label">Gemini Calls</span>
                        </div>
                    </div>
                    
                    <div className="admin-stat-card">
                        <div className="stat-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
                            <span style={{ fontSize: '1.2rem' }}>⚡</span>
                        </div>
                        <div className="stat-content">
                            <span className="stat-value">{stats.groq_calls?.toLocaleString() || 0}</span>
                            <span className="stat-label">Groq Calls</span>
                        </div>
                    </div>
                    
                    <div className="admin-stat-card">
                        <div className="stat-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                            <Check size={20} style={{ color: '#10b981' }} />
                        </div>
                        <div className="stat-content">
                            <span className="stat-value">{stats.success_rate || 100}%</span>
                            <span className="stat-label">Success Rate</span>
                        </div>
                    </div>
                    
                    <div className="admin-stat-card">
                        <div className="stat-icon" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)' }}>
                            <Hash size={20} style={{ color: '#8b5cf6' }} />
                        </div>
                        <div className="stat-content">
                            <span className="stat-value">{stats.total_tokens?.toLocaleString() || 0}</span>
                            <span className="stat-label">Total Tokens</span>
                        </div>
                    </div>
                    
                    <div className="admin-stat-card">
                        <div className="stat-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
                            <Clock size={20} style={{ color: '#f59e0b' }} />
                        </div>
                        <div className="stat-content">
                            <span className="stat-value">{stats.avg_response_time_ms || 0}ms</span>
                            <span className="stat-label">Avg Response</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="filters-bar" style={{
                display: 'flex',
                gap: '1rem',
                marginBottom: '1rem',
                flexWrap: 'wrap',
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Filter size={16} style={{ color: '#9ca3af' }} />
                    <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Filters:</span>
                </div>
                
                <select 
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="filter-select"
                    style={{
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        color: 'white',
                        fontSize: '0.9rem'
                    }}
                >
                    <option value="">All Providers</option>
                    <option value="gemini">🌟 Gemini</option>
                    <option value="groq">⚡ Groq</option>
                </select>
                
                <input
                    type="text"
                    placeholder="Operation..."
                    value={operation}
                    onChange={(e) => setOperation(e.target.value)}
                    style={{
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        color: 'white',
                        fontSize: '0.9rem',
                        width: '150px'
                    }}
                />
                
                <select 
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="filter-select"
                    style={{
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        color: 'white',
                        fontSize: '0.9rem'
                    }}
                >
                    <option value="">All Status</option>
                    <option value="success">✓ Success</option>
                    <option value="error">✗ Error</option>
                </select>
                
                <select 
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                    className="filter-select"
                    style={{
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        color: 'white',
                        fontSize: '0.9rem'
                    }}
                >
                    <option value={1}>Last 1 hour</option>
                    <option value={6}>Last 6 hours</option>
                    <option value={24}>Last 24 hours</option>
                    <option value={48}>Last 48 hours</option>
                    <option value={168}>Last 7 days</option>
                </select>
            </div>

            {/* Error display */}
            {error && (
                <div style={{
                    padding: '1rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <AlertTriangle size={16} />
                    {error}
                </div>
            )}

            {/* Logs Table */}
            <div className="logs-container" style={{
                backgroundColor: 'rgba(0,0,0,0.2)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.05)',
                overflow: 'hidden'
            }}>
                {loading && logs.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
                        <RefreshCw size={24} className="spinning" style={{ marginBottom: '1rem' }} />
                        <p>Loading AI logs...</p>
                    </div>
                ) : logs.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
                        <Brain size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                        <p>No AI API logs found</p>
                        <p style={{ fontSize: '0.85rem' }}>AI calls will appear here once made</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ 
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    borderBottom: '1px solid rgba(255,255,255,0.1)'
                                }}>
                                    <th style={{ padding: '1rem', textAlign: 'left', color: '#9ca3af', fontWeight: '500' }}>Time</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', color: '#9ca3af', fontWeight: '500' }}>Provider</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', color: '#9ca3af', fontWeight: '500' }}>Operation</th>
                                    <th style={{ padding: '1rem', textAlign: 'left', color: '#9ca3af', fontWeight: '500' }}>Model</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af', fontWeight: '500' }}>Tokens</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af', fontWeight: '500' }}>Response</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af', fontWeight: '500' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log, index) => (
                                    <tr 
                                        key={log.id || index}
                                        style={{ 
                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                            transition: 'background-color 0.15s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <td style={{ padding: '0.75rem 1rem', color: '#9ca3af', fontSize: '0.85rem' }}>
                                            {formatTime(log.created_at)}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <ProviderBadge provider={log.provider} />
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', color: '#e5e7eb', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                            {log.operation || '-'}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', color: '#9ca3af', fontSize: '0.85rem' }}>
                                            {log.model || '-'}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                            <TokenDisplay tokens={log.total_tokens} />
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                            <ResponseTimeIndicator ms={log.response_time_ms} />
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                            <StatusBadge status={log.status} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div style={{
                marginTop: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: '#9ca3af',
                fontSize: '0.85rem'
            }}>
                <span>Showing {logs.length} logs</span>
                <span>Last updated: {new Date().toLocaleTimeString()}</span>
            </div>

            <style>{`
                .spinning {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

export default AILogsPanel;
