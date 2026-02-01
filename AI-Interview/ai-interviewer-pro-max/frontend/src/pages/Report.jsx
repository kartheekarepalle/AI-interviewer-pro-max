/**
 * Report Page
 * 
 * Displays comprehensive interview report:
 * - Overall score and grade
 * - Performance breakdown
 * - Question-by-question feedback
 * - Improvement suggestions
 * - Hiring recommendation
 * - Download interview video button
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, FileVideo, ArrowLeft, RotateCcw, AlertCircle, Loader2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import { getVideoBlob, deleteVideoBlob } from '../services/videoStorage';

function Report() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [report, setReport] = useState(null);
    const [videoData, setVideoData] = useState(null);
    const [videoLoading, setVideoLoading] = useState(true);
    const [downloadingVideo, setDownloadingVideo] = useState(false);
    const [videoError, setVideoError] = useState(null);

    useEffect(() => {
        // Load video from IndexedDB
        const loadVideo = async () => {
            setVideoLoading(true);
            setVideoError(null);
            try {
                const data = await getVideoBlob(sessionId);
                if (data) {
                    setVideoData(data);
                    console.log('[Report] Video loaded from IndexedDB:', {
                        size: (data.size / 1024 / 1024).toFixed(2) + ' MB',
                        mimeType: data.mimeType
                    });
                } else {
                    console.log('[Report] No video found for this session');
                }
            } catch (err) {
                console.error('[Report] Error loading video:', err);
                setVideoError('Failed to load video recording');
            } finally {
                setVideoLoading(false);
            }
        };

        loadVideo();

        // TODO: Fetch report from API
        setTimeout(() => {
            setReport({
                reportTitle: 'Interview Performance Report',
                executiveSummary: 'Good performance with strong communication skills. Some areas for improvement identified.',
                overallScore: 75,
                grade: 'B+',
                passStatus: true,
                hiringRecommendation: 'hire',
                performanceBreakdown: {
                    technical: { score: 72, feedback: 'Solid technical foundation with room for depth.' },
                    behavioral: { score: 80, feedback: 'Good examples and STAR format usage.' },
                    communication: { score: 78, feedback: 'Clear and well-structured responses.' },
                },
                topStrengths: ['Clear communication', 'Good examples', 'Structured thinking'],
                improvementAreas: ['Technical depth', 'Time management', 'Specificity'],
                questionWiseFeedback: [
                    { questionNumber: 1, score: 80, briefFeedback: 'Good introduction with relevant experience.' },
                    { questionNumber: 2, score: 70, briefFeedback: 'Could provide more specific examples.' },
                ],
                nextSteps: ['Practice technical deep dives', 'Prepare more quantified achievements'],
            });
            setLoading(false);
        }, 1000);

        // Cleanup blob URLs on unmount
        return () => {
            if (videoData?.url) {
                URL.revokeObjectURL(videoData.url);
            }
        };
    }, [sessionId]);

    // Handle video download
    const handleDownloadVideo = async () => {
        if (!videoData?.url) return;

        setDownloadingVideo(true);

        try {
            const a = document.createElement('a');
            a.href = videoData.url;
            a.download = `interview-${sessionId}.webm`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            console.log('[Report] Video download initiated');
        } catch (err) {
            console.error('Failed to download video:', err);
            alert('Failed to download video. Please try again.');
        } finally {
            setDownloadingVideo(false);
        }
    };

    // Handle delete video (to free space)
    const handleDeleteVideo = async () => {
        if (!confirm('Are you sure you want to delete this recording? This cannot be undone.')) {
            return;
        }

        try {
            await deleteVideoBlob(sessionId);
            if (videoData?.url) {
                URL.revokeObjectURL(videoData.url);
            }
            setVideoData(null);
            console.log('[Report] Video deleted');
        } catch (err) {
            console.error('Failed to delete video:', err);
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Generating your report...</p>
            </div>
        );
    }

    const getGradeColor = (grade) => {
        if (grade.startsWith('A')) return 'grade-a';
        if (grade.startsWith('B')) return 'grade-b';
        if (grade.startsWith('C')) return 'grade-c';
        return 'grade-d';
    };

    return (
        <div className="report-container">
            <Navbar />

            <main className="report-main">
                {/* Header */}
                <header className="report-header">
                    <h1>{report.reportTitle}</h1>
                    <p className="report-summary">{report.executiveSummary}</p>
                </header>

                {/* Score Card */}
                <section className="score-card">
                    <div className={`grade-circle ${getGradeColor(report.grade)}`}>
                        <span className="grade">{report.grade}</span>
                        <span className="score">{report.overallScore}%</span>
                    </div>
                    <div className="score-details">
                        <span className={`status ${report.passStatus ? 'pass' : 'fail'}`}>
                            {report.passStatus ? '✓ PASSED' : '✗ NEEDS IMPROVEMENT'}
                        </span>
                        <span className="recommendation">
                            Recommendation: {report.hiringRecommendation.toUpperCase()}
                        </span>
                    </div>
                </section>

                {/* Performance Breakdown */}
                <section className="breakdown-section">
                    <h2>Performance Breakdown</h2>
                    <div className="breakdown-grid">
                        {Object.entries(report.performanceBreakdown).map(([category, data]) => (
                            <div key={category} className="breakdown-card">
                                <h3>{category.charAt(0).toUpperCase() + category.slice(1)}</h3>
                                <div className="score-bar">
                                    <div className="score-fill" style={{ width: `${data.score}%` }} />
                                </div>
                                <span className="score-value">{data.score}/100</span>
                                <p className="feedback">{data.feedback}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Strengths & Improvements */}
                <section className="insights-section">
                    <div className="insights-column">
                        <h2>💪 Top Strengths</h2>
                        <ul>
                            {report.topStrengths.map((strength, i) => (
                                <li key={i}>{strength}</li>
                            ))}
                        </ul>
                    </div>
                    <div className="insights-column">
                        <h2>📈 Areas for Improvement</h2>
                        <ul>
                            {report.improvementAreas.map((area, i) => (
                                <li key={i}>{area}</li>
                            ))}
                        </ul>
                    </div>
                </section>

                {/* Next Steps */}
                <section className="next-steps-section">
                    <h2>🎯 Recommended Next Steps</h2>
                    <ol>
                        {report.nextSteps.map((step, i) => (
                            <li key={i}>{step}</li>
                        ))}
                    </ol>
                </section>

                {/* Video Download Section - Always Visible */}
                <section className="video-download-section">
                    <div className="video-download-card">
                        <div className="video-info">
                            <FileVideo size={32} />
                            <div>
                                <h3>Interview Recording</h3>
                                {videoLoading ? (
                                    <p className="video-status loading">
                                        <Loader2 size={14} className="spin" /> Loading video...
                                    </p>
                                ) : videoData ? (
                                    <p className="video-status available">
                                        ✓ Recording available ({(videoData.size / 1024 / 1024).toFixed(1)} MB)
                                    </p>
                                ) : (
                                    <p className="video-status unavailable">
                                        <AlertCircle size={14} /> No recording available for this session
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="video-actions">
                            {videoData && !videoLoading && (
                                <>
                                    <button
                                        className="btn-download-video"
                                        onClick={handleDownloadVideo}
                                        disabled={downloadingVideo}
                                    >
                                        {downloadingVideo ? (
                                            <>
                                                <Loader2 size={18} className="spin" />
                                                Downloading...
                                            </>
                                        ) : (
                                            <>
                                                <Download size={18} />
                                                Download Video
                                            </>
                                        )}
                                    </button>
                                    <button
                                        className="btn-delete-video"
                                        onClick={handleDeleteVideo}
                                        title="Delete recording to free space"
                                    >
                                        🗑️
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    {videoError && (
                        <p className="video-error">{videoError}</p>
                    )}
                </section>

                {/* Actions */}
                <div className="report-actions">
                    <button className="btn-secondary" onClick={() => navigate('/dashboard')}>
                        <ArrowLeft size={18} />
                        Back to Dashboard
                    </button>
                    <button className="btn-primary" onClick={() => navigate('/interview')}>
                        <RotateCcw size={18} />
                        Start New Interview
                    </button>
                </div>
            </main>
        </div>
    );
}

export default Report;
