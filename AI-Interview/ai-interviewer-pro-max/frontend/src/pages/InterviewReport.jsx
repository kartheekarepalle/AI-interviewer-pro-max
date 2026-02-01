/**
 * Interview Report Page
 * 
 * Displays comprehensive interview report with:
 * - Readiness score (visual emphasis)
 * - Skill breakdown
 * - Strengths & weaknesses
 * - Behavioral insights
 * - Improvement suggestions
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Download, FileVideo, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import { reportApi, getStoredUser } from '../services/api';
import { updateWithReportData } from '../services/interviewStorage';
import { getVideoBlob, deleteVideoBlob } from '../services/videoStorage';

/**
 * Grade to color mapping
 */
const GRADE_COLORS = {
    'A+': 'grade-excellent',
    'A': 'grade-excellent',
    'B+': 'grade-good',
    'B': 'grade-good',
    'C+': 'grade-average',
    'C': 'grade-average',
    'D': 'grade-poor',
    'F': 'grade-poor',
};

/**
 * Level labels
 */
const LEVEL_LABELS = {
    excellent: 'Excellent - Interview Ready',
    good: 'Good - Minor Improvements Needed',
    average: 'Average - Preparation Recommended',
    needs_work: 'Needs Work - More Practice Required',
};

function InterviewReport() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const user = getStoredUser();

    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState(null);

    // Video download state - available for strict/stress interviews
    const [videoData, setVideoData] = useState(null);
    const [videoLoading, setVideoLoading] = useState(true);
    const [downloadingVideo, setDownloadingVideo] = useState(false);

    // Get interview personality from location state (passed from LiveInterview)
    const interviewPersonality = location.state?.personality || location.state?.persona || 'neutral';

    // Check if video download should be shown (strict or stress/high-pressure modes)
    const showVideoDownload = ['strict', 'stress'].includes(interviewPersonality);

    /**
     * Load video from IndexedDB
     */
    useEffect(() => {
        const loadVideo = async () => {
            if (!sessionId || !showVideoDownload) {
                setVideoLoading(false);
                return;
            }

            setVideoLoading(true);
            try {
                const data = await getVideoBlob(sessionId);
                if (data) {
                    setVideoData(data);
                    console.log('[InterviewReport] Video loaded:', {
                        size: (data.size / 1024 / 1024).toFixed(2) + ' MB',
                        mimeType: data.mimeType
                    });
                }
            } catch (err) {
                console.error('[InterviewReport] Error loading video:', err);
            } finally {
                setVideoLoading(false);
            }
        };

        loadVideo();

        // Cleanup blob URL on unmount
        return () => {
            if (videoData?.url) {
                URL.revokeObjectURL(videoData.url);
            }
        };
    }, [sessionId, showVideoDownload]);

    /**
     * Handle video download
     */
    const handleDownloadVideo = async () => {
        if (!videoData?.url) return;

        setDownloadingVideo(true);
        try {
            const a = document.createElement('a');
            a.href = videoData.url;
            a.download = `interview-${report?.target_role?.replace(/\s+/g, '_') || 'session'}-${sessionId}.webm`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            console.log('[InterviewReport] Video download initiated');
        } catch (err) {
            console.error('Failed to download video:', err);
            alert('Failed to download video. Please try again.');
        } finally {
            setDownloadingVideo(false);
        }
    };

    /**
     * Handle video deletion
     */
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
            console.log('[InterviewReport] Video deleted');
        } catch (err) {
            console.error('Failed to delete video:', err);
        }
    };

    /**
     * Load or generate report
     */
    useEffect(() => {
        const loadReport = async () => {
            if (!sessionId) {
                setError('No session ID provided');
                setLoading(false);
                return;
            }

            try {
                // First try to get existing report
                const response = await reportApi.get(sessionId);
                if (response.success && response.report) {
                    setReport(response.report);
                    // CRITICAL: Persist report data to localStorage
                    updateWithReportData(sessionId, response.report);
                    setLoading(false);
                    return;
                }
            } catch (err) {
                // Report doesn't exist, need to generate
                console.log('Report not found, generating...');
            }

            // Generate report
            try {
                setGenerating(true);
                const genResponse = await reportApi.generate(sessionId);
                if (genResponse.success && genResponse.report) {
                    setReport(genResponse.report);
                    // CRITICAL: Persist generated report data to localStorage
                    updateWithReportData(sessionId, genResponse.report);
                } else {
                    throw new Error(genResponse.message || 'Failed to generate report');
                }
            } catch (err) {
                setError(err.message || 'Failed to load report');
            } finally {
                setLoading(false);
                setGenerating(false);
            }
        };

        loadReport();
    }, [sessionId]);

    /**
     * Get score color class
     */
    const getScoreColorClass = (score) => {
        if (score >= 85) return 'score-excellent';
        if (score >= 70) return 'score-good';
        if (score >= 55) return 'score-average';
        return 'score-poor';
    };

    /**
     * Generate filename with interview name and date
     */
    const generateFilename = (type) => {
        const role = (report?.target_role || 'Interview').replace(/[^a-zA-Z0-9]/g, '_');
        const date = new Date(report?.generated_at || Date.now())
            .toISOString()
            .split('T')[0];
        return `AI_${role}_${date}_${type}.pdf`;
    };

    /**
     * Download Summary PDF - COMPREHENSIVE FULL REPORT
     */
    const downloadSummaryPDF = () => {
        if (!report) return;

        // Get all question-wise feedback if available
        const questionFeedback = report.question_feedback || report.questionWiseFeedback || [];
        const categories = report.skills?.categories || {};
        const breakdown = report.readiness?.breakdown || {};

        // Create COMPLETE PDF content as HTML with ALL report data
        const content = `
<!DOCTYPE html>
<html>
<head>
    <title>Complete Interview Report</title>
    <style>
        @page { margin: 20mm; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #1e293b; line-height: 1.6; }
        h1 { color: #1e293b; border-bottom: 3px solid #3b82f6; padding-bottom: 15px; margin-bottom: 30px; }
        h2 { color: #334155; margin-top: 35px; margin-bottom: 15px; border-left: 4px solid #3b82f6; padding-left: 15px; }
        h3 { color: #475569; margin-top: 20px; }
        .score-box { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 35px; border-radius: 16px; text-align: center; margin: 25px 0; box-shadow: 0 10px 40px rgba(59, 130, 246, 0.3); }
        .score-value { font-size: 72px; font-weight: bold; }
        .score-label { font-size: 16px; opacity: 0.9; margin-top: 5px; }
        .grade { font-size: 28px; margin-top: 15px; background: rgba(255,255,255,0.2); padding: 10px 25px; border-radius: 8px; display: inline-block; }
        .level { font-size: 14px; margin-top: 10px; opacity: 0.85; }
        .section { margin: 25px 0; padding: 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; }
        .strength-section { background: #ecfdf5; border-color: #a7f3d0; }
        .weakness-section { background: #fef2f2; border-color: #fecaca; }
        .strength { color: #059669; }
        .weakness { color: #dc2626; }
        ul { padding-left: 25px; margin: 15px 0; }
        li { margin: 12px 0; }
        .breakdown-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
        .breakdown-item { background: white; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
        .breakdown-label { font-size: 13px; color: #64748b; margin-bottom: 5px; }
        .breakdown-value { font-size: 24px; font-weight: bold; color: #1e293b; }
        .breakdown-bar { height: 8px; background: #e2e8f0; border-radius: 4px; margin-top: 8px; overflow: hidden; }
        .breakdown-fill { height: 100%; background: linear-gradient(90deg, #3b82f6, #8b5cf6); border-radius: 4px; }
        .category-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
        .category-card { background: white; padding: 20px; border-radius: 10px; text-align: center; border: 1px solid #e2e8f0; }
        .category-score { font-size: 28px; font-weight: bold; color: #3b82f6; }
        .category-label { font-size: 13px; color: #64748b; margin-top: 8px; text-transform: capitalize; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
        .stat-card { background: white; padding: 18px 12px; border-radius: 10px; text-align: center; border: 1px solid #e2e8f0; }
        .stat-value { font-size: 26px; font-weight: bold; color: #1e293b; }
        .stat-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 5px; }
        .question-section { margin: 25px 0; }
        .question-item { background: white; padding: 18px; border-radius: 10px; margin-bottom: 15px; border: 1px solid #e2e8f0; }
        .question-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .question-number { font-weight: bold; color: #3b82f6; }
        .question-score { background: #dbeafe; color: #1d4ed8; padding: 4px 12px; border-radius: 15px; font-weight: 600; font-size: 13px; }
        .question-text { font-weight: 500; margin-bottom: 8px; color: #334155; }
        .question-feedback { color: #64748b; font-size: 14px; }
        .improvement-card { background: white; padding: 15px; border-radius: 10px; margin-bottom: 12px; border-left: 4px solid #3b82f6; }
        .improvement-title { font-weight: 600; color: #1e293b; margin-bottom: 5px; }
        .improvement-priority { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 10px; text-transform: uppercase; font-weight: 600; }
        .priority-high { background: #fef2f2; color: #dc2626; }
        .priority-medium { background: #fef3c7; color: #d97706; }
        .priority-low { background: #ecfdf5; color: #059669; }
        .behavioral-metrics { display: flex; gap: 20px; margin: 15px 0; flex-wrap: wrap; }
        .behavioral-badge { background: white; padding: 10px 18px; border-radius: 20px; border: 1px solid #e2e8f0; }
        .behavioral-label { font-size: 12px; color: #64748b; }
        .behavioral-value { font-weight: 600; color: #1e293b; margin-left: 5px; text-transform: capitalize; }
        .next-steps { background: linear-gradient(135deg, #dbeafe, #e0e7ff); padding: 25px; border-radius: 12px; margin: 25px 0; }
        .next-steps h3 { color: #1e40af; margin-top: 0; }
        .next-steps ol { padding-left: 25px; }
        .next-steps li { margin: 10px 0; color: #1e40af; }
        .footer { margin-top: 50px; padding-top: 25px; border-top: 2px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
        .page-break { page-break-before: always; }
    </style>
</head>
<body>
    <h1>📊 Complete Interview Performance Report</h1>
    <p><strong>Role:</strong> ${report.target_role || 'Interview'}</p>
    <p><strong>Date:</strong> ${new Date(report.generated_at).toLocaleDateString()}</p>
    <p><strong>Session ID:</strong> ${sessionId}</p>
    
    <!-- READINESS SCORE -->
    <div class="score-box">
        <div class="score-value">${report.readiness?.score || 0}</div>
        <div class="score-label">Readiness Score / 100</div>
        <div class="grade">Grade: ${report.readiness?.grade || 'N/A'}</div>
        ${report.readiness?.level ? `<div class="level">${report.readiness.level.replace(/_/g, ' ').toUpperCase()}</div>` : ''}
    </div>

    <!-- SCORE BREAKDOWN -->
    ${Object.keys(breakdown).length > 0 ? `
    <h2>📈 Score Breakdown</h2>
    <div class="breakdown-grid">
        ${Object.entries(breakdown).map(([key, value]) => `
        <div class="breakdown-item">
            <div class="breakdown-label">${key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}</div>
            <div class="breakdown-value">${Math.round(value)}%</div>
            <div class="breakdown-bar"><div class="breakdown-fill" style="width: ${value}%"></div></div>
        </div>
        `).join('')}
    </div>
    ` : ''}

    <!-- EXECUTIVE SUMMARY -->
    ${report.executive_summary ? `
    <h2>📝 Executive Summary</h2>
    <div class="section">
        <p>${report.executive_summary}</p>
        ${report.recommendation ? `<p><strong>Recommendation:</strong> ${report.recommendation}</p>` : ''}
    </div>
    ` : ''}
    
    <!-- KEY STRENGTHS -->
    ${report.strengths?.length > 0 ? `
    <h2 class="strength">✓ Key Strengths</h2>
    <div class="section strength-section">
        <ul>
            ${report.strengths.map(s => `
            <li>
                <strong>${s.area}:</strong> ${s.description}
                ${s.evidence ? `<br><em style="color: #64748b;">Evidence: ${s.evidence}</em>` : ''}
            </li>
            `).join('')}
        </ul>
    </div>
    ` : ''}
    
    <!-- AREAS FOR IMPROVEMENT -->
    ${report.weaknesses?.length > 0 ? `
    <h2 class="weakness">→ Areas for Improvement</h2>
    <div class="section weakness-section">
        <ul>
            ${report.weaknesses.map(w => `
            <li>
                <strong>${w.area}:</strong> ${w.description}
                ${w.suggestion ? `<br><em style="color: #059669;">💡 Tip: ${w.suggestion}</em>` : ''}
            </li>
            `).join('')}
        </ul>
    </div>
    ` : ''}

    <!-- PERFORMANCE BY CATEGORY -->
    ${Object.keys(categories).length > 0 ? `
    <h2>📊 Performance by Category</h2>
    <div class="category-grid">
        ${Object.entries(categories).map(([key, value]) => `
        <div class="category-card">
            <div class="category-score">${typeof value === 'number' ? value.toFixed(1) : value}</div>
            <div class="category-label">${key.replace(/_/g, ' ')}</div>
        </div>
        `).join('')}
    </div>
    ` : ''}

    <!-- BEHAVIORAL INSIGHTS -->
    ${report.behavioral?.summary ? `
    <h2>🧠 Communication Insights</h2>
    <div class="section">
        <p>${report.behavioral.summary}</p>
        <div class="behavioral-metrics">
            ${report.behavioral.emotional_pattern ? `
            <div class="behavioral-badge">
                <span class="behavioral-label">Tone:</span>
                <span class="behavioral-value">${report.behavioral.emotional_pattern}</span>
            </div>
            ` : ''}
            ${report.behavioral.confidence_trend ? `
            <div class="behavioral-badge">
                <span class="behavioral-label">Confidence:</span>
                <span class="behavioral-value">${report.behavioral.confidence_trend}</span>
            </div>
            ` : ''}
        </div>
    </div>
    ` : ''}

    <!-- QUESTION-BY-QUESTION FEEDBACK -->
    ${questionFeedback.length > 0 ? `
    <div class="page-break"></div>
    <h2>❓ Question-by-Question Feedback</h2>
    <div class="question-section">
        ${questionFeedback.map((q, i) => `
        <div class="question-item">
            <div class="question-header">
                <span class="question-number">Question ${q.questionNumber || q.question_number || i + 1}</span>
                <span class="question-score">${q.score || q.relevance_score || 'N/A'}/10</span>
            </div>
            ${q.questionText || q.question_text ? `<div class="question-text">${q.questionText || q.question_text}</div>` : ''}
            <div class="question-feedback">${q.briefFeedback || q.feedback || q.brief_feedback || 'No feedback available'}</div>
        </div>
        `).join('')}
    </div>
    ` : ''}

    <!-- PRIORITY IMPROVEMENT AREAS -->
    ${report.improvements?.areas?.length > 0 ? `
    <h2>📈 Priority Improvement Areas</h2>
    ${report.improvements.areas.map(a => `
    <div class="improvement-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div class="improvement-title">${a.area}</div>
            <span class="improvement-priority priority-${a.priority?.toLowerCase() || 'medium'}">${a.priority || 'Medium'}</span>
        </div>
        <p style="margin: 10px 0 0 0; color: #64748b;">${a.action}</p>
    </div>
    `).join('')}
    ` : ''}

    <!-- TOPICS TO STUDY -->
    ${report.improvements?.topics?.length > 0 ? `
    <h2>📚 Topics to Review</h2>
    <div class="section">
        <ul>
            ${report.improvements.topics.map(t => `<li>${t}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    <!-- PRACTICE SUGGESTIONS -->
    ${report.improvements?.practice?.length > 0 ? `
    <h2>🎯 Practice Suggestions</h2>
    <div class="section">
        <ul>
            ${report.improvements.practice.map(p => `<li>${p}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    <!-- NEXT STEPS -->
    ${report.next_steps?.length > 0 || report.nextSteps?.length > 0 ? `
    <div class="next-steps">
        <h3>🚀 Recommended Next Steps</h3>
        <ol>
            ${(report.next_steps || report.nextSteps).map(step => `<li>${step}</li>`).join('')}
        </ol>
    </div>
    ` : ''}

    <!-- INTERVIEW STATISTICS -->
    ${report.statistics ? `
    <h2>📋 Interview Statistics</h2>
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-value">${report.statistics.total_questions || 0}</div>
            <div class="stat-label">Total Questions</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${report.statistics.answered || 0}</div>
            <div class="stat-label">Answered</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${report.statistics.skipped || 0}</div>
            <div class="stat-label">Skipped</div>
        </div>
        ${report.statistics.duration_minutes ? `
        <div class="stat-card">
            <div class="stat-value">${report.statistics.duration_minutes}m</div>
            <div class="stat-label">Duration</div>
        </div>
        ` : ''}
    </div>
    ` : ''}

    <div class="footer">
        <p><strong>Generated by AI Interviewer Pro Max</strong></p>
        <p>Report generated on: ${new Date().toLocaleString()}</p>
        <p style="margin-top: 15px; font-style: italic;">${report.disclaimer || 'This report is generated by AI and is for practice purposes only. Results should be used for self-improvement and interview preparation.'}</p>
    </div>
</body>
</html>`;

        // Create blob and download
        const blob = new Blob([content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = generateFilename('Complete_Report').replace('.pdf', '.html');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    /**
     * Download Score Report PDF 
     */
    const downloadScoreReportPDF = () => {
        if (!report) return;

        // Create detailed score breakdown as HTML
        const categories = report.skills?.categories || {};
        const breakdown = report.readiness?.breakdown || {};

        const content = `
<!DOCTYPE html>
<html>
<head>
    <title>Interview Score Report</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
        h1 { color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
        h2 { color: #334155; margin-top: 30px; }
        .score-box { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 30px; border-radius: 12px; text-align: center; margin: 20px 0; }
        .score-value { font-size: 64px; font-weight: bold; }
        .score-label { font-size: 14px; opacity: 0.9; }
        .grade { font-size: 28px; margin-top: 10px; background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 4px; display: inline-block; }
        .breakdown { margin: 20px 0; }
        .breakdown-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
        .breakdown-label { font-weight: 500; }
        .breakdown-value { font-weight: bold; }
        .category-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
        .category-card { background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; }
        .category-score { font-size: 32px; font-weight: bold; color: #3b82f6; }
        .category-label { font-size: 14px; color: #64748b; margin-top: 5px; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
        .stat-card { background: #f1f5f9; padding: 15px; border-radius: 8px; text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; color: #1e293b; }
        .stat-label { font-size: 12px; color: #64748b; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
    </style>
</head>
<body>
    <h1>📊 Interview Score Report</h1>
    <p><strong>Role:</strong> ${report.target_role || 'Interview'}</p>
    <p><strong>Date:</strong> ${new Date(report.generated_at).toLocaleDateString()}</p>
    
    <div class="score-box">
        <div class="score-value">${report.readiness?.score || 0}</div>
        <div class="score-label">READINESS SCORE / 100</div>
        <div class="grade">${report.readiness?.grade || 'N/A'}</div>
    </div>

    ${Object.keys(breakdown).length > 0 ? `
    <h2>Score Breakdown</h2>
    <div class="breakdown">
        ${Object.entries(breakdown).map(([key, value]) => `
        <div class="breakdown-row">
            <span class="breakdown-label">${key.charAt(0).toUpperCase() + key.slice(1)}</span>
            <span class="breakdown-value">${Math.round(value)}%</span>
        </div>
        `).join('')}
    </div>
    ` : ''}

    ${Object.keys(categories).length > 0 ? `
    <h2>Performance by Category</h2>
    <div class="category-grid">
        ${Object.entries(categories).map(([key, value]) => `
        <div class="category-card">
            <div class="category-score">${value.toFixed(1)}</div>
            <div class="category-label">${key.charAt(0).toUpperCase() + key.slice(1)}</div>
        </div>
        `).join('')}
    </div>
    ` : ''}

    ${report.statistics ? `
    <h2>Interview Statistics</h2>
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-value">${report.statistics.total_questions || 0}</div>
            <div class="stat-label">Total Questions</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${report.statistics.answered || 0}</div>
            <div class="stat-label">Answered</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${report.statistics.skipped || 0}</div>
            <div class="stat-label">Skipped</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${report.statistics.duration_minutes || 0}m</div>
            <div class="stat-label">Duration</div>
        </div>
    </div>
    ` : ''}

    <div class="footer">
        <p>Generated by AI Interviewer Pro Max</p>
        <p>Session ID: ${sessionId}</p>
    </div>
</body>
</html>`;

        // Create blob and download
        const blob = new Blob([content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = generateFilename('Score_Report').replace('.pdf', '.html');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    /**
     * Render loading state
     */
    if (loading) {
        return (
            <div className="report-container">
                <Navbar user={user} />
                <main className="report-main loading">
                    <div className="loading-content">
                        <div className="spinner"></div>
                        <h2>{generating ? 'Generating Your Report...' : 'Loading Report...'}</h2>
                        {generating && (
                            <p>Analyzing your performance and calculating scores</p>
                        )}
                    </div>
                </main>
            </div>
        );
    }

    /**
     * Render error state
     */
    if (error || !report) {
        return (
            <div className="report-container">
                <Navbar user={user} />
                <main className="report-main error">
                    <div className="error-panel">
                        <h2>⚠️ Report Unavailable</h2>
                        <p>{error || 'Unable to load report'}</p>
                        <button className="btn-primary" onClick={() => navigate('/dashboard')}>
                            Return to Dashboard
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="report-container">
            <Navbar user={user} />

            <main className="report-main">
                {/* Header */}
                <div className="report-header">
                    <div className="report-title">
                        <h1>📊 Interview Performance Report</h1>
                        <p className="report-role">{report.target_role || 'Interview'}</p>
                        <p className="report-date">
                            Generated: {new Date(report.generated_at).toLocaleDateString()}
                        </p>
                    </div>
                </div>

                {/* Readiness Score - Hero Section */}
                <section className="readiness-hero">
                    <div className="readiness-score-container">
                        <div className={`readiness-score-circle ${getScoreColorClass(report.readiness.score)}`}>
                            <span className="score-value">{report.readiness.score}</span>
                            <span className="score-label">/ 100</span>
                        </div>
                        <div className="readiness-grade">
                            <span className={`grade-badge ${GRADE_COLORS[report.readiness.grade]}`}>
                                {report.readiness.grade}
                            </span>
                            <p className="readiness-level">
                                {LEVEL_LABELS[report.readiness.level]}
                            </p>
                        </div>
                    </div>

                    {/* Score Breakdown */}
                    {report.readiness.breakdown && (
                        <div className="score-breakdown">
                            <h3>Score Breakdown</h3>
                            <div className="breakdown-bars">
                                {Object.entries(report.readiness.breakdown).map(([key, value]) => (
                                    <div key={key} className="breakdown-item">
                                        <div className="breakdown-label">
                                            <span>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                                            <span>{Math.round(value)}%</span>
                                        </div>
                                        <div className="breakdown-bar">
                                            <div
                                                className="breakdown-fill"
                                                style={{ width: `${value}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Score Explanation */}
                    {report.readiness.explanation && (
                        <p className="score-explanation">{report.readiness.explanation}</p>
                    )}
                </section>

                {/* Executive Summary */}
                {report.executive_summary && (
                    <section className="report-section executive-summary">
                        <h2>📝 Executive Summary</h2>
                        <p>{report.executive_summary}</p>
                        {report.recommendation && (
                            <div className="recommendation">
                                <strong>Recommendation:</strong> {report.recommendation}
                            </div>
                        )}
                    </section>
                )}

                {/* Strengths & Weaknesses */}
                <div className="strengths-weaknesses-grid">
                    {/* Strengths */}
                    {report.strengths && report.strengths.length > 0 && (
                        <section className="report-section strengths-section">
                            <h2>✓ Key Strengths</h2>
                            <ul className="insight-list">
                                {report.strengths.map((s, i) => (
                                    <li key={i} className="insight-item strength">
                                        <div className="insight-area">{s.area}</div>
                                        <p className="insight-description">{s.description}</p>
                                        {s.evidence && (
                                            <p className="insight-evidence">{s.evidence}</p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* Weaknesses */}
                    {report.weaknesses && report.weaknesses.length > 0 && (
                        <section className="report-section weaknesses-section">
                            <h2>→ Areas for Improvement</h2>
                            <ul className="insight-list">
                                {report.weaknesses.map((w, i) => (
                                    <li key={i} className="insight-item weakness">
                                        <div className="insight-area">{w.area}</div>
                                        <p className="insight-description">{w.description}</p>
                                        {w.suggestion && (
                                            <p className="insight-suggestion">
                                                <strong>Tip:</strong> {w.suggestion}
                                            </p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>

                {/* Category Scores */}
                {report.skills?.categories && Object.keys(report.skills.categories).length > 0 && (
                    <section className="report-section category-scores">
                        <h2>📊 Performance by Category</h2>
                        <div className="category-grid">
                            {Object.entries(report.skills.categories).map(([key, value]) => (
                                <div key={key} className="category-card">
                                    <div className="category-score">
                                        <span className={`score-circle-sm ${value >= 7 ? 'good' : value >= 5 ? 'average' : 'poor'}`}>
                                            {value.toFixed(1)}
                                        </span>
                                    </div>
                                    <div className="category-label">
                                        {key.charAt(0).toUpperCase() + key.slice(1)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Behavioral Insights */}
                {report.behavioral?.summary && (
                    <section className="report-section behavioral-section">
                        <h2>🧠 Communication Insights</h2>
                        <p className="behavioral-summary">{report.behavioral.summary}</p>
                        <div className="behavioral-metrics">
                            {report.behavioral.emotional_pattern && (
                                <div className="metric-badge">
                                    <span className="metric-label">Tone:</span>
                                    <span className="metric-value capitalize">
                                        {report.behavioral.emotional_pattern}
                                    </span>
                                </div>
                            )}
                            {report.behavioral.confidence_trend && (
                                <div className="metric-badge">
                                    <span className="metric-label">Confidence:</span>
                                    <span className="metric-value capitalize">
                                        {report.behavioral.confidence_trend}
                                    </span>
                                </div>
                            )}
                        </div>
                        <p className="behavioral-disclaimer">
                            * Based on text-based inference from language patterns only. Not real emotion detection.
                        </p>
                    </section>
                )}

                {/* Improvement Suggestions */}
                {report.improvements && (
                    <section className="report-section improvements-section">
                        <h2>📈 Next Steps</h2>

                        {/* Priority Areas */}
                        {report.improvements.areas && report.improvements.areas.length > 0 && (
                            <div className="improvement-areas">
                                <h3>Priority Areas</h3>
                                {report.improvements.areas.map((area, i) => (
                                    <div key={i} className={`improvement-card priority-${area.priority}`}>
                                        <div className="improvement-header">
                                            <span className="improvement-title">{area.area}</span>
                                            <span className={`priority-badge ${area.priority}`}>
                                                {area.priority}
                                            </span>
                                        </div>
                                        <p className="improvement-action">{area.action}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Topics to Study */}
                        {report.improvements.topics && report.improvements.topics.length > 0 && (
                            <div className="improvement-list">
                                <h3>📚 Topics to Review</h3>
                                <ul>
                                    {report.improvements.topics.map((topic, i) => (
                                        <li key={i}>{topic}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Practice Suggestions */}
                        {report.improvements.practice && report.improvements.practice.length > 0 && (
                            <div className="improvement-list">
                                <h3>🎯 Practice Suggestions</h3>
                                <ul>
                                    {report.improvements.practice.map((practice, i) => (
                                        <li key={i}>{practice}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </section>
                )}

                {/* Interview Statistics */}
                {report.statistics && (
                    <section className="report-section stats-section">
                        <h2>📋 Interview Statistics</h2>
                        <div className="stats-grid">
                            <div className="stat-card">
                                <span className="stat-value">{report.statistics.total_questions}</span>
                                <span className="stat-label">Total Questions</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-value">{report.statistics.answered}</span>
                                <span className="stat-label">Answered</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-value">{report.statistics.skipped}</span>
                                <span className="stat-label">Skipped</span>
                            </div>
                            {report.statistics.duration_minutes && (
                                <div className="stat-card">
                                    <span className="stat-value">{report.statistics.duration_minutes}m</span>
                                    <span className="stat-label">Duration</span>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* Disclaimer */}
                <section className="report-disclaimer">
                    <p>{report.disclaimer}</p>
                </section>

                {/* Video Download Section - Only for Strict/High-Pressure interviews */}
                {showVideoDownload && (
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
                                            <Trash2 size={16} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {/* Actions */}
                <div className="report-actions">
                    <button className="btn-secondary" onClick={downloadSummaryPDF}>
                        📄 Download Complete Report
                    </button>
                    {/* Show Video Download for strict/stress interviews, Score Report for others */}
                    {showVideoDownload ? (
                        videoData && (
                            <button
                                className="btn-secondary btn-video-download"
                                onClick={handleDownloadVideo}
                                disabled={downloadingVideo || videoLoading}
                            >
                                🎬 {downloadingVideo ? 'Downloading...' : 'Download Interview Video'}
                            </button>
                        )
                    ) : (
                        <button className="btn-secondary" onClick={downloadScoreReportPDF}>
                            📊 Download Score Report
                        </button>
                    )}
                    <button className="btn-secondary" onClick={() => navigate('/history')}>
                        View All Reports
                    </button>
                    <button className="btn-primary" onClick={() => navigate('/interview-prep')}>
                        Start New Interview
                    </button>
                </div>
            </main>
        </div>
    );
}

export default InterviewReport;
