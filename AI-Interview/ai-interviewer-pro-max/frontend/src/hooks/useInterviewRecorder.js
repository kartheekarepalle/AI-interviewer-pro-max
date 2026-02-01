/**
 * Interview Recording Hook
 * 
 * Records user video + audio during the interview using MediaRecorder API.
 * Auto-starts and stops with the interview.
 * 
 * Features:
 * - Records video + audio from webcam
 * - Stores recording as Blob
 * - Provides download capability
 * - Upload-ready structure for backend
 */

import { useState, useRef, useCallback, useEffect } from 'react';

const MIME_TYPES = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
];

function getSupportedMimeType() {
    for (const mimeType of MIME_TYPES) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
            return mimeType;
        }
    }
    return 'video/webm';
}

export default function useInterviewRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [recordingBlob, setRecordingBlob] = useState(null);
    const [error, setError] = useState(null);
    const [isSupported, setIsSupported] = useState(true);

    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const streamRef = useRef(null);
    const durationIntervalRef = useRef(null);
    const startTimeRef = useRef(null);
    const stopResolverRef = useRef(null); // Promise resolver for stopRecording

    // Check browser support
    useEffect(() => {
        setIsSupported(
            typeof MediaRecorder !== 'undefined' &&
            navigator.mediaDevices &&
            typeof navigator.mediaDevices.getUserMedia === 'function'
        );
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopRecording();
            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
            }
        };
    }, []);

    /**
     * Start recording with existing stream or request new one
     */
    const startRecording = useCallback(async (existingStream = null) => {
        if (!isSupported) {
            setError('Recording is not supported in this browser');
            return false;
        }

        try {
            setError(null);
            chunksRef.current = [];

            // Use existing stream or request new one
            let stream = existingStream;
            if (!stream) {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280, max: 1920 },
                        height: { ideal: 720, max: 1080 },
                        facingMode: 'user',
                    },
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        sampleRate: 44100,
                    },
                });
            }

            streamRef.current = stream;

            const mimeType = getSupportedMimeType();
            const recorder = new MediaRecorder(stream, {
                mimeType,
                videoBitsPerSecond: 2500000, // 2.5 Mbps
                audioBitsPerSecond: 128000,  // 128 Kbps
            });

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            recorder.onstop = () => {
                let blob = null;
                if (chunksRef.current.length > 0) {
                    blob = new Blob(chunksRef.current, { type: mimeType });
                    setRecordingBlob(blob);
                }
                setIsRecording(false);
                setIsPaused(false);
                
                // Resolve the stop promise with the blob
                if (stopResolverRef.current) {
                    stopResolverRef.current(blob);
                    stopResolverRef.current = null;
                }
            };

            recorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
                setError(`Recording error: ${event.error?.message || 'Unknown error'}`);
                setIsRecording(false);
            };

            mediaRecorderRef.current = recorder;
            recorder.start(1000); // Record in 1-second chunks

            setIsRecording(true);
            setIsPaused(false);
            startTimeRef.current = Date.now();

            // Track duration
            durationIntervalRef.current = setInterval(() => {
                if (startTimeRef.current) {
                    setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
                }
            }, 1000);

            console.log('[Recording] Started with', mimeType);
            return true;
        } catch (err) {
            console.error('Failed to start recording:', err);
            setError(err.message || 'Failed to start recording');
            return false;
        }
    }, [isSupported]);

    /**
     * Stop recording - Returns a Promise that resolves with the blob when ready
     */
    const stopRecording = useCallback(() => {
        return new Promise((resolve) => {
            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
                durationIntervalRef.current = null;
            }

            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                // Store the resolver to be called in onstop
                stopResolverRef.current = resolve;
                try {
                    mediaRecorderRef.current.stop();
                } catch (e) {
                    console.warn('Error stopping recorder:', e);
                    resolve(null);
                }
            } else {
                // Already stopped, resolve immediately
                setIsRecording(false);
                setIsPaused(false);
                resolve(null);
            }
        });
    }, []);

    /**
     * Pause recording
     */
    const pauseRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.pause();
            setIsPaused(true);
        }
    }, []);

    /**
     * Resume recording
     */
    const resumeRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
            mediaRecorderRef.current.resume();
            setIsPaused(false);
        }
    }, []);

    /**
     * Download the recording
     */
    const downloadRecording = useCallback((filename = 'interview-recording.webm') => {
        if (!recordingBlob) return;

        const url = URL.createObjectURL(recordingBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [recordingBlob]);

    /**
     * Get recording as File for upload
     */
    const getRecordingFile = useCallback((filename = 'interview-recording.webm') => {
        if (!recordingBlob) return null;

        return new File([recordingBlob], filename, {
            type: recordingBlob.type,
            lastModified: Date.now(),
        });
    }, [recordingBlob]);

    /**
     * Upload recording to backend
     */
    const uploadRecording = useCallback(async (sessionId, apiEndpoint = '/api/interviews/recording') => {
        if (!recordingBlob) {
            throw new Error('No recording available');
        }

        const formData = new FormData();
        formData.append('recording', recordingBlob, `interview-${sessionId}.webm`);
        formData.append('session_id', sessionId);
        formData.append('duration', recordingDuration.toString());

        try {
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status}`);
            }

            return await response.json();
        } catch (err) {
            console.error('Upload failed:', err);
            throw err;
        }
    }, [recordingBlob, recordingDuration]);

    /**
     * Clear recording data
     */
    const clearRecording = useCallback(() => {
        setRecordingBlob(null);
        setRecordingDuration(0);
        chunksRef.current = [];
    }, []);

    /**
     * Format duration as MM:SS
     */
    const formatDuration = useCallback((seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, []);

    return {
        // State
        isRecording,
        isPaused,
        recordingDuration,
        recordingBlob,
        error,
        isSupported,
        formattedDuration: formatDuration(recordingDuration),

        // Actions
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        downloadRecording,
        getRecordingFile,
        uploadRecording,
        clearRecording,
    };
}
