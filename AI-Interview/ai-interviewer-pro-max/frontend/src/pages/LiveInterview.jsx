/**
 * Live Interview Page - PRODUCTION-GRADE V3 Experience
 * 
 * Features:
 * - CINEMATIC FULLSCREEN MODE with ESC key toggle
 * - AVATAR-DOMINANT layout (65% avatar LEFT, 35% chat RIGHT)
 * - Proper camera/mic permission flow
 * - Auto mic handoff after TTS finishes
 * - Silence detection for auto-submit
 * - Mic locked while bot speaks
 * - Natural turn-taking conversation
 * - Voice input/output with lip sync
 * - Video recording of interview
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import InterviewerAvatar, { resetEyeContactState } from '../components/InterviewerAvatar';
import PermissionModal from '../components/PermissionModal';
import RecordingIndicator from '../components/RecordingIndicator';
import QuestionTimer from '../components/QuestionTimer';
import PerformanceSummary from '../components/PerformanceSummary';
import useSpeechServices from '../hooks/useSpeechServices';
import useMediaPermissions, { PERMISSION_STATES } from '../hooks/useMediaPermissions';
import useInterviewRecorder from '../hooks/useInterviewRecorder';
import useInterviewAnalytics from '../hooks/useInterviewAnalytics';
import { liveInterviewApi, evaluationApi, getStoredUser } from '../services/api';
import { markSessionCompleted } from '../services/interviewStorage';
import { saveVideoBlob } from '../services/videoStorage';
import '../components/InterviewerAvatar/styles.css';
import '../components/QuestionTimer.css';
import '../components/PerformanceSummary.css';
import {
    Send, SkipForward, Pause, Play, Square, Eye, EyeOff,
    AlertCircle, CheckCircle, Loader2, Sparkles, MessageSquare,
    Mic, MicOff, Volume2, VolumeX, Paperclip, Clock, Activity,
    Maximize2, Minimize2
} from 'lucide-react';

// Debounce utility for performance
const debounce = (fn, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
};

function LiveInterview() {
    const navigate = useNavigate();
    const location = useLocation();
    const { sessionId: urlSessionId } = useParams();
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const user = getStoredUser();

    // ===========================================
    // FULLSCREEN MODE STATE (CINEMATIC EXPERIENCE)
    // ===========================================
    const [isFullscreen, setIsFullscreen] = useState(true); // CSS fullscreen state
    const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false); // TRUE browser fullscreen state

    // ===========================================
    // BROWSER FULLSCREEN API (EXAM-GRADE)
    // ===========================================

    // Enter TRUE browser fullscreen (hides Chrome URL bar, tabs, etc.)
    const enterBrowserFullscreen = useCallback(() => {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(err => {
                console.warn('Fullscreen request failed:', err);
            });
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) {
            elem.msRequestFullscreen();
        }
    }, []);

    // Exit browser fullscreen
    const exitBrowserFullscreen = useCallback(() => {
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(err => {
                console.warn('Exit fullscreen failed:', err);
            });
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }, []);

    // Toggle browser fullscreen
    const toggleBrowserFullscreen = useCallback(() => {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            exitBrowserFullscreen();
        } else {
            enterBrowserFullscreen();
        }
    }, [enterBrowserFullscreen, exitBrowserFullscreen]);

    // Listen for browser fullscreen changes (ESC key is handled by browser)
    useEffect(() => {
        const handleFullscreenChange = () => {
            const isInFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
            setIsBrowserFullscreen(isInFullscreen);
            // Also sync CSS fullscreen state
            setIsFullscreen(isInFullscreen);

            // CRITICAL: Trigger resize event to fix canvas/camera after fullscreen change
            // This ensures eye contact and avatar rendering updates properly
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 100);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('msfullscreenchange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('msfullscreenchange', handleFullscreenChange);
        };
    }, []);

    // CSS fullscreen body lock (for layout control)
    useEffect(() => {
        if (isFullscreen) {
            // Lock everything
            document.body.classList.add('interview-fullscreen-active');
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.width = '100vw';
            document.body.style.height = '100vh';
            document.documentElement.style.overflow = 'hidden';
        } else {
            // Release
            document.body.classList.remove('interview-fullscreen-active');
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.height = '';
            document.documentElement.style.overflow = '';
        }
        return () => {
            // Cleanup on unmount
            document.body.classList.remove('interview-fullscreen-active');
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.height = '';
            document.documentElement.style.overflow = '';
        };
    }, [isFullscreen]);

    // Toggle CSS fullscreen mode (for layout)
    const toggleFullscreen = useCallback(() => {
        setIsFullscreen(prev => !prev);
    }, []);

    // ===========================================
    // CORE STATE
    // ===========================================
    const [sessionId, setSessionId] = useState(urlSessionId || null);
    const [status, setStatus] = useState('loading');
    const [messages, setMessages] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [progress, setProgress] = useState(null);
    const [targetRole, setTargetRole] = useState('');
    const [persona, setPersona] = useState('professional');

    // Input state
    const [answer, setAnswer] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Evaluation feedback
    const [lastFeedback, setLastFeedback] = useState(null);
    const [showFeedback, setShowFeedback] = useState(false);

    // UI toggles
    const [avatarEnabled, setAvatarEnabled] = useState(true);
    const [voiceEnabled, setVoiceEnabled] = useState(true);

    // Permission state
    const [showPermissionModal, setShowPermissionModal] = useState(true);
    const [permissionsSkipped, setPermissionsSkipped] = useState(false);

    // CONVERSATION STATE (V3) - Turn-taking
    const [conversationState, setConversationState] = useState('idle'); // 'idle' | 'bot_speaking' | 'user_turn' | 'processing'
    const silenceTimerRef = useRef(null);
    const lastTranscriptRef = useRef('');
    const SILENCE_THRESHOLD_MS = 2000; // Auto-submit after 2s of silence

    // INTERVIEW PHASE STATE MACHINE (CRITICAL - Consent-based flow)
    // States: GREETING -> WAITING_FOR_CONSENT -> INTERVIEW_IN_PROGRESS -> INTERVIEW_COMPLETED -> PAUSED
    const [interviewPhase, setInterviewPhase] = useState('GREETING');
    const hasGreetedRef = useRef(false);

    // ===========================================
    // INTENT CLASSIFICATION PATTERNS (CRITICAL FOR NON-BIASED BEHAVIOR)
    // ===========================================

    // Consent patterns
    const CONSENT_PATTERNS = ['yes', 'yeah', 'ready', 'start', 'begin', 'let\'s go', 'sure', 'ok', 'okay', 'yep', 'yup', 'absolutely', 'definitely', 'go ahead', 'i\'m ready', 'let\'s start', 'let\'s begin'];
    const DECLINE_PATTERNS = ['no', 'not now', 'later', 'wait', 'not yet', 'hold on', 'give me a moment', 'one second', 'nope'];

    // GREETING patterns - user is greeting the interviewer
    const GREETING_PATTERNS = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'greetings', 'howdy', 'hii', 'hiii'];

    // INTRODUCTION patterns - user is introducing themselves
    const INTRODUCTION_PATTERNS = ['my name is', 'i am', 'i\'m', 'this is', 'call me', 'you can call me', 'myself'];

    // TIME REQUEST patterns - user needs more time
    const TIME_REQUEST_PATTERNS = ['give me some time', 'give me a moment', 'one moment', 'just a second', 'wait a minute', 'hold on', 'let me think', 'i need a moment', 'can we start later', 'not ready yet'];

    // GENERAL KNOWLEDGE patterns - user asking conceptual questions
    const KNOWLEDGE_QUESTION_PATTERNS = ['what is', 'what are', 'how does', 'how do', 'can you explain', 'explain', 'tell me about', 'define', 'meaning of', 'difference between', 'why is', 'why do', 'when should', 'when do'];

    // PAUSE/CONTROL patterns - user wants to pause or control interview
    const CONTROL_PATTERNS = ['pause', 'stop', 'break', 'resume', 'continue', 'skip', 'next question'];

    // ===========================================
    // ROUND SYSTEM (Big Company Interview Style)
    // ===========================================
    const ROUND_DEFINITIONS = {
        DSA: { name: 'DSA Round', icon: '🧩', color: '#10b981', description: 'Data Structures & Algorithms' },
        TECHNICAL: { name: 'Technical Round', icon: '💻', color: '#6366f1', description: 'Role-specific Technical Questions' },
        BEHAVIORAL: { name: 'Behavioral Round', icon: '🤝', color: '#f59e0b', description: 'Soft Skills & Communication' },
        HR: { name: 'HR Round', icon: '👔', color: '#8b5cf6', description: 'Cultural Fit & HR Questions' },
        SITUATIONAL: { name: 'Situational Round', icon: '🎯', color: '#ec4899', description: 'Real-world Scenario Questions' },
    };

    // Round tracking state
    const [currentRound, setCurrentRound] = useState(null);
    const [showRoundTransition, setShowRoundTransition] = useState(false);
    const [roundTransitionData, setRoundTransitionData] = useState(null);
    const [completedRounds, setCompletedRounds] = useState([]);
    const previousRoundRef = useRef(null);

    // Timer
    const [startTime, setStartTime] = useState(null);

    // ===========================================
    // HOOKS
    // ===========================================
    const {
        isSpeaking,
        isListening,
        transcript,
        finalTranscript,      // The verified final transcript (without interim)
        interimTranscript,    // Current unfinished speech
        audioLevel,
        ttsSupported,
        sttSupported,
        speak,
        stopSpeaking,
        startListening,
        stopListening,
        clearTranscript,
    } = useSpeechServices();

    const {
        cameraPermission,
        micPermission,
        permissionError,
        isSupported,
        isCameraReady,
        isMicReady,
        isAllReady,
        isBlocked,
        facePosition,
        isFaceDetected,
        requestAllPermissions,
        retryPermissions,
        startFaceTracking,
        stopFaceTracking,
        stopAllMedia,
    } = useMediaPermissions();

    // Recording hook for interview video capture
    const {
        isRecording,
        formattedDuration: recordingDuration,
        recordingBlob,
        startRecording,
        stopRecording,
        downloadRecording,
        isSupported: recordingSupported,
    } = useInterviewRecorder();

    // ===========================================
    // INTERVIEW ANALYTICS (Strict/High-Pressure Modes)
    // ===========================================
    const {
        isAnalyticsEnabled,
        config: analyticsConfig,
        eyeContactData,
        postureData,
        fillerWordData,
        silenceData,
        speedData,
        timerData,
        videoData,
        summary: analyticsSummary,
        startVideoRecording,
        stopVideoRecording,
        updateEyeContact,
        analyzeTranscript,
        trackSpeech,
        updateSpeakingSpeed,
        startQuestionTimer,
        stopQuestionTimer,
        pauseTimer,
        resumeTimer,
        generateSummary,
        resetAnalytics,
    } = useInterviewAnalytics(persona);

    // Performance Summary Modal
    const [showPerformanceSummary, setShowPerformanceSummary] = useState(false);
    const [performanceSummaryData, setPerformanceSummaryData] = useState(null);

    // ===========================================
    // MEMOIZED VALUES
    // ===========================================
    const personaDisplay = useMemo(() => {
        const personas = {
            strict: { label: 'Strict', icon: '🎯', color: 'persona-strict' },
            friendly: { label: 'Friendly', icon: '😊', color: 'persona-friendly' },
            stress: { label: 'High-Pressure', icon: '⚡', color: 'persona-stress' },
            neutral: { label: 'Balanced', icon: '⚖️', color: 'persona-neutral' },
            professional: { label: 'Balanced', icon: '⚖️', color: 'persona-neutral' },
        };
        return personas[persona] || personas.neutral;
    }, [persona]);

    // ===========================================
    // EYE CONTACT TRACKING (Analytics for Strict/High-Pressure)
    // ===========================================
    useEffect(() => {
        if (!isAnalyticsEnabled || interviewPhase !== 'INTERVIEW_IN_PROGRESS') return;

        // Track eye contact based on face detection
        // User is looking at camera if face is detected and centered
        const isLookingAtCamera = isFaceDetected && facePosition &&
            Math.abs(facePosition.x) < 0.3 &&
            Math.abs(facePosition.y) < 0.3;

        // Update analytics with eye contact and posture data
        updateEyeContact(isLookingAtCamera, facePosition);

    }, [isFaceDetected, facePosition, isAnalyticsEnabled, interviewPhase, updateEyeContact]);

    // ===========================================
    // ROUND DETECTION UTILITIES
    // ===========================================
    const getRoundFromCategory = useCallback((category) => {
        if (!category) return 'TECHNICAL';
        const cat = category.toLowerCase();
        if (cat.includes('dsa') || cat.includes('algorithm') || cat.includes('data structure')) return 'DSA';
        if (cat.includes('technical') || cat.includes('coding') || cat.includes('system')) return 'TECHNICAL';
        if (cat.includes('behavioral') || cat.includes('soft') || cat.includes('communication')) return 'BEHAVIORAL';
        if (cat.includes('hr') || cat.includes('culture') || cat.includes('fit')) return 'HR';
        if (cat.includes('situational') || cat.includes('scenario')) return 'SITUATIONAL';
        return 'TECHNICAL';
    }, []);

    const triggerRoundTransition = useCallback((fromRound, toRound) => {
        // Mark previous round as completed
        if (fromRound && !completedRounds.includes(fromRound)) {
            setCompletedRounds(prev => [...prev, fromRound]);
        }

        // Determine if this is the first round (interview start)
        const isFirst = !fromRound;

        // Show transition animation
        setRoundTransitionData({
            from: fromRound ? ROUND_DEFINITIONS[fromRound] : null,
            to: ROUND_DEFINITIONS[toRound],
            isFirst: isFirst,
        });
        setShowRoundTransition(true);

        // Different timeouts: 2.5s for interview start, 2.5s for round changes (premium feel)
        const dismissTimeout = isFirst ? 2500 : 2500;

        // Hide after animation
        setTimeout(() => {
            setShowRoundTransition(false);
            setCurrentRound(toRound);
            previousRoundRef.current = toRound;
        }, dismissTimeout);
    }, [completedRounds, ROUND_DEFINITIONS]);

    // ===========================================
    // TTS - SPEAK INTERVIEWER MESSAGE WITH AUTO HANDOFF
    // ===========================================
    const speakInterviewerMessage = useCallback(async (text, autoEnableMic = true) => {
        if (!text) return;

        console.log('[Speech] Speaking:', text.substring(0, 50) + '...');

        // Lock mic while bot speaks
        if (isListening) {
            stopListening();
        }
        setConversationState('bot_speaking');

        if (voiceEnabled && ttsSupported) {
            try {
                await speak(text);
            } catch (e) {
                console.warn('TTS error:', e);
            }
        } else {
            // No TTS - wait a bit for user to read
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        // AUTO MIC HANDOFF: Enable mic after bot finishes speaking
        // IMPORTANT: Web Speech API can work even without explicit mic permission
        // So we try to start listening if STT is supported, regardless of isMicReady
        if (autoEnableMic && status === 'in_progress' && sttSupported) {
            console.log('[Speech] Auto-enabling mic for user turn...');
            setConversationState('user_turn');
            clearTranscript();
            lastTranscriptRef.current = '';

            // Small delay for natural transition
            setTimeout(() => {
                startListening();
                console.log('[Speech] Started listening for user input');
            }, 300);
        } else {
            console.log('[Speech] Not enabling mic:', { autoEnableMic, status, sttSupported, isMicReady });
            setConversationState('idle');
        }
    }, [voiceEnabled, ttsSupported, speak, isListening, stopListening, startListening, clearTranscript, status, sttSupported, isMicReady]);

    // ===========================================
    // LOAD EXISTING SESSION
    // ===========================================
    const loadSessionState = useCallback(async (id) => {
        try {
            const response = await liveInterviewApi.getState(id);
            if (response.success) {
                setSessionId(id);
                setStatus(response.status);
                setMessages(response.messages || []);
                setCurrentQuestion(response.current_question);
                setProgress(response.progress);
                setTargetRole(response.target_role);
                setPersona(response.interviewer_persona || 'professional');
                setStartTime(Date.now());
                setShowPermissionModal(false); // Already in session, skip modal
            } else {
                throw new Error(response.message || 'Failed to load session');
            }
        } catch (err) {
            console.error('Failed to load session:', err);
            setError('Failed to load interview session. Please try again.');
            setStatus('error');
        }
    }, []);

    // ===========================================
    // FIRST QUESTION STORAGE (for consent-based flow)
    // ===========================================
    const firstQuestionRef = useRef(null);

    // ===========================================
    // START NEW INTERVIEW (CONSENT-BASED FLOW)
    // ===========================================
    const startNewInterview = useCallback(async () => {
        const planId = location.state?.planId;
        const selectedPersona = location.state?.personality || location.state?.persona || 'neutral';

        if (!planId) {
            navigate('/interview-prep');
            return;
        }

        try {
            setStatus('starting');
            const response = await liveInterviewApi.start(planId, selectedPersona);

            if (response.success) {
                setSessionId(response.session_id);
                setStatus('in_progress');
                setProgress(response.progress);
                setPersona(selectedPersona);
                setTargetRole(response.target_role || 'Interview');

                // Store first question for later (after consent)
                firstQuestionRef.current = response.first_question;

                // PHASE 1: GREETING + WAITING_FOR_CONSENT
                // DO NOT show question yet - wait for user consent
                const greetingMessage = "Hi, I'm your AI Interviewer. Are you ready to begin?";

                const initialMessages = [
                    {
                        id: 'greeting',
                        role: 'interviewer',
                        content: greetingMessage,
                        message_type: 'greeting',
                        created_at: new Date().toISOString(),
                    },
                ];
                setMessages(initialMessages);
                setCurrentQuestion(null); // No question yet!
                setInterviewPhase('WAITING_FOR_CONSENT');
                hasGreetedRef.current = true;

                // Update URL
                window.history.replaceState(null, '', `/interview/${response.session_id}`);

                // START VIDEO RECORDING - ONLY for strict and high-pressure modes
                const shouldRecordVideo = selectedPersona === 'strict' || selectedPersona === 'stress';
                if (shouldRecordVideo && recordingSupported && isCameraReady) {
                    console.log('[V3] Auto-starting interview recording for', selectedPersona, 'mode...');
                    startRecording();
                }

                // Speak greeting ONLY (no question yet)
                setTimeout(() => {
                    speakInterviewerMessage(greetingMessage, true);
                }, 500);

                // Start face tracking if camera is ready
                if (isCameraReady) {
                    startFaceTracking();
                }
            } else {
                throw new Error(response.message || 'Failed to start interview');
            }
        } catch (err) {
            console.error('Failed to start interview:', err);
            setError(err.message || 'Failed to start interview');
            setStatus('error');
        }
    }, [location.state, navigate, speakInterviewerMessage, isCameraReady, startFaceTracking]);

    // ===========================================
    // CONSENT HANDLER - Start actual interview after YES
    // ===========================================
    const startActualInterview = useCallback(async () => {
        if (!firstQuestionRef.current) {
            console.error('[Consent] No first question stored');
            return;
        }

        // Detect initial round from first question's category or round_name
        const roundName = firstQuestionRef.current.round_name || firstQuestionRef.current.category;
        const initialRound = getRoundFromCategory(roundName);

        // Show "Interview Starting" transition animation
        triggerRoundTransition(null, initialRound);

        // Call backend to confirm consent and record first question
        try {
            if (sessionId) {
                await liveInterviewApi.confirmConsent(sessionId);
                console.log('[Consent] Backend consent confirmed, first question recorded');
            }
        } catch (err) {
            console.warn('[Consent] Backend consent call failed, continuing anyway:', err);
        }

        // ===========================================
        // START ANALYTICS FOR STRICT/HIGH-PRESSURE MODES
        // ===========================================
        if (isAnalyticsEnabled) {
            console.log('[Analytics] Starting performance tracking for', persona, 'mode');

            // Start video recording of user
            startVideoRecording();

            // Reset any previous analytics data
            resetAnalytics();
        }

        // Delay the actual question display until after transition
        setTimeout(() => {
            // Now add the first question
            const questionMessage = {
                id: 'first-question',
                role: 'interviewer',
                content: firstQuestionRef.current.text,
                message_type: 'question',
                question_id: firstQuestionRef.current.id,
                question_index: 0,
                round_name: firstQuestionRef.current.round_name,
                difficulty: firstQuestionRef.current.difficulty,
                created_at: new Date().toISOString(),
            };
            setMessages(prev => [...prev, questionMessage]);
            setCurrentQuestion(firstQuestionRef.current);
            setStartTime(Date.now());
            setInterviewPhase('INTERVIEW_IN_PROGRESS');

            // START QUESTION TIMER for strict/high-pressure modes
            if (isAnalyticsEnabled && analyticsConfig.questionTimeLimit > 0) {
                console.log('[Analytics] Starting question timer:', analyticsConfig.questionTimeLimit, 'seconds');
                startQuestionTimer(0);
            }

            // Speak the first question
            const startMessage = "Great, let's start the interview. " + firstQuestionRef.current.text;
            speakInterviewerMessage(startMessage, true);
        }, 2600); // Wait for transition animation to complete
    }, [speakInterviewerMessage, getRoundFromCategory, triggerRoundTransition, sessionId, isAnalyticsEnabled, persona, startVideoRecording, resetAnalytics, analyticsConfig, startQuestionTimer]);

    // ===========================================
    // INTENT CLASSIFICATION FUNCTION (CRITICAL - REMOVES BIAS)
    // ===========================================
    const classifyIntent = useCallback((input) => {
        const normalized = input.toLowerCase().trim();

        // Priority order matters - check more specific patterns first

        // 1. GREETING - user saying hi/hello
        const isGreeting = GREETING_PATTERNS.some(p => {
            const words = normalized.split(/\s+/);
            return words.some(word => word === p || word.startsWith(p));
        });
        if (isGreeting && normalized.split(' ').length <= 5) {
            return 'GREETING';
        }

        // 2. INTRODUCTION - user introducing themselves
        const isIntroduction = INTRODUCTION_PATTERNS.some(p => normalized.includes(p));
        if (isIntroduction) {
            return 'INTRODUCTION';
        }

        // 3. TIME REQUEST - user needs more time
        const isTimeRequest = TIME_REQUEST_PATTERNS.some(p => normalized.includes(p));
        if (isTimeRequest) {
            return 'TIME_REQUEST';
        }

        // 4. KNOWLEDGE QUESTION - user asking a conceptual question
        const isKnowledgeQuestion = KNOWLEDGE_QUESTION_PATTERNS.some(p => normalized.startsWith(p) || normalized.includes(p));
        if (isKnowledgeQuestion && normalized.includes('?')) {
            return 'KNOWLEDGE_QUESTION';
        }

        // 5. CONTROL - user wants to pause/skip/control interview
        const isControl = CONTROL_PATTERNS.some(p => normalized.includes(p));
        if (isControl) {
            return 'CONTROL';
        }

        // 6. CONSENT - user agreeing to start
        const hasConsent = CONSENT_PATTERNS.some(p => normalized.includes(p));
        if (hasConsent) {
            return 'CONSENT';
        }

        // 7. DECLINE - user declining to start
        const hasDecline = DECLINE_PATTERNS.some(p => normalized.includes(p));
        if (hasDecline) {
            return 'DECLINE';
        }

        // 8. Default - could be an answer or general message
        return 'GENERAL_MESSAGE';
    }, [GREETING_PATTERNS, INTRODUCTION_PATTERNS, TIME_REQUEST_PATTERNS, KNOWLEDGE_QUESTION_PATTERNS, CONTROL_PATTERNS, CONSENT_PATTERNS, DECLINE_PATTERNS]);

    // ===========================================
    // EXTRACT NAME FROM INTRODUCTION
    // ===========================================
    const extractNameFromIntroduction = useCallback((input) => {
        const normalized = input.toLowerCase().trim();

        // Patterns like "My name is John", "I'm Sarah", "I am Mike"
        const patterns = [
            /my name is\s+(\w+)/i,
            /i'?m\s+(\w+)/i,
            /i am\s+(\w+)/i,
            /this is\s+(\w+)/i,
            /call me\s+(\w+)/i,
        ];

        for (const pattern of patterns) {
            const match = input.match(pattern);
            if (match && match[1]) {
                return match[1].charAt(0).toUpperCase() + match[1].slice(1);
            }
        }

        return null;
    }, []);

    // ===========================================
    // HANDLE CONVERSATION INPUT (NON-BIASED INTENT ROUTER)
    // ===========================================
    const handleConversationInput = useCallback((userInput) => {
        const intent = classifyIntent(userInput);
        const timestamp = new Date().toISOString();

        console.log('[Intent Router] Input:', userInput, '-> Intent:', intent, '-> Phase:', interviewPhase);

        // Add user message
        const userMessage = {
            id: `user-${Date.now()}`,
            role: 'candidate',
            content: userInput,
            message_type: intent.toLowerCase(),
            created_at: timestamp,
        };
        setMessages(prev => [...prev, userMessage]);

        // Route based on intent
        switch (intent) {
            case 'GREETING': {
                // Respond to greeting warmly
                const greetingResponse = {
                    id: `greeting-resp-${Date.now()}`,
                    role: 'interviewer',
                    content: "Hello! Nice to meet you. I'm your AI Interviewer today. Are you ready to begin the interview?",
                    message_type: 'greeting_response',
                    created_at: new Date().toISOString(),
                };
                setMessages(prev => [...prev, greetingResponse]);
                speakInterviewerMessage("Hello! Nice to meet you. I'm your AI Interviewer today. Are you ready to begin the interview?", true);
                return true;
            }

            case 'INTRODUCTION': {
                // Acknowledge user's name
                const name = extractNameFromIntroduction(userInput);
                const introResponse = name
                    ? `Nice to meet you, ${name}! I'm glad you're here today. Shall we begin the interview?`
                    : "Nice to meet you! I appreciate you introducing yourself. Shall we begin the interview?";

                const introMessage = {
                    id: `intro-resp-${Date.now()}`,
                    role: 'interviewer',
                    content: introResponse,
                    message_type: 'introduction_response',
                    created_at: new Date().toISOString(),
                };
                setMessages(prev => [...prev, introMessage]);
                speakInterviewerMessage(introResponse, true);
                return true;
            }

            case 'TIME_REQUEST': {
                // Give user time, remain in WAITING_FOR_CONSENT
                const timeResponse = "Of course, take all the time you need. Just say 'ready' or 'yes' when you're prepared to start.";
                const timeMessage = {
                    id: `time-resp-${Date.now()}`,
                    role: 'interviewer',
                    content: timeResponse,
                    message_type: 'time_response',
                    created_at: new Date().toISOString(),
                };
                setMessages(prev => [...prev, timeMessage]);
                speakInterviewerMessage(timeResponse, true);
                return true;
            }

            case 'KNOWLEDGE_QUESTION': {
                // Acknowledge the question and provide a helpful response
                // In a real system, this would call an LLM for the answer
                const knowledgeResponse = "That's a great question! While I'm here primarily as your interviewer, let me help you with that. " +
                    "During the actual interview, feel free to ask clarifying questions about the interview questions themselves. " +
                    "For now, shall we begin the interview?";
                const knowledgeMessage = {
                    id: `knowledge-resp-${Date.now()}`,
                    role: 'interviewer',
                    content: knowledgeResponse,
                    message_type: 'knowledge_response',
                    created_at: new Date().toISOString(),
                };
                setMessages(prev => [...prev, knowledgeMessage]);
                speakInterviewerMessage(knowledgeResponse, true);
                return true;
            }

            case 'CONSENT': {
                // User agreed - start interview
                startActualInterview();
                return true;
            }

            case 'DECLINE': {
                // User declined - wait patiently
                const declineResponse = "No problem at all. Take your time to prepare. Just let me know when you're ready to begin.";
                const declineMessage = {
                    id: `decline-resp-${Date.now()}`,
                    role: 'interviewer',
                    content: declineResponse,
                    message_type: 'decline_response',
                    created_at: new Date().toISOString(),
                };
                setMessages(prev => [...prev, declineMessage]);
                speakInterviewerMessage(declineResponse, true);
                return true;
            }

            case 'CONTROL': {
                // Handle control commands
                const controlResponse = "I understand. Let me know when you're ready to proceed with the interview.";
                const controlMessage = {
                    id: `control-resp-${Date.now()}`,
                    role: 'interviewer',
                    content: controlResponse,
                    message_type: 'control_response',
                    created_at: new Date().toISOString(),
                };
                setMessages(prev => [...prev, controlMessage]);
                speakInterviewerMessage(controlResponse, true);
                return true;
            }

            default: {
                // GENERAL_MESSAGE - politely ask for clarification while being conversational
                const generalResponse = "Thank you for sharing. I'm your AI Interviewer, and I'm here to help you practice. " +
                    "When you're ready to start the interview, just say 'yes' or 'ready'.";
                const generalMessage = {
                    id: `general-resp-${Date.now()}`,
                    role: 'interviewer',
                    content: generalResponse,
                    message_type: 'general_response',
                    created_at: new Date().toISOString(),
                };
                setMessages(prev => [...prev, generalMessage]);
                speakInterviewerMessage(generalResponse, true);
                return true;
            }
        }
    }, [classifyIntent, extractNameFromIntroduction, interviewPhase, speakInterviewerMessage, startActualInterview]);

    // ===========================================
    // PERMISSION HANDLERS
    // ===========================================
    const handlePermissionsGranted = useCallback(() => {
        setShowPermissionModal(false);
        setPermissionsSkipped(false);
        // Enter TRUE browser fullscreen when starting interview (EXAM-GRADE)
        enterBrowserFullscreen();
        startNewInterview();
    }, [startNewInterview, enterBrowserFullscreen]);

    const handlePermissionsSkipped = useCallback(() => {
        setShowPermissionModal(false);
        setPermissionsSkipped(true);
        setAvatarEnabled(false); // Disable avatar if no camera
        // Enter TRUE browser fullscreen when starting interview (EXAM-GRADE)
        enterBrowserFullscreen();
        startNewInterview();
    }, [startNewInterview, enterBrowserFullscreen]);

    // ===========================================
    // INITIAL LOAD EFFECT
    // ===========================================
    useEffect(() => {
        if (urlSessionId) {
            // Resuming existing session
            loadSessionState(urlSessionId);
        } else if (location.state?.planId) {
            // New interview - show permission modal
            setStatus('permission');
            setShowPermissionModal(true);
        } else {
            // No plan, redirect
            navigate('/interview-prep');
        }
    }, [urlSessionId, location.state, loadSessionState, navigate]);

    // ===========================================
    // AUTO-SCROLL MESSAGES
    // ===========================================
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // ===========================================
    // AUTO-FOCUS INPUT
    // ===========================================
    useEffect(() => {
        if (status === 'in_progress' && !submitting && inputRef.current) {
            inputRef.current.focus();
        }
    }, [status, submitting, currentQuestion]);

    // ===========================================
    // SYNC VOICE TRANSCRIPT TO INPUT + SILENCE DETECTION
    // THIS IS CRITICAL: We use a ref to avoid stale closures
    // ===========================================
    const updateAnswerFromTranscript = useMemo(
        () => debounce((text) => setAnswer(text), 150),
        []
    );

    // Store current transcript in a ref to avoid stale closures in timers
    const currentTranscriptRef = useRef('');

    // Update the ref whenever transcript changes
    useEffect(() => {
        currentTranscriptRef.current = transcript || '';
    }, [transcript]);

    // Sync transcript to answer and detect silence
    useEffect(() => {
        // DEBUGGING: Log every transcript update
        console.log('[Transcript Sync] Effect fired:', {
            transcript: transcript?.substring(0, 50),
            isListening,
            hasTranscript: !!transcript,
            transcriptLength: transcript?.length
        });

        // CRITICAL FIX: Sync transcript to answer even when listening stops
        // This ensures the answer is populated before submit
        if (transcript && transcript.trim().length > 0) {
            console.log('[Transcript Sync] Updating answer with transcript:', transcript.substring(0, 50));
            // CRITICAL FIX: Set answer immediately and always keep it in sync
            setAnswer(transcript);
            updateAnswerFromTranscript(transcript);

            // ===========================================
            // ANALYTICS: Track speech for strict/high-pressure modes
            // ===========================================
            if (isAnalyticsEnabled && isListening) {
                // Track that user is speaking
                trackSpeech(true, progress?.current_question || 0);

                // Analyze transcript for filler words
                analyzeTranscript(transcript, progress?.current_question || 0);
            }

            // Reset silence timer on new speech (only when actively listening)
            if (isListening && transcript !== lastTranscriptRef.current) {
                console.log('[Transcript Sync] New transcript detected, resetting silence timer');
                lastTranscriptRef.current = transcript;

                // Clear previous timer
                if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                }

                // Set new silence timer - auto submit after silence
                if (transcript.trim().length >= 10) { // Only if substantial answer
                    silenceTimerRef.current = setTimeout(() => {
                        // CRITICAL FIX: Use the REF to get latest transcript value
                        // This avoids the stale closure problem
                        const latestTranscript = currentTranscriptRef.current;
                        console.log('[V3] Silence detected, checking transcript:', latestTranscript?.substring(0, 30));

                        // Track silence for analytics
                        if (isAnalyticsEnabled) {
                            trackSpeech(false, progress?.current_question || 0);
                        }

                        if (latestTranscript && latestTranscript.trim().length >= 10) {
                            console.log('[V3] Auto-submitting voice answer:', latestTranscript.substring(0, 50));
                            stopListening();
                            // CRITICAL FIX: Set answer directly before submit to ensure it's available
                            setAnswer(latestTranscript);
                            // Small delay to ensure state is updated before submit
                            setTimeout(() => {
                                handleSubmitAnswer();
                            }, 100);
                        }
                    }, SILENCE_THRESHOLD_MS);
                }
            }
        }

        // Track that user stopped speaking when not listening
        if (!isListening && isAnalyticsEnabled) {
            trackSpeech(false, progress?.current_question || 0);
        }
    }, [transcript, isListening, updateAnswerFromTranscript, stopListening, isAnalyticsEnabled, trackSpeech, analyzeTranscript, progress]);

    // Clear silence timer when not listening
    useEffect(() => {
        if (!isListening && silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
    }, [isListening]);

    // ===========================================
    // AUTO-SUBMIT ON TIMER EXPIRY (Strict/High-Pressure)
    // ===========================================
    useEffect(() => {
        if (!isAnalyticsEnabled || timerData.timeRemaining !== 0 || !timerData.timedOutQuestions.length) {
            return;
        }

        // Check if this timeout is for the current question
        const lastTimedOut = timerData.timedOutQuestions[timerData.timedOutQuestions.length - 1];
        const currentQuestionIndex = progress?.current_question || 0;

        if (lastTimedOut === currentQuestionIndex && !submitting) {
            console.log('[Analytics] Timer expired! Auto-submitting answer...');

            // If there's an answer, submit it
            if (answer.trim().length > 0) {
                handleSubmitAnswer();
            } else {
                // No answer - submit a placeholder or skip
                setAnswer("I ran out of time for this question.");
                setTimeout(() => {
                    handleSubmitAnswer();
                }, 100);
            }
        }
    }, [timerData.timeRemaining, timerData.timedOutQuestions, isAnalyticsEnabled, progress, submitting, answer]);

    // ===========================================
    // AUTO-START VIDEO RECORDING WHEN CAMERA READY (Strict/High-Pressure)
    // ===========================================
    useEffect(() => {
        // Only start recording for strict/stress modes when:
        // 1. Interview is in progress
        // 2. Camera is ready
        // 3. Recording is supported
        // 4. Not already recording
        const shouldRecord = (persona === 'strict' || persona === 'stress');
        if (shouldRecord && status === 'in_progress' && isCameraReady && recordingSupported && !isRecording) {
            console.log('[Recording] Auto-starting video recording for', persona, 'mode (camera just became ready)');
            startRecording();
        }
    }, [persona, status, isCameraReady, recordingSupported, isRecording, startRecording]);

    // ===========================================
    // CLEANUP ON UNMOUNT (ONLY ON UNMOUNT - empty deps array)
    // ===========================================
    useEffect(() => {
        return () => {
            // This cleanup only runs when component unmounts
            console.log('[Cleanup] Component unmounting - cleaning up everything...');

            // Clear any timers first
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
            }

            // STEP 1: Exit fullscreen FIRST
            try {
                if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
                    if (document.exitFullscreen) {
                        document.exitFullscreen().catch(() => {});
                    } else if (document.webkitExitFullscreen) {
                        document.webkitExitFullscreen();
                    } else if (document.msExitFullscreen) {
                        document.msExitFullscreen();
                    }
                }
            } catch (e) {
                console.warn('[Cleanup] Fullscreen exit error:', e);
            }

            // STEP 2: Stop speech services
            try {
                if (typeof stopSpeaking === 'function') stopSpeaking();
                if (typeof stopListening === 'function') stopListening();
            } catch (e) {
                console.warn('[Cleanup] Speech services error:', e);
            }

            // STEP 3: Stop avatar eye contact webcam (separate stream)
            try {
                resetEyeContactState();
            } catch (e) {
                console.warn('[Cleanup] Eye contact cleanup error:', e);
            }

            // STEP 4: Stop all media streams
            try {
                if (typeof stopAllMedia === 'function') stopAllMedia();
            } catch (e) {
                console.warn('[Cleanup] Media cleanup error:', e);
            }

            console.log('[Cleanup] ✓ Component unmount cleanup complete');
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty array = only run on mount/unmount

    // ===========================================
    // VOICE RECORDING TOGGLE
    // ===========================================
    const toggleVoiceRecording = useCallback(() => {
        console.log('[Voice] Toggle requested:', { isListening, isSpeaking, conversationState, sttSupported });

        // Don't allow mic toggle while bot is speaking
        if (isSpeaking || conversationState === 'bot_speaking') {
            console.log('[Voice] Cannot toggle - bot is speaking');
            return;
        }

        if (!sttSupported) {
            console.warn('[Voice] Speech recognition not supported in this browser');
            return;
        }

        if (isListening) {
            console.log('[Voice] Stopping listening...');
            stopListening();
            setConversationState('idle');
        } else {
            console.log('[Voice] Starting listening...');
            stopSpeaking();
            clearTranscript();
            lastTranscriptRef.current = '';
            startListening();
            setConversationState('user_turn');
        }
    }, [isListening, isSpeaking, conversationState, startListening, stopListening, stopSpeaking, clearTranscript, sttSupported]);

    // ===========================================
    // SUBMIT ANSWER (Phase-aware)
    // ===========================================
    const handleSubmitAnswer = async (e) => {
        e?.preventDefault();

        // CRITICAL FIX: Use transcript (final + interim) if answer is incomplete
        // This prevents cutting off words like "I don't know" becoming "I don't"
        let trimmedAnswer = answer.trim();

        // If we have ongoing speech (interim transcript), include it
        if (interimTranscript && interimTranscript.trim().length > 0) {
            console.log('[Submit] Including interim transcript:', interimTranscript);
            // Combine final transcript with interim (if answer is from transcript)
            const fullTranscript = (finalTranscript + ' ' + interimTranscript).trim();
            if (fullTranscript.length > trimmedAnswer.length) {
                trimmedAnswer = fullTranscript;
                console.log('[Submit] Using full transcript instead:', trimmedAnswer);
            }
        }

        console.log('[Submit] Attempting to submit:', {
            answerLength: trimmedAnswer.length,
            submitting,
            interviewPhase,
            sessionId
        });

        if (!trimmedAnswer || submitting) {
            console.log('[Submit] Blocked - empty answer or already submitting');
            return;
        }

        // Stop voice if active
        if (isListening) stopListening();

        // CRITICAL: Check interview phase FIRST
        // If waiting for consent, use the intent router for proper conversation handling
        if (interviewPhase === 'WAITING_FOR_CONSENT') {
            console.log('[Submit] Routing through intent classifier');
            handleConversationInput(trimmedAnswer);
            setAnswer('');
            clearTranscript();
            return;
        }

        // Only proceed if in INTERVIEW_IN_PROGRESS
        if (interviewPhase !== 'INTERVIEW_IN_PROGRESS') {
            console.warn('[Phase] Cannot submit answer - not in interview phase:', interviewPhase);
            setAnswer('');
            clearTranscript();
            return;
        }

        console.log('[Submit] Sending answer to backend...');

        const responseTime = startTime ? Math.round((Date.now() - startTime) / 1000) : null;

        setSubmitting(true);
        setError(null);

        // Add user message immediately for responsiveness
        const userMessage = {
            id: `user-${Date.now()}`,
            role: 'candidate',
            content: trimmedAnswer,
            message_type: 'answer',
            created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, userMessage]);
        setAnswer('');
        clearTranscript();

        try {
            const response = await liveInterviewApi.submitAnswer(sessionId, trimmedAnswer, responseTime);

            if (response.success) {
                // Acknowledgment message
                const ackMessage = {
                    id: `ack-${Date.now()}`,
                    role: 'interviewer',
                    content: response.acknowledgment,
                    message_type: 'acknowledgment',
                    created_at: new Date().toISOString(),
                };
                setMessages(prev => [...prev, ackMessage]);

                // Update progress
                setProgress(response.progress);

                // ===========================================
                // ANALYTICS: Stop timer and calculate speed
                // ===========================================
                if (isAnalyticsEnabled) {
                    stopQuestionTimer();

                    // Calculate speaking speed from this question
                    const questionTimeMs = startTime ? Date.now() - startTime : 0;
                    const wordCount = trimmedAnswer.split(/\s+/).length;
                    if (questionTimeMs > 0) {
                        updateSpeakingSpeed(wordCount, questionTimeMs);
                    }
                }

                // Show feedback popup IMMEDIATELY with loading state for responsiveness
                // This gives instant feedback to user while evaluation runs in background
                if (currentQuestion) {
                    // Show loading state immediately
                    setLastFeedback({ loading: true, feedback: 'Evaluating your answer...' });
                    setShowFeedback(true);
                    
                    // Run evaluation in background
                    evaluationApi.quick(
                        sessionId,
                        currentQuestion.id,
                        currentQuestion.text || '',
                        trimmedAnswer,
                        currentQuestion.type
                    ).then(evalResponse => {
                        if (evalResponse.success && evalResponse.result) {
                            // Update with real results
                            setLastFeedback(evalResponse.result);
                            // Keep showing for 5 more seconds after results arrive
                            setTimeout(() => setShowFeedback(false), 5000);
                        } else {
                            // Hide on failure
                            setShowFeedback(false);
                        }
                    }).catch(() => {
                        // Hide popup on error
                        setShowFeedback(false);
                    });
                }

                // Handle interview completion or next question
                if (response.is_complete) {
                    console.log('[Interview] Complete! Processing final response...');

                    // STREAMLINED: Process completion quickly without blocking waits
                    // Update UI state immediately for responsiveness
                    setStatus('completed');
                    setCurrentQuestion(null);
                    setInterviewPhase('INTERVIEW_COMPLETED');

                    // Add completion message
                    const completeMessage = {
                        id: `complete-${Date.now()}`,
                        role: 'interviewer',
                        content: response.acknowledgment || "Thank you for your time. That concludes our interview. Your results will be ready shortly.",
                        message_type: 'transition',
                        created_at: new Date().toISOString(),
                    };
                    setMessages(prev => [...prev, completeMessage]);

                    // Speak the final message (non-blocking)
                    const finalMessage = response.acknowledgment
                        ? response.acknowledgment + " That concludes our interview."
                        : "Thank you for your time. That concludes our interview.";
                    speakInterviewerMessage(finalMessage, false);

                    // CRITICAL: Persist interview completion to localStorage
                    markSessionCompleted(sessionId, {
                        targetRole: targetRole,
                        date: new Date().toISOString(),
                    });

                    // ===========================================
                    // INTERVIEW COMPLETE - CLEANUP SEQUENCE
                    // Order matters! Exit fullscreen FIRST, then stop cameras
                    // ===========================================
                    console.log('[Cleanup] Interview completed - starting cleanup sequence...');
                    
                    // STEP 1: Exit fullscreen FIRST (before stopping cameras)
                    // Some browsers have issues with camera cleanup while in fullscreen
                    try {
                        if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
                            console.log('[Cleanup] Step 1: Exiting fullscreen...');
                            if (document.exitFullscreen) {
                                await document.exitFullscreen().catch(() => {});
                            } else if (document.webkitExitFullscreen) {
                                document.webkitExitFullscreen();
                            } else if (document.msExitFullscreen) {
                                document.msExitFullscreen();
                            }
                            // Wait for fullscreen exit
                            await new Promise(resolve => setTimeout(resolve, 200));
                        }
                    } catch (e) {
                        console.warn('[Cleanup] Fullscreen exit error:', e);
                    }
                    
                    // STEP 2: Stop listening/speaking
                    console.log('[Cleanup] Step 2: Stopping speech services...');
                    try {
                        if (isListening) stopListening();
                        stopSpeaking();
                    } catch (e) {
                        console.warn('[Cleanup] Speech services stop error:', e);
                    }
                    
                    // STEP 3: Stop avatar's webcam FIRST (eye contact uses separate MediaPipe stream)
                    console.log('[Cleanup] Step 3: Stopping avatar eye contact webcam...');
                    try {
                        resetEyeContactState();
                    } catch (e) {
                        console.warn('[Cleanup] Eye contact cleanup error:', e);
                    }
                    
                    // STEP 4: Stop face tracking
                    console.log('[Cleanup] Step 4: Stopping face tracking...');
                    try {
                        stopFaceTracking();
                    } catch (e) {
                        console.warn('[Cleanup] Face tracking stop error:', e);
                    }
                    
                    // STEP 5: Stop all media streams (main camera/mic)
                    console.log('[Cleanup] Step 5: Stopping all media streams...');
                    try {
                        stopAllMedia();
                    } catch (e) {
                        console.warn('[Cleanup] Media streams stop error:', e);
                    }
                    
                    // STEP 6: Stop interview recording
                    console.log('[Cleanup] Step 6: Stopping recording...');
                    try {
                        if (isRecording) {
                            stopRecording();
                        }
                    } catch (e) {
                        console.warn('[Cleanup] Recording stop error:', e);
                    }
                    
                    console.log('[Cleanup] ✓ ALL cleanup complete - camera light should be OFF');

                    // Analytics: Generate and show performance summary (after cleanup)
                    if (isAnalyticsEnabled) {
                        console.log('[Analytics] Interview complete, generating summary...');
                        stopVideoRecording();

                        setTimeout(() => {
                            const summaryData = generateSummary();
                            setPerformanceSummaryData(summaryData);
                            setShowPerformanceSummary(true);
                        }, 300);
                    }
                } else if (response.next_question) {
                    // Speak acknowledgment first, then next question
                    await speakInterviewerMessage(response.acknowledgment);

                    // ROUND TRANSITION DETECTION: Check if we're entering a new round
                    const nextRoundName = response.next_question.round_name || response.next_question.category;
                    const nextRound = getRoundFromCategory(nextRoundName);

                    if (nextRound && previousRoundRef.current && nextRound !== previousRoundRef.current) {
                        // Trigger round transition animation
                        triggerRoundTransition(previousRoundRef.current, nextRound);
                    } else if (nextRound && !previousRoundRef.current) {
                        // First round detection
                        previousRoundRef.current = nextRound;
                        setCurrentRound(nextRound);
                    } else if (nextRound) {
                        // Update current round without transition
                        setCurrentRound(nextRound);
                    }

                    const questionMessage = {
                        id: `q-${Date.now()}`,
                        role: 'interviewer',
                        content: response.next_question.text,
                        message_type: 'question',
                        question_id: response.next_question.id,
                        question_index: response.next_question.index,
                        round_name: response.next_question.round_name,
                        difficulty: response.next_question.difficulty,
                        created_at: new Date().toISOString(),
                    };
                    setMessages(prev => [...prev, questionMessage]);
                    setCurrentQuestion(response.next_question);
                    setStartTime(Date.now());

                    // ===========================================
                    // ANALYTICS: Start timer for next question
                    // ===========================================
                    if (isAnalyticsEnabled && analyticsConfig.questionTimeLimit > 0) {
                        startQuestionTimer(response.next_question.index || progress?.current_question || 0);
                    }

                    // Speak next question after a brief pause
                    setTimeout(() => {
                        speakInterviewerMessage(response.next_question.text);
                    }, 300);
                }
            } else {
                throw new Error(response.message || 'Failed to submit answer');
            }
        } catch (err) {
            console.error('Submit answer error:', err);
            setError(err.message || 'Failed to submit answer. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // ===========================================
    // SKIP QUESTION
    // ===========================================
    const handleSkip = async () => {
        if (submitting) return;
        setSubmitting(true);
        setError(null);

        try {
            const response = await liveInterviewApi.skip(sessionId);
            if (response.success) {
                const skipMessage = {
                    id: `skip-${Date.now()}`,
                    role: 'system',
                    content: 'Question skipped',
                    message_type: 'system',
                    created_at: new Date().toISOString(),
                };
                setMessages(prev => [...prev, skipMessage]);
                setProgress(response.progress);

                if (response.is_complete) {
                    setStatus('completed');  // FIXED: Match backend status
                    setCurrentQuestion(null);
                } else if (response.next_question) {
                    const questionMessage = {
                        id: `q-${Date.now()}`,
                        role: 'interviewer',
                        content: response.next_question.text,
                        message_type: 'question',
                        question_id: response.next_question.id,
                        question_index: response.next_question.index,
                        created_at: new Date().toISOString(),
                    };
                    setMessages(prev => [...prev, questionMessage]);
                    setCurrentQuestion(response.next_question);
                    setStartTime(Date.now());

                    await speakInterviewerMessage(response.next_question.text);
                }
            }
        } catch (err) {
            setError('Failed to skip question');
        } finally {
            setSubmitting(false);
        }
    };

    // ===========================================
    // PAUSE / RESUME / END
    // ===========================================
    const handlePause = async () => {
        try {
            stopSpeaking();
            if (isListening) stopListening();
            const response = await liveInterviewApi.pause(sessionId);
            if (response.success) setStatus('paused');
        } catch (err) {
            setError('Failed to pause interview');
        }
    };

    const handleResume = async () => {
        try {
            const response = await liveInterviewApi.resume(sessionId);
            if (response.success) setStatus('in_progress');
        } catch (err) {
            setError('Failed to resume interview');
        }
    };

    const handleEnd = async () => {
        if (!window.confirm('Are you sure you want to end the interview early?')) return;
        try {
            console.log('[Cleanup] handleEnd - stopping all media...');

            stopSpeaking();
            stopFaceTracking();

            // CRITICAL FIX: Stop ALL media streams (camera + mic)
            stopAllMedia();

            // Cleanup webcam/camera state
            resetEyeContactState();

            // CRITICAL FIX: Exit browser fullscreen when ending interview early
            exitBrowserFullscreen();

            // Stop recording and wait for blob - CRITICAL: await the promise
            let finalBlob = recordingBlob;
            if (isRecording) {
                const stoppedBlob = await stopRecording();
                if (stoppedBlob) {
                    finalBlob = stoppedBlob;
                }
            }

            // Stop analytics video recording
            if (isAnalyticsEnabled) {
                stopVideoRecording();
            }

            // Save video blob to IndexedDB before navigating (for strict/high-pressure modes)
            if (finalBlob) {
                try {
                    await saveVideoBlob(sessionId, finalBlob);
                    console.log('[Recording] Video blob saved on early end');
                } catch (err) {
                    console.warn('[Recording] Failed to save video blob:', err);
                }
            }

            // Also save analytics video blob if available
            if (isAnalyticsEnabled && videoData.blob) {
                try {
                    await saveVideoBlob(sessionId, videoData.blob);
                    console.log('[Analytics] Analytics video blob saved on early end');
                } catch (err) {
                    console.warn('[Analytics] Failed to save video blob:', err);
                }
            }

            const response = await liveInterviewApi.end(sessionId);
            if (response.success) {
                setStatus('completed');  // FIXED: Match backend status
                navigate(`/report/${sessionId}`);
            }
        } catch (err) {
            setError('Failed to end interview');
        }
    };

    const handleViewResults = async () => {
        console.log('[Cleanup] handleViewResults - stopping all media...');

        // Stop speaking if active
        stopSpeaking();

        // Stop face tracking
        stopFaceTracking();

        // CRITICAL FIX: Stop ALL media streams (camera + mic)
        stopAllMedia();

        // Cleanup webcam/camera state
        resetEyeContactState();

        // CRITICAL FIX: Exit browser fullscreen when viewing results
        exitBrowserFullscreen();

        // Stop and save recording from main recorder - CRITICAL: await the promise
        let finalBlob = recordingBlob;
        if (isRecording) {
            const stoppedBlob = await stopRecording();
            if (stoppedBlob) {
                finalBlob = stoppedBlob;
            }
        }

        // Stop analytics video recording if active
        if (isAnalyticsEnabled && videoData.isRecording) {
            stopVideoRecording();
        }

        // Save video blob to IndexedDB for persistent access on Report page
        // Blob URLs don't survive page navigation, so we use IndexedDB
        if (finalBlob) {
            try {
                await saveVideoBlob(sessionId, finalBlob);
                console.log('[Recording] Video blob saved to IndexedDB for report page download');
            } catch (err) {
                console.warn('[Recording] Failed to save video blob:', err);
            }
        }

        // Also save analytics video blob if available
        if (isAnalyticsEnabled && videoData.blob) {
            try {
                await saveVideoBlob(sessionId, videoData.blob);
                console.log('[Analytics] Analytics video blob saved to IndexedDB for report page download');
            } catch (err) {
                console.warn('[Analytics] Failed to save video blob:', err);
            }
        }

        navigate(`/report/${sessionId}`, { state: { personality: persona } });
    };

    // ===========================================
    // RENDER MESSAGE
    // ===========================================
    const renderMessage = useCallback((message) => {
        const isInterviewer = message.role === 'interviewer';
        const isSystem = message.role === 'system';

        if (isSystem) {
            return (
                <div key={message.id} className="chat-message system">
                    <span className="system-badge">{message.content}</span>
                </div>
            );
        }

        return (
            <div key={message.id} className={`chat-message ${isInterviewer ? 'interviewer' : 'user'}`}>
                <div className="message-avatar">
                    {isInterviewer ? (
                        <span className="avatar-icon interviewer">{personaDisplay.icon}</span>
                    ) : (
                        <span className="avatar-icon user">👤</span>
                    )}
                </div>
                <div className="message-content">
                    <div className="message-header">
                        <span className="sender-name">
                            {isInterviewer ? 'Interviewer' : 'You'}
                        </span>
                        {message.message_type === 'question' && (
                            <span className="question-badge">
                                Q{(message.question_index || 0) + 1}
                            </span>
                        )}
                    </div>
                    <div className="message-bubble">
                        {message.content}
                    </div>
                </div>
            </div>
        );
    }, [personaDisplay]);

    // ===========================================
    // RENDER: PERMISSION MODAL
    // ===========================================
    if (showPermissionModal && status === 'permission') {
        return (
            <div className="live-interview-container">
                <Navbar user={user} />
                <PermissionModal
                    onPermissionsGranted={handlePermissionsGranted}
                    onSkip={handlePermissionsSkipped}
                    requestAllPermissions={requestAllPermissions}
                    retryPermissions={retryPermissions}
                    cameraPermission={cameraPermission}
                    micPermission={micPermission}
                    permissionError={permissionError}
                    isSupported={isSupported}
                    isCameraReady={isCameraReady}
                    isMicReady={isMicReady}
                    isBlocked={isBlocked}
                />
            </div>
        );
    }

    // ===========================================
    // RENDER: LOADING STATE
    // ===========================================
    if (status === 'loading' || status === 'starting') {
        return (
            <div className="live-interview-container">
                <Navbar user={user} />
                <main className="interview-loading">
                    <div className="loading-card">
                        <Loader2 size={48} className="spin" />
                        <h2>{status === 'starting' ? 'Starting Interview...' : 'Loading...'}</h2>
                        <p>Preparing your personalized interview experience</p>
                    </div>
                </main>
            </div>
        );
    }

    // ===========================================
    // RENDER: ERROR STATE
    // ===========================================
    if (status === 'error') {
        return (
            <div className="live-interview-container">
                <Navbar user={user} />
                <main className="interview-loading">
                    <div className="error-card">
                        <AlertCircle size={48} />
                        <h2>Something went wrong</h2>
                        <p>{error}</p>
                        <button
                            className="btn btn-primary"
                            onClick={() => navigate('/interview-prep')}
                        >
                            Back to Interview Prep
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    // ===========================================
    // RENDER: MAIN INTERVIEW UI
    // ===========================================
    return (
        <div className={`live-interview-container ${isFullscreen ? 'fullscreen-mode' : 'windowed-mode'}`}>
            {/* NAVBAR - Only visible in windowed mode */}
            {!isFullscreen && <Navbar user={user} minimal />}

            {/* FULLSCREEN CONTROLS BAR - Always visible in fullscreen */}
            {isFullscreen && (
                <div className="fullscreen-controls-bar">
                    <div className="fc-left">
                        <span className="fc-logo">🤖 AI Interviewer</span>
                        <span className={`persona-badge ${personaDisplay.color}`}>
                            {personaDisplay.icon} {personaDisplay.label}
                        </span>
                    </div>
                    <div className="fc-center">
                        {progress && (
                            <span className="fc-progress">
                                Question {progress.current_question} / {progress.total_questions}
                            </span>
                        )}
                    </div>
                    <div className="fc-right">
                        <button
                            className="fc-btn"
                            onClick={toggleBrowserFullscreen}
                            title={isBrowserFullscreen ? "Exit Fullscreen (ESC)" : "Enter Fullscreen"}
                        >
                            {isBrowserFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                        </button>
                        <button
                            className="fc-btn exit-btn"
                            onClick={() => navigate('/dashboard')}
                            title="Exit Interview"
                        >
                            Exit
                        </button>
                    </div>
                </div>
            )}

            {/* ROUND TRANSITION OVERLAY - Full-screen popup for ALL rounds */}
            {showRoundTransition && roundTransitionData && (
                <div className="round-transition-overlay">
                    <div className={`round-transition-content ${roundTransitionData.isFirst ? 'interview-start' : 'round-change'}`}>
                        {/* Round Transition Icon */}
                        <div
                            className="round-transition-icon"
                            style={{
                                backgroundColor: roundTransitionData.to?.color ? `${roundTransitionData.to.color}20` : 'rgba(99, 102, 241, 0.1)',
                                borderColor: roundTransitionData.to?.color || '#6366f1'
                            }}
                        >
                            {roundTransitionData.to?.icon || '🎯'}
                        </div>

                        {/* Title: "Interview Starting" or "Next Round" */}
                        <div className="round-transition-to">
                            {roundTransitionData.isFirst
                                ? 'Interview Starting'
                                : `Moving to ${roundTransitionData.to?.name || 'Next Round'}`
                            }
                        </div>

                        {/* Round Name (for non-first rounds) */}
                        {!roundTransitionData.isFirst && (
                            <div
                                className="round-transition-name"
                                style={{ color: roundTransitionData.to?.color || '#6366f1' }}
                            >
                                {roundTransitionData.to?.name || 'Next Round'}
                            </div>
                        )}

                        {/* Description */}
                        <div className="round-transition-description">
                            {roundTransitionData.to?.description || 'Get ready for your mock interview'}
                        </div>

                        {/* Transition from previous round (if applicable) */}
                        {roundTransitionData.from && (
                            <div className="round-transition-from">
                                <span className="from-icon">{roundTransitionData.from.icon}</span>
                                <span className="from-text">{roundTransitionData.from.name} Complete ✓</span>
                            </div>
                        )}

                        {/* Round Progress Dots */}
                        <div className="round-transition-progress">
                            {['DSA', 'TECHNICAL', 'BEHAVIORAL', 'HR'].map((roundKey) => (
                                <div
                                    key={roundKey}
                                    className={`round-dot 
                                        ${completedRounds.includes(roundKey) ? 'completed' : ''} 
                                        ${roundTransitionData.to &&
                                            ROUND_DEFINITIONS[roundKey]?.name === roundTransitionData.to?.name
                                            ? 'current' : ''
                                        }`}
                                    title={ROUND_DEFINITIONS[roundKey]?.name}
                                    style={{
                                        borderColor: roundTransitionData.to &&
                                            ROUND_DEFINITIONS[roundKey]?.name === roundTransitionData.to?.name
                                            ? roundTransitionData.to.color
                                            : undefined
                                    }}
                                >
                                    <span className="dot-icon">{ROUND_DEFINITIONS[roundKey]?.icon}</span>
                                    <span className="dot-label">{roundKey}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <main className="interview-main">
                {/* Error Banner */}
                {error && status !== 'error' && (
                    <div className="error-banner">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                        <button onClick={() => setError(null)}>×</button>
                    </div>
                )}

                {/* Paused Overlay */}
                {status === 'paused' && (
                    <div className="paused-overlay">
                        <div className="paused-card">
                            <Pause size={48} />
                            <h3>Interview Paused</h3>
                            <p>Your progress is saved. Resume when you're ready.</p>
                            <button className="btn btn-primary btn-lg" onClick={handleResume}>
                                <Play size={20} /> Resume Interview
                            </button>
                        </div>
                    </div>
                )}

                {/* Interview Content - 65% Avatar LEFT / 35% Chat RIGHT */}
                <div className={`interview-content ${!avatarEnabled ? 'no-avatar' : ''}`}>
                    {/* Avatar Panel - LEFT (65%) */}
                    {avatarEnabled && (
                        <div className="avatar-panel">
                            {/* Avatar Panel Header */}
                            <div className="avatar-panel-header">
                                <div className="header-left">
                                    <div className="header-title">
                                        <MessageSquare size={18} />
                                        <span>Interview</span>
                                    </div>
                                    <span className={`persona-badge ${personaDisplay.color}`}>
                                        {personaDisplay.icon} {personaDisplay.label}
                                    </span>
                                </div>
                                <div className="header-center">
                                    {progress && (
                                        <>
                                            <span className="question-progress">
                                                Question {progress.current_question} / {progress.total_questions}
                                            </span>
                                            <div className="progress-bar-mini">
                                                <div
                                                    className="fill"
                                                    style={{ width: `${(progress.current_question / progress.total_questions) * 100}%` }}
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="header-controls">
                                    <button
                                        className={`header-icon-btn ${avatarEnabled ? 'active' : ''}`}
                                        onClick={() => setAvatarEnabled(!avatarEnabled)}
                                        title="Toggle Avatar"
                                    >
                                        <Eye size={18} />
                                    </button>
                                    {ttsSupported && (
                                        <button
                                            className={`header-icon-btn ${voiceEnabled ? 'active' : ''}`}
                                            onClick={() => setVoiceEnabled(!voiceEnabled)}
                                            title="Toggle Voice"
                                        >
                                            <Volume2 size={18} />
                                        </button>
                                    )}
                                    <button
                                        className="header-icon-btn"
                                        title={isBrowserFullscreen ? "Exit Fullscreen (ESC)" : "Enter Browser Fullscreen"}
                                        onClick={toggleBrowserFullscreen}
                                    >
                                        {isBrowserFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                                    </button>
                                </div>
                            </div>
                            {/* Avatar Canvas - Takes remaining space */}
                            <div className="avatar-wrapper">
                                <InterviewerAvatar
                                    speaking={isSpeaking || conversationState === 'bot_speaking'}
                                    listening={conversationState === 'user_turn' || isListening}
                                    audioLevel={audioLevel}
                                    enabled={avatarEnabled}
                                    enableWebcam={status === 'in_progress' && isCameraReady}
                                />
                            </div>
                        </div>
                    )}

                    {/* Chat Panel - RIGHT (35%) */}
                    <div className="chat-panel">
                        {/* Chat Header */}
                        <div className="chat-header">
                            {progress && (
                                <span className="question-label">
                                    Question {progress.current_question} / {progress.total_questions}
                                </span>
                            )}
                            {currentRound && ROUND_DEFINITIONS[currentRound] && (
                                <div className="round-indicator">
                                    <span className="round-indicator-icon">
                                        {ROUND_DEFINITIONS[currentRound].icon}
                                    </span>
                                    <span className="round-indicator-name">
                                        {ROUND_DEFINITIONS[currentRound].name}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Question Timer (Strict/High-Pressure Modes) */}
                        {isAnalyticsEnabled && timerData.isRunning && analyticsConfig.questionTimeLimit > 0 && (
                            <QuestionTimer
                                timeRemaining={timerData.timeRemaining}
                                totalTime={analyticsConfig.questionTimeLimit}
                                isRunning={timerData.isRunning}
                                showWarnings={true}
                            />
                        )}

                        {/* Recording Indicator (Strict/High-Pressure Modes) */}
                        {isRecording && (persona === 'strict' || persona === 'stress') && (
                            <div className="recording-indicator-container">
                                <RecordingIndicator
                                    isRecording={isRecording}
                                    duration={recordingDuration}
                                />
                                <span className="recording-note">Your interview is being recorded</span>
                            </div>
                        )}

                        {/* Real-time Analytics Stats (Strict/High-Pressure) */}
                        {isAnalyticsEnabled && interviewPhase === 'INTERVIEW_IN_PROGRESS' && (
                            <div className="analytics-stats-bar">
                                <div className="stat-item">
                                    <Eye size={14} />
                                    <span className="stat-label">Eye Contact</span>
                                    <span className={`stat-value ${eyeContactData.percentage >= 70 ? 'good' : eyeContactData.percentage >= 50 ? 'fair' : 'poor'}`}>
                                        {Math.round(eyeContactData.percentage)}%
                                    </span>
                                </div>
                                <div className="stat-item">
                                    <Activity size={14} />
                                    <span className="stat-label">Stability</span>
                                    <span className={`stat-value ${postureData.stabilityScore >= 70 ? 'good' : postureData.stabilityScore >= 50 ? 'fair' : 'poor'}`}>
                                        {postureData.stabilityScore}%
                                    </span>
                                </div>
                                {fillerWordData.totalCount > 0 && (
                                    <div className="stat-item warning">
                                        <MessageSquare size={14} />
                                        <span className="stat-label">Fillers</span>
                                        <span className="stat-value">{fillerWordData.totalCount}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Chat Messages */}
                        <div className="chat-messages">
                            {messages.map(renderMessage)}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Quick Feedback Toast */}
                        {showFeedback && lastFeedback && (
                            <div className={`feedback-toast ${
                                lastFeedback.loading ? 'loading' :
                                lastFeedback.relevance_score >= 6 ? 'good' :
                                lastFeedback.relevance_score >= 4 ? 'ok' : 'needs-work'
                                }`}>
                                <div className="feedback-header">
                                    {lastFeedback.loading ? (
                                        <Loader2 size={16} className="spinning" />
                                    ) : lastFeedback.relevance_score >= 6 ? (
                                        <CheckCircle size={16} />
                                    ) : (
                                        <AlertCircle size={16} />
                                    )}
                                    <span>
                                        {lastFeedback.loading ? 'Evaluating...' :
                                            lastFeedback.relevance_score >= 6 ? 'Good Answer' :
                                            lastFeedback.relevance_score >= 4 ? 'Adequate' : 'Needs Improvement'}
                                    </span>
                                    <button onClick={() => setShowFeedback(false)}>×</button>
                                </div>
                                <p>{lastFeedback.feedback}</p>
                                {!lastFeedback.loading && (
                                    <div className="feedback-score">
                                        Score: {lastFeedback.relevance_score}/10
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Voice Input Indicator */}
                        {isListening && sttSupported && (
                            <div className="voice-input-indicator recording">
                                <div className="voice-waves">
                                    <span className="voice-wave-bar" />
                                    <span className="voice-wave-bar" />
                                    <span className="voice-wave-bar" />
                                    <span className="voice-wave-bar" />
                                    <span className="voice-wave-bar" />
                                </div>
                                <div className={`voice-transcript ${!transcript ? 'placeholder' : ''}`}>
                                    {transcript || (interviewPhase === 'WAITING_FOR_CONSENT'
                                        ? "Listening... Say 'yes' or 'ready'"
                                        : 'Listening... Speak your answer')}
                                </div>
                            </div>
                        )}

                        {/* Input Area - Show during interview OR waiting for consent */}
                        {status === 'in_progress' && (currentQuestion || interviewPhase === 'WAITING_FOR_CONSENT') && (
                            <div className="chat-input-area">
                                <form onSubmit={handleSubmitAnswer}>
                                    <div className="input-container">
                                        <textarea
                                            ref={inputRef}
                                            value={answer}
                                            onChange={(e) => setAnswer(e.target.value)}
                                            placeholder={
                                                interviewPhase === 'WAITING_FOR_CONSENT'
                                                    ? "Say 'yes' or 'ready' to begin..."
                                                    : "Type your answer..."
                                            }
                                            disabled={submitting}
                                            rows={1}
                                            className="chat-input"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSubmitAnswer(e);
                                                }
                                            }}
                                        />
                                        <div className="input-actions-inline">
                                            {/* SEND BUTTON - Primary action */}
                                            <button
                                                type="submit"
                                                className={`send-btn ${answer.trim() ? 'active' : ''}`}
                                                disabled={submitting || !answer.trim()}
                                                title="Send (Enter)"
                                            >
                                                {submitting ? (
                                                    <Loader2 size={20} className="spin" />
                                                ) : (
                                                    <Send size={20} />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    {/* Media Controls */}
                                    <div className="media-controls">
                                        {sttSupported && (
                                            <button
                                                type="button"
                                                className={`media-btn ${isListening ? 'active recording' : 'off'}`}
                                                onClick={toggleVoiceRecording}
                                                disabled={submitting || isSpeaking}
                                                title={isListening ? 'Stop Recording' : 'Start Voice Input'}
                                            >
                                                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                                                {isListening && <span className="recording-dot" />}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            className={`media-btn ${voiceEnabled ? 'active' : 'off'}`}
                                            onClick={() => setVoiceEnabled(!voiceEnabled)}
                                            title={voiceEnabled ? 'Mute Interviewer' : 'Unmute Interviewer'}
                                        >
                                            {voiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                                        </button>
                                        <button
                                            type="button"
                                            className={`media-btn ${isCameraReady ? 'active' : 'off'}`}
                                            title="Camera"
                                        >
                                            {isCameraReady ? <Eye size={20} /> : <EyeOff size={20} />}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Completing State */}
                        {status === 'completed' && (
                            <div className="completing-card">
                                <Sparkles size={48} />
                                <h3>Interview Complete!</h3>
                                <p>Great job! Your responses are being analyzed.</p>
                                <button
                                    className="btn btn-primary btn-lg"
                                    onClick={handleViewResults}
                                >
                                    View Your Results
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Performance Summary Modal (Strict/High-Pressure Modes) */}
            {showPerformanceSummary && performanceSummaryData && (
                <PerformanceSummary
                    summary={performanceSummaryData}
                    onClose={() => {
                        setShowPerformanceSummary(false);
                        handleViewResults();
                    }}
                />
            )}
        </div>
    );
}

export default LiveInterview;
