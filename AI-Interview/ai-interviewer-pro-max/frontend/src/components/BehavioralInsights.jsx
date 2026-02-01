/**
 * Behavioral Insights Component
 * 
 * Displays simulated behavioral observations from text analysis.
 * 
 * IMPORTANT: These are TEXT-BASED INFERENCES, not real emotion detection.
 */

import React from 'react';

/**
 * Emotional state icons and labels
 */
const EMOTIONAL_STATES = {
    calm: { icon: '😌', label: 'Calm', color: 'insight-calm' },
    nervous: { icon: '😰', label: 'Nervous', color: 'insight-nervous' },
    confident: { icon: '😎', label: 'Confident', color: 'insight-confident' },
    uncertain: { icon: '🤔', label: 'Uncertain', color: 'insight-uncertain' },
};

/**
 * Confidence level display
 */
const CONFIDENCE_LEVELS = {
    high: { icon: '⬆️', label: 'High Confidence', color: 'confidence-high' },
    moderate: { icon: '➡️', label: 'Moderate Confidence', color: 'confidence-moderate' },
    low: { icon: '⬇️', label: 'Low Confidence', color: 'confidence-low' },
};

/**
 * Single Answer Insight Card
 */
export function AnswerInsightCard({ insight }) {
    if (!insight) return null;

    const emotionalState = EMOTIONAL_STATES[insight.emotional_state?.state] || EMOTIONAL_STATES.calm;
    const confidenceLevel = CONFIDENCE_LEVELS[insight.confidence_level?.level] || CONFIDENCE_LEVELS.moderate;

    return (
        <div className="insight-card">
            <div className="insight-header">
                <span className="insight-label">AI Observations</span>
                <span className="insight-disclaimer">Text-based inference</span>
            </div>

            <div className="insight-metrics">
                {/* Emotional State */}
                <div className={`insight-metric ${emotionalState.color}`}>
                    <span className="metric-icon">{emotionalState.icon}</span>
                    <div className="metric-content">
                        <span className="metric-label">Tone</span>
                        <span className="metric-value">{emotionalState.label}</span>
                    </div>
                </div>

                {/* Confidence Level */}
                <div className={`insight-metric ${confidenceLevel.color}`}>
                    <span className="metric-icon">{confidenceLevel.icon}</span>
                    <div className="metric-content">
                        <span className="metric-label">Expression</span>
                        <span className="metric-value">{confidenceLevel.label}</span>
                    </div>
                </div>
            </div>

            {/* Observations */}
            {insight.observations && insight.observations.length > 0 && (
                <div className="insight-observations">
                    <h4>Observations</h4>
                    <ul>
                        {insight.observations.slice(0, 3).map((obs, i) => (
                            <li key={i}>{obs}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Suggestions */}
            {insight.suggestions && insight.suggestions.length > 0 && (
                <div className="insight-suggestions">
                    <h4>Tips</h4>
                    <ul>
                        {insight.suggestions.slice(0, 2).map((sug, i) => (
                            <li key={i}>{sug}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

/**
 * Session Summary Card
 */
export function SessionSummaryCard({ summary }) {
    if (!summary) return null;

    const dominantState = EMOTIONAL_STATES[summary.emotional_pattern?.dominant_state] || EMOTIONAL_STATES.calm;

    return (
        <div className="session-summary-card">
            <div className="summary-header">
                <h3>📊 Behavioral Insights</h3>
                <span className="summary-disclaimer">Text-based inference only</span>
            </div>

            {/* Narrative */}
            {summary.narrative && (
                <p className="summary-narrative">{summary.narrative}</p>
            )}

            <div className="summary-grid">
                {/* Emotional Pattern */}
                <div className="summary-section">
                    <h4>Communication Tone</h4>
                    <div className={`summary-badge ${dominantState.color}`}>
                        <span>{dominantState.icon}</span>
                        <span>Predominantly {dominantState.label}</span>
                    </div>
                    {summary.emotional_pattern?.trajectory !== 'stable' && (
                        <p className="trajectory-note">
                            Trajectory: {summary.emotional_pattern.trajectory}
                        </p>
                    )}
                </div>

                {/* Confidence Pattern */}
                <div className="summary-section">
                    <h4>Confidence Expression</h4>
                    <div className="confidence-bar">
                        <div
                            className="confidence-fill"
                            style={{ width: `${(summary.confidence_pattern?.average_score || 0.5) * 100}%` }}
                        />
                    </div>
                    <p className="confidence-label">
                        {Math.round((summary.confidence_pattern?.average_score || 0.5) * 100)}% confidence level
                    </p>
                    {summary.confidence_pattern?.trajectory !== 'stable' && (
                        <p className="trajectory-note">
                            Trajectory: {summary.confidence_pattern.trajectory}
                        </p>
                    )}
                </div>
            </div>

            {/* Strengths & Improvements */}
            <div className="summary-patterns">
                {summary.behavioral_patterns?.consistent_strengths?.length > 0 && (
                    <div className="pattern-section strengths">
                        <h4>✓ Strengths</h4>
                        <ul>
                            {summary.behavioral_patterns.consistent_strengths.map((s, i) => (
                                <li key={i}>{s}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {summary.behavioral_patterns?.recurring_weaknesses?.length > 0 && (
                    <div className="pattern-section improvements">
                        <h4>→ Areas to Improve</h4>
                        <ul>
                            {summary.behavioral_patterns.recurring_weaknesses.map((w, i) => (
                                <li key={i}>{w}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {summary.behavioral_patterns?.improvement_areas?.length > 0 && (
                    <div className="pattern-section progress">
                        <h4>↗ Progress Noted</h4>
                        <ul>
                            {summary.behavioral_patterns.improvement_areas.map((a, i) => (
                                <li key={i}>{a}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Key Takeaways */}
            {summary.key_takeaways && summary.key_takeaways.length > 0 && (
                <div className="summary-takeaways">
                    <h4>Key Takeaways</h4>
                    <ul>
                        {summary.key_takeaways.map((t, i) => (
                            <li key={i}>{t}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Disclaimer */}
            <div className="summary-footer">
                <p className="disclaimer-text">
                    These insights are derived from language pattern analysis of your written responses.
                    They are text-based inferences, not real emotion or sentiment detection.
                </p>
            </div>
        </div>
    );
}

/**
 * Compact Insight Badge for chat messages
 */
export function InsightBadge({ insight }) {
    if (!insight) return null;

    const emotionalState = EMOTIONAL_STATES[insight.emotional_state?.state] || EMOTIONAL_STATES.calm;
    const confidenceLevel = CONFIDENCE_LEVELS[insight.confidence_level?.level] || CONFIDENCE_LEVELS.moderate;

    return (
        <div className="insight-badge">
            <span className="badge-item" title={`Tone: ${emotionalState.label}`}>
                {emotionalState.icon}
            </span>
            <span className="badge-item" title={`Confidence: ${confidenceLevel.label}`}>
                {confidenceLevel.icon}
            </span>
        </div>
    );
}

export default { AnswerInsightCard, SessionSummaryCard, InsightBadge };
