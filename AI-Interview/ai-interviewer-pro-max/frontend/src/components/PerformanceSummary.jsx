/**
 * PerformanceSummary - Interview Analytics Summary Component
 * 
 * Displays comprehensive performance metrics after Strict/High-Pressure interviews:
 * - Eye Contact Analysis
 * - Posture/Stability Score
 * - Filler Word Report
 * - Silence Analysis
 * - Speaking Speed
 * - Video Playback
 */

import React, { useState, useRef } from 'react';
import {
    Eye, Activity, MessageSquare, Clock, Zap,
    Video, Download, ChevronDown, ChevronUp,
    CheckCircle, AlertTriangle, XCircle, Award, TrendingUp
} from 'lucide-react';
import './PerformanceSummary.css';

export default function PerformanceSummary({ summary, onClose, onDownloadVideo }) {
    const [expandedSections, setExpandedSections] = useState({
        eyeContact: true,
        posture: true,
        fillerWords: false,
        silence: false,
        speed: true,
    });
    const videoRef = useRef(null);

    if (!summary) return null;

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const getGradeIcon = (grade) => {
        if (grade === 'Excellent') return <CheckCircle size={18} className="grade-icon excellent" />;
        if (grade === 'Good') return <CheckCircle size={18} className="grade-icon good" />;
        if (grade === 'Fair') return <AlertTriangle size={18} className="grade-icon fair" />;
        return <XCircle size={18} className="grade-icon poor" />;
    };

    const getScoreColor = (score) => {
        if (score >= 80) return 'excellent';
        if (score >= 60) return 'good';
        if (score >= 40) return 'fair';
        return 'poor';
    };

    const handleDownloadVideo = () => {
        if (summary.video?.url) {
            const a = document.createElement('a');
            a.href = summary.video.url;
            a.download = `interview-recording-${new Date().toISOString().split('T')[0]}.webm`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    return (
        <div className="performance-summary-overlay">
            <div className="performance-summary-modal">
                {/* Header */}
                <div className="summary-header">
                    <div className="summary-title">
                        <Award size={28} className="title-icon" />
                        <div>
                            <h2>Interview Performance Analysis</h2>
                            <p className="summary-subtitle">
                                {summary.mode === 'strict' ? 'Strict Mode' : 'High-Pressure Mode'} Interview Complete
                            </p>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                {/* Overall Score */}
                <div className="overall-score-section">
                    <div className={`score-circle ${getScoreColor(summary.overallScore)}`}>
                        <span className="score-value">{summary.overallScore}</span>
                        <span className="score-label">Overall</span>
                    </div>
                    <div className="score-breakdown">
                        <div className="breakdown-item">
                            <Eye size={16} />
                            <span>Eye Contact</span>
                            <span className={`score ${getScoreColor(summary.eyeContact?.percentage || 0)}`}>
                                {summary.eyeContact?.percentage || 0}%
                            </span>
                        </div>
                        <div className="breakdown-item">
                            <Activity size={16} />
                            <span>Stability</span>
                            <span className={`score ${getScoreColor(summary.posture?.stabilityScore || 0)}`}>
                                {summary.posture?.stabilityScore || 0}%
                            </span>
                        </div>
                        <div className="breakdown-item">
                            <Zap size={16} />
                            <span>Speed</span>
                            <span className="score">{summary.speed?.wordsPerMinute || 0} WPM</span>
                        </div>
                    </div>
                </div>

                {/* Video Section */}
                {summary.video?.available && summary.video?.url && (
                    <div className="video-section">
                        <div className="section-header">
                            <Video size={20} />
                            <h3>Your Interview Recording</h3>
                            <button className="download-btn" onClick={handleDownloadVideo}>
                                <Download size={16} /> Download
                            </button>
                        </div>
                        <div className="video-container">
                            <video
                                ref={videoRef}
                                src={summary.video.url}
                                controls
                                className="interview-video"
                            />
                            <p className="video-duration">Duration: {summary.video.duration}s</p>
                        </div>
                    </div>
                )}

                {/* Detailed Metrics */}
                <div className="metrics-sections">
                    {/* Eye Contact */}
                    <div className={`metric-section ${expandedSections.eyeContact ? 'expanded' : ''}`}>
                        <div className="section-header clickable" onClick={() => toggleSection('eyeContact')}>
                            <div className="header-left">
                                <Eye size={20} />
                                <h3>Eye Contact Analysis</h3>
                                {getGradeIcon(summary.eyeContact?.grade)}
                            </div>
                            {expandedSections.eyeContact ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                        {expandedSections.eyeContact && (
                            <div className="section-content">
                                <div className="metric-grid">
                                    <div className="metric-item">
                                        <span className="metric-label">Eye Contact Time</span>
                                        <span className={`metric-value ${getScoreColor(summary.eyeContact?.percentage)}`}>
                                            {summary.eyeContact?.percentage}%
                                        </span>
                                    </div>
                                    <div className="metric-item">
                                        <span className="metric-label">Grade</span>
                                        <span className="metric-value">{summary.eyeContact?.grade}</span>
                                    </div>
                                </div>
                                <div className="progress-bar">
                                    <div
                                        className={`progress-fill ${getScoreColor(summary.eyeContact?.percentage)}`}
                                        style={{ width: `${summary.eyeContact?.percentage}%` }}
                                    />
                                </div>
                                <p className="recommendation">{summary.eyeContact?.recommendation}</p>
                            </div>
                        )}
                    </div>

                    {/* Posture/Stability */}
                    <div className={`metric-section ${expandedSections.posture ? 'expanded' : ''}`}>
                        <div className="section-header clickable" onClick={() => toggleSection('posture')}>
                            <div className="header-left">
                                <Activity size={20} />
                                <h3>Posture & Stability</h3>
                                {getGradeIcon(summary.posture?.grade)}
                            </div>
                            {expandedSections.posture ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                        {expandedSections.posture && (
                            <div className="section-content">
                                <div className="metric-grid">
                                    <div className="metric-item">
                                        <span className="metric-label">Stability Score</span>
                                        <span className={`metric-value ${getScoreColor(summary.posture?.stabilityScore)}`}>
                                            {summary.posture?.stabilityScore}%
                                        </span>
                                    </div>
                                    <div className="metric-item">
                                        <span className="metric-label">Fidget Count</span>
                                        <span className="metric-value">{summary.posture?.fidgetCount}</span>
                                    </div>
                                </div>
                                <div className="progress-bar">
                                    <div
                                        className={`progress-fill ${getScoreColor(summary.posture?.stabilityScore)}`}
                                        style={{ width: `${summary.posture?.stabilityScore}%` }}
                                    />
                                </div>
                                <p className="recommendation">{summary.posture?.recommendation}</p>
                            </div>
                        )}
                    </div>

                    {/* Filler Words */}
                    <div className={`metric-section ${expandedSections.fillerWords ? 'expanded' : ''}`}>
                        <div className="section-header clickable" onClick={() => toggleSection('fillerWords')}>
                            <div className="header-left">
                                <MessageSquare size={20} />
                                <h3>Filler Words</h3>
                                <span className={`count-badge ${summary.fillerWords?.totalCount > 10 ? 'warning' : 'good'}`}>
                                    {summary.fillerWords?.totalCount || 0} found
                                </span>
                            </div>
                            {expandedSections.fillerWords ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                        {expandedSections.fillerWords && (
                            <div className="section-content">
                                <div className="filler-breakdown">
                                    {Object.entries(summary.fillerWords?.breakdown || {}).map(([word, count]) => (
                                        <div key={word} className="filler-item">
                                            <span className="filler-word">"{word}"</span>
                                            <span className="filler-count">{count}x</span>
                                        </div>
                                    ))}
                                    {Object.keys(summary.fillerWords?.breakdown || {}).length === 0 && (
                                        <p className="no-fillers">No filler words detected! 🎉</p>
                                    )}
                                </div>
                                <p className="recommendation">{summary.fillerWords?.recommendation}</p>
                            </div>
                        )}
                    </div>

                    {/* Silence Analysis */}
                    <div className={`metric-section ${expandedSections.silence ? 'expanded' : ''}`}>
                        <div className="section-header clickable" onClick={() => toggleSection('silence')}>
                            <div className="header-left">
                                <Clock size={20} />
                                <h3>Silence Analysis</h3>
                                <span className={`count-badge ${summary.silence?.instanceCount > 3 ? 'warning' : 'good'}`}>
                                    {summary.silence?.instanceCount || 0} pauses
                                </span>
                            </div>
                            {expandedSections.silence ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                        {expandedSections.silence && (
                            <div className="section-content">
                                <div className="metric-grid">
                                    <div className="metric-item">
                                        <span className="metric-label">Total Silence</span>
                                        <span className="metric-value">{summary.silence?.totalSilenceSeconds}s</span>
                                    </div>
                                    <div className="metric-item">
                                        <span className="metric-label">Longest Pause</span>
                                        <span className="metric-value">{summary.silence?.longestSilenceSeconds}s</span>
                                    </div>
                                </div>
                                <p className="recommendation">{summary.silence?.recommendation}</p>
                            </div>
                        )}
                    </div>

                    {/* Speaking Speed */}
                    <div className={`metric-section ${expandedSections.speed ? 'expanded' : ''}`}>
                        <div className="section-header clickable" onClick={() => toggleSection('speed')}>
                            <div className="header-left">
                                <TrendingUp size={20} />
                                <h3>Speaking Speed</h3>
                                <span className={`speed-badge ${summary.speed?.grade === 'Excellent' ? 'excellent' :
                                        summary.speed?.grade === 'Good' ? 'good' : 'warning'
                                    }`}>
                                    {summary.speed?.wordsPerMinute} WPM
                                </span>
                            </div>
                            {expandedSections.speed ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                        {expandedSections.speed && (
                            <div className="section-content">
                                <div className="speed-meter">
                                    <div className="speed-labels">
                                        <span>Too Slow</span>
                                        <span>Optimal (120-160)</span>
                                        <span>Too Fast</span>
                                    </div>
                                    <div className="speed-bar">
                                        <div
                                            className="speed-marker"
                                            style={{ left: `${Math.min(100, Math.max(0, (summary.speed?.wordsPerMinute - 60) / 1.8))}%` }}
                                        />
                                    </div>
                                </div>
                                <p className="speed-grade">{summary.speed?.grade}</p>
                                <p className="recommendation">{summary.speed?.recommendation}</p>
                            </div>
                        )}
                    </div>

                    {/* Timed Out Questions */}
                    {summary.timer?.timedOutQuestions > 0 && (
                        <div className="metric-section warning-section">
                            <div className="section-header">
                                <div className="header-left">
                                    <AlertTriangle size={20} className="warning-icon" />
                                    <h3>Time Management</h3>
                                </div>
                            </div>
                            <div className="section-content">
                                <p className="timeout-warning">
                                    ⚠️ You ran out of time on <strong>{summary.timer.timedOutQuestions}</strong> question(s).
                                </p>
                                <p className="recommendation">
                                    Practice giving concise answers. Aim to complete your response within the time limit.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="summary-footer">
                    <p className="footer-note">
                        💡 These metrics help you improve your interview performance.
                        Practice makes perfect!
                    </p>
                    <button className="btn-primary" onClick={onClose}>
                        Continue to Results
                    </button>
                </div>
            </div>
        </div>
    );
}
