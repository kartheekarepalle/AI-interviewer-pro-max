/**
 * Settings & Maintenance Panel Component
 * 
 * System settings management with:
 * - Maintenance mode toggle
 * - System configuration
 * - API rate limits
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Settings, RefreshCw, Save, Wrench, AlertTriangle, Check,
    Clock, Shield, Zap, Power, MessageSquare, Edit3,
    XCircle, ChevronRight
} from 'lucide-react';
import { getToken } from '../../services/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Setting input component
const SettingInput = ({ setting, onUpdate }) => {
    const [value, setValue] = useState(setting.value);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onUpdate(setting.key, value);
            setEditing(false);
        } catch (err) {
            console.error('Error saving setting:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="setting-item">
            <div className="setting-info">
                <label>{setting.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</label>
                {setting.description && <p className="setting-description">{setting.description}</p>}
            </div>
            <div className="setting-control">
                {editing ? (
                    <div className="edit-controls">
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            className="setting-input"
                        />
                        <button className="save-btn" onClick={handleSave} disabled={saving}>
                            {saving ? <RefreshCw size={14} className="spinning" /> : <Check size={14} />}
                        </button>
                        <button className="cancel-btn" onClick={() => { setEditing(false); setValue(setting.value); }}>
                            <XCircle size={14} />
                        </button>
                    </div>
                ) : (
                    <div className="display-controls">
                        <span className="setting-value">
                            {setting.is_sensitive ? '••••••••' : setting.value}
                        </span>
                        <button className="edit-btn" onClick={() => setEditing(true)}>
                            <Edit3 size={14} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

function SettingsMaintenancePanel() {
    const [settings, setSettings] = useState({});
    const [maintenance, setMaintenance] = useState({ enabled: false, message: '' });
    const [apiLimits, setApiLimits] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [maintenanceMessage, setMaintenanceMessage] = useState('');

    // Fetch settings
    const fetchSettings = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = getToken();

            // Fetch settings
            const settingsRes = await fetch(`${API_BASE}/api/admin/settings`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (settingsRes.ok) {
                const data = await settingsRes.json();
                if (data.success) {
                    setSettings(data.settings);
                }
            }

            // Fetch maintenance status
            const maintenanceRes = await fetch(`${API_BASE}/api/admin/maintenance`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (maintenanceRes.ok) {
                const data = await maintenanceRes.json();
                if (data.success) {
                    setMaintenance({
                        enabled: data.maintenance_mode,
                        message: data.message || ''
                    });
                    setMaintenanceMessage(data.message || '');
                }
            }

            // Fetch API limits
            const limitsRes = await fetch(`${API_BASE}/api/admin/api-limits`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (limitsRes.ok) {
                const data = await limitsRes.json();
                if (data.success) {
                    setApiLimits(data.limits);
                }
            }

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Toggle maintenance mode
    const toggleMaintenance = async () => {
        setSaving(true);
        try {
            const token = getToken();
            const response = await fetch(`${API_BASE}/api/admin/maintenance/toggle`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setMaintenance(prev => ({ ...prev, enabled: data.maintenance_mode }));
                }
            }
        } catch (err) {
            console.error('Error toggling maintenance:', err);
        } finally {
            setSaving(false);
        }
    };

    // Update maintenance message
    const updateMaintenanceMessage = async () => {
        setSaving(true);
        try {
            const token = getToken();
            const response = await fetch(`${API_BASE}/api/admin/maintenance/message`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: maintenanceMessage })
            });

            if (response.ok) {
                setMaintenance(prev => ({ ...prev, message: maintenanceMessage }));
            }
        } catch (err) {
            console.error('Error updating message:', err);
        } finally {
            setSaving(false);
        }
    };

    // Update a setting
    const updateSetting = async (key, value) => {
        const token = getToken();
        const response = await fetch(`${API_BASE}/api/admin/settings/${key}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ value })
        });

        if (response.ok) {
            fetchSettings(); // Refresh settings
        } else {
            throw new Error('Failed to update setting');
        }
    };

    // Update API limits
    const updateApiLimits = async () => {
        setSaving(true);
        try {
            const token = getToken();
            const response = await fetch(`${API_BASE}/api/admin/api-limits`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(apiLimits)
            });

            if (response.ok) {
                console.log('API limits updated');
            }
        } catch (err) {
            console.error('Error updating limits:', err);
        } finally {
            setSaving(false);
        }
    };

    // Initial fetch
    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    if (loading) {
        return (
            <div className="admin-loading">
                <RefreshCw className="spinning" size={40} />
                <p>Loading settings...</p>
            </div>
        );
    }

    return (
        <div className="settings-maintenance-panel" style={{ padding: '0' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem'
            }}>
                <div>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f3f4f6' }}>
                        <Wrench size={24} />
                        Maintenance & Settings
                    </h2>
                    <p style={{ margin: '0.5rem 0 0', color: '#9ca3af', fontSize: '0.9rem' }}>
                        Control system maintenance mode and API rate limits
                    </p>
                </div>
                <button onClick={fetchSettings} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                }}>
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            {/* Maintenance Mode Card */}
            <div className="admin-stat-card" style={{
                marginBottom: '1.5rem',
                padding: '1.5rem',
                backgroundColor: maintenance.enabled ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.05)',
                border: `1px solid ${maintenance.enabled ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.2)'}`
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1.5rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: maintenance.enabled ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)'
                        }}>
                            <Power size={28} style={{ color: maintenance.enabled ? '#f59e0b' : '#10b981' }} />
                        </div>
                        <div>
                            <h3 style={{
                                margin: 0,
                                fontSize: '1.25rem',
                                color: maintenance.enabled ? '#f59e0b' : '#10b981'
                            }}>
                                {maintenance.enabled ? 'Maintenance Mode Active' : 'System Online'}
                            </h3>
                            <p style={{ margin: '0.25rem 0 0', color: '#9ca3af', fontSize: '0.9rem' }}>
                                {maintenance.enabled
                                    ? 'Users will see a maintenance message when accessing the site.'
                                    : 'All users can access the system normally.'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={toggleMaintenance}
                        disabled={saving}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '10px',
                            border: 'none',
                            fontWeight: '600',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            background: maintenance.enabled
                                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            opacity: saving ? 0.7 : 1
                        }}
                    >
                        {saving ? (
                            <RefreshCw size={16} className="spin" />
                        ) : maintenance.enabled ? (
                            <>Disable Maintenance</>
                        ) : (
                            <>Enable Maintenance</>
                        )}
                    </button>
                </div>

                {/* Maintenance Message Editor */}
                <div style={{ marginTop: '1rem' }}>
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.5rem',
                        fontSize: '0.9rem',
                        color: '#9ca3af'
                    }}>
                        <MessageSquare size={16} />
                        Maintenance Message (shown to users)
                    </label>
                    <textarea
                        value={maintenanceMessage}
                        onChange={(e) => setMaintenanceMessage(e.target.value)}
                        placeholder="Enter a message to display to users during maintenance..."
                        rows={3}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            color: 'white',
                            fontSize: '1rem',
                            resize: 'vertical',
                            marginBottom: '0.75rem'
                        }}
                    />
                    <button
                        onClick={updateMaintenanceMessage}
                        disabled={saving || maintenanceMessage === maintenance.message}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.625rem 1.25rem',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            border: 'none',
                            borderRadius: '8px',
                            color: 'white',
                            fontWeight: '600',
                            cursor: (saving || maintenanceMessage === maintenance.message) ? 'not-allowed' : 'pointer',
                            opacity: (saving || maintenanceMessage === maintenance.message) ? 0.5 : 1
                        }}
                    >
                        <Save size={16} />
                        Save Message
                    </button>
                </div>
            </div>

            {/* API Rate Limits Card */}
            <div className="admin-stat-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f3f4f6' }}>
                    <Zap size={18} />
                    API Rate Limits
                </h3>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    marginBottom: '1rem'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.9rem', color: '#9ca3af' }}>Requests per Minute</label>
                        <input
                            type="number"
                            value={apiLimits.requests_per_minute || 60}
                            onChange={(e) => setApiLimits(prev => ({ ...prev, requests_per_minute: parseInt(e.target.value) }))}
                            style={{
                                padding: '0.75rem',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                backgroundColor: 'rgba(0,0,0,0.3)',
                                color: 'white',
                                fontSize: '1rem'
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.9rem', color: '#9ca3af' }}>Interviews per Day</label>
                        <input
                            type="number"
                            value={apiLimits.interviews_per_day || 10}
                            onChange={(e) => setApiLimits(prev => ({ ...prev, interviews_per_day: parseInt(e.target.value) }))}
                            style={{
                                padding: '0.75rem',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                backgroundColor: 'rgba(0,0,0,0.3)',
                                color: 'white',
                                fontSize: '1rem'
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.9rem', color: '#9ca3af' }}>AI Calls per Hour</label>
                        <input
                            type="number"
                            value={apiLimits.ai_calls_per_hour || 100}
                            onChange={(e) => setApiLimits(prev => ({ ...prev, ai_calls_per_hour: parseInt(e.target.value) }))}
                            style={{
                                padding: '0.75rem',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                backgroundColor: 'rgba(0,0,0,0.3)',
                                color: 'white',
                                fontSize: '1rem'
                            }}
                        />
                    </div>
                </div>

                <button
                    onClick={updateApiLimits}
                    disabled={saving}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.625rem 1.25rem',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                        fontWeight: '600',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.7 : 1
                    }}
                >
                    <Save size={16} />
                    Save Rate Limits
                </button>
            </div>

            <style>{`
                .settings-maintenance-panel .spin {
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

export default SettingsMaintenancePanel;

