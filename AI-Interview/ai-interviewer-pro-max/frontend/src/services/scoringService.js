/**
 * Interview Scoring Service
 * 
 * Rule-based smart scoring for interview performance.
 * Uses heuristics instead of heavy ML for fast execution.
 * 
 * Scores:
 * - Speech Clarity (filler words, pauses, speed)
 * - Confidence (answer length, hesitation)
 * - Eye Contact (simulated from webcam availability)
 * - Technical Depth (keyword density, structure)
 */

// ===========================================
// FILLER WORDS DATABASE
// ===========================================

const FILLER_WORDS = [
    'um', 'uh', 'er', 'ah', 'like', 'you know', 'basically',
    'actually', 'literally', 'honestly', 'right', 'so yeah',
    'kind of', 'sort of', 'i mean', 'well', 'okay so',
];

const HEDGING_WORDS = [
    'maybe', 'perhaps', 'probably', 'might', 'could be',
    'i think', 'i guess', 'i believe', 'i suppose',
    'not sure', 'possibly', 'somewhat',
];

const TECHNICAL_KEYWORDS = [
    // Programming
    'algorithm', 'data structure', 'complexity', 'optimization',
    'scalability', 'performance', 'architecture', 'design pattern',
    'microservices', 'api', 'database', 'cache', 'queue',
    // Concepts
    'trade-off', 'approach', 'solution', 'implementation',
    'refactor', 'debug', 'testing', 'deployment', 'monitoring',
    // Methods
    'agile', 'scrum', 'sprint', 'iteration', 'review',
];

const STAR_METHOD_INDICATORS = [
    'situation', 'task', 'action', 'result',
    'challenge', 'approach', 'outcome', 'learned',
    'responsibility', 'achieved', 'improved', 'delivered',
];

// ===========================================
// SCORING FUNCTIONS
// ===========================================

/**
 * Calculate speech clarity score (0-100)
 * Based on filler words, sentence structure, and word count
 */
export function calculateClarityScore(answer) {
    if (!answer || answer.trim().length === 0) return 0;

    const text = answer.toLowerCase();
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    if (wordCount < 5) return 20; // Too short

    // Count filler words
    let fillerCount = 0;
    FILLER_WORDS.forEach(filler => {
        const regex = new RegExp(`\\b${filler}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) fillerCount += matches.length;
    });

    // Filler ratio (lower is better)
    const fillerRatio = fillerCount / wordCount;
    const fillerPenalty = Math.min(40, fillerRatio * 200);

    // Sentence count and average length
    const sentences = answer.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = wordCount / Math.max(1, sentences.length);

    // Ideal sentence length is 15-25 words
    let structurePenalty = 0;
    if (avgSentenceLength < 8) structurePenalty = 15;
    else if (avgSentenceLength > 35) structurePenalty = 20;

    // Word length variety (indicates vocabulary)
    const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / wordCount;
    const vocabularyBonus = avgWordLength > 5 ? 10 : 0;

    // Calculate final score
    let score = 100 - fillerPenalty - structurePenalty + vocabularyBonus;

    // Clamp to 0-100
    return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculate confidence score (0-100)
 * Based on hedging words, answer length, and assertive language
 */
export function calculateConfidenceScore(answer) {
    if (!answer || answer.trim().length === 0) return 0;

    const text = answer.toLowerCase();
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    if (wordCount < 5) return 15; // Very short = low confidence

    // Count hedging words
    let hedgingCount = 0;
    HEDGING_WORDS.forEach(hedge => {
        const regex = new RegExp(`\\b${hedge}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) hedgingCount += matches.length;
    });

    // Hedging ratio (lower is better)
    const hedgingRatio = hedgingCount / wordCount;
    const hedgingPenalty = Math.min(35, hedgingRatio * 250);

    // Answer length bonus (longer = more confident, up to a point)
    let lengthBonus = 0;
    if (wordCount >= 30) lengthBonus = 10;
    if (wordCount >= 60) lengthBonus = 15;
    if (wordCount >= 100) lengthBonus = 20;

    // Assertive language detection
    const assertivePatterns = [
        /\bi (did|led|managed|created|built|designed|implemented)\b/gi,
        /\bmy (approach|solution|responsibility)\b/gi,
        /\bsuccessfully\b/gi,
        /\bachieved\b/gi,
        /\bdelivered\b/gi,
    ];

    let assertiveBonus = 0;
    assertivePatterns.forEach(pattern => {
        if (pattern.test(text)) assertiveBonus += 5;
    });
    assertiveBonus = Math.min(20, assertiveBonus);

    // Calculate final score
    let score = 70 - hedgingPenalty + lengthBonus + assertiveBonus;

    // Clamp to 0-100
    return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculate technical depth score (0-100)
 * Based on technical keywords and structured responses
 */
export function calculateTechnicalScore(answer) {
    if (!answer || answer.trim().length === 0) return 0;

    const text = answer.toLowerCase();
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    if (wordCount < 10) return 10;

    // Count technical keywords
    let technicalCount = 0;
    TECHNICAL_KEYWORDS.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) technicalCount += matches.length;
    });

    // Technical density bonus
    const technicalRatio = technicalCount / wordCount;
    const technicalBonus = Math.min(30, technicalRatio * 500);

    // STAR method indicators
    let starCount = 0;
    STAR_METHOD_INDICATORS.forEach(indicator => {
        if (text.includes(indicator)) starCount++;
    });
    const starBonus = Math.min(20, starCount * 5);

    // Specific example detection
    const hasExample = /for example|such as|instance|specifically|when i/gi.test(text);
    const exampleBonus = hasExample ? 15 : 0;

    // Numbers and metrics (shows quantifiable experience)
    const hasNumbers = /\d+/.test(answer);
    const metricsBonus = hasNumbers ? 10 : 0;

    // Base score from length
    let baseScore = 40;
    if (wordCount >= 50) baseScore = 50;
    if (wordCount >= 80) baseScore = 55;

    // Calculate final score
    let score = baseScore + technicalBonus + starBonus + exampleBonus + metricsBonus;

    // Clamp to 0-100
    return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculate eye contact score (0-100)
 * Simulated based on webcam availability and face detection
 */
