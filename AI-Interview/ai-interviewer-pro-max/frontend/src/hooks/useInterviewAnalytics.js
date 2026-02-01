/**
 * useInterviewAnalytics - Real-time Interview Performance Tracking
 * 
 * PRODUCTION-GRADE analytics for Strict and High-Pressure interview modes.
 * 
 * Features:
 * - Eye Contact Tracking (% of time maintaining eye contact)
 * - Posture/Stability Score (face position variance)
 * - Filler Word Detection (um, uh, like, you know)
 * - Silence Penalty Tracking (awkward pauses)
 * - Speaking Speed Analysis (words per minute)
 * - Video Recording of user
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// Filler words to detect
const FILLER_WORDS = [
    'um', 'uh', 'uhh', 'umm', 'er', 'err', 'ah', 'ahh',
    'like', 'you know', 'basically', 'actually', 'literally',
    'so', 'well', 'right', 'okay', 'i mean', 'kind of', 'sort of'
];

// Configuration for different modes
const MODE_CONFIG = {
    strict: {
        questionTimeLimit: 120, // 2 minutes per question
        silenceThreshold: 3000, // 3 seconds of silence is penalized
        eyeContactThreshold: 0.7, // 70% eye contact needed for "good"
        enabled: true,
    },
    stress: {
        questionTimeLimit: 90, // 1.5 minutes per question (more pressure)
        silenceThreshold: 2000, // 2 seconds silence penalty
        eyeContactThreshold: 0.8, // 80% eye contact needed
        enabled: true,
    },
    friendly: {
        questionTimeLimit: 0, // No time limit
        silenceThreshold: 0, // No silence penalty
        eyeContactThreshold: 0,
        enabled: false,
    },
    neutral: {
        questionTimeLimit: 0,
        silenceThreshold: 0,
        eyeContactThreshold: 0,
        enabled: false,
    },
    professional: {
        questionTimeLimit: 0,
        silenceThreshold: 0,
        eyeContactThreshold: 0,
        enabled: false,
    }
};

export default function useInterviewAnalytics(mode = 'neutral') {
    // Get config for current mode
    const config = MODE_CONFIG[mode] || MODE_CONFIG.neutral;
    const isAnalyticsEnabled = config.enabled;

    // ===========================================
    // STATE
    // ===========================================

    // Eye Contact Tracking
    const [eyeContactData, setEyeContactData] = useState({
        totalFrames: 0,
        eyeContactFrames: 0,
        percentage: 0,
        currentlyLooking: false,
        history: [], // timestamps of eye contact status
    });

    // Posture/Stability Tracking
    const [postureData, setPostureData] = useState({
        stabilityScore: 100, // 0-100, higher is more stable
        totalMovement: 0,
        fidgetCount: 0,
        positionHistory: [], // {x, y, timestamp}
    });

    // Filler Words
    const [fillerWordData, setFillerWordData] = useState({
        totalCount: 0,
        breakdown: {}, // { "um": 5, "uh": 3 }
        percentageOfSpeech: 0,
        instances: [], // { word, timestamp, questionIndex }
    });

    // Silence Tracking
    const [silenceData, setSilenceData] = useState({
        totalSilenceMs: 0,
        silenceInstances: [], // { startTime, duration, questionIndex }
        longestSilence: 0,
        averageSilence: 0,
    });

    // Speaking Speed
    const [speedData, setSpeedData] = useState({
        wordsPerMinute: 0,
        totalWords: 0,
        totalSpeakingTimeMs: 0,
        speedHistory: [], // { wpm, timestamp }
        isTooFast: false,
        isTooSlow: false,
    });

    // Question Timer
    const [timerData, setTimerData] = useState({
        timeRemaining: config.questionTimeLimit,
        isRunning: false,
        timedOutQuestions: [],
        questionStartTime: null,
    });

    // Video Recording
    const [videoData, setVideoData] = useState({
        isRecording: false,
        blob: null,
        url: null,
        duration: 0,
    });

    // Overall Summary
    const [summary, setSummary] = useState(null);

    // ===========================================
    // REFS
    // ===========================================
    const mediaRecorderRef = useRef(null);
    const videoStreamRef = useRef(null);
    const recordedChunksRef = useRef([]);
    const timerIntervalRef = useRef(null);
    const lastFacePositionRef = useRef(null);
    const lastSpeechTimeRef = useRef(null);
    const silenceStartRef = useRef(null);
    const currentQuestionIndexRef = useRef(0);
    const analyticsStartTimeRef = useRef(null);
    const speechStartTimeRef = useRef(null);
    const wordCountRef = useRef(0);

    // ===========================================
    // VIDEO RECORDING
    // ===========================================

    const startVideoRecording = useCallback(async () => {
        if (!isAnalyticsEnabled) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 640, height: 480 },
                audio: false // We don't need audio in this recording
            });

            videoStreamRef.current = stream;
            recordedChunksRef.current = [];

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp9'
            });

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                setVideoData(prev => ({
                    ...prev,
                    isRecording: false,
                    blob,
                    url,
                }));
            };

            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start(1000); // Collect data every second
            analyticsStartTimeRef.current = Date.now();

            setVideoData(prev => ({ ...prev, isRecording: true }));
            console.log('[Analytics] Video recording started');
        } catch (error) {
            console.error('[Analytics] Failed to start video recording:', error);
        }
    }, [isAnalyticsEnabled]);

    const stopVideoRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();

            const duration = analyticsStartTimeRef.current
                ? (Date.now() - analyticsStartTimeRef.current) / 1000
                : 0;

            setVideoData(prev => ({ ...prev, duration }));
        }

        if (videoStreamRef.current) {
            videoStreamRef.current.getTracks().forEach(track => track.stop());
            videoStreamRef.current = null;
        }

        console.log('[Analytics] Video recording stopped');
    }, []);

    // ===========================================
    // EYE CONTACT TRACKING
    // ===========================================

    const updateEyeContact = useCallback((isLookingAtCamera, facePosition = null) => {
        if (!isAnalyticsEnabled) return;

        setEyeContactData(prev => {
            const newTotalFrames = prev.totalFrames + 1;
            const newEyeContactFrames = isLookingAtCamera ? prev.eyeContactFrames + 1 : prev.eyeContactFrames;
            const newPercentage = (newEyeContactFrames / newTotalFrames) * 100;

            return {
                totalFrames: newTotalFrames,
                eyeContactFrames: newEyeContactFrames,
                percentage: Math.round(newPercentage * 10) / 10,
                currentlyLooking: isLookingAtCamera,
                history: [...prev.history.slice(-100), { looking: isLookingAtCamera, timestamp: Date.now() }],
            };
        });

        // Also update posture tracking if face position provided
        if (facePosition) {
            updatePosture(facePosition);
        }
    }, [isAnalyticsEnabled]);

    // ===========================================
    // POSTURE/STABILITY TRACKING
    // ===========================================

    const updatePosture = useCallback((facePosition) => {
        if (!isAnalyticsEnabled || !facePosition) return;

        const { x, y } = facePosition;
        const now = Date.now();

        setPostureData(prev => {
            const newHistory = [...prev.positionHistory.slice(-60), { x, y, timestamp: now }];

            // Calculate movement from last position
            let movementDelta = 0;
            let fidgetIncrement = 0;

            if (lastFacePositionRef.current) {
                const dx = Math.abs(x - lastFacePositionRef.current.x);
                const dy = Math.abs(y - lastFacePositionRef.current.y);
                movementDelta = Math.sqrt(dx * dx + dy * dy);

                // Consider it fidgeting if movement is significant but short
                if (movementDelta > 0.05 && movementDelta < 0.15) {
                    fidgetIncrement = 1;
                }
            }

            lastFacePositionRef.current = { x, y };

            // Calculate stability score based on variance
            let stabilityScore = 100;
            if (newHistory.length >= 10) {
                const recentPositions = newHistory.slice(-30);
                const avgX = recentPositions.reduce((sum, p) => sum + p.x, 0) / recentPositions.length;
                const avgY = recentPositions.reduce((sum, p) => sum + p.y, 0) / recentPositions.length;

                const variance = recentPositions.reduce((sum, p) => {
                    return sum + Math.pow(p.x - avgX, 2) + Math.pow(p.y - avgY, 2);
                }, 0) / recentPositions.length;

                // Convert variance to stability score (lower variance = higher stability)
                stabilityScore = Math.max(0, Math.min(100, 100 - variance * 2000));
            }

            return {
                stabilityScore: Math.round(stabilityScore),
                totalMovement: prev.totalMovement + movementDelta,
                fidgetCount: prev.fidgetCount + fidgetIncrement,
                positionHistory: newHistory,
            };
        });
    }, [isAnalyticsEnabled]);

    // ===========================================
    // FILLER WORD DETECTION
    // ===========================================

    const analyzeTranscript = useCallback((transcript, questionIndex = 0) => {
        if (!isAnalyticsEnabled || !transcript) return;

        const lowerTranscript = transcript.toLowerCase();
        const words = lowerTranscript.split(/\s+/);
        const totalWords = words.length;

        // Count filler words
        const fillerCounts = {};
        FILLER_WORDS.forEach(filler => {
            const regex = new RegExp(`\\b${filler}\\b`, 'gi');
            const matches = lowerTranscript.match(regex);
            if (matches && matches.length > 0) {
                fillerCounts[filler] = matches.length;
            }
        });

        const totalFillers = Object.values(fillerCounts).reduce((sum, count) => sum + count, 0);

        setFillerWordData(prev => ({
            totalCount: totalFillers,
            breakdown: fillerCounts,
            percentageOfSpeech: totalWords > 0 ? (totalFillers / totalWords) * 100 : 0,
            instances: Object.entries(fillerCounts).map(([word, count]) => ({
                word,
                count,
                questionIndex,
                timestamp: Date.now(),
            })),
        }));

        // Update word count for speed calculation
        wordCountRef.current = totalWords;
    }, [isAnalyticsEnabled]);

    // ===========================================
    // SILENCE TRACKING
    // ===========================================

    const trackSpeech = useCallback((isSpeaking, questionIndex = 0) => {
        if (!isAnalyticsEnabled) return;

        const now = Date.now();

        if (isSpeaking) {
            // User is speaking
            if (!speechStartTimeRef.current) {
                speechStartTimeRef.current = now;
            }

            // Check if there was a silence gap
            if (silenceStartRef.current) {
                const silenceDuration = now - silenceStartRef.current;

                if (silenceDuration >= config.silenceThreshold) {
                    setSilenceData(prev => {
                        const newInstances = [...prev.silenceInstances, {
                            startTime: silenceStartRef.current,
                            duration: silenceDuration,
                            questionIndex,
                        }];
                        const totalSilence = newInstances.reduce((sum, s) => sum + s.duration, 0);
                        const avgSilence = newInstances.length > 0 ? totalSilence / newInstances.length : 0;

                        return {
                            totalSilenceMs: totalSilence,
                            silenceInstances: newInstances,
                            longestSilence: Math.max(prev.longestSilence, silenceDuration),
                            averageSilence: avgSilence,
                        };
                    });
                }
                silenceStartRef.current = null;
            }

            lastSpeechTimeRef.current = now;
        } else {
            // User stopped speaking - start silence timer
            if (lastSpeechTimeRef.current && !silenceStartRef.current) {
                silenceStartRef.current = now;
            }
        }
    }, [isAnalyticsEnabled, config.silenceThreshold]);

    // ===========================================
    // SPEAKING SPEED ANALYSIS
    // ===========================================

    const updateSpeakingSpeed = useCallback((wordCount, speakingTimeMs) => {
        if (!isAnalyticsEnabled || speakingTimeMs <= 0) return;

        const wpm = (wordCount / speakingTimeMs) * 60000; // Words per minute

        setSpeedData(prev => ({
            wordsPerMinute: Math.round(wpm),
            totalWords: wordCount,
            totalSpeakingTimeMs: speakingTimeMs,
            speedHistory: [...prev.speedHistory.slice(-20), { wpm: Math.round(wpm), timestamp: Date.now() }],
            isTooFast: wpm > 180, // Speaking too fast (nervous)
            isTooSlow: wpm < 100, // Speaking too slow (unprepared)
        }));
    }, [isAnalyticsEnabled]);

    // ===========================================
    // QUESTION TIMER
    // ===========================================

    const startQuestionTimer = useCallback((questionIndex = 0) => {
        if (!isAnalyticsEnabled || config.questionTimeLimit <= 0) return;

        currentQuestionIndexRef.current = questionIndex;

        setTimerData(prev => ({
            ...prev,
            timeRemaining: config.questionTimeLimit,
            isRunning: true,
            questionStartTime: Date.now(),
        }));

        // Clear any existing timer
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
        }

        timerIntervalRef.current = setInterval(() => {
            setTimerData(prev => {
                const newTime = prev.timeRemaining - 1;

                if (newTime <= 0) {
                    clearInterval(timerIntervalRef.current);
                    return {
                        ...prev,
                        timeRemaining: 0,
                        isRunning: false,
                        timedOutQuestions: [...prev.timedOutQuestions, questionIndex],
                    };
                }

                return { ...prev, timeRemaining: newTime };
            });
        }, 1000);

        console.log('[Analytics] Question timer started:', config.questionTimeLimit, 'seconds');
    }, [isAnalyticsEnabled, config.questionTimeLimit]);

    const stopQuestionTimer = useCallback(() => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }

        setTimerData(prev => ({
            ...prev,
            isRunning: false,
        }));
    }, []);

    const pauseTimer = useCallback(() => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
        setTimerData(prev => ({ ...prev, isRunning: false }));
    }, []);

    const resumeTimer = useCallback(() => {
        if (!isAnalyticsEnabled || timerData.timeRemaining <= 0) return;

        timerIntervalRef.current = setInterval(() => {
            setTimerData(prev => {
                const newTime = prev.timeRemaining - 1;
                if (newTime <= 0) {
                    clearInterval(timerIntervalRef.current);
                    return {
                        ...prev,
                        timeRemaining: 0,
                        isRunning: false,
                        timedOutQuestions: [...prev.timedOutQuestions, currentQuestionIndexRef.current],
                    };
                }
                return { ...prev, timeRemaining: newTime, isRunning: true };
            });
        }, 1000);
    }, [isAnalyticsEnabled, timerData.timeRemaining]);

    // ===========================================
    // GENERATE FINAL SUMMARY
    // ===========================================

    const generateSummary = useCallback(() => {
        // Calculate speaking speed from total data
        const totalTimeMs = analyticsStartTimeRef.current
            ? Date.now() - analyticsStartTimeRef.current
            : speedData.totalSpeakingTimeMs;

        const finalWPM = totalTimeMs > 0
            ? (wordCountRef.current / totalTimeMs) * 60000
            : speedData.wordsPerMinute;

        // Eye contact grade
        let eyeContactGrade = 'Needs Improvement';
        if (eyeContactData.percentage >= 80) eyeContactGrade = 'Excellent';
        else if (eyeContactData.percentage >= 70) eyeContactGrade = 'Good';
        else if (eyeContactData.percentage >= 50) eyeContactGrade = 'Fair';

        // Posture grade
        let postureGrade = 'Needs Improvement';
        if (postureData.stabilityScore >= 85) postureGrade = 'Excellent';
        else if (postureData.stabilityScore >= 70) postureGrade = 'Good';
        else if (postureData.stabilityScore >= 50) postureGrade = 'Fair';

        // Speed grade
        let speedGrade = 'Good';
        if (finalWPM > 180) speedGrade = 'Too Fast (Nervous)';
        else if (finalWPM < 100) speedGrade = 'Too Slow';
        else if (finalWPM >= 120 && finalWPM <= 160) speedGrade = 'Excellent';

        const summaryData = {
            // Eye Contact
            eyeContact: {
                percentage: Math.round(eyeContactData.percentage),
                grade: eyeContactGrade,
                totalFrames: eyeContactData.totalFrames,
                recommendation: eyeContactData.percentage < 70
                    ? 'Try to maintain eye contact with the camera more consistently. This shows confidence and engagement.'
                    : 'Great job maintaining eye contact!',
            },

            // Posture/Stability
            posture: {
                stabilityScore: postureData.stabilityScore,
                grade: postureGrade,
                fidgetCount: postureData.fidgetCount,
                recommendation: postureData.stabilityScore < 70
                    ? 'Try to stay more steady during your responses. Excessive movement can appear nervous.'
                    : 'Good posture control throughout the interview!',
            },

            // Filler Words
            fillerWords: {
                totalCount: fillerWordData.totalCount,
                breakdown: fillerWordData.breakdown,
                percentageOfSpeech: Math.round(fillerWordData.percentageOfSpeech * 100) / 100,
                recommendation: fillerWordData.totalCount > 10
                    ? 'Work on reducing filler words. Practice pausing instead of using "um" or "uh".'
                    : fillerWordData.totalCount > 5
                        ? 'Some filler words detected. A bit of practice can help reduce these.'
                        : 'Excellent! Minimal filler words used.',
            },

            // Silence
            silence: {
                totalSilenceSeconds: Math.round(silenceData.totalSilenceMs / 1000),
                instanceCount: silenceData.silenceInstances.length,
                longestSilenceSeconds: Math.round(silenceData.longestSilence / 1000),
                recommendation: silenceData.silenceInstances.length > 3
                    ? 'Several awkward pauses detected. Practice your responses to speak more fluently.'
                    : 'Good flow! Minimal awkward silences.',
            },

            // Speaking Speed
            speed: {
                wordsPerMinute: Math.round(finalWPM),
                grade: speedGrade,
                recommendation: finalWPM > 180
                    ? 'You\'re speaking quite fast. Try to slow down to ensure clarity.'
                    : finalWPM < 100
                        ? 'Consider speaking a bit faster to maintain engagement.'
                        : 'Great speaking pace!',
            },

            // Timer
            timer: {
                timedOutQuestions: timerData.timedOutQuestions.length,
                questionIndexes: timerData.timedOutQuestions,
            },

            // Video
            video: {
                available: videoData.blob !== null,
                url: videoData.url,
                duration: Math.round(videoData.duration),
            },

            // Overall Score (weighted average)
            overallScore: Math.round(
                (eyeContactData.percentage * 0.25) +
                (postureData.stabilityScore * 0.20) +
                (Math.max(0, 100 - fillerWordData.totalCount * 3) * 0.20) +
                (Math.max(0, 100 - silenceData.silenceInstances.length * 10) * 0.15) +
                (finalWPM >= 120 && finalWPM <= 160 ? 100 : Math.max(0, 100 - Math.abs(140 - finalWPM))) * 0.20
            ),

            timestamp: new Date().toISOString(),
            mode: mode,
        };

        setSummary(summaryData);
        console.log('[Analytics] Summary generated:', summaryData);
        return summaryData;
    }, [eyeContactData, postureData, fillerWordData, silenceData, speedData, timerData, videoData, mode]);

    // ===========================================
    // CLEANUP
    // ===========================================

    useEffect(() => {
        return () => {
            stopVideoRecording();
            stopQuestionTimer();
        };
    }, [stopVideoRecording, stopQuestionTimer]);

    // ===========================================
    // RESET ALL DATA
    // ===========================================

    const resetAnalytics = useCallback(() => {
        setEyeContactData({
            totalFrames: 0,
            eyeContactFrames: 0,
            percentage: 0,
            currentlyLooking: false,
            history: [],
        });
        setPostureData({
            stabilityScore: 100,
            totalMovement: 0,
            fidgetCount: 0,
            positionHistory: [],
        });
        setFillerWordData({
            totalCount: 0,
            breakdown: {},
            percentageOfSpeech: 0,
            instances: [],
        });
        setSilenceData({
            totalSilenceMs: 0,
            silenceInstances: [],
            longestSilence: 0,
            averageSilence: 0,
        });
        setSpeedData({
            wordsPerMinute: 0,
            totalWords: 0,
            totalSpeakingTimeMs: 0,
            speedHistory: [],
            isTooFast: false,
            isTooSlow: false,
        });
        setTimerData({
            timeRemaining: config.questionTimeLimit,
            isRunning: false,
            timedOutQuestions: [],
            questionStartTime: null,
        });
        setVideoData({
            isRecording: false,
            blob: null,
            url: null,
            duration: 0,
        });
        setSummary(null);

        lastFacePositionRef.current = null;
        lastSpeechTimeRef.current = null;
        silenceStartRef.current = null;
        analyticsStartTimeRef.current = null;
        speechStartTimeRef.current = null;
        wordCountRef.current = 0;
        recordedChunksRef.current = [];
    }, [config.questionTimeLimit]);

    return {
        // Config
        isAnalyticsEnabled,
        config,

        // Data
        eyeContactData,
        postureData,
        fillerWordData,
        silenceData,
        speedData,
        timerData,
        videoData,
        summary,

        // Video Recording
        startVideoRecording,
        stopVideoRecording,

        // Tracking Functions
        updateEyeContact,
        updatePosture,
        analyzeTranscript,
        trackSpeech,
        updateSpeakingSpeed,

        // Timer Functions
        startQuestionTimer,
        stopQuestionTimer,
        pauseTimer,
        resumeTimer,

        // Summary
        generateSummary,
        resetAnalytics,
    };
}

// Export mode config for other components
export { MODE_CONFIG };
