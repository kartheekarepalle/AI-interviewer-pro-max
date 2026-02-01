/**
 * Integrations Panel Component
 * 
 * Third-party integration management:
 * - View all integrations
 * - Configure API keys
 * - Enable/disable integrations
 * - Run health checks
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Link2, RefreshCw, Settings, Check, XCircle, AlertTriangle,
    Eye, EyeOff, Save, Power, Activity, Zap, Cloud, Mail, CreditCard,
    Bot, Brain, Server
} from 'lucide-react';
import { getToken } from '../../services/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Integration icons mapping
const getIntegrationIcon = (name) => {
    const icons = {
        gemini: Brain,
        groq: Bot,
        openai: Zap,
        aws_s3: Cloud,
        sendgrid: Mail,
        stripe: CreditCard
    };
    return icons[name] || Server;
};

// Status indicator
const StatusIndicator = ({ connected, enabled }) => {
    if (!enabled) {
        return (
            <span className="status-badge disabled">
                <Power size={12} /> Disabled
            </span>
        );
    }
    
    return connected ? (
        <span className="status-badge connected">
            <Check size={12} /> Connected
        </span>
    ) : (
        <span className="status-badge disconnected">
            <XCircle size={12} /> Not Connected
        </span>
    );
};

// Integration card component
const IntegrationCard = ({ integration, onUpdate, onHealthCheck }) => {
    const [editing, setEditing] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [showSecret, setShowSecret] = useState(false);
    const [saving, setSaving] = useState(false);
    const [checking, setChecking] = useState(false);
    const [healthResult, setHealthResult] = useState(null);

    const Icon = getIntegrationIcon(integration.name);

    const handleSave = async () => {
        setSaving(true);
        try {
            const updates = {
                is_enabled: integration.is_enabled
            };
            if (apiKey) updates.api_key = apiKey;
            if (apiSecret) updates.api_secret = apiSecret;

            await onUpdate(integration.id, updates);
            setEditing(false);
            setApiKey('');
            setApiSecret('');
        } catch (err) {
            console.error('Error saving:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async () => {
        setSaving(true);
        try {
            await onUpdate(integration.id, { is_enabled: !integration.is_enabled });
        } catch (err) {
            console.error('Error toggling:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleHealthCheck = async () => {
        setChecking(true);
        setHealthResult(null);
        try {
            const result = await onHealthCheck(integration.name);
            setHealthResult(result);
        } catch (err) {
            setHealthResult({ status: 'error', message: err.message });
        } finally {
            setChecking(false);
        }
    };

    return (
        <div className={`integration-card ${integration.is_enabled ? 'enabled' : 'disabled'}`}>
            <div className="integration-header">
                <div className="integration-icon">
                    <Icon size={32} />
                </div>
                <div className="integration-info">
                    <h3>{integration.display_name}</h3>
                    <p>{integration.description}</p>
                </div>
                <StatusIndicator 
                    connected={integration.is_configured} 
                    enabled={integration.is_enabled} 
                />
            </div>

            <div className="integration-details">
                <div className="detail-row">
                    <span className="label">API Key:</span>
                    <span className="value">
                        {integration.api_key_preview || 'Not configured'}
                    </span>
                </div>
                {integration.config && Object.keys(integration.config).length > 0 && (
                    <div className="detail-row">
                        <span className="label">Config:</span>
                        <span className="value">{JSON.stringify(integration.config)}</span>
                    </div>
                )}
            </div>

            {editing && (
                <div className="integration-edit-form">
                    <div className="form-row">
                        <label>API Key</label>
                        <div className="password-input">
                            <input
                                type={showKey ? 'text' : 'password'}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Enter new API key..."
                            />
                            <button 
                                className="toggle-visibility"
                                onClick={() => setShowKey(!showKey)}
                            >
                                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                    {integration.name !== 'gemini' && integration.name !== 'groq' && (
                        <div className="form-row">
                            <label>API Secret</label>
                            <div className="password-input">
                                <input
                                    type={showSecret ? 'text' : 'password'}
                                    value={apiSecret}
                                    onChange={(e) => setApiSecret(e.target.value)}
                                    placeholder="Enter API secret (if required)..."
                                />
                                <button 
                                    className="toggle-visibility"
                                    onClick={() => setShowSecret(!showSecret)}
                                >
                                    {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {healthResult && (
                <div className={`health-result ${healthResult.status}`}>
                    {healthResult.status === 'healthy' ? (
                        <Check size={16} />
                    ) : (
                        <AlertTriangle size={16} />
                    )}
                    <span>{healthResult.message || healthResult.status}</span>
                </div>
            )}

            <div className="integration-actions">
                <button 
                    className={`toggle-btn ${integration.is_enabled ? 'enabled' : ''}`}
                    onClick={handleToggle}
                    disabled={saving}
                >
                    <Power size={16} />
                    {integration.is_enabled ? 'Disable' : 'Enable'}
                </button>

                {editing ? (
                    <>
                        <button 
                            className="save-btn"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? <RefreshCw size={16} className="spinning" /> : <Save size={16} />}
                            Save
                        </button>
                        <button 
                            className="cancel-btn"
                            onClick={() => { setEditing(false); setApiKey(''); setApiSecret(''); }}
                        >
                            <XCircle size={16} />
                            Cancel
                        </button>
                    </>
                ) : (
                    <button 
                        className="edit-btn"
                        onClick={() => setEditing(true)}
                    >
                        <Settings size={16} />
                        Configure
                    </button>
                )}

                <button 
                    className="health-btn"
                    onClick={handleHealthCheck}
                    disabled={checking || !integration.is_enabled}
                >
                    {checking ? (
                        <RefreshCw size={16} className="spinning" />
                    ) : (
                        <Activity size={16} />
                    )}
                    Health Check
                </button>
            </div>
        </div>
    );
};

function IntegrationsPanel() {
    const [integrations, setIntegrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch integrations
    const fetchIntegrations = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = getToken();
            const response = await fetch(`${API_BASE}/api/admin/integrations`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to fetch integrations');

            const data = await response.json();
            if (data.success) {
                setIntegrations(data.integrations);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Update integration
    const updateIntegration = async (integrationId, updates) => {
        const token = getToken();
        const response = await fetch(`${API_BASE}/api/admin/integrations/${integrationId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updates)
        });

        if (!response.ok) throw new Error('Failed to update integration');

        fetchIntegrations();
    };

    // Health check
    const healthCheck = async (integrationName) => {
        const token = getToken();
        const response = await fetch(`${API_BASE}/api/admin/integrations/${integrationName}/health-check`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Health check failed');

        const data = await response.json();
        return data.health;
    };

    // Initial fetch
    useEffect(() => {
        fetchIntegrations();
    }, [fetchIntegrations]);

    if (loading) {
        return (
            <div className="admin-loading">
                <RefreshCw className="spinning" size={40} />
                <p>Loading integrations...</p>
            </div>
        );
    }

    return (
        <div className="integrations-panel">
            {/* Header */}
            <div className="panel-header">
                <div className="header-left">
                    <Link2 size={24} />
                    <h2>Third-Party Integrations</h2>
                </div>
                <div className="header-right">
                    <button className="refresh-btn" onClick={fetchIntegrations} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spinning' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="integrations-stats">
                <div className="stat">
                    <span className="stat-value">
                        {integrations.filter(i => i.is_enabled).length}
                    </span>
                    <span className="stat-label">Enabled</span>
                </div>
                <div className="stat">
                    <span className="stat-value">
                        {integrations.filter(i => i.is_configured).length}
                    </span>
                    <span className="stat-label">Configured</span>
                </div>
                <div className="stat">
                    <span className="stat-value">{integrations.length}</span>
                    <span className="stat-label">Total</span>
                </div>
            </div>

            {/* Integrations Grid */}
            <div className="integrations-grid">
                {integrations.map((integration) => (
                    <IntegrationCard
                        key={integration.id}
                        integration={integration}
                        onUpdate={updateIntegration}
                        onHealthCheck={healthCheck}
                    />
                ))}
            </div>

            {integrations.length === 0 && (
                <div className="empty-state">
                    <Link2 size={48} />
                    <p>No integrations configured</p>
                </div>
            )}
        </div>
    );
}

export default IntegrationsPanel;