export function calculateEyeContactScore(stats) {
    const {
        totalDuration = 0,      // Total interview duration in seconds
        cameraActiveTime = 0,   // Time camera was on
        faceDetectedTime = 0,   // Time face was detected
        lookAwayCount = 0,      // Times user looked away
    } = stats;

    if (totalDuration === 0) return 50; // Default if no data

    // Camera usage ratio
    const cameraRatio = cameraActiveTime / totalDuration;
    const cameraScore = cameraRatio * 40; // Max 40 points

    // Face detection ratio
    const faceRatio = cameraActiveTime > 0
        ? faceDetectedTime / cameraActiveTime
        : 0;
    const faceScore = faceRatio * 40; // Max 40 points

    // Look away penalty (normalized per minute)
    const durationMinutes = totalDuration / 60;
    const lookAwayPerMinute = lookAwayCount / Math.max(1, durationMinutes);
    const lookAwayPenalty = Math.min(20, lookAwayPerMinute * 4);

    // Calculate final score
    let score = cameraScore + faceScore + 20 - lookAwayPenalty;

    // Clamp to 0-100
    return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculate overall interview score from components
 */
export function calculateOverallScore(scores) {
    const {
        clarity = 50,
        confidence = 50,
        technical = 50,
        eyeContact = 50,
    } = scores;

    // Weighted average
    const overall = (
        clarity * 0.25 +
        confidence * 0.30 +
        technical * 0.30 +
        eyeContact * 0.15
    );

    return Math.round(overall);
}

/**
 * Get score grade and label
 */
export function getScoreGrade(score) {
    if (score >= 90) return { grade: 'A+', label: 'Exceptional', color: '#10b981' };
    if (score >= 85) return { grade: 'A', label: 'Excellent', color: '#10b981' };
    if (score >= 80) return { grade: 'B+', label: 'Very Good', color: '#22c55e' };
    if (score >= 75) return { grade: 'B', label: 'Good', color: '#84cc16' };
    if (score >= 70) return { grade: 'C+', label: 'Above Average', color: '#eab308' };
    if (score >= 65) return { grade: 'C', label: 'Average', color: '#f59e0b' };
    if (score >= 60) return { grade: 'D', label: 'Below Average', color: '#f97316' };
    return { grade: 'F', label: 'Needs Improvement', color: '#ef4444' };
}

/**
 * Generate score breakdown for analytics
 */
export function generateScoreBreakdown(answers = []) {
    if (answers.length === 0) {
        return {
            clarity: 50,
            confidence: 50,
            technical: 50,
            eyeContact: 50,
            overall: 50,
            details: [],
        };
    }

    // Calculate scores for each answer
    const details = answers.map((answer, index) => ({
        questionIndex: index + 1,
        clarity: calculateClarityScore(answer.text),
        confidence: calculateConfidenceScore(answer.text),
        technical: calculateTechnicalScore(answer.text),
        wordCount: (answer.text || '').split(/\s+/).filter(w => w).length,
        responseTime: answer.responseTime || 0,
    }));

    // Calculate averages
    const avgClarity = details.reduce((sum, d) => sum + d.clarity, 0) / details.length;
    const avgConfidence = details.reduce((sum, d) => sum + d.confidence, 0) / details.length;
    const avgTechnical = details.reduce((sum, d) => sum + d.technical, 0) / details.length;

    return {
        clarity: Math.round(avgClarity),
        confidence: Math.round(avgConfidence),
        technical: Math.round(avgTechnical),
        eyeContact: 50, // Default, updated by eye tracking
        overall: calculateOverallScore({
            clarity: avgClarity,
            confidence: avgConfidence,
            technical: avgTechnical,
            eyeContact: 50,
        }),
        details,
    };
}

// ===========================================
// COMPANY MODE CONFIGURATIONS
// ===========================================

export const COMPANY_MODES = {
    faang: {
        id: 'faang',
        name: 'FAANG / Big Tech',
        icon: '🏢',
        description: 'Rigorous technical standards, system design focus',
        config: {
            strictness: 0.9,
            technicalWeight: 0.40,
            behavioralWeight: 0.25,
            communicationWeight: 0.35,
            followUpDepth: 'deep',
            scoringThreshold: 75,
            personality: 'analytical',
        },
    },
    startup: {
        id: 'startup',
        name: 'Startup',
        icon: '🚀',
        description: 'Agility focus, problem-solving, cultural fit',
        config: {
            strictness: 0.7,
            technicalWeight: 0.30,
            behavioralWeight: 0.35,
            communicationWeight: 0.35,
            followUpDepth: 'moderate',
            scoringThreshold: 65,
            personality: 'friendly',
        },
    },
    enterprise: {
        id: 'enterprise',
        name: 'Enterprise / Corporate',
        icon: '🏛️',
        description: 'Process-oriented, team collaboration, stability',
        config: {
            strictness: 0.75,
            technicalWeight: 0.30,
            behavioralWeight: 0.40,
            communicationWeight: 0.30,
            followUpDepth: 'moderate',
            scoringThreshold: 70,
            personality: 'professional',
        },
    },
    hr: {
        id: 'hr',
        name: 'HR Screening',
        icon: '👥',
        description: 'Cultural fit, soft skills, basic qualification',
        config: {
            strictness: 0.5,
            technicalWeight: 0.15,
            behavioralWeight: 0.50,
            communicationWeight: 0.35,
            followUpDepth: 'light',
            scoringThreshold: 60,
            personality: 'friendly',
        },
    },
    recruiter: {
        id: 'recruiter',
        name: 'Recruiter Call',
        icon: '📞',
        description: 'Quick screen, experience verification, salary discussion',
        config: {
            strictness: 0.4,
            technicalWeight: 0.20,
            behavioralWeight: 0.35,
            communicationWeight: 0.45,
            followUpDepth: 'light',
            scoringThreshold: 55,
            personality: 'casual',
        },
    },
};

export function getCompanyMode(modeId) {
    return COMPANY_MODES[modeId] || COMPANY_MODES.enterprise;
}

export function getCompanyModeList() {
    return Object.values(COMPANY_MODES);
}
