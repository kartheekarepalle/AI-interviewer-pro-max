/**
 * useSpeechServices - TTS and STT with Real Audio Level Detection
 * 
 * Features:
 * - Text-to-Speech for AI interviewer voice
 * - Speech-to-Text for user voice input
 * - Real-time audio level for lip sync
 * - Throttled updates for performance
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ===========================================
// TTS CONFIGURATION
// ===========================================

const TTS_CONFIG = {
    rate: 0.95,
    pitch: 1.0,
    volume: 1.0,
    preferredVoices: [
        'Microsoft David',
        'Google US English',
        'Alex',
        'Daniel',
    ],
};

// ===========================================
// AUDIO LEVEL DETECTION
// ===========================================

class AudioLevelAnalyzer {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.source = null;
        this.animationFrame = null;
        this.onLevelChange = null;
        this.isRunning = false;
    }

    async start(stream, onLevelChange) {
        this.onLevelChange = onLevelChange;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.5;

            this.source = this.audioContext.createMediaStreamSource(stream);
            this.source.connect(this.analyser);

            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.isRunning = true;

            this.analyze();
        } catch (e) {
            console.warn('Audio analyzer setup failed:', e);
        }
    }

    analyze = () => {
        if (!this.isRunning) return;

        this.analyser.getByteFrequencyData(this.dataArray);

        // Calculate RMS level
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i] ** 2;
        }
        const rms = Math.sqrt(sum / this.dataArray.length);

        // Normalize to 0-1 (typical speech range)
        const level = Math.min(1, rms / 128);

        if (this.onLevelChange) {
            this.onLevelChange(level);
        }

        this.animationFrame = requestAnimationFrame(this.analyze);
    };

    stop() {
        this.isRunning = false;

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }

        if (this.audioContext) {
            this.audioContext.close().catch(() => { });
            this.audioContext = null;
        }

        this.onLevelChange = null;
    }
}

// ===========================================
// MAIN HOOK
// ===========================================

export default function useSpeechServices() {
    // TTS state
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);

    // STT state
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');

    // Refs
    const recognitionRef = useRef(null);
    const synthRef = useRef(null);
    const utteranceRef = useRef(null);
    const audioLevelAnimationRef = useRef(null);
    const analyzerRef = useRef(null);
    const isListeningRef = useRef(false); // Track current listening state for callbacks
    const isSpeakingRef = useRef(false); // Track speaking state for animation loop (avoid stale closure)

    // Feature detection
    const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    const sttSupported = typeof window !== 'undefined' &&
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    // ===========================================
    // TTS (Text-to-Speech)
    // ===========================================

    const getVoice = useCallback(() => {
        if (!ttsSupported) return null;

        const voices = window.speechSynthesis.getVoices();

        // Try preferred voices first
        for (const preferred of TTS_CONFIG.preferredVoices) {
            const voice = voices.find(v => v.name.includes(preferred));
            if (voice) return voice;
        }

        // Fallback to first English voice
        const englishVoice = voices.find(v => v.lang.startsWith('en'));
        if (englishVoice) return englishVoice;

        return voices[0] || null;
    }, [ttsSupported]);

    const speak = useCallback((text) => {
        return new Promise((resolve, reject) => {
            if (!ttsSupported || !text) {
                resolve();
                return;
            }

            // Cancel any ongoing speech
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utteranceRef.current = utterance;

            const voice = getVoice();
            if (voice) utterance.voice = voice;

            utterance.rate = TTS_CONFIG.rate;
            utterance.pitch = TTS_CONFIG.pitch;
            utterance.volume = TTS_CONFIG.volume;

            // Advanced lip sync simulation
            // Generates phoneme-like audio patterns for realistic mouth movement
            let lastUpdate = 0;
            let syllablePhase = 0;
            let wordBreakTimer = 0;
            let currentPeak = 0.5;
            let targetPeak = 0.5;

            const simulateAudioLevel = () => {
                // Use ref to avoid stale closure - check if still speaking
                if (!isSpeakingRef.current) {
                    setAudioLevel(0);
                    return;
                }

                const now = Date.now();
                const deltaMs = now - lastUpdate;
                if (deltaMs < 40) { // ~25fps for smooth animation
                    audioLevelAnimationRef.current = requestAnimationFrame(simulateAudioLevel);
                    return;
                }
                lastUpdate = now;

                // Simulate speech patterns
                syllablePhase += deltaMs * 0.015; // Syllable rhythm
                wordBreakTimer -= deltaMs;

                // Random word breaks (pauses in speech)
                if (wordBreakTimer <= 0) {
                    if (Math.random() < 0.15) {
                        // Brief pause between words
                        wordBreakTimer = 80 + Math.random() * 120;
                        targetPeak = 0.05; // Small value during pauses for subtle mouth movement
                    } else {
                        wordBreakTimer = 150 + Math.random() * 200;
                        targetPeak = 0.4 + Math.random() * 0.5;
                    }
                }

                // Smooth transition to target
                currentPeak = currentPeak + (targetPeak - currentPeak) * 0.3;

                // Generate phoneme-like variations
                const syllableWave = Math.sin(syllablePhase) * 0.3;
                const quickVariation = Math.sin(now * 0.02) * 0.15;
                const microVariation = (Math.random() - 0.5) * 0.12;

                // Combine for natural speech pattern
                let level = currentPeak + syllableWave + quickVariation + microVariation;
                level = Math.max(0.02, Math.min(1, level)); // Minimum 0.02 for subtle movement

                setAudioLevel(level);
                audioLevelAnimationRef.current = requestAnimationFrame(simulateAudioLevel);
            };

            utterance.onstart = () => {
                isSpeakingRef.current = true; // Set ref FIRST
                setIsSpeaking(true);
                simulateAudioLevel();
            };

            utterance.onend = () => {
                isSpeakingRef.current = false; // Set ref FIRST to stop animation
                setIsSpeaking(false);
                setAudioLevel(0);
                if (audioLevelAnimationRef.current) {
                    cancelAnimationFrame(audioLevelAnimationRef.current);
                    audioLevelAnimationRef.current = null;
                }
                resolve();
            };

            utterance.onerror = (event) => {
                isSpeakingRef.current = false; // Set ref FIRST to stop animation
                setIsSpeaking(false);
                setAudioLevel(0);
                if (audioLevelAnimationRef.current) {
                    cancelAnimationFrame(audioLevelAnimationRef.current);
                    audioLevelAnimationRef.current = null;
                }
                // Don't reject on 'interrupted' errors (normal when speech is cancelled)
                if (event.error !== 'interrupted') {
                    console.warn('TTS error:', event.error);
                }
                resolve();
            };

            window.speechSynthesis.speak(utterance);
        });
    }, [ttsSupported, getVoice, isSpeaking]);

    const stopSpeaking = useCallback(() => {
        isSpeakingRef.current = false; // Set ref FIRST to stop animation
        if (ttsSupported) {
            window.speechSynthesis.cancel();
        }
        setIsSpeaking(false);
        setAudioLevel(0);
        if (audioLevelAnimationRef.current) {
            cancelAnimationFrame(audioLevelAnimationRef.current);
            audioLevelAnimationRef.current = null;
        }
    }, [ttsSupported]);

    // ===========================================
    // STT (Speech-to-Text)
    // ===========================================

    const initRecognition = useCallback(() => {
        if (!sttSupported) return null;

        if (recognitionRef.current) {
            return recognitionRef.current;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            let interim = '';
            let final = '';

            console.log('[STT] onresult event received, resultIndex:', event.resultIndex, 'resultsLength:', event.results.length);

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    final += result[0].transcript + ' ';
                    console.log('[STT] Final result:', result[0].transcript, 'confidence:', (result[0].confidence * 100).toFixed(0) + '%');
                } else {
                    interim += result[0].transcript;
                }
            }

            if (final) {
                console.log('[STT] Adding final transcript:', final.trim().substring(0, 50));
                setTranscript(prev => {
                    const newTranscript = (prev + final).trim();
                    console.log('[STT] New transcript value:', newTranscript.substring(0, 50));
                    return newTranscript;
                });
            }
            if (interim) {
                console.log('[STT] Interim result:', interim.substring(0, 50));
            }
            setInterimTranscript(interim);
        };

        recognition.onerror = (event) => {
            console.warn('[STT] Recognition error:', event.error, event.message);
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                console.error('[STT] Microphone access denied');
                setIsListening(false);
                isListeningRef.current = false;
            } else if (event.error === 'no-speech') {
                console.log('[STT] No speech detected, continuing to listen...');
                // Don't stop - just no speech detected yet
            } else if (event.error === 'aborted') {
                console.log('[STT] Recognition aborted');
            } else {
                console.warn('[STT] Other error, will attempt to continue:', event.error);
            }
        };

        recognition.onend = () => {
            console.log('[STT] Recognition ended, isListeningRef:', isListeningRef.current);
            // Auto-restart if still supposed to be listening (use REF to avoid stale closure)
            if (isListeningRef.current && recognitionRef.current) {
                console.log('[STT] Auto-restarting recognition...');
                try {
                    recognitionRef.current.start();
                } catch (e) {
                    console.warn('[STT] Failed to restart recognition:', e);
                    setIsListening(false);
                    isListeningRef.current = false;
                }
            } else {
                setIsListening(false);
                isListeningRef.current = false;
            }
        };

        recognitionRef.current = recognition;
        return recognition;
    }, [sttSupported, isListening]);

    const startListening = useCallback(async (audioStream = null) => {
        if (!sttSupported) return;

        console.log('[STT] startListening called');
        const recognition = initRecognition();
        if (!recognition) return;

        // Clear previous transcript
        setTranscript('');
        setInterimTranscript('');

        try {
            recognition.start();
            setIsListening(true);
            isListeningRef.current = true; // Sync ref for callbacks
            console.log('[STT] Recognition started successfully');

            // Start audio analyzer if stream provided
            if (audioStream) {
                if (analyzerRef.current) {
                    analyzerRef.current.stop();
                }
                analyzerRef.current = new AudioLevelAnalyzer();
                analyzerRef.current.start(audioStream, setAudioLevel);
            }
        } catch (e) {
            console.warn('[STT] Failed to start speech recognition:', e);
            setIsListening(false);
            isListeningRef.current = false;
        }
    }, [sttSupported, initRecognition]);

    const stopListening = useCallback(() => {
        console.log('[STT] stopListening called');
        isListeningRef.current = false; // Set ref FIRST to prevent auto-restart

        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                // Ignore
            }
        }

        if (analyzerRef.current) {
            analyzerRef.current.stop();
            analyzerRef.current = null;
        }

        setIsListening(false);
        setInterimTranscript('');
        setAudioLevel(0);
    }, []);

    const clearTranscript = useCallback(() => {
        setTranscript('');
        setInterimTranscript('');
    }, []);

    // ===========================================
    // CLEANUP
    // ===========================================

    useEffect(() => {
        return () => {
            stopSpeaking();
            stopListening();
        };
    }, [stopSpeaking, stopListening]);

    // Ensure voices are loaded
    useEffect(() => {
        if (ttsSupported) {
            // Chrome needs voices to be loaded
            window.speechSynthesis.getVoices();
            window.speechSynthesis.onvoiceschanged = () => {
                window.speechSynthesis.getVoices();
            };
        }
    }, [ttsSupported]);

    return {
        // TTS
        isSpeaking,
        audioLevel,
        speak,
        stopSpeaking,
        ttsSupported,

        // STT
        isListening,
        transcript: transcript + interimTranscript,
        finalTranscript: transcript,
        interimTranscript,
        startListening,
        stopListening,
        clearTranscript,
        sttSupported,
    };
}
