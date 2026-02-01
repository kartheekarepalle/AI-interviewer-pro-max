/**
 * Broadcast Panel Component
 * 
 * Admin can send broadcast messages to all users.
 * Messages are stored and displayed as announcements.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Zap, Send, RefreshCw, Clock, Trash2, AlertCircle,
    CheckCircle, Eye, EyeOff, MessageSquare, Users
} from 'lucide-react';
import { getToken } from '../../services/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Message Type Badge
const TypeBadge = ({ type }) => {
    const config = {
        info: { color: '#3b82f6', bg: '#dbeafe', label: 'Info' },
        warning: { color: '#f59e0b', bg: '#fef3c7', label: 'Warning' },
        success: { color: '#10b981', bg: '#d1fae5', label: 'Success' },
        urgent: { color: '#ef4444', bg: '#fee2e2', label: 'Urgent' }
    };

    const { color, bg, label } = config[type] || config.info;

    return (
        <span className="type-badge" style={{ backgroundColor: bg, color }}>
            {label}
        </span>
    );
};

function BroadcastPanel() {
    const [broadcasts, setBroadcasts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [message, setMessage] = useState(null);

    // Form state
    const [newBroadcast, setNewBroadcast] = useState({
        title: '',
        message: '',
        type: 'info',
        expiresInHours: 24
    });

    // Fetch broadcasts
    const fetchBroadcasts = useCallback(async () => {
        setLoading(true);
        try {
            const token = getToken();
            const response = await fetch(`${API_BASE}/api/admin/broadcasts`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setBroadcasts(data.broadcasts || []);
                }
            }
        } catch (err) {
            console.error('Error fetching broadcasts:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Send broadcast
    const sendBroadcast = async (e) => {
        e.preventDefault();

        if (!newBroadcast.title.trim() || !newBroadcast.message.trim()) {
            setMessage({ type: 'error', text: 'Please fill in all required fields' });
            return;
        }

        setSending(true);
        setMessage(null);

        try {
            const token = getToken();
            const response = await fetch(`${API_BASE}/api/admin/broadcasts`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newBroadcast)
            });

            const data = await response.json();

            if (data.success) {
                setMessage({ type: 'success', text: 'Broadcast sent successfully!' });
                setNewBroadcast({
                    title: '',
                    message: '',
                    type: 'info',
                    expiresInHours: 24
                });
                fetchBroadcasts();
            } else {
                throw new Error(data.detail || 'Failed to send broadcast');
            }
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setSending(false);
        }
    };

    // Delete broadcast
    const deleteBroadcast = async (id) => {
        if (!confirm('Delete this broadcast?')) return;

        try {
            const token = getToken();
            const response = await fetch(`${API_BASE}/api/admin/broadcasts/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                fetchBroadcasts();
            }
        } catch (err) {
            console.error('Error deleting broadcast:', err);
        }
    };

    // Toggle broadcast visibility
    const toggleBroadcast = async (id, isActive) => {
        try {
            const token = getToken();
            const response = await fetch(`${API_BASE}/api/admin/broadcasts/${id}/toggle`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                fetchBroadcasts();
            }
        } catch (err) {
            console.error('Error toggling broadcast:', err);
        }
    };

    useEffect(() => {
        fetchBroadcasts();
    }, [fetchBroadcasts]);

    // Clear message after 5 seconds
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    return (
        <div className="broadcast-panel">
            {/* Header */}
            <div className="panel-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem'
            }}>
                <div>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Zap size={24} />
                        Broadcast Messages
                    </h2>
                    <p style={{ margin: '0.5rem 0 0', color: '#9ca3af', fontSize: '0.9rem' }}>
                        Send announcements to all users. Messages appear in their dashboard.
                    </p>
                </div>
                <button onClick={fetchBroadcasts} className="btn-secondary" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem'
                }}>
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            {/* Message */}
            {message && (
                <div style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: message.type === 'success' ? '#10b981' : '#ef4444'
                }}>
                    {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    {message.text}
                </div>
            )}

            {/* New Broadcast Form */}
            <div className="admin-stat-card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Send size={18} />
                    New Broadcast
                </h3>

                <form onSubmit={sendBroadcast}>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#9ca3af' }}>
                                Title *
                            </label>
                            <input
                                type="text"
                                value={newBroadcast.title}
                                onChange={(e) => setNewBroadcast(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="Announcement title..."
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    backgroundColor: 'rgba(0,0,0,0.3)',
                                    color: 'white',
                                    fontSize: '1rem'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#9ca3af' }}>
                                Message *
                            </label>
                            <textarea
                                value={newBroadcast.message}
                                onChange={(e) => setNewBroadcast(prev => ({ ...prev, message: e.target.value }))}
                                placeholder="Your message to all users..."
                                rows={3}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    backgroundColor: 'rgba(0,0,0,0.3)',
                                    color: 'white',
                                    fontSize: '1rem',
                                    resize: 'vertical'
                                }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#9ca3af' }}>
                                    Type
                                </label>
                                <select
                                    value={newBroadcast.type}
                                    onChange={(e) => setNewBroadcast(prev => ({ ...prev, type: e.target.value }))}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        backgroundColor: 'rgba(0,0,0,0.3)',
                                        color: 'white',
                                        fontSize: '1rem'
                                    }}
                                >
                                    <option value="info">Info</option>
                                    <option value="success">Success</option>
                                    <option value="warning">Warning</option>
                                    <option value="urgent">Urgent</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#9ca3af' }}>
                                    Expires In
                                </label>
                                <select
                                    value={newBroadcast.expiresInHours}
                                    onChange={(e) => setNewBroadcast(prev => ({ ...prev, expiresInHours: parseInt(e.target.value) }))}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        backgroundColor: 'rgba(0,0,0,0.3)',
                                        color: 'white',
                                        fontSize: '1rem'
                                    }}
                                >
                                    <option value={1}>1 hour</option>
                                    <option value={6}>6 hours</option>
                                    <option value={24}>24 hours</option>
                                    <option value={48}>48 hours</option>
                                    <option value={168}>1 week</option>
                                </select>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={sending}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                padding: '0.875rem',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                border: 'none',
                                borderRadius: '10px',
                                color: 'white',
                                fontSize: '1rem',
                                fontWeight: '600',
                                cursor: sending ? 'not-allowed' : 'pointer',
                                opacity: sending ? 0.7 : 1
                            }}
                        >
                            {sending ? (
                                <><RefreshCw size={18} className="spin" /> Sending...</>
                            ) : (
                                <><Send size={18} /> Send Broadcast</>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Active Broadcasts */}
            <div className="admin-stat-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MessageSquare size={18} />
                    Recent Broadcasts
                    <span style={{
                        marginLeft: 'auto',
                        fontSize: '0.85rem',
                        color: '#6b7280',
                        fontWeight: 'normal'
                    }}>
                        {broadcasts.length} total
                    </span>
                </h3>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                        <RefreshCw size={24} className="spin" />
                        <p>Loading broadcasts...</p>
                    </div>
                ) : broadcasts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                        <Zap size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <p>No broadcasts yet. Send your first announcement above!</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {broadcasts.map((broadcast) => (
                            <div
                                key={broadcast.id}
                                style={{
                                    padding: '1rem',
                                    borderRadius: '10px',
                                    backgroundColor: 'rgba(0,0,0,0.2)',
                                    border: `1px solid ${broadcast.is_active ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.1)'}`,
                                    opacity: broadcast.is_active ? 1 : 0.6
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <TypeBadge type={broadcast.type} />
                                        <strong style={{ color: '#f3f4f6' }}>{broadcast.title}</strong>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => toggleBroadcast(broadcast.id, broadcast.is_active)}
                                            title={broadcast.is_active ? 'Hide' : 'Show'}
                                            style={{
                                                padding: '0.25rem',
                                                background: 'none',
                                                border: 'none',
                                                color: broadcast.is_active ? '#10b981' : '#6b7280',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {broadcast.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                                        </button>
                                        <button
                                            onClick={() => deleteBroadcast(broadcast.id)}
                                            title="Delete"
                                            style={{
                                                padding: '0.25rem',
                                                background: 'none',
                                                border: 'none',
                                                color: '#ef4444',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <p style={{ margin: '0 0 0.5rem', color: '#9ca3af', fontSize: '0.9rem' }}>
                                    {broadcast.message}
                                </p>
                                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#6b7280' }}>
                                    <span><Clock size={12} style={{ marginRight: '0.25rem' }} />{new Date(broadcast.created_at).toLocaleString()}</span>
                                    <span><Users size={12} style={{ marginRight: '0.25rem' }} />{broadcast.views || 0} views</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                .broadcast-panel .spin {
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                
                .broadcast-panel .btn-secondary {
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .broadcast-panel .btn-secondary:hover {
                    background: rgba(255, 255, 255, 0.15);
                }
                
                .broadcast-panel .type-badge {
                    padding: 0.25rem 0.5rem;
                    border-radius: 4px;
                    font-size: 0.75rem;
                    font-weight: 500;
                }
            `}</style>
        </div>
    );
}

export default BroadcastPanel;
