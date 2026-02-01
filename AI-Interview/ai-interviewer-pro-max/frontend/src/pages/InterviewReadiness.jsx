/**
 * Interview Readiness Page - Premium Design
 * 
 * Step-by-step interview preparation flow with
 * modern card layout and smooth animations.
 * 
 * PRODUCTION FIX:
 * - Single source of truth for interview plan
 * - Resume-driven role suggestions
 * - Persistent input caching
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import InterviewPlanPreview from '../components/InterviewPlanPreview';
import CompanyModeSelector from '../components/CompanyModeSelector';
import PersonalitySelector from '../components/PersonalitySelector';
import { resumeApi, planApi, getStoredUser } from '../services/api';
import {
    Target, FileText, Briefcase, Settings, Sparkles,
    ChevronRight, Loader2, Upload, CheckCircle, AlertCircle
} from 'lucide-react';

// ===========================================
// PERSISTENCE CACHE KEYS
// ===========================================
const CACHE_PREFIX = 'ai_interviewer_config_';
const CACHE_KEYS = {
    selectedResumeId: `${CACHE_PREFIX}resume_id`,
    targetRole: `${CACHE_PREFIX}target_role`,
    sessionType: `${CACHE_PREFIX}session_type`,
    difficulty: `${CACHE_PREFIX}difficulty`,
    companyMode: `${CACHE_PREFIX}company_mode`,
    personality: `${CACHE_PREFIX}personality`,
    roundConfig: `${CACHE_PREFIX}round_config`,
    selectedRoles: `${CACHE_PREFIX}selected_roles`, // Multi-select roles
};

// Helper: Get cached value from localStorage
const getCachedValue = (key, defaultValue) => {
    try {
        const cached = localStorage.getItem(key);
        if (cached !== null) {
            return JSON.parse(cached);
        }
    } catch {
        // Storage error or parse error - ignore
    }
    return defaultValue;
};

// Helper: Set cached value (only used when user explicitly changes a value)
const setCachedValue = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Storage quota exceeded or disabled
    }
};

// Helper: Clear ALL cached values (for fresh start)
const clearAllCache = () => {
    try {
        Object.values(CACHE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    } catch {
        // Storage disabled
    }
};

// ===========================================
// ROLE EXTRACTION FROM RESUME
// ===========================================
const ROLE_KEYWORDS_MAP = {
    // Frontend
    'react': ['Frontend Developer', 'React Developer', 'UI Engineer'],
    'angular': ['Frontend Developer', 'Angular Developer', 'UI Engineer'],
    'vue': ['Frontend Developer', 'Vue.js Developer', 'UI Engineer'],
    'javascript': ['Frontend Developer', 'Full Stack Developer', 'Software Engineer'],
    'typescript': ['Frontend Developer', 'Full Stack Developer', 'Software Engineer'],
    'html': ['Frontend Developer', 'Web Developer'],
    'css': ['Frontend Developer', 'Web Developer', 'UI Engineer'],

    // Backend
    'python': ['Backend Developer', 'Python Developer', 'Software Engineer', 'Data Engineer'],
    'java': ['Backend Developer', 'Java Developer', 'Software Engineer'],
    'node': ['Backend Developer', 'Node.js Developer', 'Full Stack Developer'],
    'express': ['Backend Developer', 'Node.js Developer', 'API Engineer'],
    'django': ['Backend Developer', 'Python Developer', 'Full Stack Developer'],
    'fastapi': ['Backend Developer', 'Python Developer', 'API Engineer'],
    'spring': ['Backend Developer', 'Java Developer', 'Software Engineer'],
    'golang': ['Backend Developer', 'Go Developer', 'Software Engineer'],
    'rust': ['Systems Engineer', 'Backend Developer', 'Software Engineer'],

    // Data/ML
    'machine learning': ['ML Engineer', 'Data Scientist', 'AI Engineer'],
    'deep learning': ['ML Engineer', 'Deep Learning Engineer', 'AI Researcher'],
    'tensorflow': ['ML Engineer', 'Data Scientist', 'AI Engineer'],
    'pytorch': ['ML Engineer', 'Deep Learning Engineer', 'AI Engineer'],
    'pandas': ['Data Scientist', 'Data Analyst', 'Data Engineer'],
    'numpy': ['Data Scientist', 'ML Engineer', 'Data Analyst'],
    'scikit': ['Data Scientist', 'ML Engineer', 'Data Analyst'],
    'data analysis': ['Data Analyst', 'Business Analyst', 'Data Scientist'],
    'sql': ['Data Engineer', 'Backend Developer', 'Data Analyst', 'Database Administrator'],

    // DevOps/Cloud
    'aws': ['DevOps Engineer', 'Cloud Engineer', 'Solutions Architect'],
    'azure': ['DevOps Engineer', 'Cloud Engineer', 'Solutions Architect'],
    'gcp': ['DevOps Engineer', 'Cloud Engineer', 'Solutions Architect'],
    'docker': ['DevOps Engineer', 'Platform Engineer', 'Backend Developer'],
    'kubernetes': ['DevOps Engineer', 'Platform Engineer', 'SRE'],
    'terraform': ['DevOps Engineer', 'Infrastructure Engineer', 'Cloud Engineer'],
    'ci/cd': ['DevOps Engineer', 'SRE', 'Platform Engineer'],

    // Mobile
    'ios': ['iOS Developer', 'Mobile Developer', 'Software Engineer'],
    'android': ['Android Developer', 'Mobile Developer', 'Software Engineer'],
    'swift': ['iOS Developer', 'Mobile Developer'],
    'kotlin': ['Android Developer', 'Mobile Developer', 'Backend Developer'],
    'flutter': ['Mobile Developer', 'Cross-Platform Developer'],
    'react native': ['Mobile Developer', 'Cross-Platform Developer', 'React Developer'],

    // Management/Lead
    'lead': ['Tech Lead', 'Engineering Manager', 'Senior Engineer'],
    'manager': ['Engineering Manager', 'Product Manager', 'Project Manager'],
    'architect': ['Solutions Architect', 'Technical Architect', 'Principal Engineer'],
    'scrum': ['Scrum Master', 'Agile Coach', 'Project Manager'],
    'product': ['Product Manager', 'Product Owner', 'Technical Product Manager'],
};

// Default fallback roles (always shown)
const DEFAULT_ROLES = [
    'Software Engineer',
    'Full Stack Developer',
    'Backend Developer',
    'Frontend Developer',
];

// DEFAULT VALUES
const DEFAULT_VALUES = {
    selectedResumeId: '',
    targetRole: 'Software Engineer',
    sessionType: 'mixed',
    difficulty: 'medium',
    companyMode: 'faang', // First option in COMPANY_MODES
    personality: 'strict', // First option in personality list
    roundConfig: { dsa: 2, technical: 4, behavioral: 2, hr: 2 },
};

function InterviewReadiness() {
    const navigate = useNavigate();
    const location = useLocation();
    const user = getStoredUser();

    // ===========================================
    // DOMAIN FROM DOMAIN SELECTION PAGE
    // ===========================================
    const domain = location.state?.domain || 'computer_science';
    const domainName = location.state?.domainName || 'Computer Science';
    const domainTopics = location.state?.domainTopics || ['DSA', 'System Design', 'OOP'];

    // ===========================================
    // STATE - All initialized with DEFAULT values (fresh start)
    // ===========================================
    const [loading, setLoading] = useState(true);
    const [resumes, setResumes] = useState([]);
    const [plan, setPlan] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState(null);
    const [currentStep, setCurrentStep] = useState(1);
    const [showInstructionModal, setShowInstructionModal] = useState(false);

    // Unique key to force input resets on each page load
    const [formKey, setFormKey] = useState(Date.now());

    // FRESH START: All inputs initialized with DEFAULT values only
    // Resume ID from location state ONLY (no cache)
    const [selectedResumeId, setSelectedResumeIdState] = useState(
        location.state?.resumeId || DEFAULT_VALUES.selectedResumeId
    );

    // Target Role - Default value (fresh)
    const [targetRole, setTargetRoleState] = useState(
        DEFAULT_VALUES.targetRole
    );

    // Session Type - Default value (fresh)
    const [sessionType, setSessionTypeState] = useState(
        DEFAULT_VALUES.sessionType
    );

    // Difficulty - Default value (fresh)
    const [difficulty, setDifficultyState] = useState(
        DEFAULT_VALUES.difficulty
    );

    // Company Mode - Default value (fresh)
    const [companyMode, setCompanyModeState] = useState(
        DEFAULT_VALUES.companyMode
    );

    // Personality - Default value (fresh)
    const [personality, setPersonalityState] = useState(
        DEFAULT_VALUES.personality
    );

    // Round Configuration - Default value (fresh)
    const [roundConfig, setRoundConfigState] = useState(
        DEFAULT_VALUES.roundConfig
    );

    // Resume-driven suggested roles (computed from selected resume)
    const [suggestedRoles, setSuggestedRoles] = useState(DEFAULT_ROLES);

    // ===========================================
    // SETTERS WITH CACHE PERSISTENCE
    // ===========================================
    const setSelectedResumeId = useCallback((value) => {
        setSelectedResumeIdState(value);
        setCachedValue(CACHE_KEYS.selectedResumeId, value);
    }, []);

    const setTargetRole = useCallback((value) => {
        setTargetRoleState(value);
        setCachedValue(CACHE_KEYS.targetRole, value);
    }, []);

    const setSessionType = useCallback((value) => {
        setSessionTypeState(value);
        setCachedValue(CACHE_KEYS.sessionType, value);
    }, []);

    const setDifficulty = useCallback((value) => {
        setDifficultyState(value);
        setCachedValue(CACHE_KEYS.difficulty, value);
    }, []);

    const setCompanyMode = useCallback((value) => {
        setCompanyModeState(value);
        setCachedValue(CACHE_KEYS.companyMode, value);
    }, []);

    const setPersonality = useCallback((value) => {
        setPersonalityState(value);
        setCachedValue(CACHE_KEYS.personality, value);
    }, []);

    const setRoundConfig = useCallback((valueOrUpdater) => {
        setRoundConfigState(prev => {
            const newValue = typeof valueOrUpdater === 'function' ? valueOrUpdater(prev) : valueOrUpdater;
            setCachedValue(CACHE_KEYS.roundConfig, newValue);
            return newValue;
        });
    }, []);

    // Calculate total from round config
    const totalFromRounds = useMemo(() =>
        Object.values(roundConfig).reduce((a, b) => a + b, 0),
        [roundConfig]
    );

    // ===========================================
    // EXTRACT ROLES FROM RESUME TEXT
    // ===========================================
    const extractRolesFromResume = useCallback((resumeText) => {
        if (!resumeText) return DEFAULT_ROLES;

        const textLower = resumeText.toLowerCase();
        const extractedRoles = new Set();

        // Scan resume text for keywords
        for (const [keyword, roles] of Object.entries(ROLE_KEYWORDS_MAP)) {
            if (textLower.includes(keyword)) {
                roles.forEach(role => extractedRoles.add(role));
            }
        }

        // If we found roles, prioritize them; otherwise use defaults
        const rolesArray = Array.from(extractedRoles);
        if (rolesArray.length > 0) {
            // Limit to 8 roles, sorted by relevance (first match = higher priority)
            return rolesArray.slice(0, 8);
        }

        return DEFAULT_ROLES;
    }, []);

    // ===========================================
    // LOAD RESUMES AND EXTRACT ROLE SUGGESTIONS
    // ===========================================
    const loadResumes = useCallback(async () => {
        try {
            setLoading(true);
            const response = await resumeApi.getAll();
            if (response.success) {
                setResumes(response.resumes || []);
                // DO NOT auto-select resume - user must explicitly choose
                // This ensures fresh start every time
            }
        } catch (err) {
            setError('Failed to load resumes. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    const loadExistingPlan = useCallback(async (resumeId) => {
        if (!resumeId) return;
        try {
            const response = await planApi.getByResume(resumeId);
            if (response.success && response.plan) {
                // ONLY set the plan object for display
                // DO NOT override user's form settings - they should start fresh
                setPlan(response.plan);
                setCurrentStep(3);
            } else {
                setPlan(null);
            }
        } catch (err) {
            setPlan(null);
        }
    }, []);

    // ===========================================
    // EFFECTS
    // ===========================================

    // Clear all cache on mount (fresh start for user)
    useEffect(() => {
        clearAllCache();
        // Reset form key to force input remount
        setFormKey(Date.now());
    }, []);

    // Load resumes on mount
    useEffect(() => {
        loadResumes();
    }, [loadResumes]);

    // When selected resume changes, load existing plan and extract role suggestions
    useEffect(() => {
        if (selectedResumeId) {
            loadExistingPlan(selectedResumeId);
            if (currentStep < 2) setCurrentStep(2);

            // Extract role suggestions from resume text
            const selectedResume = resumes.find(r => r.id === selectedResumeId);
            if (selectedResume) {
                // If resume has text content, extract roles
                // Note: We need the full resume with content, so fetch it
                resumeApi.getById(selectedResumeId)
                    .then(response => {
                        if (response.success && response.resume?.text_content) {
                            const roles = extractRolesFromResume(response.resume.text_content);
                            setSuggestedRoles(roles);
                        }
                    })
                    .catch(() => setSuggestedRoles(DEFAULT_ROLES));
            }
        }
    }, [selectedResumeId, loadExistingPlan, currentStep, resumes, extractRolesFromResume]);

    const handleGeneratePlan = async () => {
        if (!selectedResumeId) {
            setError('Please select a resume first');
            return;
        }
        if (!targetRole.trim()) {
            setError('Please enter a target job role');
            return;
        }
        if (totalFromRounds < 3) {
            setError('Please configure at least 3 questions total');
            return;
        }

        setGenerating(true);
        setError(null);

        try {
            const response = await planApi.generate(
                selectedResumeId,
                targetRole.trim(),
                {
                    sessionType,
                    difficultyLevel: difficulty,
                    questionCount: totalFromRounds,
                    companyMode,
                    // Pass per-round configuration
                    roundConfig: {
                        dsa_questions: roundConfig.dsa,
                        technical_questions: roundConfig.technical,
                        behavioral_questions: roundConfig.behavioral,
                        hr_questions: roundConfig.hr,
                    },
                }
            );

            if (response.success && response.plan) {
                setPlan(response.plan);
                setCurrentStep(3);
            } else {
                throw new Error(response.message || 'Failed to generate plan');
            }
        } catch (err) {
            setError(err.message || 'Failed to generate interview plan');
        } finally {
            setGenerating(false);
        }
    };

    const handleStartInterview = () => {
        if (!plan) return;
        // Show instruction modal first
        setShowInstructionModal(true);
    };

    // Proceed to interview after instruction is acknowledged
    const handleProceedToInterview = () => {
        setShowInstructionModal(false);
        // Store acknowledgment in session storage (reset on browser close)
        sessionStorage.setItem('ai_interviewer_instruction_accepted', 'true');
        navigate('/interview', {
            state: {
                planId: plan.id,
                resumeId: selectedResumeId,
                personality: personality,
            }
        });
    };

    const selectedResume = resumes.find(r => r.id === selectedResumeId);

    return (
        <div className="readiness-container">
            <Navbar user={user} />

            <main className="readiness-main">
                {/* Domain Badge & Back */}
                <div className="domain-breadcrumb">
                    <button
                        className="back-btn-small"
                        onClick={() => navigate('/select-domain')}
                    >
                        ← Change Domain
                    </button>
                    <div className="domain-badge-inline">
                        <span className="domain-badge-icon">💻</span>
                        <span className="domain-badge-label">{domainName}</span>
                    </div>
                </div>

                {/* Page Header */}
                <section className="page-header-premium">
                    <div className="header-icon">
                        <Target size={40} />
                    </div>
                    <div className="header-content">
                        <h1>Interview Preparation</h1>
                        <p>Configure your personalized AI-powered mock interview for {domainName}</p>
                    </div>
                </section>

                {/* Step Indicator */}
                <div className="step-indicator">
                    <div className={`step ${currentStep >= 1 ? 'active' : ''} ${selectedResumeId ? 'completed' : ''}`}>
                        <span className="step-number">1</span>
                        <span className="step-label">Resume</span>
                    </div>
                    <ChevronRight size={16} className="step-arrow" />
                    <div className={`step ${currentStep >= 2 ? 'active' : ''} ${plan ? 'completed' : ''}`}>
                        <span className="step-number">2</span>
                        <span className="step-label">Configure</span>
                    </div>
                    <ChevronRight size={16} className="step-arrow" />
                    <div className={`step ${currentStep >= 3 ? 'active' : ''}`}>
                        <span className="step-number">3</span>
                        <span className="step-label">Start</span>
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="error-banner">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                        <button onClick={() => setError(null)}>×</button>
                    </div>
                )}

                <div className="readiness-grid">
                    {/* Configuration Panel */}
                    <section className="config-panel card">
                        <div className="panel-header">
                            <Settings size={20} />
                            <h2>Interview Configuration</h2>
                        </div>

                        {/* Resume Selection */}
                        <div className="config-section">
                            <div className="section-header">
                                <FileText size={18} />
                                <h3>Select Resume</h3>
                            </div>
                            {loading ? (
                                <div className="loading-inline">
                                    <Loader2 size={20} className="spin" />
                                    <span>Loading resumes...</span>
                                </div>
                            ) : resumes.length === 0 ? (
                                <div className="no-resumes-card">
                                    <Upload size={32} />
                                    <p>No resumes uploaded yet</p>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => navigate('/resumes')}
                                    >
                                        Upload Resume
                                    </button>
                                </div>
                            ) : (
                                <select
                                    key={`resume-${formKey}`}
                                    value={selectedResumeId}
                                    onChange={(e) => setSelectedResumeId(e.target.value)}
                                    disabled={generating}
                                    className="form-select"
                                >
                                    <option value="">Select a resume...</option>
                                    {resumes.map((resume) => (
                                        <option key={resume.id} value={resume.id}>
                                            {resume.filename} {resume.is_parsed === 'success' ? '✓' : '⏳'}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Company Mode */}
                        {selectedResumeId && (
                            <div className="config-section">
                                <div className="section-header">
                                    <Briefcase size={18} />
                                    <h3>Interview Style</h3>
                                </div>
                                <CompanyModeSelector
                                    value={companyMode}
                                    onChange={setCompanyMode}
                                    disabled={generating}
                                />
                            </div>
                        )}

                        {/* Personality */}
                        {selectedResumeId && (
                            <div className="config-section">
                                <PersonalitySelector
                                    selectedPersonality={personality}
                                    onPersonalitySelect={setPersonality}
                                    disabled={generating}
                                />
                            </div>
                        )}

                        {/* Target Role */}
                        <div className="config-section">
                            <div className="section-header">
                                <Target size={18} />
                                <h3>Target Role</h3>
                            </div>
                            <input
                                key={`role-${formKey}`}
                                type="text"
                                value={targetRole}
                                onChange={(e) => setTargetRole(e.target.value)}
                                placeholder="e.g., Software Engineer"
                                disabled={generating}
                                className="form-input"
                            />
                            <div className="role-chips">
                                {suggestedRoles.slice(0, 4).map((role) => (
                                    <button
                                        key={role}
                                        type="button"
                                        className={`chip ${targetRole === role ? 'active' : ''}`}
                                        onClick={() => setTargetRole(role)}
                                        disabled={generating}
                                    >
                                        {role}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Difficulty Selection */}
                        <div className="config-section">
                            <div className="section-header">
                                <Settings size={18} />
                                <h3>Difficulty Level</h3>
                            </div>
                            <select
                                key={`diff-${formKey}`}
                                value={difficulty}
                                onChange={(e) => setDifficulty(e.target.value)}
                                disabled={generating}
                                className="form-select"
                            >
                                <option value="easy">Entry Level</option>
                                <option value="medium">Mid Level</option>
                                <option value="hard">Senior</option>
                                <option value="expert">Lead/Principal</option>
                            </select>
                        </div>

                        {/* Per-Round Question Configuration */}
                        <div className="config-section">
                            <div className="section-header">
                                <Settings size={18} />
                                <h3>Questions Per Round</h3>
                                <span className="badge-total">{totalFromRounds} total</span>
                            </div>

                            <div className="round-config-grid">
                                {/* DSA Round */}
                                <div className="round-config-item">
                                    <div className="round-label">
                                        <span className="round-icon">💻</span>
                                        <span>DSA</span>
                                    </div>
                                    <div className="round-controls">
                                        <button
                                            type="button"
                                            className="round-btn"
                                            onClick={() => setRoundConfig(prev => ({ ...prev, dsa: Math.max(0, prev.dsa - 1) }))}
                                            disabled={generating || roundConfig.dsa <= 0}
                                        >−</button>
                                        <span className="round-count">{roundConfig.dsa}</span>
                                        <button
                                            type="button"
                                            className="round-btn"
                                            onClick={() => setRoundConfig(prev => ({ ...prev, dsa: Math.min(10, prev.dsa + 1) }))}
                                            disabled={generating || roundConfig.dsa >= 10}
                                        >+</button>
                                    </div>
                                </div>

                                {/* Technical Round */}
                                <div className="round-config-item">
                                    <div className="round-label">
                                        <span className="round-icon">🔧</span>
                                        <span>Technical</span>
                                    </div>
                                    <div className="round-controls">
                                        <button
                                            type="button"
                                            className="round-btn"
                                            onClick={() => setRoundConfig(prev => ({ ...prev, technical: Math.max(0, prev.technical - 1) }))}
                                            disabled={generating || roundConfig.technical <= 0}
                                        >−</button>
                                        <span className="round-count">{roundConfig.technical}</span>
                                        <button
                                            type="button"
                                            className="round-btn"
                                            onClick={() => setRoundConfig(prev => ({ ...prev, technical: Math.min(10, prev.technical + 1) }))}
                                            disabled={generating || roundConfig.technical >= 10}
                                        >+</button>
                                    </div>
                                </div>

                                {/* Behavioral Round */}
                                <div className="round-config-item">
                                    <div className="round-label">
                                        <span className="round-icon">🗣️</span>
                                        <span>Behavioral</span>
                                    </div>
                                    <div className="round-controls">
                                        <button
                                            type="button"
                                            className="round-btn"
                                            onClick={() => setRoundConfig(prev => ({ ...prev, behavioral: Math.max(0, prev.behavioral - 1) }))}
                                            disabled={generating || roundConfig.behavioral <= 0}
                                        >−</button>
                                        <span className="round-count">{roundConfig.behavioral}</span>
                                        <button
                                            type="button"
                                            className="round-btn"
                                            onClick={() => setRoundConfig(prev => ({ ...prev, behavioral: Math.min(10, prev.behavioral + 1) }))}
                                            disabled={generating || roundConfig.behavioral >= 10}
                                        >+</button>
                                    </div>
                                </div>

                                {/* HR Round */}
                                <div className="round-config-item">
                                    <div className="round-label">
                                        <span className="round-icon">👔</span>
                                        <span>HR</span>
                                    </div>
                                    <div className="round-controls">
                                        <button
                                            type="button"
                                            className="round-btn"
                                            onClick={() => setRoundConfig(prev => ({ ...prev, hr: Math.max(0, prev.hr - 1) }))}
                                            disabled={generating || roundConfig.hr <= 0}
                                        >−</button>
                                        <span className="round-count">{roundConfig.hr}</span>
                                        <button
                                            type="button"
                                            className="round-btn"
                                            onClick={() => setRoundConfig(prev => ({ ...prev, hr: Math.min(10, prev.hr + 1) }))}
                                            disabled={generating || roundConfig.hr >= 10}
                                        >+</button>
                                    </div>
                                </div>
                            </div>

                            {/* Estimated Duration - Matches backend: 3 min/question */}
                            <div className="duration-estimate">
                                <span>⏱️ Estimated: {Math.round(totalFromRounds * 3)} min</span>
                            </div>
                        </div>

                        {/* Generate Button */}
                        <button
                            className="btn btn-primary btn-lg generate-btn"
                            onClick={handleGeneratePlan}
                            disabled={generating || !selectedResumeId}
                        >
                            {generating ? (
                                <>
                                    <Loader2 size={20} className="spin" />
                                    <span>Generating Plan...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles size={20} />
                                    <span>{plan ? 'Regenerate Plan' : 'Generate Interview Plan'}</span>
                                </>
                            )}
                        </button>
                    </section>

                    {/* Plan Preview Panel */}
                    <section className="preview-panel">
                        {generating ? (
                            <div className="generating-state card">
                                <div className="generating-animation">
                                    <Sparkles size={48} className="sparkle-icon" />
                                </div>
                                <h3>Creating Your Interview Plan</h3>
                                <p>Analyzing your resume and generating personalized questions...</p>
                                <div className="progress-bar">
                                    <div className="progress-fill generating"></div>
                                </div>
                            </div>
                        ) : plan ? (
                            <InterviewPlanPreview
                                plan={plan}
                                onStartInterview={handleStartInterview}
                                onRegenerate={handleGeneratePlan}
                            />
                        ) : (
                            <div className="no-plan card">
                                <div className="no-plan-icon">
                                    <Target size={64} />
                                </div>
                                <h3>No Interview Plan Yet</h3>
                                <p>Configure your settings and generate a personalized interview plan based on your resume.</p>
                                <ul className="feature-list">
                                    <li>
                                        <CheckCircle size={16} />
                                        Questions tailored to your experience
                                    </li>
                                    <li>
                                        <CheckCircle size={16} />
                                        Focus on your skill gaps
                                    </li>
                                    <li>
                                        <CheckCircle size={16} />
                                        Deeper probing on strengths
                                    </li>
                                    <li>
                                        <CheckCircle size={16} />
                                        Behavioral questions included
                                    </li>
                                </ul>
                            </div>
                        )}
                    </section>
                </div>
            </main>

            {/* ===========================================
                INSTRUCTION MODAL (Shows before interview)
                =========================================== */}
            {showInstructionModal && (
                <div className="instruction-modal-overlay">
                    <div className="instruction-modal">
                        <div className="instruction-modal-icon">
                            <AlertCircle size={48} />
                        </div>
                        <h2 className="instruction-modal-title">Before You Begin</h2>
                        <div className="instruction-modal-content">
                            <p>
                                This AI Interviewer is trained and fine-tuned
                                <strong> ONLY for interview practice purposes</strong>.
                            </p>
                            <p>
                                Please focus on <strong>interview responses only</strong>.
                                The AI is designed to evaluate and help you improve your
                                interview skills, not to answer general questions.
                            </p>
                            <ul className="instruction-list">
                                <li>✓ Answer interview questions thoughtfully</li>
                                <li>✓ Ask for clarification if needed</li>
                                <li>✗ Do not ask unrelated questions</li>
                                <li>✗ Do not use as a general chatbot</li>
                            </ul>
                        </div>
                        <button
                            className="btn btn-primary btn-lg instruction-modal-btn"
                            onClick={handleProceedToInterview}
                        >
                            I Understand
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default InterviewReadiness;
