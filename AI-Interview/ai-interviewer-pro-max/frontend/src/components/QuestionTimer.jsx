/**
 * QuestionTimer - Countdown Timer Component for Strict/High-Pressure Interviews
 * 
 * Shows remaining time for current question with visual urgency indicators.
 */

import React, { useMemo } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import './QuestionTimer.css';

export default function QuestionTimer({
    timeRemaining,
    totalTime,
    isRunning,
    onTimeUp,
    showWarnings = true
}) {
    // Calculate percentage for progress bar
    const percentage = totalTime > 0 ? (timeRemaining / totalTime) * 100 : 100;

    // Determine urgency level
    const urgency = useMemo(() => {
        if (timeRemaining <= 10) return 'critical'; // Last 10 seconds
        if (timeRemaining <= 30) return 'warning';  // Last 30 seconds
        if (percentage <= 25) return 'low';         // Last quarter
        return 'normal';
    }, [timeRemaining, percentage]);

    // Format time as MM:SS
    const formattedTime = useMemo(() => {
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, [timeRemaining]);

    // Don't render if no time limit
    if (totalTime <= 0) return null;

    return (
        <div className={`question-timer ${urgency} ${isRunning ? 'running' : 'paused'}`}>
            <div className="timer-header">
                {urgency === 'critical' ? (
                    <AlertTriangle size={16} className="timer-icon pulse" />
                ) : (
                    <Clock size={16} className="timer-icon" />
                )}
                <span className="timer-label">Time Remaining</span>
            </div>

            <div className="timer-display">
                <span className={`timer-value ${urgency}`}>{formattedTime}</span>
            </div>

            <div className="timer-progress-bar">
                <div
                    className={`timer-progress-fill ${urgency}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>

            {showWarnings && urgency === 'warning' && (
                <div className="timer-warning">
                    ⚠️ 30 seconds remaining!
                </div>
            )}

            {showWarnings && urgency === 'critical' && (
                <div className="timer-warning critical">
                    🚨 Wrap up your answer!
                </div>
            )}

            {timeRemaining === 0 && (
                <div className="timer-timeout">
                    ⏰ Time's up!
                </div>
            )}
        </div>
    );
}
