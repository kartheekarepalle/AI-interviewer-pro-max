/**
 * API Service
 * 
 * Centralized API client for backend communication.
 * All API calls go through this service.
 * 
 * IMPORTANT: Frontend ONLY talks to backend.
 * NO direct Gemini/Groq API calls from frontend.
 */

const API_BASE_URL = '/api';

// Token key for localStorage
const TOKEN_KEY = 'ai_interviewer_token';
const USER_KEY = 'ai_interviewer_user';


// ===========================================
// TOKEN MANAGEMENT
// ===========================================

/**
 * Get auth token from storage
 */
export const getToken = () => localStorage.getItem(TOKEN_KEY);

/**
 * Set auth token in storage
 */
export const setToken = (token) => {
    localStorage.setItem(TOKEN_KEY, token);
};

/**
 * Remove auth token from storage
 */
export const removeToken = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
};

/**
 * Get stored user data
 */
export const getStoredUser = () => {
    const userData = localStorage.getItem(USER_KEY);
    return userData ? JSON.parse(userData) : null;
};

/**
 * Store user data
 */
export const setStoredUser = (user) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
};

/**
 * Clear all app-specific cached data (NOT auth tokens)
 * Use this on app reload to ensure fresh state
 */
export const clearSessionData = () => {
    // Clear sessionStorage completely
    sessionStorage.clear();

    // Clear any interview/session related data from localStorage
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
            key.includes('interview') ||
            key.includes('session') ||
            key.includes('ats_') ||
            key.includes('plan_') ||
            key.includes('analytics_') ||
            key.includes('resume_cache') ||
            key.includes('evaluation_')
        )) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
};

/**
 * Clear ALL app data including auth (for logout)
 * Preserves only theme preference
 */
export const clearAllAppData = () => {
    // Save theme preference before clearing
    const theme = localStorage.getItem('ai_interviewer_theme');

    // Clear everything
    localStorage.clear();
    sessionStorage.clear();

    // Restore theme preference
    if (theme) {
        localStorage.setItem('ai_interviewer_theme', theme);
    }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = () => !!getToken();


// ===========================================
// HTTP REQUEST HELPER
// ===========================================

// Flag to track if we've already detected a connection error
// This prevents retry spam on ECONNREFUSED
let connectionErrorDetected = false;

/**
 * Reset connection error flag (call when app starts fresh)
 */
export const resetConnectionState = () => {
    connectionErrorDetected = false;
};

/**
 * Check if backend is reachable
 */
export const checkBackendHealth = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
            connectionErrorDetected = false;
            return true;
        }
        return false;
    } catch {
        return false;
    }
};

/**
 * Make authenticated API request
 * SAFETY: Handles ECONNREFUSED gracefully, no retry spam
 */
async function request(endpoint, options = {}) {
    // If we've already detected a connection error, don't spam requests
    if (connectionErrorDetected && endpoint !== '/health') {
        throw new Error('Backend is unreachable. Please ensure the server is running.');
    }

    const token = getToken();

    const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
        });

        // Connection succeeded, reset error flag
        connectionErrorDetected = false;

        // Handle 401 - Unauthorized
        if (response.status === 401) {
            removeToken();
            window.location.href = '/login';
            throw new Error('Session expired. Please login again.');
        }

        // Parse response
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.detail || data.message || `Request failed: ${response.status}`);
        }

        return data;
    } catch (error) {
        // Check for connection errors (ECONNREFUSED, network failure, etc.)
        const isConnectionError =
            error.message === 'Failed to fetch' ||
            error.message.includes('NetworkError') ||
            error.message.includes('ECONNREFUSED') ||
            error.name === 'TypeError' && !error.message.includes('401');

        if (isConnectionError) {
            // Mark connection as failed to prevent retry spam
            connectionErrorDetected = true;

            // Clear auth state
            removeToken();

            // Redirect to login (only once)
            if (window.location.pathname !== '/login') {
                console.error('[API] Backend unreachable - redirecting to login');
                window.location.href = '/login';
            }

            throw new Error('Unable to connect to server. Please check if the backend is running.');
        }

        // For auth-related errors, don't retry
        if (error.message.includes('Session expired')) {
            throw error;
        }

        throw error;
    }
}


// ===========================================
// AUTH API
// ===========================================

