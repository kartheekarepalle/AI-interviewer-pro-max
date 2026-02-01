/**
 * Announcements Component
 * 
 * Displays active broadcast messages from admin to users.
 * Shows in a collapsible banner at the top of the dashboard.
 */

import React, { useState, useEffect } from 'react';
import { 
    Megaphone, X, AlertTriangle, Info, CheckCircle, 
    AlertCircle, ChevronDown, ChevronUp 
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Type-based icon and colors
const getTypeConfig = (type) => {
    const configs = {
        info: {
            icon: <Info size={18} />,
            bgColor: 'rgba(59, 130, 246, 0.15)',
            borderColor: 'rgba(59, 130, 246, 0.4)',
            textColor: '#93c5fd',
            accentColor: '#3b82f6'
        },
        warning: {
            icon: <AlertTriangle size={18} />,
            bgColor: 'rgba(245, 158, 11, 0.15)',
            borderColor: 'rgba(245, 158, 11, 0.4)',
            textColor: '#fcd34d',
            accentColor: '#f59e0b'
        },
        success: {
            icon: <CheckCircle size={18} />,
            bgColor: 'rgba(16, 185, 129, 0.15)',
            borderColor: 'rgba(16, 185, 129, 0.4)',
            textColor: '#6ee7b7',
            accentColor: '#10b981'
        },
        urgent: {
            icon: <AlertCircle size={18} />,
            bgColor: 'rgba(239, 68, 68, 0.15)',
            borderColor: 'rgba(239, 68, 68, 0.4)',
            textColor: '#fca5a5',
            accentColor: '#ef4444'
        }
    };
    return configs[type] || configs.info;
};

function Announcements() {
    const [broadcasts, setBroadcasts] = useState([]);
    const [dismissed, setDismissed] = useState([]);
    const [viewedIds, setViewedIds] = useState(new Set()); // Track which broadcasts have been viewed
    const [expanded, setExpanded] = useState(true);
    const [loading, setLoading] = useState(true);

    // Load dismissed announcements from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('dismissedAnnouncements');
        if (saved) {
            try {
                setDismissed(JSON.parse(saved));
            } catch (e) {
                setDismissed([]);
            }
        }
        
        // Load viewed announcements from localStorage
        const viewed = localStorage.getItem('viewedAnnouncements');
        if (viewed) {
            try {
                setViewedIds(new Set(JSON.parse(viewed)));
            } catch (e) {
                setViewedIds(new Set());
            }
        }
    }, []);

    // Track view for a broadcast
    const trackView = async (broadcastId) => {
        if (viewedIds.has(broadcastId)) return; // Already tracked
        
        try {
            await fetch(`${API_BASE}/api/public/broadcasts/${broadcastId}/view`, {
                method: 'POST'
            });
            
            // Update local state
            const newViewed = new Set(viewedIds);
            newViewed.add(broadcastId);
            setViewedIds(newViewed);
            localStorage.setItem('viewedAnnouncements', JSON.stringify([...newViewed]));
        } catch (err) {
            console.error('Failed to track view:', err);
        }
    };

    // Fetch active broadcasts
    useEffect(() => {
        const fetchBroadcasts = async () => {
            try {
                const response = await fetch(`${API_BASE}/api/public/broadcasts`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        const newBroadcasts = data.broadcasts || [];
                        setBroadcasts(newBroadcasts);
                        
                        // Track views for all new broadcasts that user hasn't seen yet
                        newBroadcasts.forEach(broadcast => {
                            if (!viewedIds.has(broadcast.id) && !dismissed.includes(broadcast.id)) {
                                trackView(broadcast.id);
                            }
                        });
                    }
                }
            } catch (err) {
                console.error('Failed to fetch announcements:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchBroadcasts();
        
        // Refresh every 5 minutes
        const interval = setInterval(fetchBroadcasts, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [viewedIds, dismissed]);

    // Dismiss an announcement
    const dismissAnnouncement = (id) => {
        const newDismissed = [...dismissed, id];
        setDismissed(newDismissed);
        localStorage.setItem('dismissedAnnouncements', JSON.stringify(newDismissed));
    };

    // Filter out dismissed announcements
    const activeAnnouncements = broadcasts.filter(b => !dismissed.includes(b.id));

    // Don't render if no announcements or still loading
    if (loading || activeAnnouncements.length === 0) {
        return null;
    }

    return (
        <div className="announcements-container" style={{
            position: 'relative',
            zIndex: 100,
            marginBottom: '1rem',
            fontFamily: "'Inter', sans-serif"
        }}>
            {/* Header bar - always visible */}
            <div 
                className="announcements-header"
                onClick={() => setExpanded(!expanded)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.2))',
                    borderRadius: expanded ? '12px 12px 0 0' : '12px',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderBottom: expanded ? 'none' : '1px solid rgba(139, 92, 246, 0.3)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Megaphone size={18} style={{ color: '#a78bfa' }} />
                    <span style={{ 
                        color: '#e5e7eb', 
                        fontWeight: '600',
                        fontSize: '0.9rem'
                    }}>
                        Announcements
                    </span>
                    <span style={{
                        background: 'rgba(139, 92, 246, 0.3)',
                        color: '#c4b5fd',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '0.75rem',
                        fontWeight: '600'
                    }}>
                        {activeAnnouncements.length}
                    </span>
                </div>
                <div style={{ color: '#9ca3af' }}>
                    {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
            </div>

            {/* Announcements list */}
            {expanded && (
                <div style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '0 0 12px 12px',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderTop: 'none',
                    overflow: 'hidden'
                }}>
                    {activeAnnouncements.map((announcement, index) => {
                        const config = getTypeConfig(announcement.type);
                        return (
                            <div 
                                key={announcement.id}
                                style={{
                                    padding: '1rem',
                                    backgroundColor: config.bgColor,
                                    borderLeft: `4px solid ${config.accentColor}`,
                                    borderBottom: index < activeAnnouncements.length - 1 
                                        ? '1px solid rgba(255,255,255,0.05)' 
                                        : 'none',
                                    display: 'flex',
                                    gap: '0.75rem',
                                    alignItems: 'flex-start'
                                }}
                            >
                                <div style={{ color: config.accentColor, marginTop: '2px' }}>
                                    {config.icon}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ 
                                        fontWeight: '600', 
                                        color: config.textColor,
                                        marginBottom: '0.25rem',
                                        fontSize: '0.95rem'
                                    }}>
                                        {announcement.title}
                                    </div>
                                    <div style={{ 
                                        color: '#d1d5db',
                                        fontSize: '0.85rem',
                                        lineHeight: '1.5'
                                    }}>
                                        {announcement.message}
                                    </div>
                                    {announcement.created_at && (
                                        <div style={{
                                            color: '#6b7280',
                                            fontSize: '0.75rem',
                                            marginTop: '0.5rem'
                                        }}>
                                            {new Date(announcement.created_at).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        dismissAnnouncement(announcement.id);
                                    }}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#6b7280',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        borderRadius: '4px',
                                        transition: 'all 0.15s ease'
                                    }}
                                    onMouseEnter={(e) => e.target.style.color = '#9ca3af'}
                                    onMouseLeave={(e) => e.target.style.color = '#6b7280'}
                                    title="Dismiss"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default Announcements;
