/**
 * API Key Management Panel Component
 * 
 * Real-time API key management for:
 * - Google Gemini API
 * - Groq API
 * 
 * Features:
 * - View current API key status
 * - Update API keys
 * - Test API key validity
 * - Revert to .env values
 * - Lock screen protection with passcode "admindelta"
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Key, Shield, Eye, EyeOff, Save, RefreshCw, CheckCircle,
    XCircle, AlertTriangle, Trash2, TestTube, Loader, Database,
    FileText, Lock, Unlock, ShieldAlert
} from 'lucide-react';
import { getToken } from '../../services/api';

// Lock Screen Component - Requires passcode "admindelta" to access API keys
const APIKeyLockScreen = ({ onUnlock }) => {
    const [passcode, setPasscode] = useState('');
    const [error, setError] = useState('');
    const [attempts, setAttempts] = useState(0);
    const [isLocked, setIsLocked] = useState(false);

    const CORRECT_PASSCODE = 'admindelta';
    const MAX_ATTEMPTS = 5;

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (isLocked) {
            setError('Too many attempts. Please wait 30 seconds.');
            return;
        }

        if (passcode === CORRECT_PASSCODE) {
            // Store unlock status in session (resets on browser close)
            sessionStorage.setItem('api_keys_unlocked', 'true');
            onUnlock();
        } else {
            const newAttempts = attempts + 1;
            setAttempts(newAttempts);
            setError(`Invalid passcode. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`);
            setPasscode('');
            
            if (newAttempts >= MAX_ATTEMPTS) {
                setIsLocked(true);
                setTimeout(() => {
                    setIsLocked(false);
                    setAttempts(0);
                    setError('');
                }, 30000); // 30 second lockout
            }
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            padding: '2rem'
        }}>
            <div style={{
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                borderRadius: '16px',
                padding: '3rem',
                maxWidth: '400px',
                width: '100%',
                textAlign: 'center',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)'
            }}>
                {/* Lock Icon */}
                <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem',
                    boxShadow: '0 10px 30px rgba(102, 126, 234, 0.4)'
                }}>
                    <ShieldAlert size={40} color="white" />
                </div>

                <h2 style={{ 
                    margin: '0 0 0.5rem', 
                    color: '#f3f4f6',
                    fontSize: '1.5rem'
                }}>
                    🔐 Protected Area
                </h2>
                
                <p style={{ 
                    color: '#9ca3af', 
                    marginBottom: '2rem',
                    fontSize: '0.9rem'
                }}>
                    API Key Management requires admin verification.
                    <br />
                    Enter the security passcode to continue.
                </p>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <input
                            type="password"
                            value={passcode}
                            onChange={(e) => {
                                setPasscode(e.target.value);
                                setError('');
                            }}
                            placeholder="Enter passcode..."
                            disabled={isLocked}
                            autoFocus
                            style={{
                                width: '100%',
                                padding: '1rem',
                                fontSize: '1rem',
                                borderRadius: '10px',
                                border: error ? '2px solid #ef4444' : '2px solid rgba(255,255,255,0.1)',
                                backgroundColor: 'rgba(0,0,0,0.3)',
                                color: 'white',
                                textAlign: 'center',
                                letterSpacing: '0.2em',
                                transition: 'all 0.2s'
                            }}
                        />
                    </div>

                    {error && (
                        <div style={{
                            color: '#ef4444',
                            fontSize: '0.85rem',
                            marginBottom: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem'
                        }}>
                            <AlertTriangle size={16} />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={!passcode || isLocked}
                        style={{
                            width: '100%',
                            padding: '1rem',
                            fontSize: '1rem',
                            fontWeight: '600',
                            borderRadius: '10px',
                            border: 'none',
                            background: (!passcode || isLocked) 
                                ? 'rgba(255,255,255,0.1)' 
                                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            cursor: (!passcode || isLocked) ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Unlock size={18} />
                        {isLocked ? 'Locked - Please Wait' : 'Unlock Access'}
                    </button>
                </form>

                <p style={{
                    color: '#6b7280',
                    fontSize: '0.75rem',
                    marginTop: '1.5rem'
                }}>
                    🛡️ This security measure protects sensitive API credentials
                </p>
            </div>
        </div>
    );
};

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Status Badge Component
const StatusBadge = ({ status, source }) => {
    const getConfig = () => {
        if (status) {
            return {
                icon: CheckCircle,
                color: '#10b981',
                bgColor: 'rgba(16, 185, 129, 0.1)',
                label: 'Configured'
            };
        }
        return {
            icon: XCircle,
            color: '#ef4444',
            bgColor: 'rgba(239, 68, 68, 0.1)',
            label: 'Not Configured'
        };
    };

    const { icon: Icon, color, bgColor, label } = getConfig();

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.25rem 0.75rem',
            backgroundColor: bgColor,
            borderRadius: '20px',
            fontSize: '0.8rem'
        }}>
            <Icon size={14} color={color} />
            <span style={{ color }}>{label}</span>
            {source && (
                <span style={{
                    fontSize: '0.7rem',
                    color: '#6b7280',
                    marginLeft: '0.25rem'
                }}>
                    ({source})
                </span>
            )}
        </div>
    );
};

