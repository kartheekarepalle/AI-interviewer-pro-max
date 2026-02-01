/**
 * Interview Storage Service
 * 
 * Provides persistent storage for interview completion data.
 * Uses backend API as primary source, localStorage as fallback.
 * 
 * CRITICAL: Ensures interview data persists after refresh and
 * dashboard counts/history are always accurate.
 */

const STORAGE_KEY = 'ai_interviewer_completed_sessions';
const HISTORY_KEY = 'ai_interviewer_interview_history';
const ANALYTICS_KEY = 'ai_interviewer_analytics_cache';

// ===========================================
// INTERVIEW DATA STRUCTURE
// ===========================================

/**
 * Creates a standardized interview record
 * @param {Object} data - Interview completion data
 * @returns {Object} Standardized interview record
 */
export function createInterviewRecord(data) {
    return {
        interviewId: data.interviewId || data.session_id || data.id,
        date: data.date || data.completed_at || new Date().toISOString(),
        score: data.score || data.readiness?.score || 0,
        grade: data.grade || data.readiness?.grade || 'C',
        targetRole: data.targetRole || data.target_role || 'Interview',
        status: 'completed',
        strengths: data.strengths || [],
        weaknesses: data.weaknesses || [],
        improvementTips: data.improvementTips || data.improvements?.areas || [],
        pdfUrl: data.pdfUrl || null,
        summary: data.summary || data.executive_summary || '',
        statistics: data.statistics || {
            total_questions: data.total_questions || 0,
            answered: data.answered || 0,
            skipped: data.skipped || 0,
            duration_minutes: data.duration_minutes || 0,
        },
        skills: data.skills || {},
        createdAt: new Date().toISOString(),
    };
}

// ===========================================
// LOCAL STORAGE OPERATIONS
// ===========================================

/**
 * Get all stored interview records from localStorage
 * @returns {Array} Array of interview records
 */
export function getStoredInterviews() {
    try {
        const stored = localStorage.getItem(HISTORY_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.warn('[InterviewStorage] Failed to read from localStorage:', e);
        return [];
    }
}

/**
 * Save interview record to localStorage
 * @param {Object} record - Interview record to save
 * @returns {boolean} Success status
 */
export function saveInterviewToStorage(record) {
    try {
        const interviews = getStoredInterviews();

        // Check if interview already exists (update) or is new (add)
        const existingIndex = interviews.findIndex(
            i => i.interviewId === record.interviewId
        );

        if (existingIndex >= 0) {
            // Update existing record
            interviews[existingIndex] = {
                ...interviews[existingIndex],
                ...record,
                updatedAt: new Date().toISOString(),
            };
        } else {
            // Add new record at beginning
            interviews.unshift(record);
        }

        // Keep only last 100 interviews
        const trimmedInterviews = interviews.slice(0, 100);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmedInterviews));

        // Update analytics cache
        updateAnalyticsCache(trimmedInterviews);

        console.log('[InterviewStorage] Saved interview:', record.interviewId);
        return true;
    } catch (e) {
        console.error('[InterviewStorage] Failed to save:', e);
        return false;
    }
}

/**
 * Get a specific interview by ID
 * @param {string} interviewId - Interview ID
 * @returns {Object|null} Interview record or null
 */
export function getInterviewById(interviewId) {
    const interviews = getStoredInterviews();
    return interviews.find(i => i.interviewId === interviewId) || null;
}

/**
 * Delete an interview from storage
 * @param {string} interviewId - Interview ID
 * @returns {boolean} Success status
 */
export function deleteInterviewFromStorage(interviewId) {
    try {
        const interviews = getStoredInterviews();
        const filtered = interviews.filter(i => i.interviewId !== interviewId);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
        updateAnalyticsCache(filtered);
        return true;
    } catch (e) {
        console.error('[InterviewStorage] Failed to delete:', e);
        return false;
    }
}

// ===========================================
// ANALYTICS CACHE
// ===========================================

/**
 * Update local analytics cache based on stored interviews
 * @param {Array} interviews - Array of interview records
 */
function updateAnalyticsCache(interviews) {
    try {
        const completed = interviews.filter(i => i.status === 'completed');
        const scores = completed.filter(i => i.score > 0).map(i => i.score);

        const analytics = {
            total_interviews: interviews.length,
            completed_interviews: completed.length,
            average_score: scores.length > 0
                ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
                : null,
            best_score: scores.length > 0 ? Math.max(...scores) : null,
            last_interview_at: interviews.length > 0 ? interviews[0].date : null,
            updatedAt: new Date().toISOString(),
        };

        localStorage.setItem(ANALYTICS_KEY, JSON.stringify(analytics));
    } catch (e) {
        console.warn('[InterviewStorage] Failed to update analytics cache:', e);
    }
}

/**
 * Get cached analytics
 * @returns {Object} Analytics data
 */
export function getCachedAnalytics() {
    try {
        const cached = localStorage.getItem(ANALYTICS_KEY);
        if (cached) {
            return JSON.parse(cached);
        }
    } catch (e) {
        console.warn('[InterviewStorage] Failed to read analytics cache:', e);
    }

    // Calculate from stored interviews if cache missing
    const interviews = getStoredInterviews();
    const completed = interviews.filter(i => i.status === 'completed');
    const scores = completed.filter(i => i.score > 0).map(i => i.score);

    return {
        total_interviews: interviews.length,
        completed_interviews: completed.length,
        average_score: scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : null,
        best_score: scores.length > 0 ? Math.max(...scores) : null,
        last_interview_at: interviews.length > 0 ? interviews[0].date : null,
    };
}