export const authApi = {
    /**
     * User signup
     */
    async signup(name, email, password) {
        const response = await request('/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ name, email, password }),
        });

        if (response.success && response.token) {
            setToken(response.token.access_token);
            setStoredUser(response.user);
        }

        return response;
    },

    /**
     * User login
     */
    async login(email, password) {
        const response = await request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });

        if (response.success && response.token) {
            setToken(response.token.access_token);
            setStoredUser(response.user);
        }

        return response;
    },

    /**
     * User logout
     */
    async logout() {
        try {
            await request('/auth/logout', { method: 'POST' });
        } catch (error) {
            // Continue with local logout even if server fails
            console.warn('Logout API call failed:', error);
        } finally {
            removeToken();
        }
    },

    /**
     * Get current user
     */
    async getCurrentUser() {
        return request('/auth/me');
    },

    /**
     * Verify token is valid
     * SAFETY: Only calls backend if token exists in localStorage
     * Returns false immediately if no token, preventing unnecessary requests
     */
    async verifyToken() {
        // Check if token exists BEFORE making any API call
        const token = getToken();
        if (!token) {
            console.log('[Auth] No token in storage, skipping verify-token call');
            return false;
        }

        try {
            await request('/auth/verify-token', { method: 'POST' });
            return true;
        } catch (error) {
            // Log for debugging but don't spam
            console.warn('[Auth] Token verification failed:', error.message);
            return false;
        }
    },
};


// ===========================================
// USER API
// ===========================================

export const userApi = {
    /**
     * Get user profile
     */
    async getProfile() {
        return request('/users/profile');
    },

    /**
     * Update user profile
     */
    async updateProfile(data) {
        const params = new URLSearchParams();
        if (data.name) params.append('name', data.name);

        return request(`/users/profile?${params.toString()}`, {
            method: 'PUT',
        });
    },

    /**
     * Get user analytics
     */
    async getAnalytics() {
        return request('/users/analytics');
    },

    /**
     * Get interview history
     */
    async getHistory(limit = 10, offset = 0) {
        return request(`/users/history?limit=${limit}&offset=${offset}`);
    },

    /**
     * Get user resumes
     */
    async getResumes() {
        return request('/resumes/me');
    },
};


// ===========================================
// INTERVIEW API
// ===========================================

export const interviewApi = {
    /**
     * Create interview session
     */
    async createSession(config) {
        const params = new URLSearchParams();
        if (config.sessionType) params.append('session_type', config.sessionType);
        if (config.difficulty) params.append('difficulty', config.difficulty);
        if (config.questionCount) params.append('question_count', config.questionCount);
        if (config.resumeId) params.append('resume_id', config.resumeId);
        if (config.jobRoleId) params.append('job_role_id', config.jobRoleId);

        return request(`/interviews/sessions?${params.toString()}`, {
            method: 'POST',
        });
    },

    /**
     * Get session details
     */
    async getSession(sessionId) {
        return request(`/interviews/sessions/${sessionId}`);
    },

    /**
     * Start question planning
     */
    async startPlanning(sessionId) {
        return request(`/interviews/sessions/${sessionId}/plan`, {
            method: 'POST',
        });
    },

    /**
     * Start interview
     */
    async startInterview(sessionId) {
        return request(`/interviews/sessions/${sessionId}/start`, {
            method: 'POST',
        });
    },

    /**
     * Get current question
     */
    async getCurrentQuestion(sessionId) {
        return request(`/interviews/sessions/${sessionId}/question`);
    },

    /**
     * Submit answer
     */
    async submitAnswer(sessionId, questionId, answerText, responseTimeSeconds) {
        const params = new URLSearchParams();
        params.append('question_id', questionId);
        params.append('answer_text', answerText);
        params.append('response_time_seconds', responseTimeSeconds);

        return request(`/interviews/sessions/${sessionId}/answer?${params.toString()}`, {
            method: 'POST',
        });
    },

    /**
     * Pause interview
     */
    async pauseInterview(sessionId) {
        return request(`/interviews/sessions/${sessionId}/pause`, {
            method: 'POST',
        });
    },

    /**
     * Resume interview
     */
    async resumeInterview(sessionId) {
        return request(`/interviews/sessions/${sessionId}/resume`, {
            method: 'POST',
        });
    },

    /**
     * End interview
     */
    async endInterview(sessionId) {
        return request(`/interviews/sessions/${sessionId}/end`, {
            method: 'POST',
        });
    },

    /**
     * Get session results
     */
    async getResults(sessionId) {
        return request(`/interviews/sessions/${sessionId}/results`);
    },

    /**
     * Get available job roles
     */
    async getJobRoles() {
        return request('/interviews/roles');
    },
};


// ===========================================
// RESUME API
// ===========================================

