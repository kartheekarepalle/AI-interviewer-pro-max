/**
 * User Data Service - SINGLE SOURCE OF TRUTH
 * 
 * Provides unified data access for Dashboard, Profile, and Analytics pages.
 * Uses backend API as primary source with localStorage fallback.
 * 
 * CRITICAL: Both Dashboard and Profile MUST use this service.
 * DO NOT fetch data separately in components.
 */

import { analyticsApi, profileApi, resumeApi, userApi } from './api';
import {
    getCachedAnalytics,
    getStoredInterviews,
    getInterviewHistory,
    syncWithBackend,
} from './interviewStorage';

// ===========================================
// DATA SHAPE DEFINITIONS
// ===========================================

/**
 * @typedef {Object} UserAnalytics
 * @property {number} total_interviews
 * @property {number} completed_interviews
 * @property {number|null} average_score
 * @property {number|null} best_score
 * @property {string|null} last_interview_at
 * @property {string} trend - 'improving' | 'declining' | 'stable'
 * @property {number} completion_rate
 * @property {number} total_questions_answered
 * @property {Object} skill_summary
 */

/**
 * @typedef {Object} InterviewRecord
 * @property {string} id
 * @property {string} target_role
 * @property {number|null} score
 * @property {string} status
 * @property {string} created_at
 * @property {string} session_type
 * @property {string} difficulty
 * @property {number} duration
 * @property {Array} strengths
 * @property {Array} weaknesses
 * @property {boolean} has_recording
 */

// ===========================================
// ANALYTICS COMPUTATION (Used by Dashboard & Profile)
// ===========================================

/**
 * Compute analytics from interview array
 * SINGLE function used by both Dashboard and Profile
 * 
 * @param {Array} interviews - Array of interview records
 * @returns {UserAnalytics}
 */
export function computeAnalytics(interviews = []) {
    const completed = interviews.filter(i =>
        i.status === 'completed' || i.status === 'completing'
    );

    const scores = completed
        .filter(i => i.score != null && i.score > 0)
        .map(i => Number(i.score));

    // Calculate trend (compare last 3 vs previous 3)
    let trend = 'stable';
    if (scores.length >= 6) {
        const recent = scores.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
        const older = scores.slice(3, 6).reduce((a, b) => a + b, 0) / 3;
        if (recent > older + 5) trend = 'improving';
        else if (recent < older - 5) trend = 'declining';
    }

    // Calculate completion rate
    const completionRate = interviews.length > 0
        ? Math.round((completed.length / interviews.length) * 100)
        : 0;

    // Calculate total questions
    const totalQuestions = completed.reduce((sum, i) => {
        return sum + (i.total_questions || i.questions_answered || 0);
    }, 0);

    return {
        total_interviews: interviews.length,
        completed_interviews: completed.length,
        average_score: scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : null,
        best_score: scores.length > 0 ? Math.max(...scores) : null,
        last_interview_at: interviews.length > 0 ? interviews[0].created_at : null,
        trend,
        completion_rate: completionRate,
        total_questions_answered: totalQuestions,
    };
}

// ===========================================
// UNIFIED DATA LOADERS
// ===========================================

/**
 * Load all user data for Dashboard/Profile
 * Uses backend API with localStorage fallback
 * 
 * @returns {Promise<{analytics: UserAnalytics, interviews: Array, resumes: Array}>}
 */
export async function loadUserData() {
    let analytics = getCachedAnalytics(); // Start with cache
    let interviews = [];
    let resumes = [];

    // Try backend first
    try {
        // Load all data in parallel
        const [analyticsRes, historyRes, resumesRes] = await Promise.allSettled([
            userApi.getAnalytics(),
            profileApi.getInterviewHistory(50, 0),
            resumeApi.getAll(),
        ]);

        // Process analytics
        if (analyticsRes.status === 'fulfilled' && analyticsRes.value.success) {
            analytics = analyticsRes.value.analytics || analytics;
        }

        // Process interview history
        if (historyRes.status === 'fulfilled' && historyRes.value.success) {
            interviews = historyRes.value.interviews || [];
            // Sync to localStorage for future fallback
            syncWithBackend(interviews);
        } else {
            // Fallback to localStorage
            interviews = getStoredInterviews().map(normalizeInterviewRecord);
        }

        // Process resumes
        if (resumesRes.status === 'fulfilled' && resumesRes.value.success) {
            resumes = resumesRes.value.resumes || [];
        }

        // If backend analytics failed but we have interviews, compute locally
        if (!analytics.total_interviews && interviews.length > 0) {
            analytics = computeAnalytics(interviews);
        }

    } catch (error) {
        console.error('[UserDataService] Failed to load data:', error);

        // Full fallback to localStorage
        interviews = getStoredInterviews().map(normalizeInterviewRecord);
        analytics = computeAnalytics(interviews);
    }

    return { analytics, interviews, resumes };
}

/**
 * Load dashboard-specific data (quick stats + recent interviews)
 * Optimized for dashboard which needs less data
 * 
 * @returns {Promise<{analytics: UserAnalytics, recentInterviews: Array}>}
 */
export async function loadDashboardData() {
    let analytics = getCachedAnalytics();
    let recentInterviews = getInterviewHistory(5); // Start with cache

    try {
        // Load analytics from backend
        const analyticsRes = await userApi.getAnalytics();
        if (analyticsRes.success && analyticsRes.analytics) {
            analytics = analyticsRes.analytics;
        }

        // Load recent history
        const historyRes = await userApi.getHistory(5, 0);
        if (historyRes.success && historyRes.interviews?.length > 0) {
            recentInterviews = historyRes.interviews;
            syncWithBackend(historyRes.interviews);
        }
    } catch (error) {
        console.warn('[UserDataService] Dashboard API failed, using cache');
        // Fallback already set
    }

    return { analytics, recentInterviews };
}

/**
 * Load profile page data (full history + resumes)
 * 
 * @returns {Promise<{analytics: UserAnalytics, interviews: Array, resumes: Array, user: Object}>}
 */
export async function loadProfileData() {
    return loadUserData();
}

// ===========================================
// HELPERS
// ===========================================

/**
 * Normalize interview record to consistent shape
 * Handles variations between backend and localStorage formats
 */
function normalizeInterviewRecord(record) {
    return {
        id: record.id || record.interviewId || record.session_id,
        target_role: record.target_role || record.targetRole || record.job_role || 'Interview',
        score: record.score ?? null,
        status: record.status || 'completed',
        created_at: record.created_at || record.date || record.createdAt,
        session_type: record.session_type || 'mixed',
        difficulty: record.difficulty || record.difficulty_level || 'medium',
        duration: record.duration || record.duration_minutes || 0,
        strengths: record.strengths || [],
        weaknesses: record.weaknesses || [],
        has_recording: record.has_recording || false,
        total_questions: record.total_questions || record.statistics?.total_questions || 0,
        questions_answered: record.questions_answered || record.statistics?.answered || 0,
    };
}

/**
 * Get formatted analytics for Profile stats display
 */
export function getFormattedStats(analytics, resumeCount = 0) {
    return {
        total_interviews: analytics?.total_interviews || 0,
        completed_interviews: analytics?.completed_interviews || 0,
        average_score: analytics?.average_score || 0,
        total_resumes: resumeCount,
        best_score: analytics?.best_score || 0,
        completion_rate: analytics?.completion_rate || 0,
        trend: analytics?.trend || 'stable',
    };
}

export default {
    computeAnalytics,
    loadUserData,
    loadDashboardData,
    loadProfileData,
    getFormattedStats,
};
