/**
 * Personality Selector Component
 * 
 * Allows users to select interviewer personality mode:
 * - Strict: Formal and direct
 * - Friendly: Warm and encouraging
 * - Stress: High-pressure and rapid
 * - Neutral: Balanced and professional
 * 
 * These affect TONE only, not scoring or evaluation.
 */

import React, { useState, useEffect } from 'react';
import { personalityApi } from '../services/api';

/**
 * Personality icon mapping
 */
const PERSONALITY_ICONS = {
    strict: '🎯',
    friendly: '😊',
    stress: '⚡',
    neutral: '⚖️',
};

/**
 * Personality color mapping
 */
const PERSONALITY_COLORS = {
    strict: 'personality-strict',
    friendly: 'personality-friendly',
    stress: 'personality-stress',
    neutral: 'personality-neutral',
};

function PersonalitySelector({ selectedPersonality, onPersonalitySelect, disabled = false }) {
    const [personalities, setPersonalities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    /**
     * Fetch available personalities
     */
    useEffect(() => {
        const fetchPersonalities = async () => {
            try {
                const response = await personalityApi.getAll();
                if (response.success && response.personalities) {
                    setPersonalities(response.personalities);
                }
            } catch (err) {
                setError('Failed to load personality modes');
                console.error('Personality fetch error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchPersonalities();
    }, []);

    /**
     * Handle personality selection
     */
    const handleSelect = (personality) => {
        if (disabled) return;
        onPersonalitySelect(personality.id);
    };

    if (loading) {
        return (
            <div className="personality-selector loading">
                <div className="spinner-small"></div>
                <span>Loading personalities...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="personality-selector error">
                <span>⚠️ {error}</span>
            </div>
        );
    }

    return (
        <div className="personality-selector">
            <h3 className="personality-title">Choose Interviewer Style</h3>
            <p className="personality-subtitle">
                Select how the interviewer should interact with you
            </p>

            <div className="personality-options">
                {personalities.map((personality) => (
                    <div
                        key={personality.id}
                        className={`personality-option ${PERSONALITY_COLORS[personality.id]} ${selectedPersonality === personality.id ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                        onClick={() => handleSelect(personality)}
                    >
                        <div className="personality-icon">
                            {PERSONALITY_ICONS[personality.id] || '📋'}
                        </div>
                        <div className="personality-info">
                            <h4 className="personality-name">{personality.name}</h4>
                            <p className="personality-desc">{personality.description}</p>
                            <div className="personality-tags">
                                <span className={`intensity-tag ${personality.intensity}`}>
                                    {personality.intensity} intensity
                                </span>
                                <span className={`pressure-tag ${personality.pressure_level}`}>
                                    {personality.pressure_level} pressure
                                </span>
                            </div>
                        </div>
                        {selectedPersonality === personality.id && (
                            <span className="selected-check">✓</span>
                        )}
                    </div>
                ))}
            </div>

        </div>
    );
}

/**
 * Compact personality indicator for interview screen
 */
export function PersonalityIndicator({ personalityId, personalityName }) {
    if (!personalityId) return null;

    return (
        <div className={`personality-indicator ${PERSONALITY_COLORS[personalityId]}`}>
            <span className="personality-indicator-icon">
                {PERSONALITY_ICONS[personalityId] || '📋'}
            </span>
            <span className="personality-indicator-name">
                {personalityName || personalityId.charAt(0).toUpperCase() + personalityId.slice(1)} Mode
            </span>
        </div>
    );
}

export default PersonalitySelector;