// ===========================================
// INTERVIEW COMPLETION HANDLER
// ===========================================

/**
 * Handle interview completion - stores data and updates counts
 * Call this when an interview finishes (from LiveInterview or InterviewReport)
 * 
 * @param {string} sessionId - Session/Interview ID
 * @param {Object} reportData - Report data from backend or local evaluation
 * @returns {Object} Saved interview record
 */
export function handleInterviewCompletion(sessionId, reportData) {
    console.log('[InterviewStorage] Handling interview completion:', sessionId);

    const record = createInterviewRecord({
        interviewId: sessionId,
        ...reportData,
    });

    saveInterviewToStorage(record);

    return record;
}

/**
 * Mark session as completed (without full report data)
 * Use when navigating to report page before report is generated
 * 
 * @param {string} sessionId - Session ID
 * @param {Object} basicData - Basic interview data (targetRole, date, etc.)
 */
export function markSessionCompleted(sessionId, basicData = {}) {
    const existing = getInterviewById(sessionId);

    if (!existing) {
        // Create a placeholder record that will be updated with full report later
        const record = createInterviewRecord({
            interviewId: sessionId,
            status: 'pending_report',
            targetRole: basicData.targetRole || 'Interview',
            date: basicData.date || new Date().toISOString(),
            score: 0, // Will be updated when report is generated
        });

        saveInterviewToStorage(record);
    }
}

/**
 * Update existing interview record with report data
 * Call this from InterviewReport after report is generated/loaded
 * 
 * @param {string} sessionId - Session ID
 * @param {Object} report - Full report data
 * @returns {Object} Updated interview record
 */
export function updateWithReportData(sessionId, report) {
    console.log('[InterviewStorage] Updating with report data:', sessionId);

    const record = createInterviewRecord({
        interviewId: sessionId,
        score: report.readiness?.score || report.score,
        grade: report.readiness?.grade || report.grade,
        targetRole: report.target_role || report.targetRole,
        date: report.generated_at || report.date || new Date().toISOString(),
        strengths: report.strengths || [],
        weaknesses: report.weaknesses || [],
        improvementTips: report.improvements?.areas || [],
        summary: report.executive_summary || '',
        statistics: report.statistics || {},
        skills: report.skills || {},
        status: 'completed',
    });

    saveInterviewToStorage(record);

    return record;
}

// ===========================================
// HISTORY & DISPLAY HELPERS
// ===========================================

/**
 * Get interview history for dashboard display
 * @param {number} limit - Max number of interviews to return
 * @returns {Array} Array of interview history items
 */
export function getInterviewHistory(limit = 10) {
    const interviews = getStoredInterviews();
    return interviews.slice(0, limit).map(i => ({
        id: i.interviewId,
        job_role: i.targetRole,
        score: i.score,
        status: i.status,
        created_at: i.date,
        grade: i.grade,
    }));
}

/**
 * Get statistics for dashboard
 * @returns {Object} Dashboard statistics
 */
export function getDashboardStats() {
    return getCachedAnalytics();
}

// ===========================================
// SYNC WITH BACKEND (Hybrid approach)
// ===========================================

/**
 * Merge backend data with local storage
 * Call this when backend data is loaded to ensure consistency
 * 
 * @param {Array} backendInterviews - Interviews from backend API
 */
export function syncWithBackend(backendInterviews) {
    if (!backendInterviews || !Array.isArray(backendInterviews)) return;

    const localInterviews = getStoredInterviews();
    const mergedMap = new Map();

    // Add local interviews first
    localInterviews.forEach(i => {
        mergedMap.set(i.interviewId, i);
    });

    // Overlay backend data (takes precedence)
    backendInterviews.forEach(i => {
        const id = i.id || i.session_id || i.interviewId;
        const existing = mergedMap.get(id);

        const record = createInterviewRecord({
            interviewId: id,
            score: i.score || existing?.score,
            grade: i.grade || existing?.grade,
            targetRole: i.job_role || i.target_role || existing?.targetRole,
            date: i.created_at || i.completed_at || existing?.date,
            status: i.status || 'completed',
        });

        mergedMap.set(id, { ...existing, ...record });
    });

    // Save merged data
    const mergedArray = Array.from(mergedMap.values())
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    localStorage.setItem(HISTORY_KEY, JSON.stringify(mergedArray.slice(0, 100)));
    updateAnalyticsCache(mergedArray);
}

/**
 * Clear all interview storage (for logout)
 */
export function clearInterviewStorage() {
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(ANALYTICS_KEY);
    localStorage.removeItem(STORAGE_KEY);
}

export default {
    createInterviewRecord,
    getStoredInterviews,
    saveInterviewToStorage,
    getInterviewById,
    deleteInterviewFromStorage,
    getCachedAnalytics,
    handleInterviewCompletion,
    markSessionCompleted,
    updateWithReportData,
    getInterviewHistory,
    getDashboardStats,
    syncWithBackend,
    clearInterviewStorage,
};
