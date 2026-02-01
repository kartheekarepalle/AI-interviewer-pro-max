/**
 * ATSResult Component
 * 
 * Displays ATS analysis results with:
 * - Overall score gauge
 * - Score breakdown
 * - Strengths and weaknesses
 * - Recommendations
 * 
 * Per requirements:
 * - Clean, readable UI
 * - Frontend handles loading & error states
 */

import React from 'react';

function ATSResult({ result, loading = false, error = null }) {
    // Loading state
    if (loading) {
        return (
            <div className="ats-result loading">
                <div className="ats-loading">
                    <div className="spinner"></div>
                    <p>Analyzing your resume...</p>
                    <p className="loading-hint">This may take a few seconds</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="ats-result error">
                <div className="ats-error">
                    <span className="error-icon">⚠️</span>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    // No result state
    if (!result) {
        return null;
    }

    /**
     * Get score color based on value
     */
    const getScoreColor = (score) => {
        if (score >= 80) return 'excellent';
        if (score >= 60) return 'good';
        if (score >= 40) return 'moderate';
        return 'poor';
    };

    /**
     * Get score label based on value
     */
    const getScoreLabel = (score) => {
        if (score >= 85) return 'Excellent';
        if (score >= 70) return 'Good';
        if (score >= 55) return 'Moderate';
        if (score >= 40) return 'Needs Work';
        return 'Low';
    };

    /**
     * Get impact badge color
     */
    const getImpactColor = (impact) => {
        switch (impact?.toLowerCase()) {
            case 'high': return 'impact-high';
            case 'medium': return 'impact-medium';
            case 'low': return 'impact-low';
            default: return 'impact-medium';
        }
    };

    return (
        <div className="ats-result">
            {/* Header with overall score */}
            <div className="ats-header">
                <div className="ats-score-container">
                    <div className={`ats-score-circle ${getScoreColor(result.overall_score)}`}>
                        <span className="score-value">{result.overall_score}</span>
                        <span className="score-label">ATS Score</span>
                    </div>
                    <div className="ats-score-info">
                        <h3>{getScoreLabel(result.overall_score)}</h3>
                        <p className="target-role">For: {result.target_role}</p>
                        {result.analysis_source === 'mock' && (
                            <span className="mock-badge">Demo Mode</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Summary */}
            {result.summary && (
                <div className="ats-summary">
                    <p>{result.summary}</p>
                </div>
            )}

            {/* Score Breakdown */}
            <div className="ats-section">
                <h4>📊 Score Breakdown</h4>
                <div className="score-breakdown">
                    {Object.entries(result.breakdown || {}).map(([key, value]) => (
                        <div key={key} className="breakdown-item">
                            <div className="breakdown-label">
                                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </div>
                            <div className="breakdown-bar-container">
                                <div
                                    className={`breakdown-bar ${getScoreColor(value)}`}
                                    style={{ width: `${value}%` }}
                                />
                            </div>
                            <div className="breakdown-value">{value}%</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Skills */}
            {result.skills_extracted?.length > 0 && (
                <div className="ats-section">
                    <h4>🎯 Skills Detected ({result.skills_extracted.length})</h4>
                    <div className="skills-list">
                        {result.skills_extracted.map((skill, idx) => (
                            <span
                                key={idx}
                                className={`skill-tag ${skill.category || 'general'}`}
                                title={`${skill.proficiency || 'Unknown'} proficiency`}
                            >
                                {skill.name}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Keywords */}
            <div className="ats-keywords-section">
                {result.matched_keywords?.length > 0 && (
                    <div className="keywords-column">
                        <h4>✅ Matched Keywords</h4>
                        <ul className="keywords-list matched">
                            {result.matched_keywords.map((kw, idx) => (
                                <li key={idx}>{kw}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {result.missing_keywords?.length > 0 && (
                    <div className="keywords-column">
                        <h4>❌ Missing Keywords</h4>
                        <ul className="keywords-list missing">
                            {result.missing_keywords.map((kw, idx) => (
                                <li key={idx}>{kw}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Strengths */}
            {result.strength_areas?.length > 0 && (
                <div className="ats-section">
                    <h4>💪 Strengths</h4>
                    <ul className="insights-list strengths">
                        {result.strength_areas.map((strength, idx) => (
                            <li key={idx}>
                                <strong>{strength.area}</strong>
                                <span>{strength.description}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Weaknesses */}
            {result.weak_areas?.length > 0 && (
                <div className="ats-section">
                    <h4>🎓 Areas to Improve</h4>
                    <ul className="insights-list weaknesses">
                        {result.weak_areas.map((weakness, idx) => (
                            <li key={idx}>
                                <strong>{weakness.area}</strong>
                                <span>{weakness.description}</span>
                                {weakness.suggestion && (
                                    <em className="suggestion">💡 {weakness.suggestion}</em>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Recommendations */}
            {result.recommendations?.length > 0 && (
                <div className="ats-section">
                    <h4>📝 Recommendations</h4>
                    <div className="recommendations-list">
                        {result.recommendations.map((rec, idx) => (
                            <div key={idx} className="recommendation-item">
                                <div className="rec-header">
                                    <span className="rec-area">{rec.area}</span>
                                    <span className={`impact-badge ${getImpactColor(rec.impact)}`}>
                                        {rec.impact || 'medium'} impact
                                    </span>
                                </div>
                                <p className="rec-suggestion">{rec.suggestion}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ATSResult;
