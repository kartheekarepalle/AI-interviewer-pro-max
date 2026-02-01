/**
 * Maintenance Page Component
 * 
 * Displayed to users when the system is in maintenance mode.
 * Features a beautiful, professional maintenance message.
 * Shows admin's custom disclaimer/message.
 */

import React, { useState, useEffect } from 'react';
import { Wrench, ArrowLeft, Clock, Mail, AlertTriangle, Shield } from 'lucide-react';
import './MaintenancePage.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function MaintenancePage({ message: initialMessage }) {
    const [message, setMessage] = useState(initialMessage || '');
    
    // Periodically check if maintenance is over
    useEffect(() => {
        const checkMaintenance = async () => {
            try {
                const response = await fetch(`${API_BASE}/api/public/maintenance-status`);
                if (response.ok) {
                    const data = await response.json();
                    if (!data.maintenance_mode) {
                        // Maintenance is over, reload the page
                        window.location.reload();
                    } else if (data.message) {
                        setMessage(data.message);
                    }
                }
            } catch (err) {
                console.log('Maintenance check failed:', err);
            }
        };
        
        // Check every 30 seconds
        const interval = setInterval(checkMaintenance, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleGoBack = () => {
        // Clear all auth tokens and redirect to login
        localStorage.removeItem('ai_interviewer_token');
        localStorage.removeItem('ai_interviewer_user');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    };

    return (
        <div className="maintenance-page">
            <div className="maintenance-container">
                {/* Animated Background Elements */}
                <div className="floating-elements">
                    <div className="float-element e1"></div>
                    <div className="float-element e2"></div>
                    <div className="float-element e3"></div>
                </div>

                {/* Main Content */}
                <div className="maintenance-content">
                    <div className="maintenance-icon">
                        <Wrench size={64} />
                        <div className="icon-ring"></div>
                    </div>

                    <h1>🚧 Maintenance Mode</h1>
                    <h2 className="maintenance-admin-message">
                        {message || "System is under maintenance. Please check back later."}
                    </h2>
                    
                    <p className="maintenance-subtitle">
                        We're performing scheduled maintenance to improve your experience
                    </p>

                    {/* Admin Message Box */}
                    <div className="maintenance-message-box">
                        <div className="message-header">
                            <AlertTriangle size={18} />
                            <span>Administrator Notice</span>
                        </div>
                        <p className="admin-message">
                            {message || "We're currently performing system maintenance. Please check back shortly. We apologize for any inconvenience."}
                        </p>
                    </div>

                    <div className="maintenance-info">
                        <div className="info-item">
                            <Clock size={18} />
                            <span>Please check back periodically</span>
                        </div>
                        <div className="info-item">
                            <Shield size={18} />
                            <span>Your data is safe during maintenance</span>
                        </div>
                    </div>

                    <div className="maintenance-actions">
                        <button 
                            className="refresh-btn"
                            onClick={handleGoBack}
                        >
                            <ArrowLeft size={18} />
                            <span>Go Back</span>
                        </button>
                    </div>

                    <div className="maintenance-footer">
                        <p>Thank you for your patience!</p>
                        <p className="contact">
                            <Mail size={14} />
                            <span>Questions? Contact support@aiinterviewer.com</span>
                        </p>
                    </div>

                    {/* Auto-check indicator */}
                    <div className="auto-check-indicator">
                        <div className="pulse-dot"></div>
                        <span>Auto-checking every 30 seconds</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MaintenancePage;