export const resumeApi = {
    /**
     * Upload a resume file
     * @param {File} file - The resume file (PDF or DOCX)
     */
    async upload(file) {
        const token = getToken();
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE_URL}/resumes/upload`, {
            method: 'POST',
            headers: {
                ...(token && { Authorization: `Bearer ${token}` }),
            },
            body: formData,
        });

        // Handle 401 - Unauthorized
        if (response.status === 401) {
            removeToken();
            window.location.href = '/login';
            throw new Error('Session expired. Please login again.');
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.detail || data.message || 'Failed to upload resume');
        }

        return data;
    },

    /**
     * Get all resumes for current user
     */
    async getAll() {
        return request('/resumes/me');
    },

    /**
     * Get a specific resume by ID
     */
    async getById(resumeId) {
        return request(`/resumes/${resumeId}`);
    },

    /**
     * Delete a resume
     */
    async delete(resumeId) {
        return request(`/resumes/${resumeId}`, {
            method: 'DELETE',
        });
    },
};


// ===========================================
// ATS API
// ===========================================

export const atsApi = {
    /**
     * Analyze resume for ATS compatibility
     * @param {string} resumeId - Resume ID to analyze
     * @param {string} targetRole - Target job role
     * @param {string} [targetDescription] - Optional job description
     */
    async analyze(resumeId, targetRole, targetDescription = null) {
        return request(`/ats/analyze/${resumeId}`, {
            method: 'POST',
            body: JSON.stringify({
                target_role: targetRole,
                target_role_description: targetDescription,
            }),
        });
    },

    /**
     * Get ATS analysis result by ID
     */
    async getResult(analysisId) {
        return request(`/ats/result/${analysisId}`);
    },

    /**
     * Get latest ATS analysis for a resume
     */
    async getResumeAnalysis(resumeId) {
        return request(`/ats/resume/${resumeId}`);
    },

    /**
     * Get user's ATS analysis history
     */
    async getHistory(limit = 10) {
        return request(`/ats/history?limit=${limit}`);
    },

    /**
     * Get ATS API status (Gemini configured or mock mode)
     */
    async getStatus() {
        return request('/ats/status');
    },
};


// ===========================================
// INTERVIEW PLAN API
// ===========================================

export const planApi = {
    /**
     * Generate interview plan for a resume
     * @param {string} resumeId - Resume ID
     * @param {string} targetRole - Target job role
     * @param {object} options - Optional settings including roundConfig
     */
    async generate(resumeId, targetRole, options = {}) {
        return request(`/interviews/plan/${resumeId}`, {
            method: 'POST',
            body: JSON.stringify({
                target_role: targetRole,
                target_role_description: options.targetDescription || null,
                session_type: options.sessionType || 'mixed',
                difficulty_level: options.difficultyLevel || 'medium',
                question_count: options.questionCount || 10,
                company_mode: options.companyMode || null,
                // CRITICAL: Pass per-round question configuration
                round_config: options.roundConfig || null,
            }),
        });
    },

    /**
     * Get plan by ID
     */
    async getById(planId) {
        return request(`/interviews/plan/${planId}`);
    },

    /**
     * Get latest plan for a resume
     */
    async getByResume(resumeId) {
        return request(`/interviews/plans/resume/${resumeId}`);
    },

    /**
     * Get all user's plans
     */
    async getAll(limit = 10) {
        return request(`/interviews/plans/me?limit=${limit}`);
    },

    /**
     * Get questions from a plan
     */
    async getQuestions(planId) {
        return request(`/interviews/plan/${planId}/questions`);
    },
};


// ===========================================
// LIVE INTERVIEW API
// ===========================================

export const liveInterviewApi = {
    /**
     * Start a live interview session
     * @param {string} planId - Interview plan ID
     * @param {string} persona - Interviewer persona (professional, friendly, stress)
     */
    async start(planId, persona = 'professional') {
        return request('/interviews/live/start', {
            method: 'POST',
            body: JSON.stringify({
                plan_id: planId,
                persona: persona,
            }),
        });
    },

    /**
     * Get session state (for resuming after refresh)
     */
    async getState(sessionId) {
        return request(`/interviews/live/${sessionId}/state`);
    },

    /**
     * Submit an answer
     */
    async submitAnswer(sessionId, answerText, responseTimeSeconds = null) {
        return request(`/interviews/live/${sessionId}/answer`, {
            method: 'POST',
            body: JSON.stringify({
                answer_text: answerText,
                response_time_seconds: responseTimeSeconds,
            }),
        });
    },

    /**
     * Skip current question
     */
    async skip(sessionId) {
        return request(`/interviews/live/${sessionId}/skip`, {
            method: 'POST',
        });
    },

    /**
     * Pause interview
     */
    async pause(sessionId) {
        return request(`/interviews/live/${sessionId}/pause`, {
            method: 'POST',
        });
    },

    /**
     * Resume interview
     */
    async resume(sessionId) {
        return request(`/interviews/live/${sessionId}/resume`, {
            method: 'POST',
        });
    },

    /**
     * End interview early
     */
    async end(sessionId) {
        return request(`/interviews/live/${sessionId}/end`, {
            method: 'POST',
        });
    },

    /**
     * Confirm user consent to start interview
     * Called after user says "yes" to the greeting
     */
    async confirmConsent(sessionId) {
        return request(`/interviews/live/${sessionId}/consent`, {
            method: 'POST',
        });
    },

    /**
     * Get API status
     */
    async getStatus() {
        return request('/interviews/live/status');
    },
};


// ===========================================
// EVALUATION API
// ===========================================

export const evaluationApi = {
    /**
     * Quick evaluation (Groq) - Layer 1
     */
    async quick(sessionId, questionId, questionText, answerText, questionType = null) {
        return request('/evaluations/quick', {
            method: 'POST',
            body: JSON.stringify({
                session_id: sessionId,
                question_id: questionId,
                question_text: questionText,
                answer_text: answerText,
                question_type: questionType,
            }),
        });
    },

    /**
     * Deep evaluation (Gemini) - Layer 2
     */
    async deep(sessionId, questionId, questionText, answerText, options = {}) {
        return request('/evaluations/deep', {
            method: 'POST',
            body: JSON.stringify({
                session_id: sessionId,
                question_id: questionId,
                question_text: questionText,
                answer_text: answerText,
                question_type: options.questionType,
                resume_context: options.resumeContext,
                expected_topics: options.expectedTopics,
            }),
        });
    },

    /**
     * Batch deep evaluation for session
     */
    async batch(sessionId) {
        return request('/evaluations/batch', {
            method: 'POST',
            body: JSON.stringify({
                session_id: sessionId,
            }),
        });
    },

    /**
     * Get session evaluations
     */
    async getSession(sessionId) {
        return request(`/evaluations/${sessionId}`);
    },

    /**
     * Get single evaluation
     */
    async getSingle(evaluationId) {
        return request(`/evaluations/single/${evaluationId}`);
    },

    /**
     * Finalize session evaluations
     */
    async finalize(sessionId) {
        return request(`/evaluations/finalize/${sessionId}`, {
            method: 'POST',
        });
    },

    /**
     * Get evaluation API status
     */
    async getStatus() {
        return request('/evaluations/status');
    },
};


// ===========================================
// SIMULATION API (Behavioral Insights)
// ===========================================

export const simulationApi = {
    /**
     * Analyze answer for behavioral patterns
     * Text-based inference only
     */
    async analyze(sessionId, questionId, answerText, options = {}) {
        return request('/simulation/analyze', {
            method: 'POST',
            body: JSON.stringify({
                session_id: sessionId,
                question_id: questionId,
                answer_text: answerText,
                question_text: options.questionText,
                question_type: options.questionType,
                response_time_seconds: options.responseTime,
                evaluation_id: options.evaluationId,
            }),
        });
    },

    /**
     * Generate session behavioral summary
     */
    async generateSummary(sessionId) {
        return request('/simulation/session/summary', {
            method: 'POST',
            body: JSON.stringify({
                session_id: sessionId,
            }),
        });
    },

    /**
     * Get session behavioral insights
     */
    async getSession(sessionId) {
        return request(`/simulation/session/${sessionId}`);
    },

    /**
     * Get single insight
     */
    async getInsight(insightId) {
        return request(`/simulation/insight/${insightId}`);
    },

    /**
     * Get disclaimer
     */
    async getDisclaimer() {
        return request('/simulation/disclaimer');
    },
};


// ===========================================
// REPORT API
// ===========================================

export const reportApi = {
    /**
     * Generate interview report
     */
    async generate(sessionId, options = {}) {
        return request(`/reports/generate/${sessionId}`, {
            method: 'POST',
            body: JSON.stringify({
                include_behavioral: options.includeBehavioral ?? true,
                include_skills: options.includeSkills ?? true,
            }),
        });
    },

    /**
     * Get interview report
     */
    async get(sessionId) {
        return request(`/reports/${sessionId}`);
    },

    /**
     * List user reports
     */
    async list(limit = 10) {
        return request(`/reports/?limit=${limit}`);
    },
};


// ===========================================
// ROADMAP API
// ===========================================

export const roadmapApi = {
    /**
     * Generate career roadmap for session
     */
    async generate(sessionId, options = {}) {
        return request(`/roadmap/generate/${sessionId}`, {
            method: 'POST',
            body: JSON.stringify({
                target_role: options.targetRole,
                current_level: options.currentLevel,
                target_level: options.targetLevel,
                focus_areas: options.focusAreas,
            }),
        });
    },

    /**
     * Generate standalone roadmap
     */
    async generateStandalone(options = {}) {
        return request('/roadmap/generate', {
            method: 'POST',
            body: JSON.stringify({
                target_role: options.targetRole || 'Software Developer',
                current_level: options.currentLevel,
                target_level: options.targetLevel,
                focus_areas: options.focusAreas,
            }),
        });
    },

    /**
     * Get roadmap for session
     */
    async get(sessionId) {
        return request(`/roadmap/${sessionId}`);
    },

    /**
     * List user roadmaps
     */
    async list(limit = 10) {
        return request(`/roadmap/?limit=${limit}`);
    },
};


// ===========================================
// COMPANY MODES API
// ===========================================

export const companyApi = {
    /**
     * Get all company modes
     */
    async getModes() {
        return request('/companies/modes');
    },

    /**
     * Get specific company mode
     */
    async getMode(modeId) {
        return request(`/companies/modes/${modeId}`);
    },
};


// ===========================================
// PERSONALITY MODES API
// ===========================================

export const personalityApi = {
    /**
     * Get all personality modes
     */
    async getAll() {
        return request('/personalities/');
    },

    /**
     * Get specific personality mode
     */
    async getById(personalityId) {
        return request(`/personalities/${personalityId}`);
    },
};


// ===========================================
// ANALYTICS API
// ===========================================

export const analyticsApi = {
    /**
     * Get full dashboard data
     */
    async getDashboard(days = 30) {
        return request(`/analytics/dashboard?days=${days}`);
    },

    /**
     * Get overview statistics
     */
    async getOverview(days = 30) {
        return request(`/analytics/overview?days=${days}`);
    },

    /**
     * Get skill performance
     */
    async getSkills() {
        return request('/analytics/skills');
    },

    /**
     * Get progress over time
     */
    async getProgress(days = 90, interval = 'week') {
        return request(`/analytics/progress?days=${days}&interval=${interval}`);
    },

    /**
     * Get question type breakdown
     */
    async getQuestionTypes() {
        return request('/analytics/question-types');
    },

    /**
     * Get recent interviews
     */
    async getRecent(limit = 5) {
        return request(`/analytics/recent?limit=${limit}`);
    },
};


// ===========================================
// PROFILE API (User Profile Page)
// ===========================================

export const profileApi = {
    /**
     * Get user profile (same as auth/me)
     */
    async getProfile() {
        return request('/users/profile');
    },

    /**
     * Get interview history
     */
    async getInterviewHistory(limit = 20, offset = 0) {
        return request(`/users/history?limit=${limit}&offset=${offset}`);
    },

    /**
     * Get user statistics
     */
    async getUserStats() {
        try {
            const response = await request('/analytics/overview?days=90');
            // Transform to expected shape
            return {
                success: true,
                stats: {
                    total_interviews: response.total_interviews || 0,
                    completed_interviews: response.completed_interviews || 0,
                    average_score: response.average_score || 0,
                    total_resumes: 0, // Will be filled from resume API
                },
            };
        } catch (error) {
            return {
                success: false,
                stats: {
                    total_interviews: 0,
                    completed_interviews: 0,
                    average_score: 0,
                    total_resumes: 0,
                },
            };
        }
    },

    /**
     * Update user profile
     */
    async updateProfile(data) {
        const params = new URLSearchParams();
        if (data.name) params.append('name', data.name);

        return request(`/users/profile?${params.toString()}`, {
            method: 'PUT',
        });
    },
};


// ===========================================
// COMBINED API EXPORT
// ===========================================

export const api = {
    auth: authApi,
    user: userApi,
    interview: interviewApi,
    resume: resumeApi,
    ats: atsApi,
    plan: planApi,
    live: liveInterviewApi,
    evaluation: evaluationApi,
    simulation: simulationApi,
    report: reportApi,
    roadmap: roadmapApi,
    company: companyApi,
    personality: personalityApi,
    analytics: analyticsApi,
    profile: profileApi,

    // Legacy compatibility
    login: authApi.login,
    signup: authApi.signup,
    logout: authApi.logout,
    getCurrentUser: authApi.getCurrentUser,
};

export default api;
