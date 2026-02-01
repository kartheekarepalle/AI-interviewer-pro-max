/**
 * InterviewPlanPreview Component
 * 
 * Displays a preview of the interview plan including:
 * - Question breakdown by category
 * - Estimated duration
 * - Focus areas
 * - Start Interview button
 */

import React from 'react';

function InterviewPlanPreview({
    plan,
    loading = false,
    onStartInterview,
    onRegenerate,
}) {
    // Loading state
    if (loading) {
        return (
            <div className="plan-preview loading">
                <div className="plan-loading">
                    <div className="spinner"></div>
                    <p>Generating your personalized interview plan...</p>
                    <p className="loading-hint">This may take a few seconds</p>
                </div>
            </div>
        );
    }

    // No plan state
    if (!plan) {
        return null;
    }

    /**
     * Get difficulty badge class
     */
    const getDifficultyClass = (level) => {
        switch (level?.toLowerCase()) {
            case 'easy': return 'difficulty-easy';
            case 'medium': return 'difficulty-medium';
            case 'hard': return 'difficulty-hard';
            case 'expert': return 'difficulty-expert';
            default: return 'difficulty-medium';
        }
    };

    /**
     * Get category icon
     */
    const getCategoryIcon = (category) => {
        switch (category?.toLowerCase()) {
            case 'dsa': return '🧮';
            case 'technical': return '💻';
            case 'behavioral': return '🤝';
            case 'hr': return '👔';
            case 'situational': return '🎯';
            default: return '❓';
        }
    };

    /**
     * Format duration
     */
    const formatDuration = (minutes) => {
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours > 1 ? 's' : ''}`;
    };

    return (
        <div className="plan-preview">
            {/* Header */}
            <div className="plan-header">
                <div className="plan-title">
                    <h3>📋 Interview Plan Ready</h3>
                    <span className={`difficulty-badge ${getDifficultyClass(plan.difficulty_level)}`}>
                        {plan.difficulty_level}
                    </span>
                </div>
                <p className="plan-role">For: <strong>{plan.target_role}</strong></p>
                {plan.generation_source === 'mock' && (
                    <span className="mock-badge">Demo Mode</span>
                )}
            </div>

            {/* Quick Stats */}
            <div className="plan-stats">
                <div className="stat-item">
                    <span className="stat-icon">📝</span>
                    <span className="stat-value">{plan.total_questions}</span>
                    <span className="stat-label">Questions</span>
                </div>
                <div className="stat-item">
                    <span className="stat-icon">⏱️</span>
                    <span className="stat-value">{formatDuration(plan.total_questions * 3)}</span>
                    <span className="stat-label">Duration</span>
                </div>
            </div>

            {/* Question Breakdown */}
            <div className="plan-section">
                <h4>Question Breakdown</h4>
                <div className="breakdown-grid">
                    {plan.breakdown && Object.entries(plan.breakdown).map(([category, count]) => (
                        count > 0 && (
                            <div key={category} className="breakdown-item">
                                <span className="category-icon">{getCategoryIcon(category)}</span>
                                <div className="category-info">
                                    <span className="category-name">{category.charAt(0).toUpperCase() + category.slice(1)}</span>
                                    <span className="category-count">{count} question{count > 1 ? 's' : ''}</span>
                                </div>
                            </div>
                        )
                    ))}
                </div>
            </div>

            {/* Focus Areas */}
            {(plan.strength_focus_areas?.length > 0 || plan.weakness_focus_areas?.length > 0) && (
                <div className="plan-section">
                    <h4>Focus Areas</h4>
                    <div className="focus-areas">
                        {plan.strength_focus_areas?.slice(0, 2).map((area, idx) => (
                            <div key={idx} className="focus-item strength">
                                <span className="focus-icon">💪</span>
                                <span className="focus-text">{area.area}</span>
                            </div>
                        ))}
                        {plan.weakness_focus_areas?.slice(0, 2).map((area, idx) => (
                            <div key={idx} className="focus-item weakness">
                                <span className="focus-icon">🎯</span>
                                <span className="focus-text">{area.area}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Skills to Test */}
            {plan.skills_to_test?.length > 0 && (
                <div className="plan-section">
                    <h4>Skills to Be Tested</h4>
                    <div className="skills-list">
                        {plan.skills_to_test.slice(0, 8).map((skill, idx) => (
                            <span key={idx} className="skill-tag">{skill}</span>
                        ))}
                        {plan.skills_to_test.length > 8 && (
                            <span className="skill-tag more">+{plan.skills_to_test.length - 8} more</span>
                        )}
                    </div>
                </div>
            )}

            {/* Summary */}
            {plan.summary && (
                <div className="plan-summary">
                    <p>{plan.summary}</p>
                </div>
            )}

            {/* Actions */}
            <div className="plan-actions">
                <button
                    className="btn-primary start-button"
                    onClick={onStartInterview}
                    disabled={plan.status === 'used'}
                >
                    🎯 Start Interview
                </button>

                {onRegenerate && (
                    <button
                        className="btn-secondary"
                        onClick={onRegenerate}
                    >
                        🔄 Generate New Plan
                    </button>
                )}
            </div>

            {plan.is_used && (
                <p className="plan-used-notice">
                    This plan has already been used for an interview.
                </p>
            )}
        </div>
    );
}

export default InterviewPlanPreview;
