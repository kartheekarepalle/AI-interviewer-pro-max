/**
 * Bug Report Button Component
 * 
 * A floating button that users can click to submit bug reports.
 * Only visible on user pages (not admin or interview pages).
 */

import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bug, X, Send, Loader2, CheckCircle } from 'lucide-react';
import { getToken, getStoredUser } from '../../services/api';
import './BugReportButton.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function BugReportButton() {
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState(null);
    
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'general',
        severity: 'medium'
    });

    // Check if we should show the bug report button
    const shouldShowButton = () => {
        const path = location.pathname;
        const user = getStoredUser();
        
        // Hide on admin pages
        if (path.startsWith('/admin')) return false;
        
        // Hide during live interview
        if (path.startsWith('/interview/') && path.includes('/live')) return false;
        if (path.startsWith('/live-interview')) return false;
        
        // Hide on landing/auth pages (no user logged in)
        if (!user && (path === '/' || path === '/login' || path === '/signup')) return false;
        
        // Show on all other user pages
        return true;
    };

    // Don't render if should not show
    if (!shouldShowButton()) {
        return null;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            const token = getToken();
            const response = await fetch(`${API_BASE}/api/public/bug-report`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...formData,
                    page_url: window.location.href,
                    browser_info: navigator.userAgent
                })
            });

            if (!response.ok) {
                throw new Error('Failed to submit bug report');
            }

            setSubmitted(true);
            setFormData({
                title: '',
                description: '',
                category: 'general',
                severity: 'medium'
            });

            // Reset after 3 seconds
            setTimeout(() => {
                setSubmitted(false);
                setIsOpen(false);
            }, 3000);
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleChange = (e) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    return (
        <>
            {/* Floating Button */}
            <button 
                className="bug-report-float-btn"
                onClick={() => setIsOpen(true)}
                title="Report a Bug"
            >
                <Bug size={24} />
            </button>

            {/* Modal */}
            {isOpen && (
                <div className="bug-report-overlay" onClick={() => setIsOpen(false)}>
                    <div className="bug-report-modal" onClick={e => e.stopPropagation()}>
                        <div className="bug-report-header">
                            <h3><Bug size={20} /> Report a Bug</h3>
                            <button className="close-btn" onClick={() => setIsOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        {submitted ? (
                            <div className="bug-report-success">
                                <CheckCircle size={48} />
                                <h4>Thank you!</h4>
                                <p>Your bug report has been submitted successfully.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="bug-report-form">
                                <div className="form-group">
                                    <label htmlFor="title">Title *</label>
                                    <input
                                        type="text"
                                        id="title"
                                        name="title"
                                        value={formData.title}
                                        onChange={handleChange}
                                        placeholder="Brief description of the issue"
                                        required
                                    />
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="category">Category</label>
                                        <select
                                            id="category"
                                            name="category"
                                            value={formData.category}
                                            onChange={handleChange}
                                        >
                                            <option value="general">General</option>
                                            <option value="ui">User Interface</option>
                                            <option value="interview">Interview</option>
                                            <option value="resume">Resume</option>
                                            <option value="auth">Authentication</option>
                                            <option value="performance">Performance</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="severity">Severity</label>
                                        <select
                                            id="severity"
                                            name="severity"
                                            value={formData.severity}
                                            onChange={handleChange}
                                        >
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                            <option value="critical">Critical</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="description">Description *</label>
                                    <textarea
                                        id="description"
                                        name="description"
                                        value={formData.description}
                                        onChange={handleChange}
                                        placeholder="Please describe the issue in detail. Include steps to reproduce if possible."
                                        rows={5}
                                        required
                                    />
                                </div>

                                {error && (
                                    <div className="bug-report-error">
                                        {error}
                                    </div>
                                )}

                                <div className="form-actions">
                                    <button 
                                        type="button" 
                                        className="cancel-btn"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="submit-btn"
                                        disabled={submitting}
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 size={16} className="spinning" />
                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                <Send size={16} />
                                                Submit Report
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

export default BugReportButton;