// Source Badge
const SourceBadge = ({ source }) => {
    const getConfig = () => {
        switch (source) {
            case 'database':
                return { icon: Database, color: '#8b5cf6', label: 'Database Override' };
            case 'env':
                return { icon: FileText, color: '#3b82f6', label: '.env File' };
            default:
                return { icon: AlertTriangle, color: '#f59e0b', label: 'Not Set' };
        }
    };

    const { icon: Icon, color, label } = getConfig();

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontSize: '0.75rem',
            color
        }}>
            <Icon size={12} />
            <span>{label}</span>
        </div>
    );
};

// API Key Card Component
const APIKeyCard = ({
    provider,
    providerName,
    providerIcon,
    keyInfo,
    onUpdate,
    onTest,
    onRemoveOverride,
    testResult,
    isTesting,
    isSaving
}) => {
    const [showKey, setShowKey] = useState(false);
    const [newKey, setNewKey] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    const handleSave = () => {
        if (newKey.trim()) {
            onUpdate(provider, newKey.trim());
            setNewKey('');
            setIsEditing(false);
        }
    };

    const handleCancel = () => {
        setNewKey('');
        setIsEditing(false);
    };

    return (
        <div className="admin-stat-card" style={{
            padding: '1.5rem',
            marginBottom: '1rem',
            border: keyInfo?.configured ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '1rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        {providerIcon}
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{providerName}</h3>
                        <SourceBadge source={keyInfo?.source} />
                    </div>
                </div>
                <StatusBadge status={keyInfo?.configured} source={keyInfo?.source} />
            </div>

            {/* Current Key Display */}
            {keyInfo?.configured && (
                <div style={{
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Lock size={14} color="#6b7280" />
                        <code style={{
                            fontFamily: 'monospace',
                            fontSize: '0.9rem',
                            color: '#a78bfa'
                        }}>
                            {showKey ? keyInfo.masked_key : '•'.repeat(Math.min(keyInfo.key_length || 20, 30))}
                        </code>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            ({keyInfo.key_length} chars)
                        </span>
                    </div>
                    <button
                        onClick={() => setShowKey(!showKey)}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0.25rem'
                        }}
                        title={showKey ? 'Hide key' : 'Show masked key'}
                    >
                        {showKey ? <EyeOff size={16} color="#6b7280" /> : <Eye size={16} color="#6b7280" />}
                    </button>
                </div>
            )}

            {/* Edit/Update Section */}
            {isEditing ? (
                <div style={{ marginBottom: '1rem' }}>
                    <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        marginBottom: '0.5rem'
                    }}>
                        <input
                            type="password"
                            value={newKey}
                            onChange={(e) => setNewKey(e.target.value)}
                            placeholder={`Enter new ${providerName} API key...`}
                            style={{
                                flex: 1,
                                padding: '0.75rem',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                backgroundColor: 'rgba(0,0,0,0.3)',
                                color: 'white',
                                fontFamily: 'monospace'
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={handleSave}
                            disabled={!newKey.trim() || isSaving}
                            className="btn-primary"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem 1rem',
                                opacity: !newKey.trim() || isSaving ? 0.5 : 1
                            }}
                        >
                            {isSaving ? <Loader size={14} className="spin" /> : <Save size={14} />}
                            Save Key
                        </button>
                        <button
                            onClick={handleCancel}
                            className="btn-secondary"
                            style={{
                                padding: '0.5rem 1rem'
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    marginBottom: '1rem'
                }}>
                    <button
                        onClick={() => setIsEditing(true)}
                        className="btn-primary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 1rem'
                        }}
                    >
                        <Key size={14} />
                        {keyInfo?.configured ? 'Update Key' : 'Add Key'}
                    </button>

                    {keyInfo?.configured && (
                        <>
                            <button
                                onClick={() => onTest(provider)}
                                disabled={isTesting}
                                className="btn-secondary"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.5rem 1rem',
                                    opacity: isTesting ? 0.5 : 1
                                }}
                            >
                                {isTesting ? <Loader size={14} className="spin" /> : <TestTube size={14} />}
                                Test Key
                            </button>

                            {keyInfo?.source === 'database' && (
                                <button
                                    onClick={() => onRemoveOverride(provider)}
                                    className="btn-danger"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.5rem 1rem',
                                        backgroundColor: 'rgba(239, 68, 68, 0.2)',
                                        color: '#ef4444'
                                    }}
                                    title="Remove database override and revert to .env value"
                                >
                                    <Trash2 size={14} />
                                    Revert to .env
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Test Result */}
            {testResult && (
                <div style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    backgroundColor: testResult.valid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${testResult.valid ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    marginTop: '0.5rem'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.25rem'
                    }}>
                        {testResult.valid ? (
                            <CheckCircle size={16} color="#10b981" />
                        ) : (
                            <XCircle size={16} color="#ef4444" />
                        )}
                        <span style={{
                            fontWeight: '600',
                            color: testResult.valid ? '#10b981' : '#ef4444'
                        }}>
                            {testResult.valid ? 'API Key Valid' : 'API Key Invalid'}
                        </span>
                    </div>
                    <p style={{
                        margin: 0,
                        fontSize: '0.85rem',
                        color: '#9ca3af'
                    }}>
                        {testResult.message}
                    </p>
                    {testResult.test_response && (
                        <p style={{
                            margin: '0.5rem 0 0',
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            fontStyle: 'italic'
                        }}>
                            Response: "{testResult.test_response}"
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

// Main Component
function APIKeyManagementPanel() {
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [apiKeys, setApiKeys] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [testResults, setTestResults] = useState({});
    const [isTesting, setIsTesting] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState(null);

    // Check if already unlocked from session
    useEffect(() => {
        const unlocked = sessionStorage.getItem('api_keys_unlocked') === 'true';
        setIsUnlocked(unlocked);
    }, []);

    // Handle lock screen unlock
    const handleUnlock = () => {
        setIsUnlocked(true);
    };

    // Lock the panel (for manual re-lock)
    const handleLock = () => {
        sessionStorage.removeItem('api_keys_unlocked');
        setIsUnlocked(false);
    };

    // Fetch API keys status
    const fetchAPIKeys = useCallback(async () => {
        if (!isUnlocked) return;
        
        setLoading(true);
        setError(null);
        try {
            const token = getToken();
            if (!token) {
                throw new Error('No authentication token found');
            }

            const response = await fetch(`${API_BASE}/api/admin/api-keys`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch API keys`);
            }

            const data = await response.json();
            console.log('API Keys Response:', data); // Debug log

            if (data.success && data.api_keys) {
                setApiKeys(data.api_keys);
            } else {
                // If no api_keys in response, set default empty state
                setApiKeys({
                    gemini: { configured: false, source: 'none', masked_key: '', key_length: 0 },
                    groq: { configured: false, source: 'none', masked_key: '', key_length: 0 }
                });
            }
        } catch (err) {
            console.error('API Keys fetch error:', err);
            setError(err.message);
            // Set fallback state on error
            setApiKeys({
                gemini: { configured: false, source: 'none', masked_key: '', key_length: 0 },
                groq: { configured: false, source: 'none', masked_key: '', key_length: 0 }
            });
        } finally {
            setLoading(false);
        }
    }, [isUnlocked]);

    // Update API key
    const handleUpdateKey = async (provider, key) => {
        setIsSaving(true);
        setMessage(null);

        try {
            const token = getToken();
            const body = {};
            body[`${provider}_api_key`] = key;

            const response = await fetch(`${API_BASE}/api/admin/api-keys`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (data.success) {
                setMessage({ type: 'success', text: `${provider.toUpperCase()} API key updated successfully!` });
                fetchAPIKeys();
                // Clear previous test result
                setTestResults(prev => ({ ...prev, [provider]: null }));
            } else {
                throw new Error(data.detail || 'Failed to update API key');
            }
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setIsSaving(false);
        }
    };

    // Test API keys
    const handleTestKey = async (provider) => {
        setIsTesting(prev => ({ ...prev, [provider]: true }));
        setTestResults(prev => ({ ...prev, [provider]: null }));

        try {
            const token = getToken();
            const response = await fetch(`${API_BASE}/api/admin/api-keys/test`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success && data.results) {
                setTestResults(prev => ({
                    ...prev,
                    [provider]: data.results[provider]
                }));
            }
        } catch (err) {
            setTestResults(prev => ({
                ...prev,
                [provider]: { valid: false, message: err.message }
            }));
        } finally {
            setIsTesting(prev => ({ ...prev, [provider]: false }));
        }
    };

    // Test all keys
    const handleTestAllKeys = async () => {
        setIsTesting({ gemini: true, groq: true });
        setTestResults({});

        try {
            const token = getToken();
            const response = await fetch(`${API_BASE}/api/admin/api-keys/test`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success && data.results) {
                setTestResults(data.results);
            }
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setIsTesting({});
        }
    };

    // Remove override
    const handleRemoveOverride = async (provider) => {
        if (!confirm(`Remove database override for ${provider.toUpperCase()}? This will revert to the .env file value.`)) {
            return;
        }

        try {
            const token = getToken();
            const response = await fetch(`${API_BASE}/api/admin/api-keys/${provider}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                fetchAPIKeys();
                setTestResults(prev => ({ ...prev, [provider]: null }));
            } else {
                throw new Error(data.detail || 'Failed to remove override');
            }
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        }
    };

    useEffect(() => {
        fetchAPIKeys();
    }, [fetchAPIKeys]);

    // Auto-clear messages
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    // Show lock screen if not unlocked
    if (!isUnlocked) {
        return <APIKeyLockScreen onUnlock={handleUnlock} />;
    }

    if (loading) {
        return (
            <div className="admin-loading">
                <Loader size={40} className="spin" />
                <p>Loading API configuration...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="admin-error">
                <AlertTriangle size={40} />
                <p>Error: {error}</p>
                <button onClick={fetchAPIKeys} className="btn-primary">
                    <RefreshCw size={16} /> Retry
                </button>
            </div>
        );
    }

    return (
        <div className="api-key-management-panel">
            {/* Header */}
            <div className="panel-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem'
            }}>
                <div>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Shield size={24} />
                        API Key Management
                    </h2>
                    <p style={{ margin: '0.5rem 0 0', color: '#9ca3af', fontSize: '0.9rem' }}>
                        Manage your AI provider API keys. Database values override .env file settings.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={handleLock}
                        className="btn-secondary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.6rem 1.25rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            borderColor: 'rgba(239, 68, 68, 0.3)',
                            color: '#ef4444'
                        }}
                        title="Lock API Keys panel"
                    >
                        <Lock size={16} />
                        Lock
                    </button>
                    <button
                        onClick={handleTestAllKeys}
                        disabled={isTesting.gemini || isTesting.groq || (!apiKeys?.gemini?.configured && !apiKeys?.groq?.configured)}
                        className="btn-primary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.6rem 1.25rem',
                            opacity: (isTesting.gemini || isTesting.groq || (!apiKeys?.gemini?.configured && !apiKeys?.groq?.configured)) ? 0.5 : 1,
                            cursor: (!apiKeys?.gemini?.configured && !apiKeys?.groq?.configured) ? 'not-allowed' : 'pointer'
                        }}
                        title={(!apiKeys?.gemini?.configured && !apiKeys?.groq?.configured) ? 'Add API keys first to enable testing' : 'Test all configured API keys'}
                    >
                        {(isTesting.gemini || isTesting.groq) ? (
                            <Loader size={16} className="spin" />
                        ) : (
                            <TestTube size={16} />
                        )}
                        Test All Keys
                    </button>
                    <button
                        onClick={fetchAPIKeys}
                        className="btn-secondary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.6rem 1.25rem'
                        }}
                    >
                        <RefreshCw size={16} />
                        Refresh
                    </button>
                </div>
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
                    gap: '0.5rem'
                }}>
                    {message.type === 'success' ? (
                        <CheckCircle size={16} color="#10b981" />
                    ) : (
                        <XCircle size={16} color="#ef4444" />
                    )}
                    <span style={{ color: message.type === 'success' ? '#10b981' : '#ef4444' }}>
                        {message.text}
                    </span>
                </div>
            )}

            {/* Info Box */}
            <div style={{
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.5rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <Shield size={20} color="#3b82f6" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                        <h4 style={{ margin: '0 0 0.5rem', color: '#3b82f6' }}>How API Key Management Works</h4>
                        <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#9ca3af', fontSize: '0.85rem' }}>
                            <li><strong>.env File:</strong> Default source for API keys (set during deployment)</li>
                            <li><strong>Database Override:</strong> Keys set here override .env values instantly</li>
                            <li><strong>Real-time:</strong> Changes take effect immediately without server restart</li>
                            <li><strong>Security:</strong> Keys are masked and stored securely</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Warning when no keys configured */}
            {apiKeys && !apiKeys?.gemini?.configured && !apiKeys?.groq?.configured && (
                <div style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem'
                }}>
                    <AlertTriangle size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                        <h4 style={{ margin: '0 0 0.5rem', color: '#f59e0b' }}>No API Keys Configured</h4>
                        <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.85rem' }}>
                            Your AI features won't work until you add at least one API key. Click "Add Key" below to get started.
                        </p>
                    </div>
                </div>
            )}

            {/* API Key Cards */}
            <div className="api-keys-grid">
                <APIKeyCard
                    provider="gemini"
                    providerName="Google Gemini"
                    providerIcon={<span style={{ fontSize: '1.5rem' }}>✨</span>}
                    keyInfo={apiKeys?.gemini}
                    onUpdate={handleUpdateKey}
                    onTest={handleTestKey}
                    onRemoveOverride={handleRemoveOverride}
                    testResult={testResults.gemini}
                    isTesting={isTesting.gemini}
                    isSaving={isSaving}
                />

                <APIKeyCard
                    provider="groq"
                    providerName="Groq"
                    providerIcon={<span style={{ fontSize: '1.5rem' }}>⚡</span>}
                    keyInfo={apiKeys?.groq}
                    onUpdate={handleUpdateKey}
                    onTest={handleTestKey}
                    onRemoveOverride={handleRemoveOverride}
                    testResult={testResults.groq}
                    isTesting={isTesting.groq}
                    isSaving={isSaving}
                />
            </div>

            {/* Usage Instructions */}
            <div style={{
                marginTop: '2rem',
                padding: '1rem',
                backgroundColor: 'rgba(0,0,0,0.2)',
                borderRadius: '8px'
            }}>
                <h4 style={{ margin: '0 0 0.75rem', color: '#f3f4f6' }}>Quick Reference</h4>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '1rem',
                    fontSize: '0.85rem',
                    color: '#9ca3af'
                }}>
                    <div>
                        <strong style={{ color: '#a78bfa' }}>Gemini API Key</strong>
                        <p style={{ margin: '0.25rem 0 0' }}>
                            Get from: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>Google AI Studio</a>
                        </p>
                        <p style={{ margin: '0.25rem 0 0' }}>Used for: Interview plans, Resume analysis, Reports</p>
                    </div>
                    <div>
                        <strong style={{ color: '#a78bfa' }}>Groq API Key</strong>
                        <p style={{ margin: '0.25rem 0 0' }}>
                            Get from: <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>Groq Console</a>
                        </p>
                        <p style={{ margin: '0.25rem 0 0' }}>Used for: Live interviews, Real-time responses</p>
                    </div>
                </div>
            </div>

            <style>{`
                .api-key-management-panel .spin {
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                
                .api-key-management-panel .btn-primary {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                
                .api-key-management-panel .btn-primary:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                }
                
                .api-key-management-panel .btn-secondary {
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                
                .api-key-management-panel .btn-secondary:hover:not(:disabled) {
                    background: rgba(255, 255, 255, 0.15);
                }
                
                .api-key-management-panel .btn-danger:hover {
                    background-color: rgba(239, 68, 68, 0.3) !important;
                }
                
                .api-key-management-panel input:focus {
                    outline: none;
                    border-color: #667eea;
                    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
                }
            `}</style>
        </div>
    );
}

export default APIKeyManagementPanel;
