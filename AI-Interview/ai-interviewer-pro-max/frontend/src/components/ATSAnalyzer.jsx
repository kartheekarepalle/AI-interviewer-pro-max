/**
 * ATSAnalyzer Component
 * 
 * Component for triggering ATS analysis on a resume.
 * Shows job role input and analyze button.
 */

import React, { useState, useEffect } from 'react';
import { atsApi } from '../services/api';
import ATSResult from './ATSResult';

function ATSAnalyzer({
    resume,
    onAnalysisComplete,
    initialResult = null
}) {
    // State
    const [targetRole, setTargetRole] = useState('');
    const [targetDescription, setTargetDescription] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState(initialResult);
    const [error, setError] = useState(null);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Reset result when resume changes (prevents stale ATS data)
    useEffect(() => {
        setResult(null);
        setTargetRole('');
        setError(null);
    }, [resume?.id]);

    // Handle role change - clear old results for different role
    const handleRoleChange = (newRole) => {
        if (newRole !== targetRole) {
            // Clear result to prevent showing old role's analysis
            setResult(null);
            setError(null);
        }
        setTargetRole(newRole);
    };

    /**
     * Trigger ATS analysis
     */
    const handleAnalyze = async () => {
        if (!targetRole.trim()) {
            setError('Please enter a target job role');
            return;
        }

        if (!resume?.id) {
            setError('No resume selected');
            return;
        }

        setAnalyzing(true);
        setError(null);

        try {
            const response = await atsApi.analyze(
                resume.id,
                targetRole.trim(),
                targetDescription.trim() || null
            );

            if (response.success && response.result) {
                setResult(response.result);
                if (onAnalysisComplete) {
                    onAnalysisComplete(response.result);
                }
            } else {
                throw new Error(response.message || 'Analysis failed');
            }
        } catch (err) {
            setError(err.message || 'Failed to analyze resume. Please try again.');
        } finally {
            setAnalyzing(false);
        }
    };

    // Common job roles for suggestions
    const suggestedRoles = [
        'Software Engineer',
        'Frontend Developer',
        'Backend Developer',
        'Full Stack Developer',
        'Data Scientist',
        'Product Manager',
        'DevOps Engineer',
        'UI/UX Designer',
    ];

    return (
        <div className="ats-analyzer">
            {/* Premium Header Section */}
            <div className="ats-header-section">
                <div className="ats-header-icon">
                    <span>📊</span>
                </div>
                <div className="ats-header-content">
                    <h2 className="ats-header-title">ATS Resume Analysis</h2>
                    <p className="ats-header-description">
                        Get AI-powered insights on how well your resume matches the target role
                    </p>
                </div>
            </div>

            {/* Analysis Form Card */}
            <div className="ats-form-card">
                <div className="ats-form-header">
                    <div className="form-step-badge">
                        <span className="step-number">1</span>
                        <span className="step-label">Configure Analysis</span>
                    </div>
                </div>

                {/* Target Role Input */}
                <div className="ats-form-group">
                    <label htmlFor="targetRole" className="ats-label">
                        <span className="label-icon">🎯</span>
                        Target Job Role
                    </label>
                    <input
                        type="text"
                        id="targetRole"
                        value={targetRole}
                        onChange={(e) => handleRoleChange(e.target.value)}
                        placeholder="e.g., Software Engineer, Product Manager"
                        disabled={analyzing}
                        className="ats-input"
                    />

                    {/* Quick Role Suggestions */}
                    <div className="ats-role-suggestions">
                        <span className="suggestions-label">Quick select:</span>
                        <div className="suggestions-grid">
                            {suggestedRoles.map((role) => (
                                <button
                                    key={role}
                                    type="button"
                                    className={`ats-suggestion-chip ${targetRole === role ? 'active' : ''}`}
                                    onClick={() => handleRoleChange(role)}
                                    disabled={analyzing}
                                >
                                    {role}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Advanced Options Toggle */}
                <button
                    type="button"
                    className="ats-toggle-advanced"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                >
                    <span className="toggle-icon">{showAdvanced ? '▼' : '▶'}</span>
                    <span>Advanced Options</span>
                </button>

                {/* Advanced Options Panel */}
                {showAdvanced && (
                    <div className="ats-advanced-panel">
                        <div className="ats-form-group">
                            <label htmlFor="targetDescription" className="ats-label">
                                <span className="label-icon">📋</span>
                                Job Description (Optional)
                            </label>
                            <textarea
                                id="targetDescription"
                                value={targetDescription}
                                onChange={(e) => setTargetDescription(e.target.value)}
                                placeholder="Paste the full job description for more accurate keyword matching and scoring..."
                                rows={5}
                                disabled={analyzing}
                                className="ats-textarea"
                            />
                            <p className="ats-form-hint">
                                💡 Adding a job description improves match accuracy by 40%
                            </p>
                        </div>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="ats-error-message">
                        <span className="error-icon">⚠️</span>
                        <span>{error}</span>
                    </div>
                )}

                {/* Analyze Button */}
                <button
                    type="button"
                    className="ats-analyze-button"
                    onClick={handleAnalyze}
                    disabled={analyzing || !resume}
                >
                    {analyzing ? (
                        <>
                            <span className="button-spinner"></span>
                            <span>Analyzing Resume...</span>
                        </>
                    ) : (
                        <>
                            <span className="button-icon">🔍</span>
                            <span>{result ? 'Re-Analyze Resume' : 'Analyze Resume'}</span>
                        </>
                    )}
                </button>

                {!resume && (
                    <div className="ats-no-resume-hint">
                        <span className="hint-icon">📄</span>
                        <span>Upload a resume first to enable analysis</span>
                    </div>
                )}
            </div>

            {/* Results Section */}
            {analyzing && (
                <div className="ats-results-section">
                    <ATSResult
                        result={null}
                        loading={true}
                        error={null}
                    />
                </div>
            )}

            {result && !analyzing && (
                <div className="ats-results-section">
                    <div className="results-header">
                        <div className="results-badge">
                            <span className="badge-icon">✅</span>
                            <span>Analysis Complete</span>
                        </div>
                    </div>
                    <ATSResult
                        result={result}
                        loading={false}
                        error={null}
                    />
                </div>
            )}

            {!result && !analyzing && resume && (
                <div className="ats-empty-state-card">
                    <div className="empty-state-illustration">
                        <span className="illustration-icon">📊</span>
                        <div className="illustration-lines">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                    <h3>Ready to Analyze</h3>
                    <p>Enter a target role and click analyze to check your resume's ATS compatibility score</p>
                    <ul className="feature-highlights">
                        <li>
                            <span className="feature-icon">✓</span>
                            Keyword matching analysis
                        </li>
                        <li>
                            <span className="feature-icon">✓</span>
                            Skills gap identification
                        </li>
                        <li>
                            <span className="feature-icon">✓</span>
                            Actionable recommendations
                        </li>
                    </ul>
                </div>
            )}
        </div>
    );
}

export default ATSAnalyzer;

