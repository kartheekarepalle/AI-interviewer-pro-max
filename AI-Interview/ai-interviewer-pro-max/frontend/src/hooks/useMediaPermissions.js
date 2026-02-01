/**
 * useMediaPermissions - PRODUCTION-GRADE Media Permission Hook
 * 
 * FIXES:
 * - Requests BOTH camera + microphone together
 * - Proper permission state checking before request
 * - Working retry functionality
 * - Real stream validation (no fake states)
 * - Browser-accurate behavior
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// Permission states
export const PERMISSION_STATES = {
    PENDING: 'pending',
    GRANTED: 'granted',
    DENIED: 'denied',
    BLOCKED: 'blocked',
    ERROR: 'error',
    NOT_SUPPORTED: 'not_supported',
};

export default function useMediaPermissions() {
    // Permission states - reflect REAL browser state
    const [cameraPermission, setCameraPermission] = useState(PERMISSION_STATES.PENDING);
    const [micPermission, setMicPermission] = useState(PERMISSION_STATES.PENDING);
    const [permissionError, setPermissionError] = useState(null);

    // Stream state - only true if REAL streams exist
    const [mediaStream, setMediaStream] = useState(null);
    const [hasVideoTrack, setHasVideoTrack] = useState(false);
    const [hasAudioTrack, setHasAudioTrack] = useState(false);

    // Face tracking
    const [facePosition, setFacePosition] = useState(null);
    const [isFaceDetected, setIsFaceDetected] = useState(false);

    // Refs
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const ctxRef = useRef(null);
    const trackingIntervalRef = useRef(null);

    // Check if browser supports mediaDevices
    const isSupported = typeof navigator !== 'undefined' &&
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === 'function';

    // ===========================================
    // PERMISSION STATE CHECK (Before Request)
    // ===========================================
    const checkPermissionState = useCallback(async () => {
        if (!navigator.permissions) {
            // Browser doesn't support Permissions API - we'll find out when we request
            return { camera: 'prompt', microphone: 'prompt' };
        }

        try {
            const [cameraResult, micResult] = await Promise.all([
                navigator.permissions.query({ name: 'camera' }).catch(() => ({ state: 'prompt' })),
                navigator.permissions.query({ name: 'microphone' }).catch(() => ({ state: 'prompt' })),
            ]);

            return {
                camera: cameraResult.state,
                microphone: micResult.state,
            };
        } catch (e) {
            console.warn('Permission query failed:', e);
            return { camera: 'prompt', microphone: 'prompt' };
        }
    }, []);

    // ===========================================
    // ERROR MESSAGE GENERATOR
    // ===========================================
    const getErrorMessage = useCallback((error, permState) => {
        // Check if permissions are blocked (user selected "Block" in browser)
        if (permState?.camera === 'denied' || permState?.microphone === 'denied') {
            return {
                title: 'Access Blocked',
                message: 'Browser has blocked camera/microphone access. You need to manually allow access.',
                action: 'Click the 🔒 icon in address bar → Site settings → Allow camera & microphone → Refresh page',
                isBlocked: true,
            };
        }

        if (!error) return null;

        switch (error.name) {
            case 'NotAllowedError':
            case 'PermissionDeniedError':
                return {
                    title: 'Permission Denied',
                    message: 'You denied camera/microphone access.',
                    action: 'Click the 🔒 icon in address bar → Allow camera & microphone → Refresh',
                    isBlocked: false,
                };
            case 'NotFoundError':
            case 'DevicesNotFoundError':
                return {
                    title: 'No Device Found',
                    message: 'No camera or microphone detected.',
                    action: 'Connect a camera/microphone and try again',
                    isBlocked: false,
                };
            case 'NotReadableError':
            case 'TrackStartError':
                return {
                    title: 'Device In Use',
                    message: 'Your camera or microphone is being used by another application.',
                    action: 'Close other apps using camera/mic and try again',
                    isBlocked: false,
                };
            case 'OverconstrainedError':
                return {
                    title: 'Device Error',
                    message: 'Your device doesn\'t support the required settings.',
                    action: 'Try a different camera/microphone',
                    isBlocked: false,
                };
            case 'SecurityError':
                return {
                    title: 'Security Error',
                    message: 'Media access blocked due to security settings.',
                    action: 'Use HTTPS or localhost',
                    isBlocked: true,
                };
            default:
                return {
                    title: 'Unknown Error',
                    message: error.message || 'An unexpected error occurred.',
                    action: 'Refresh the page and try again',
                    isBlocked: false,
                };
        }
    }, []);

    // ===========================================
    // VALIDATE STREAM (Real tracks exist)
    // ===========================================
    const validateStream = useCallback((stream) => {
        if (!stream) {
            return { hasVideo: false, hasAudio: false };
        }

        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();

        const hasVideo = videoTracks.length > 0 && videoTracks.some(t => t.enabled && t.readyState === 'live');
        const hasAudio = audioTracks.length > 0 && audioTracks.some(t => t.enabled && t.readyState === 'live');

        return { hasVideo, hasAudio };
    }, []);

    // ===========================================
    // REQUEST ALL PERMISSIONS (Camera + Mic TOGETHER)
    // ===========================================
    const requestAllPermissions = useCallback(async () => {
        if (!isSupported) {
            setCameraPermission(PERMISSION_STATES.NOT_SUPPORTED);
            setMicPermission(PERMISSION_STATES.NOT_SUPPORTED);
            setPermissionError({
                title: 'Not Supported',
                message: 'Your browser does not support camera/microphone access.',
                action: 'Use Chrome, Firefox, Edge, or Safari',
                isBlocked: true,
            });
            return false;
        }

        // Step 1: Check current permission state
        const permState = await checkPermissionState();
        console.log('Current permission state:', permState);

        // Step 2: If both are denied/blocked, show instructions immediately
        if (permState.camera === 'denied' && permState.microphone === 'denied') {
            setCameraPermission(PERMISSION_STATES.BLOCKED);
            setMicPermission(PERMISSION_STATES.BLOCKED);
            setPermissionError(getErrorMessage(null, permState));
            return false;
        }

        // Step 3: Request BOTH camera AND microphone in ONE call
        setCameraPermission(PERMISSION_STATES.PENDING);
        setMicPermission(PERMISSION_STATES.PENDING);
        setPermissionError(null);

        try {
            // Stop any existing streams first
            if (mediaStream) {
                mediaStream.getTracks().forEach(track => track.stop());
            }

            // Request BOTH video AND audio together
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 320, max: 640 },
                    height: { ideal: 240, max: 480 },
                    facingMode: 'user',
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            // Step 4: Validate stream has REAL tracks
            const { hasVideo, hasAudio } = validateStream(stream);

            console.log('Stream validation:', { hasVideo, hasAudio });

            // Update states based on REAL track availability
            setHasVideoTrack(hasVideo);
            setHasAudioTrack(hasAudio);
            setCameraPermission(hasVideo ? PERMISSION_STATES.GRANTED : PERMISSION_STATES.ERROR);
            setMicPermission(hasAudio ? PERMISSION_STATES.GRANTED : PERMISSION_STATES.ERROR);
            setMediaStream(stream);

            // If either is missing, show partial error
            if (!hasVideo || !hasAudio) {
                setPermissionError({
                    title: 'Partial Access',
                    message: `${!hasVideo ? 'Camera' : 'Microphone'} could not be accessed.`,
                    action: 'Check your device settings',
                    isBlocked: false,
                });
                return false;
            }

            return true;

        } catch (error) {
            console.error('getUserMedia error:', error);

            // Re-check permission state after error
            const newPermState = await checkPermissionState();

            // Determine final states
            const camState = newPermState.camera === 'denied'
                ? PERMISSION_STATES.BLOCKED
                : PERMISSION_STATES.DENIED;
            const micState = newPermState.microphone === 'denied'
                ? PERMISSION_STATES.BLOCKED
                : PERMISSION_STATES.DENIED;

            setCameraPermission(camState);
            setMicPermission(micState);
            setHasVideoTrack(false);
            setHasAudioTrack(false);
            setPermissionError(getErrorMessage(error, newPermState));

            return false;
        }
    }, [isSupported, mediaStream, checkPermissionState, validateStream, getErrorMessage]);

    // ===========================================
    // RETRY PERMISSIONS (Works correctly)
    // ===========================================
    const retryPermissions = useCallback(async () => {
        // First check current permission state
        const permState = await checkPermissionState();
        console.log('Retry - Current permission state:', permState);

        // If BOTH are blocked, we cannot re-request - show instructions
        if (permState.camera === 'denied' && permState.microphone === 'denied') {
            setCameraPermission(PERMISSION_STATES.BLOCKED);
            setMicPermission(PERMISSION_STATES.BLOCKED);
            setPermissionError({
                title: 'Access Blocked by Browser',
                message: 'You previously blocked camera/microphone access. The browser will not ask again automatically.',
                action: 'To fix: Click 🔒 icon in address bar → Site settings → Change camera/microphone to "Allow" → Refresh the page',
                isBlocked: true,
            });
            return false;
        }

        // If at least one is "prompt", we can try requesting again
        return requestAllPermissions();
    }, [checkPermissionState, requestAllPermissions]);

    // ===========================================
    // FACE TRACKING
    // ===========================================
    const detectFaceCenter = useCallback((video, canvas, ctx) => {
        if (!video || !canvas || !ctx || video.readyState < 2) return null;

        try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            let totalX = 0, totalY = 0, count = 0;

            for (let y = 0; y < canvas.height; y += 4) {
                for (let x = 0; x < canvas.width; x += 4) {
                    const idx = (y * canvas.width + x) * 4;
                    const r = data[idx], g = data[idx + 1], b = data[idx + 2];

                    if (r > 95 && g > 40 && b > 20 && r > g && r > b &&
                        Math.abs(r - g) > 15 && r - b > 15) {
                        totalX += x;
                        totalY += y;
                        count++;
                    }
                }
            }

            if (count > 50) {
                return {
                    x: ((totalX / count) / canvas.width - 0.5) * 2,
                    y: ((totalY / count) / canvas.height - 0.5) * 2,
                };
            }
        } catch (e) {
            // Ignore
        }
        return null;
    }, []);

    const startFaceTracking = useCallback(() => {
        if (!mediaStream || !hasVideoTrack) {
            console.warn('Cannot start face tracking: no video stream');
            return false;
        }

        if (!videoRef.current) {
            videoRef.current = document.createElement('video');
            videoRef.current.autoplay = true;
            videoRef.current.playsInline = true;
            videoRef.current.muted = true;
            videoRef.current.style.display = 'none';
        }

        if (!canvasRef.current) {
            canvasRef.current = document.createElement('canvas');
            canvasRef.current.width = 160;
            canvasRef.current.height = 120;
            ctxRef.current = canvasRef.current.getContext('2d', { willReadFrequently: true });
        }

        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(console.warn);

        if (trackingIntervalRef.current) {
            clearInterval(trackingIntervalRef.current);
        }

        trackingIntervalRef.current = setInterval(() => {
            const face = detectFaceCenter(videoRef.current, canvasRef.current, ctxRef.current);

            if (face) {
                setFacePosition(prev => ({
                    x: prev ? prev.x * 0.7 + face.x * 0.3 : face.x,
                    y: prev ? prev.y * 0.7 + face.y * 0.3 : face.y,
                }));
                setIsFaceDetected(true);
            } else {
                setIsFaceDetected(false);
                setFacePosition(prev => prev ? { x: prev.x * 0.9, y: prev.y * 0.9 } : null);
            }
        }, 100);

        return true;
    }, [mediaStream, hasVideoTrack, detectFaceCenter]);

    const stopFaceTracking = useCallback(() => {
        if (trackingIntervalRef.current) {
            clearInterval(trackingIntervalRef.current);
            trackingIntervalRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.srcObject = null;
        }
        setFacePosition(null);
        setIsFaceDetected(false);
    }, []);

    // ===========================================
    // STOP ALL MEDIA
    // ===========================================
    const stopAllMedia = useCallback(() => {
        console.log('[useMediaPermissions] Stopping all media streams...');
        stopFaceTracking();

        if (mediaStream) {
            mediaStream.getTracks().forEach(track => {
                console.log('[useMediaPermissions] Stopping track:', track.kind, track.label);
                track.stop();
            });
        }

        setMediaStream(null);
        setHasVideoTrack(false);
        setHasAudioTrack(false);
        console.log('[useMediaPermissions] ✓ All media streams stopped');
    }, [mediaStream, stopFaceTracking]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopAllMedia();
        };
    }, []);

    // Derived states - based on REAL stream validation
    const isCameraReady = cameraPermission === PERMISSION_STATES.GRANTED && hasVideoTrack;
    const isMicReady = micPermission === PERMISSION_STATES.GRANTED && hasAudioTrack;
    const isAllReady = isCameraReady && isMicReady;
    const isBlocked = permissionError?.isBlocked === true;

    return {
        // Permission states
        cameraPermission,
        micPermission,
        permissionError,
        isSupported,

        // Real stream states
        isCameraReady,
        isMicReady,
        isAllReady,
        isBlocked,

        // Stream
        mediaStream,

        // Face tracking
        facePosition,
        isFaceDetected,

        // Actions
        requestAllPermissions,
        retryPermissions,
        startFaceTracking,
        stopFaceTracking,
        stopAllMedia,
    };
}
