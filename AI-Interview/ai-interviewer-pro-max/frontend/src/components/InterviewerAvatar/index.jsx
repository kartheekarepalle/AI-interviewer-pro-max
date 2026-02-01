/**
 * Professional 3D Interviewer Avatar - Half Body GLB Model
 * 
 * FEATURES:
 * ✅ Half-body view (chest and above)
 * ✅ Arms in NATURAL RESTING POSE with bent elbows
 * ✅ LIP SYNC with real audio analysis + viseme morphs + jaw bone
 * ✅ **WEBCAM EYE CONTACT** - Avatar tracks user's face via webcam and rotates head
 * ✅ Theme-aware background (light/dark mode)
 * ✅ Breathing and blinking animations
 * 
 * @version 28.0.0 - WEBCAM-BASED EYE CONTACT TRACKING (MediaPipe FaceMesh)
 */

import React, { useRef, useEffect, useState, useCallback, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import './styles.css';

const MODEL_PATH = new URL('./3d_model.glb', import.meta.url).href;

// ===========================================
// AVATAR CONFIGURATION
// ===========================================

const AVATAR_CONFIG = {
    dpr: Math.min(window.devicePixelRatio || 2, 2),

    // WEBCAM EYE CONTACT CONFIG - Avatar tracks user's face via webcam
    // The head moves to follow the user's face position
    eyeContact: {
        enabled: true,
        useWebcam: true,         // Enable webcam-based face tracking
        smoothing: 0.12,         // Slightly faster for more responsive feel

        // HEAD MOVEMENT SENSITIVITY - How much avatar head moves based on face position
        // Face position is normalized to -1 to 1 range
        webcamYawSensitivity: 0.35,   // Horizontal: how much yaw for full face displacement
        webcamPitchSensitivity: 0.25, // Vertical: how much pitch for full face displacement

        // MICRO-MOVEMENTS - Small natural movements when face is stable
        microMovementAmount: 0.03,    // Small idle movements
        microMovementSpeed: 0.6,      // Speed of micro-movements

        // FALLBACK ANIMATION - When webcam not available (INCREASED for visibility)
        primaryYaw: 0.20,        // Main horizontal movement (~12 degrees) - DOUBLED
        primaryPitch: 0.14,      // Main vertical movement (~8 degrees) - DOUBLED
        secondaryYaw: 0.10,      // Secondary horizontal layer
        secondaryPitch: 0.07,    // Secondary vertical layer
        primarySpeed: 0.5,       // Slow, breathing-like base rhythm
        secondarySpeed: 0.8,     // Slightly faster secondary rhythm

        // LIMITS - Maximum rotation allowed (safety clamp)
        maxYaw: 0.50,            // Max ±29 degrees horizontal
        maxPitch: 0.40,          // Max ±23 degrees vertical
    },

    lipSync: {
        amplitudeSensitivity: 8.0,   // Increased from 4.5 for more visible movement
        smoothing: 0.22,              // Slightly slower for more natural feel
        maxValue: 1.0,
        jawOpenMax: 0.4,              // Increased from 0.25 for wider mouth opening
        visemeSpeed: 14,              // Slightly slower for more visible transitions
        jawEnabled: true,             // Jaw ONLY moves when audio-driven
        // Extended morph target names for different avatar formats
        mouthOpenTargets: ['jawOpen', 'mouthOpen', 'viseme_aa', 'viseme_O', 'aa', 'oh'],
        visemeTargets: {
            A: ['viseme_aa', 'aa', 'mouthOpen'],
            O: ['viseme_O', 'viseme_oh', 'oh', 'oo'],
            E: ['viseme_E', 'viseme_ee', 'ee', 'ih'],
            I: ['viseme_I', 'viseme_ih', 'ih'],
            U: ['viseme_U', 'viseme_uu', 'uu'],
            CH: ['viseme_CH', 'ch'],
            PP: ['viseme_PP', 'viseme_pp', 'pp', 'mbp'],
            FF: ['viseme_FF', 'viseme_ff', 'ff', 'fv'],
            TH: ['viseme_TH', 'th'],
            SS: ['viseme_SS', 'viseme_ss', 'ss'],
            RR: ['viseme_RR', 'rr'],
            NN: ['viseme_nn', 'nn'],
            DD: ['viseme_DD', 'dd'],
            kk: ['viseme_kk', 'kk'],
        }
    },

    // Arms STRAIGHT DOWN - REVERSED rotation for this model
    armPose: {
        shoulder: {
            leftZ: 0,
            rightZ: 0,
        },
        // Upper arm: negative values to rotate DOWN (model uses opposite convention)
        upperArm: {
            leftZ: -1.2,       // NEGATIVE = down for this model
            rightZ: 1.2,       // POSITIVE = down for right arm (mirrored)
            leftY: 0,
            rightY: 0,
            forwardX: 0,
        },
        // Forearm: straight
        forearm: {
            leftZ: 0,
            leftX: 0,
            rightZ: 0,
            rightX: 0,
        },
        hand: {
            leftZ: 0,
            rightZ: 0,
            leftX: 0,
            rightX: 0,
        }
    },

    animation: {
        blinkInterval: [2.5, 5.0],
        blinkDuration: 0.12,
        breathSpeed: 1.0,
        idleSwayAmount: 0,      // DISABLED - no body rotation
    },
};

export { AVATAR_CONFIG };

// ===========================================
// WEBCAM-BASED EYE CONTACT SYSTEM (MediaPipe FaceMesh)
// Avatar tracks user's face via webcam and rotates head to maintain eye contact
// This creates an immersive experience where the avatar "looks at" the user
// ===========================================

const eyeContactState = {
    initialized: false,
    time: 0,                    // Time accumulator for animations
    webcamActive: false,        // Is webcam currently active
    faceDetected: false,        // Is a face currently detected
    facePosition: { x: 0, y: 0 }, // Normalized face position (-1 to 1)
    targetYaw: 0,               // Target head yaw based on face position
    targetPitch: 0,             // Target head pitch based on face position
    videoElement: null,         // Hidden video element for webcam
    faceMesh: null,             // MediaPipe FaceMesh instance
    camera: null,               // MediaPipe Camera instance
    lastFaceTime: 0,            // Last time a face was detected
    debugMode: true,            // Log debug info
    fallbackActive: true,       // ALWAYS start with fallback active until webcam is confirmed
    initAttempts: 0,            // Track initialization attempts
    isProcessingFrame: false,   // Prevent overlapping frame processing
};

// MediaPipe FaceMesh loader function (dynamic import to avoid blocking)
let faceMeshModule = null;
let cameraUtilsModule = null;

const loadMediaPipeModules = async () => {
    try {
        if (!faceMeshModule) {
            faceMeshModule = await import('@mediapipe/face_mesh');
        }
        if (!cameraUtilsModule) {
            cameraUtilsModule = await import('@mediapipe/camera_utils');
        }
        return { faceMeshModule, cameraUtilsModule };
    } catch (error) {
        console.error('[EyeContact] Failed to load MediaPipe modules:', error);
        return null;
    }
};

// Process FaceMesh results - extract face position
const onFaceResults = (results) => {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];

        // Use nose tip (landmark 1) as face center reference
        // FaceMesh coordinates: x=0-1 (left to right), y=0-1 (top to bottom)
        const noseTip = landmarks[1];

        // Convert to centered coordinates (-1 to 1)
        // x: 0.5 is center, 0 is left edge, 1 is right edge
        // y: 0.5 is center, 0 is top edge, 1 is bottom edge
        const faceX = (noseTip.x - 0.5) * 2;  // -1 (left) to 1 (right)
        const faceY = (noseTip.y - 0.5) * 2;  // -1 (top) to 1 (bottom)

        // Update state
        eyeContactState.faceDetected = true;
        eyeContactState.facePosition = { x: faceX, y: faceY };
        eyeContactState.lastFaceTime = Date.now();

        // INVERT the X direction: if user moves left, avatar looks left (same direction)
        // This creates the effect of the avatar looking AT the user
        const cfg = AVATAR_CONFIG.eyeContact;
        eyeContactState.targetYaw = -faceX * cfg.webcamYawSensitivity;
        eyeContactState.targetPitch = faceY * cfg.webcamPitchSensitivity;

        if (eyeContactState.debugMode && Math.random() < 0.02) {
            console.log('[EyeContact] Face detected - X:', faceX.toFixed(2),
                'Y:', faceY.toFixed(2),
                'TargetYaw:', eyeContactState.targetYaw.toFixed(3),
                'TargetPitch:', eyeContactState.targetPitch.toFixed(3));
        }
    } else {
        // No face detected - mark as lost after a short delay
        if (Date.now() - eyeContactState.lastFaceTime > 500) {
            eyeContactState.faceDetected = false;
        }
    }
};

// Initialize webcam-based eye contact tracking
const initializeEyeContact = async () => {
    // Prevent multiple simultaneous initialization attempts
    if (eyeContactState.initAttempts > 3) {
        console.log('[EyeContact] Max init attempts reached, using fallback');
        eyeContactState.fallbackActive = true;
        eyeContactState.initialized = true;
        return;
    }

    eyeContactState.initAttempts++;
    eyeContactState.time = 0;

    // CRITICAL: Always activate fallback first - it will be switched off if webcam succeeds
    // This ensures smooth animation from the very first frame
    eyeContactState.fallbackActive = true;
    eyeContactState.initialized = true;
    eyeContactState.faceDetected = false;

    console.log('[EyeContact] ✓ Initializing eye contact system (attempt', eyeContactState.initAttempts, ')...');
    console.log('[EyeContact] ✓ FALLBACK ANIMATION ACTIVE immediately for smooth experience');

    // Check if webcam is enabled in config
    if (!AVATAR_CONFIG.eyeContact.useWebcam) {
        console.log('[EyeContact] Webcam tracking disabled in config, using fallback animation');
        return;
    }

    try {
        // Load MediaPipe modules dynamically with timeout
        const loadTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('MediaPipe load timeout')), 8000)
        );

        const modules = await Promise.race([loadMediaPipeModules(), loadTimeout]);
        if (!modules) {
            console.warn('[EyeContact] MediaPipe modules not available, using fallback animation');
            eyeContactState.fallbackActive = true;
            return;
        }

        const { FaceMesh } = modules.faceMeshModule;
        const { Camera } = modules.cameraUtilsModule;

        // Create hidden video element for webcam
        const videoElement = document.createElement('video');
        videoElement.setAttribute('playsinline', '');
        videoElement.setAttribute('autoplay', '');
        videoElement.setAttribute('muted', '');
        videoElement.muted = true;
        videoElement.style.display = 'none';
        videoElement.style.width = '320px';
        videoElement.style.height = '240px';
        document.body.appendChild(videoElement);
        eyeContactState.videoElement = videoElement;

        // Initialize FaceMesh with error handling
        const faceMesh = new FaceMesh({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });

        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        faceMesh.onResults(onFaceResults);
        eyeContactState.faceMesh = faceMesh;

        // Initialize Camera with frame processing
        const camera = new Camera(videoElement, {
            onFrame: async () => {
                if (eyeContactState.faceMesh && eyeContactState.webcamActive && !eyeContactState.isProcessingFrame) {
                    eyeContactState.isProcessingFrame = true;
                    try {
                        await eyeContactState.faceMesh.send({ image: videoElement });
                    } catch (e) {
                        // Silent error - don't spam console
                    } finally {
                        eyeContactState.isProcessingFrame = false;
                    }
                }
            },
            width: 320,
            height: 240
        });

        eyeContactState.camera = camera;

        // Start the camera with timeout
        const cameraTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Camera start timeout')), 5000)
        );

        await Promise.race([camera.start(), cameraTimeout]);
        
        // Give it a moment to start processing frames
        await new Promise(resolve => setTimeout(resolve, 500));
        
        eyeContactState.webcamActive = true;
        eyeContactState.fallbackActive = false; // Webcam is working, disable fallback

        console.log('[EyeContact] ✓ WEBCAM face tracking ACTIVE! Avatar will follow your face position.');

    } catch (error) {
        console.error('[EyeContact] Failed to initialize webcam tracking:', error.message || error);
        console.log('[EyeContact] ✓ Using FALLBACK animation mode (avatar will still move naturally)');
        eyeContactState.webcamActive = false;
        eyeContactState.fallbackActive = true;
    }
};

// Cleanup function - CRITICAL: Must fully release webcam
const cleanupEyeContact = () => {
    console.log('[EyeContact] Starting webcam cleanup...');

    // Mark as not active immediately to stop any ongoing processing
    eyeContactState.webcamActive = false;
    eyeContactState.isProcessingFrame = false;

    // Stop camera (MediaPipe Camera utility)
    if (eyeContactState.camera) {
        try {
            console.log('[EyeContact] Stopping MediaPipe camera...');
            eyeContactState.camera.stop();
        } catch (e) {
            console.warn('[EyeContact] Camera stop error:', e);
        }
        eyeContactState.camera = null;
    }

    // Close FaceMesh
    if (eyeContactState.faceMesh) {
        try {
            console.log('[EyeContact] Closing FaceMesh...');
            eyeContactState.faceMesh.close();
        } catch (e) {
            console.warn('[EyeContact] FaceMesh close error:', e);
        }
        eyeContactState.faceMesh = null;
    }

    // CRITICAL: Stop video element's srcObject stream tracks
    // This is what actually releases the webcam and turns off the camera light
    if (eyeContactState.videoElement) {
        try {
            const stream = eyeContactState.videoElement.srcObject;
            if (stream && stream.getTracks) {
                const tracks = stream.getTracks();
                console.log('[EyeContact] Stopping', tracks.length, 'video tracks...');
                tracks.forEach(track => {
                    console.log('[EyeContact] Stopping track:', track.kind, track.label, 'readyState:', track.readyState);
                    track.stop();
                });
            }
            eyeContactState.videoElement.srcObject = null;
        } catch (e) {
            console.warn('[EyeContact] Video stream stop error:', e);
        }
        
        try {
            // Pause and remove the video element
            eyeContactState.videoElement.pause();
            eyeContactState.videoElement.remove();
        } catch (e) {
            console.warn('[EyeContact] Video element remove error:', e);
        }
        eyeContactState.videoElement = null;
    }

    // Reset all state flags
    eyeContactState.initialized = false;
    eyeContactState.faceDetected = false;
    eyeContactState.time = 0;

    console.log('[EyeContact] ✓ Webcam cleanup complete - camera should be OFF');
};

// ===========================================
// GLB AVATAR COMPONENT
// ===========================================

function GLBAvatar({ speaking, audioLevel, theme }) {
    const gltf = useGLTF(MODEL_PATH);
    const { scene } = gltf;
    const groupRef = useRef();

    const bonesRef = useRef({});
    const originalRotations = useRef({});
    const originalScales = useRef({});  // For fallback lip sync
    const smoothedEyeContact = useRef({ x: 0, y: 0 });
    const morphMeshesRef = useRef([]);
    const morphTargetMap = useRef({});  // Maps generic names to actual morph targets
    const hasMorphTargets = useRef(false);  // Track if model has morphs
    const smoothedAudio = useRef(0);
    const visemePhase = useRef(0);
    const jawRestPosition = useRef(null);  // Store jaw rest position for reset
    const initialized = useRef(false);
    const eyeContactStarted = useRef(false);  // Track if we started eye contact

    const animState = useRef({
        time: 0,
        blinkTimer: Math.random() * 3 + 2,
        isBlinking: false,
        blinkProgress: 0,
        breathPhase: 0,
        lastLogTime: 0,  // For debug logging
        loggedInit: false,  // Track if we logged initialization
    });

    // CRITICAL: Initialize webcam-based eye contact when GLBAvatar mounts
    useEffect(() => {
        if (!eyeContactStarted.current) {
            eyeContactStarted.current = true;
            console.log('[GLBAvatar] ✓ Initializing WEBCAM-based eye contact tracking');
            initializeEyeContact();
        }

        // Cleanup on unmount
        return () => {
            cleanupEyeContact();
        };
    }, []);

    // Initialize bones and morphs
    useEffect(() => {
        if (!scene || initialized.current) return;
        initialized.current = true;

        const bones = bonesRef.current;
        const morphMeshes = [];
        const allBones = {};

        // Collect all bones
        scene.traverse((child) => {
            if (child.isBone) {
                allBones[child.name] = child;
            }
        });

        const boneNames = Object.keys(allBones);
        console.log('[Avatar] Found bones:', boneNames.length);
        console.log('[Avatar] All bone names:', boneNames);

        // Match bones using various naming conventions
        boneNames.forEach(name => {
            const lowerName = name.toLowerCase();
            const bone = allBones[name];

            // HEAD
            if (lowerName === 'head' ||
                lowerName.endsWith('head') ||
                (lowerName.includes('head') && !lowerName.includes('top') && !lowerName.includes('end'))) {
                if (!bones.head) {
                    bones.head = bone;
                    originalRotations.current.head = bone.rotation.clone();
                    console.log('[Avatar] Found Head bone:', name);
                }
            }

            // NECK
            if (lowerName === 'neck' || lowerName.endsWith('neck') || lowerName.includes('neck')) {
                if (!bones.neck) {
                    bones.neck = bone;
                    originalRotations.current.neck = bone.rotation.clone();
                    console.log('[Avatar] Found Neck bone:', name);
                }
            }

            // JAW - Extended patterns for different model formats
            const isJaw = (
                lowerName === 'jaw' ||
                lowerName.includes('jaw') ||
                lowerName.includes('chin') ||
                lowerName.includes('mandible') ||
                lowerName.includes('lower_lip') ||
                lowerName.includes('lowerlip') ||
                lowerName.includes('mouth') ||
                lowerName.endsWith('_jaw') ||
                lowerName.endsWith(':jaw') ||
                lowerName.endsWith('.jaw')
            );
            if (isJaw && !bones.jaw) {
                bones.jaw = bone;
                originalRotations.current.jaw = bone.rotation.clone();
                originalScales.current.jaw = bone.scale.clone();
                // CRITICAL: Store rest position for jaw - ensures jaw stays closed by default
                jawRestPosition.current = {
                    x: bone.rotation.x,
                    y: bone.rotation.y,
                    z: bone.rotation.z
                };
                console.log('[Avatar] Found Jaw/Chin bone:', name, 'Rest position:', jawRestPosition.current);
            }

            // LEFT UPPER ARM
            const isLeftUpperArm = (
                (lowerName.includes('left') && lowerName.includes('arm') && !lowerName.includes('fore') && !lowerName.includes('lower') && !lowerName.includes('shoulder')) ||
                (lowerName.includes('left') && lowerName.includes('upper') && !lowerName.includes('shoulder')) ||
                lowerName === 'leftarm' ||
                lowerName.endsWith(':leftarm') ||
                lowerName.endsWith('_leftarm') ||
                (lowerName.includes('l_arm') && !lowerName.includes('fore') && !lowerName.includes('shoulder') && !lowerName.includes('lower')) ||
                (lowerName.includes('arm_l') && !lowerName.includes('fore') && !lowerName.includes('shoulder') && !lowerName.includes('lower')) ||
                (lowerName.includes('arm.l') && !lowerName.includes('fore') && !lowerName.includes('shoulder') && !lowerName.includes('lower'))
            );

            if (isLeftUpperArm && !bones.leftArm) {
                bones.leftArm = bone;
                originalRotations.current.leftArm = bone.rotation.clone();
                console.log('[Avatar] Found Left Upper Arm bone:', name);
            }

            // RIGHT UPPER ARM
            const isRightUpperArm = (
                (lowerName.includes('right') && lowerName.includes('arm') && !lowerName.includes('fore') && !lowerName.includes('lower') && !lowerName.includes('shoulder')) ||
                (lowerName.includes('right') && lowerName.includes('upper') && !lowerName.includes('shoulder')) ||
                lowerName === 'rightarm' ||
                lowerName.endsWith(':rightarm') ||
                lowerName.endsWith('_rightarm') ||
                (lowerName.includes('r_arm') && !lowerName.includes('fore') && !lowerName.includes('shoulder') && !lowerName.includes('lower')) ||
                (lowerName.includes('arm_r') && !lowerName.includes('fore') && !lowerName.includes('shoulder') && !lowerName.includes('lower')) ||
                (lowerName.includes('arm.r') && !lowerName.includes('fore') && !lowerName.includes('shoulder') && !lowerName.includes('lower'))
            );

            if (isRightUpperArm && !bones.rightArm) {
                bones.rightArm = bone;
                originalRotations.current.rightArm = bone.rotation.clone();
                console.log('[Avatar] Found Right Upper Arm bone:', name);
            }

            // LEFT FOREARM
            const isLeftForearm = (
                (lowerName.includes('left') && (lowerName.includes('fore') || lowerName.includes('lower')) && lowerName.includes('arm')) ||
                lowerName === 'leftforearm' ||
                lowerName.endsWith(':leftforearm') ||
                (lowerName.includes('forearm') && lowerName.includes('l')) ||
                lowerName.includes('l_forearm') ||
                lowerName.includes('forearm_l') ||
                lowerName.includes('forearm.l') ||
                (lowerName.includes('elbow') && lowerName.includes('left'))
            );

            if (isLeftForearm && !bones.leftForearm) {
                bones.leftForearm = bone;
                originalRotations.current.leftForearm = bone.rotation.clone();
                console.log('[Avatar] Found Left Forearm bone:', name);
            }

            // RIGHT FOREARM
            const isRightForearm = (
                (lowerName.includes('right') && (lowerName.includes('fore') || lowerName.includes('lower')) && lowerName.includes('arm')) ||
                lowerName === 'rightforearm' ||
                lowerName.endsWith(':rightforearm') ||
                (lowerName.includes('forearm') && lowerName.includes('r') && !lowerName.includes('l')) ||
                lowerName.includes('r_forearm') ||
                lowerName.includes('forearm_r') ||
                lowerName.includes('forearm.r') ||
                (lowerName.includes('elbow') && lowerName.includes('right'))
            );

            if (isRightForearm && !bones.rightForearm) {
                bones.rightForearm = bone;
                originalRotations.current.rightForearm = bone.rotation.clone();
                console.log('[Avatar] Found Right Forearm bone:', name);
            }

            // LEFT HAND
            const isLeftHand = (
                (lowerName.includes('left') && lowerName.includes('hand') && !lowerName.includes('thumb') && !lowerName.includes('index') && !lowerName.includes('middle') && !lowerName.includes('ring') && !lowerName.includes('pinky')) ||
                lowerName === 'lefthand' ||
                lowerName.endsWith(':lefthand') ||
                lowerName.includes('hand_l') ||
                lowerName.includes('hand.l') ||
                lowerName.includes('l_hand')
            );

            if (isLeftHand && !bones.leftHand) {
                bones.leftHand = bone;
                originalRotations.current.leftHand = bone.rotation.clone();
                console.log('[Avatar] Found Left Hand bone:', name);
            }

            // RIGHT HAND
            const isRightHand = (
                (lowerName.includes('right') && lowerName.includes('hand') && !lowerName.includes('thumb') && !lowerName.includes('index') && !lowerName.includes('middle') && !lowerName.includes('ring') && !lowerName.includes('pinky')) ||
                lowerName === 'righthand' ||
                lowerName.endsWith(':righthand') ||
                lowerName.includes('hand_r') ||
                lowerName.includes('hand.r') ||
                lowerName.includes('r_hand')
            );

            if (isRightHand && !bones.rightHand) {
                bones.rightHand = bone;
                originalRotations.current.rightHand = bone.rotation.clone();
                console.log('[Avatar] Found Right Hand bone:', name);
            }

            // SPINE
            if (lowerName === 'spine' || lowerName.includes('spine')) {
                if (!bones.spine) {
                    bones.spine = bone;
                    originalRotations.current.spine = bone.rotation.clone();
                }
            }
        });

        // Find morph targets and build a map
        const morphMap = morphTargetMap.current;
        scene.traverse((child) => {
            if ((child.isMesh || child.isSkinnedMesh) &&
                child.morphTargetDictionary &&
                Object.keys(child.morphTargetDictionary).length > 0) {
                morphMeshes.push(child);
                hasMorphTargets.current = true;

                // Map all available morph targets
                Object.keys(child.morphTargetDictionary).forEach(targetName => {
                    const lowerTarget = targetName.toLowerCase();
                    if (!morphMap[lowerTarget]) {
                        morphMap[lowerTarget] = targetName;
                    }
                });
            }

            // Store original head scale for fallback lip sync
            if (child.name && child.name.toLowerCase().includes('head')) {
                originalScales.current.head = child.scale.clone();
                bonesRef.current.headMesh = child;
                console.log('[Avatar] Found head mesh for fallback lip sync:', child.name);
            }
        });

        morphMeshesRef.current = morphMeshes;
        console.log('[Avatar] Found morph targets:', Object.keys(morphMap));

        // ===========================================
        // APPLY INITIAL POSE - X axis rotation for arms
        // ===========================================
        // Left arm - rotate down on X axis
        if (bones.leftArm) {
            bones.leftArm.rotation.set(1.2, 0, 0.3);
            console.log('[Avatar] Left Arm posed - X rotation');
        } else {
            console.log('[Avatar] WARNING: Left Arm bone NOT FOUND');
        }
        // Right arm - rotate down on X axis (mirrored)
        if (bones.rightArm) {
            bones.rightArm.rotation.set(1.2, 0, -0.3);
            console.log('[Avatar] Right Arm posed - X rotation');
        } else {
            console.log('[Avatar] WARNING: Right Arm bone NOT FOUND');
        }
        // Forearms - slight bend
        if (bones.leftForearm) {
            bones.leftForearm.rotation.set(0.3, 0, 0);
        }
        if (bones.rightForearm) {
            bones.rightForearm.rotation.set(0.3, 0, 0);
        }
        // Hands - neutral
        if (bones.leftHand) {
            bones.leftHand.rotation.set(0, 0, 0);
        }
        if (bones.rightHand) {
            bones.rightHand.rotation.set(0, 0, 0);
        }
        // Head - facing forward
        if (bones.head) {
            bones.head.rotation.set(0, 0, 0);
        }
        // Neck - straight
        if (bones.neck) {
            bones.neck.rotation.set(0, 0, 0);
        }

        console.log('[Avatar] Initialized - Head:', !!bones.head, 'Neck:', !!bones.neck,
            'Arms:', !!bones.leftArm && !!bones.rightArm,
            'Forearms:', !!bones.leftForearm && !!bones.rightForearm,
            'Hands:', !!bones.leftHand && !!bones.rightHand,
            'Jaw:', !!bones.jaw,
            'HeadMesh:', !!bones.headMesh,
            'HasMorphs:', hasMorphTargets.current);

    }, [scene]);

    // Helper: Set morph target with fallback names
    const setMorph = useCallback((name, value) => {
        morphMeshesRef.current.forEach(mesh => {
            // Try exact name first
            let idx = mesh.morphTargetDictionary?.[name];

            // Try lowercase
            if (idx === undefined) {
                idx = mesh.morphTargetDictionary?.[name.toLowerCase()];
            }

            // Try mapped name
            if (idx === undefined && morphTargetMap.current[name.toLowerCase()]) {
                idx = mesh.morphTargetDictionary?.[morphTargetMap.current[name.toLowerCase()]];
            }

            if (idx !== undefined && mesh.morphTargetInfluences) {
                mesh.morphTargetInfluences[idx] = Math.max(0, Math.min(1, value));
            }
        });
    }, []);

    // Helper: Try multiple morph target names
    const setMorphMultiple = useCallback((names, value) => {
        let found = false;
        for (const name of names) {
            morphMeshesRef.current.forEach(mesh => {
                const idx = mesh.morphTargetDictionary?.[name];
                if (idx !== undefined && mesh.morphTargetInfluences) {
                    mesh.morphTargetInfluences[idx] = Math.max(0, Math.min(1, value));
                    found = true;
                }
            });
            if (found) break;
        }
    }, []);

    // Animation loop
    useFrame((state, delta) => {
        const s = animState.current;
        const dt = Math.min(delta, 0.1);
        s.time += dt;

        const bones = bonesRef.current;
        const cfg = AVATAR_CONFIG;
        const eyeCfg = cfg.eyeContact;
        const lipCfg = cfg.lipSync;
        const armCfg = cfg.armPose;

        // Debug: Log IMMEDIATELY on first run to confirm animation loop is active
        if (!s.loggedInit && bones.head) {
            s.loggedInit = true;
            console.log('[GLBAvatar] ✓✓✓ Animation loop ACTIVE - Head bone:', !!bones.head,
                'Neck:', !!bones.neck, 'EyeContact enabled:', eyeCfg.enabled);
            console.log('[GLBAvatar] Eye config values - Primary Yaw:', eyeCfg.primaryYaw,
                'Primary Pitch:', eyeCfg.primaryPitch, 'Smoothing:', eyeCfg.smoothing);
            // Force a test movement on first frame to confirm animation works
            bones.head.rotation.y = 0.1;
            console.log('[GLBAvatar] ✓ Test head rotation applied');
        }

        if (s.time - s.lastLogTime > 3) {
            s.lastLogTime = s.time;
            const mode = (eyeContactState.webcamActive && eyeContactState.faceDetected && !eyeContactState.fallbackActive)
                ? 'WEBCAM'
                : 'FALLBACK';
            console.log('[useFrame] t=' + s.time.toFixed(1) + 's, Mode:', mode,
                '| HeadYaw:', bones.head?.rotation.y.toFixed(3) || 'N/A',
                '| HeadPitch:', bones.head?.rotation.x.toFixed(3) || 'N/A',
                '| FallbackActive:', eyeContactState.fallbackActive);
        }

        // Model position - head/shoulders only (arms cropped out)
        if (groupRef.current) {
            groupRef.current.position.y = -1.35 + Math.sin(s.breathPhase) * 0.002;
            groupRef.current.rotation.y = Math.sin(s.time * 0.3) * cfg.animation.idleSwayAmount;
        }

        s.breathPhase += dt * cfg.animation.breathSpeed;

        // ===========================================
        // FORCE ARM POSE - Try X axis rotation for this model
        // ===========================================
        // Left arm - rotate DOWN on X axis
        if (bones.leftArm) {
            bones.leftArm.rotation.set(1.2, 0, 0.3);  // X rotation down, slight Z inward
        }
        // Right arm - rotate DOWN on X axis (mirrored)
        if (bones.rightArm) {
            bones.rightArm.rotation.set(1.2, 0, -0.3); // X rotation down, slight Z inward
        }
        // Forearms - slight bend
        if (bones.leftForearm) {
            bones.leftForearm.rotation.set(0.3, 0, 0);
        }
        if (bones.rightForearm) {
            bones.rightForearm.rotation.set(0.3, 0, 0);
        }
        // Hands - neutral
        if (bones.leftHand) {
            bones.leftHand.rotation.set(0, 0, 0);
        }
        if (bones.rightHand) {
            bones.rightHand.rotation.set(0, 0, 0);
        }

        // ===========================================
        // WEBCAM EYE CONTACT - HEAD TRACKS USER'S FACE
        // When webcam is active, avatar follows user's face position
        // Falls back to subtle animations when webcam unavailable
        // ===========================================
        if (eyeCfg.enabled && bones.head) {
            // Accumulate time for micro-movements
            eyeContactState.time += dt;
            const t = eyeContactState.time;

            let targetYaw = 0;
            let targetPitch = 0;

            // =========================================
            // WEBCAM-BASED TRACKING (Primary)
            // Avatar follows user's face position from webcam
            // Only used when webcam is active AND face is detected AND fallback is off
            // =========================================
            const useWebcamTracking = eyeContactState.webcamActive &&
                eyeContactState.faceDetected &&
                !eyeContactState.fallbackActive;

            if (useWebcamTracking) {
                // Use face-tracking-based head rotation
                targetYaw = eyeContactState.targetYaw;
                targetPitch = eyeContactState.targetPitch;

                // Add subtle micro-movements to appear more alive
                // (human heads are never perfectly still even when looking at something)
                const microYaw = Math.sin(t * eyeCfg.microMovementSpeed * 2.1) * eyeCfg.microMovementAmount +
                    Math.sin(t * eyeCfg.microMovementSpeed * 3.7) * eyeCfg.microMovementAmount * 0.5;
                const microPitch = Math.cos(t * eyeCfg.microMovementSpeed * 1.8) * eyeCfg.microMovementAmount * 0.7;

                targetYaw += microYaw;
                targetPitch += microPitch;

            } else {
                // =========================================
                // FALLBACK ANIMATION (When webcam not available)
                // Natural sine-wave based head movements
                // =========================================

                // PRIMARY MOVEMENT - Slow, breathing-like rhythm
                const primaryYaw = Math.sin(t * eyeCfg.primarySpeed) * eyeCfg.primaryYaw;
                const primaryPitch = Math.cos(t * eyeCfg.primarySpeed * 0.7) * eyeCfg.primaryPitch;

                // SECONDARY MOVEMENT - Faster, adds life
                const secondaryYaw = Math.sin(t * eyeCfg.secondarySpeed + 1.5) * eyeCfg.secondaryYaw +
                    Math.sin(t * eyeCfg.secondarySpeed * 1.8 + 3.0) * eyeCfg.secondaryYaw * 0.4;
                const secondaryPitch = Math.cos(t * eyeCfg.secondarySpeed * 0.9 + 0.8) * eyeCfg.secondaryPitch +
                    Math.sin(t * eyeCfg.secondarySpeed * 1.4 + 2.0) * eyeCfg.secondaryPitch * 0.3;

                // OCCASIONAL GLANCE - Adds realism
                const glanceCycle = t % 12;
                let glanceYaw = 0;
                let glancePitch = 0;
                if (glanceCycle > 10.5 && glanceCycle < 11.2) {
                    const glanceProgress = (glanceCycle - 10.5) / 0.7;
                    const glanceCurve = Math.sin(glanceProgress * Math.PI);
                    glanceYaw = glanceCurve * 0.15;
                }
                if (glanceCycle > 5.0 && glanceCycle < 5.4) {
                    const glanceProgress = (glanceCycle - 5.0) / 0.4;
                    const glanceCurve = Math.sin(glanceProgress * Math.PI);
                    glancePitch = glanceCurve * 0.10;
                }

                targetYaw = primaryYaw + secondaryYaw + glanceYaw;
                targetPitch = primaryPitch + secondaryPitch + glancePitch;
            }

            // CLAMP to safe limits
            const clampedYaw = THREE.MathUtils.clamp(targetYaw, -eyeCfg.maxYaw, eyeCfg.maxYaw);
            const clampedPitch = THREE.MathUtils.clamp(targetPitch, -eyeCfg.maxPitch, eyeCfg.maxPitch);

            // APPLY with smooth interpolation (creates natural, not-robotic movement)
            bones.head.rotation.y = THREE.MathUtils.lerp(bones.head.rotation.y, clampedYaw, eyeCfg.smoothing);
            bones.head.rotation.x = THREE.MathUtils.lerp(bones.head.rotation.x, clampedPitch, eyeCfg.smoothing);
            bones.head.rotation.z = 0; // NO roll

        } else if (bones.head) {
            bones.head.rotation.set(0, 0, 0);
        }

        // NECK follows head at reduced intensity (natural body mechanics)
        if (bones.neck && eyeCfg.enabled && bones.head) {
            const neckYaw = bones.head.rotation.y * 0.35;
            const neckPitch = bones.head.rotation.x * 0.25;
            bones.neck.rotation.y = THREE.MathUtils.lerp(bones.neck.rotation.y, neckYaw, eyeCfg.smoothing * 0.5);
            bones.neck.rotation.x = THREE.MathUtils.lerp(bones.neck.rotation.x, neckPitch, eyeCfg.smoothing * 0.5);
            bones.neck.rotation.z = 0;
        } else if (bones.neck) {
            bones.neck.rotation.set(0, 0, 0);
        }

        // ===========================================
        // BLINKING
        // ===========================================
        s.blinkTimer -= dt;
        if (s.blinkTimer <= 0 && !s.isBlinking) {
            s.isBlinking = true;
            s.blinkProgress = 0;
            s.blinkTimer = cfg.animation.blinkInterval[0] +
                Math.random() * (cfg.animation.blinkInterval[1] - cfg.animation.blinkInterval[0]);
        }

        if (s.isBlinking) {
            s.blinkProgress += dt / cfg.animation.blinkDuration;
            const curve = s.blinkProgress < 0.5 ? s.blinkProgress * 2 : 2 - s.blinkProgress * 2;
            ['eyesClosed', 'eyeBlinkLeft', 'eyeBlinkRight', 'eyeBlink_L', 'eyeBlink_R', 'blink', 'blink_L', 'blink_R'].forEach(t => {
                setMorph(t, curve);
            });
            if (s.blinkProgress >= 1) {
                s.isBlinking = false;
                ['eyesClosed', 'eyeBlinkLeft', 'eyeBlinkRight', 'eyeBlink_L', 'eyeBlink_R', 'blink', 'blink_L', 'blink_R'].forEach(t => setMorph(t, 0));
            }
        }

        // ===========================================
        // JAW RESET - CRITICAL: Reset jaw to rest position EVERY FRAME first
        // Jaw only moves when explicitly driven by audio below
        // ===========================================
        if (bones.jaw && jawRestPosition.current && lipCfg.jawEnabled) {
            // Always reset jaw to rest position first
            bones.jaw.rotation.x = jawRestPosition.current.x;
            bones.jaw.rotation.y = jawRestPosition.current.y;
            bones.jaw.rotation.z = jawRestPosition.current.z;
        }

        // ===========================================
        // LIP SYNC - Jaw ONLY moves when audio is playing
        // ===========================================
        const isSpeakingNow = speaking && audioLevel > 0.02;

        if (isSpeakingNow) {
            const targetAmp = Math.min(audioLevel * lipCfg.amplitudeSensitivity, lipCfg.maxValue);
            smoothedAudio.current += (targetAmp - smoothedAudio.current) * lipCfg.smoothing;
            visemePhase.current += dt * lipCfg.visemeSpeed;
        } else {
            smoothedAudio.current *= 0.85;
            if (smoothedAudio.current < 0.01) smoothedAudio.current = 0;
        }

        const amp = smoothedAudio.current;
        const phase = visemePhase.current;

        if (amp > 0.02) {
            // Generate varied phoneme patterns
            const vowelA = Math.max(0, Math.sin(phase) * 0.5 + 0.5);
            const vowelO = Math.max(0, Math.sin(phase + 1.2) * 0.5 + 0.5);
            const vowelE = Math.max(0, Math.sin(phase + 2.4) * 0.5 + 0.5);
            const consonantP = Math.max(0, Math.sin(phase * 2.3)) * 0.5;
            const consonantF = Math.max(0, Math.sin(phase * 2.7 + 0.5)) * 0.45;

            // Apply visemes using multiple target names for compatibility
            setMorphMultiple(lipCfg.visemeTargets.A, amp * vowelA * 0.9);
            setMorphMultiple(lipCfg.visemeTargets.O, amp * vowelO * 0.7);
            setMorphMultiple(lipCfg.visemeTargets.E, amp * vowelE * 0.6);
            setMorphMultiple(lipCfg.visemeTargets.PP, amp * consonantP);
            setMorphMultiple(lipCfg.visemeTargets.FF, amp * consonantF);

            // Mouth open / jaw
            const mouthOpenAmount = amp * (0.6 + Math.sin(phase * 1.5) * 0.25);
            setMorphMultiple(lipCfg.mouthOpenTargets, mouthOpenAmount);

            // Jaw bone movement - ONLY when audio is playing
            // Jaw rotation is additive to the rest position (already reset above)
            if (bones.jaw && jawRestPosition.current && lipCfg.jawEnabled) {
                // Add jaw opening based on audio amplitude
                bones.jaw.rotation.x = jawRestPosition.current.x + (amp * lipCfg.jawOpenMax);
            }

            // FALLBACK: If no morphs AND no jaw, use head movements to simulate talking
            // This creates subtle nod-like movements when speaking
            if (!hasMorphTargets.current && !bones.jaw && bones.head) {
                const origHead = originalRotations.current.head;
                // Create speech rhythm through subtle head nods and micro-movements
                const nodAmount = amp * 0.03 * Math.sin(phase * 3); // Slight up-down nod
                const tiltAmount = amp * 0.015 * Math.sin(phase * 1.7 + 0.5); // Subtle side tilt

                bones.head.rotation.x = THREE.MathUtils.lerp(
                    bones.head.rotation.x,
                    origHead.x + nodAmount,
                    0.2
                );
                bones.head.rotation.z = THREE.MathUtils.lerp(
                    bones.head.rotation.z,
                    (origHead.z || 0) + tiltAmount,
                    0.15
                );
            }

            // Also add neck emphasis for models without jaw
            if (!hasMorphTargets.current && !bones.jaw && bones.neck) {
                const origNeck = originalRotations.current.neck;
                const neckEmphasis = amp * 0.02 * Math.sin(phase * 2.5);
                bones.neck.rotation.x = THREE.MathUtils.lerp(
                    bones.neck.rotation.x,
                    origNeck.x + neckEmphasis,
                    0.15
                );
            }
        } else {
            // NOT SPEAKING - FORCE MOUTH CLOSED IMMEDIATELY
            // Reset audio amplitude to 0 immediately
            smoothedAudio.current = 0;

            // Reset all lip sync morphs to 0
            if (hasMorphTargets.current) {
                const allTargets = [
                    ...lipCfg.mouthOpenTargets,
                    ...Object.values(lipCfg.visemeTargets).flat()
                ];
                allTargets.forEach(t => setMorph(t, 0));
            }

            // Reset common mouth morph targets
            ['mouthOpen', 'jawOpen', 'viseme_aa', 'viseme_O', 'viseme_E', 'viseme_I', 'viseme_U',
                'aa', 'oh', 'ee', 'ih', 'uu', 'mouthSmile', 'mouthFrown'].forEach(t => setMorph(t, 0));

            // JAW is already reset at start of frame - no additional action needed
            // The jaw rest position is enforced above before lip sync logic
        }
    });

    return (
        <group ref={groupRef} position={[0, 0, 0]}>
            <primitive object={scene} position={[0, 0, 0]} />
        </group>
    );
}

useGLTF.preload(MODEL_PATH);

// ===========================================
// LIGHTING
// ===========================================

function Lighting({ theme }) {
    const isDark = theme === 'dark';
    return (
        <>
            <ambientLight intensity={isDark ? 0.5 : 0.7} />
            <directionalLight position={[2, 2, 4]} intensity={isDark ? 1.2 : 1.4} color={isDark ? "#fff" : "#fff8f0"} />
            <directionalLight position={[-2, 1, 3]} intensity={isDark ? 0.4 : 0.6} color="#e8f0ff" />
            {isDark && (
                <>
                    <pointLight position={[-1, 0.2, -0.3]} intensity={2} color="#8b5cf6" distance={4} />
                    <pointLight position={[1, 0.2, -0.3]} intensity={1.5} color="#a78bfa" distance={4} />
                </>
            )}
        </>
    );
}

// ===========================================
// BACKGROUND
// ===========================================

function Background({ theme }) {
    const { scene } = useThree();
    useEffect(() => {
        scene.background = new THREE.Color(theme === 'dark' ? '#0d0d1a' : '#f0f4f8');
    }, [scene, theme]);
    return null;
}

// ===========================================
// LOADING
// ===========================================

function LoadingAvatar() {
    return (
        <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.06, 32, 32]} />
            <meshStandardMaterial color="#8b5cf6" />
        </mesh>
    );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

function InterviewerAvatar({
    speaking = false,
    listening = false,
    audioLevel = 0,
    enabled = true,
    enableWebcam = true,  // Enable webcam-based eye contact tracking
    theme = 'dark'
}) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [detectedTheme, setDetectedTheme] = useState(theme);
    const [webcamStatus, setWebcamStatus] = useState('initializing'); // 'initializing' | 'active' | 'fallback' | 'disabled'

    // Theme detection effect
    useEffect(() => {
        const checkTheme = () => {
            const docTheme = document.documentElement.getAttribute('data-theme');
            setDetectedTheme(docTheme || theme);
        };
        checkTheme();
        const observer = new MutationObserver(checkTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        return () => observer.disconnect();
    }, [theme]);

    // ===========================================
    // WEBCAM EYE CONTACT - Starts when avatar AND webcam are enabled
    // Avatar tracks user's face via webcam for natural eye contact
    // ===========================================
    useEffect(() => {
        if (enabled && enableWebcam) {
            console.log('[Avatar] 🎥 Initializing WEBCAM-based eye contact tracking');
            setWebcamStatus('initializing');

            // Start eye contact tracking and update status based on result
            initializeEyeContact().then(() => {
                // Check if webcam is actually active after initialization
                setTimeout(() => {
                    if (eyeContactState.webcamActive && eyeContactState.faceDetected) {
                        setWebcamStatus('active');
                        console.log('[Avatar] ✅ Webcam eye contact ACTIVE');
                    } else if (eyeContactState.webcamActive) {
                        setWebcamStatus('active');
                        console.log('[Avatar] 🎥 Webcam active, waiting for face detection');
                    } else {
                        setWebcamStatus('fallback');
                        console.log('[Avatar] ⚠️ Using fallback animation mode');
                    }
                }, 1000);
            }).catch(() => {
                setWebcamStatus('fallback');
            });
        } else if (enabled && !enableWebcam) {
            setWebcamStatus('disabled');
            console.log('[Avatar] 📵 Webcam tracking disabled by prop');
        }

        // Cleanup when component unmounts or is disabled
        return () => {
            if (enabled) {
                console.log('[Avatar] Cleaning up webcam eye contact tracking');
                cleanupEyeContact();
                setWebcamStatus('disabled');
            }
        };
    }, [enabled, enableWebcam]);

    // Monitor webcam status periodically
    useEffect(() => {
        if (!enabled || !enableWebcam) return;

        const statusInterval = setInterval(() => {
            if (eyeContactState.webcamActive && eyeContactState.faceDetected) {
                setWebcamStatus('active');
            } else if (eyeContactState.webcamActive) {
                setWebcamStatus('active'); // Active but no face
            } else if (eyeContactState.initialized) {
                setWebcamStatus('fallback');
            }
        }, 2000);

        return () => clearInterval(statusInterval);
    }, [enabled, enableWebcam]);

    // Pass the actual audio level for natural lip movement (no forced minimum)
    const effectiveAudio = speaking ? audioLevel : 0;
    const isDark = detectedTheme === 'dark';

    if (!enabled) {
        return (
            <div className={`avatar-container avatar-disabled ${isDark ? 'dark' : 'light'}`}>
                <div className="avatar-placeholder"><span>Avatar Disabled</span></div>
            </div>
        );
    }

    return (
        <div className={`avatar-container ${isDark ? 'dark' : 'light'}`}>
            <div className="avatar-status">
                {speaking && <div className="status-indicator speaking">Speaking</div>}
                {listening && <div className="status-indicator listening">Listening</div>}
                {/* Eye Contact Status Indicator */}
                {enableWebcam && webcamStatus === 'active' && (
                    <div className="status-indicator eye-contact active" title="Eye contact tracking active">
                        👁️ Tracking
                    </div>
                )}
                {enableWebcam && webcamStatus === 'fallback' && (
                    <div className="status-indicator eye-contact fallback" title="Using fallback animation - allow camera access for real eye contact">
                        👁️ Fallback
                    </div>
                )}
                {enableWebcam && webcamStatus === 'initializing' && (
                    <div className="status-indicator eye-contact initializing" title="Initializing eye contact tracking...">
                        👁️ Starting...
                    </div>
                )}
            </div>

            <Canvas
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%'
                }}
                dpr={AVATAR_CONFIG.dpr}
                gl={{ antialias: true, alpha: false }}
                camera={{ fov: 22, position: [0, 0.25, 1.8], near: 0.1, far: 100 }}
                onCreated={({ camera, gl }) => {
                    camera.lookAt(0, 0.2, 0);
                    // Ensure canvas is centered
                    gl.domElement.style.display = 'block';
                    gl.domElement.style.margin = '0 auto';
                    setIsLoaded(true);
                }}
                onError={() => setHasError(true)}
            >
                <Background theme={detectedTheme} />
                <Lighting theme={detectedTheme} />
                <Suspense fallback={<LoadingAvatar />}>
                    <GLBAvatar speaking={speaking} audioLevel={effectiveAudio} theme={detectedTheme} />
                </Suspense>
            </Canvas>

            {!isLoaded && (
                <div className={`avatar-loading-overlay ${isDark ? 'dark' : 'light'}`}>
                    <div className="loading-spinner"></div>
                    <span>Loading Avatar...</span>
                </div>
            )}

            {hasError && <div className="avatar-error"><span>Failed to load avatar</span></div>}
        </div>
    );
}

// Export eye contact control functions for interview lifecycle management
export { initializeEyeContact, cleanupEyeContact };

// Reset function to clear all eye contact state (call when interview ends)
export const resetEyeContactState = () => {
    console.log('[Avatar] Resetting eye contact state - releasing all camera resources...');
    
    // First cleanup any active webcam resources
    cleanupEyeContact();
    
    // Then reset all state flags
    eyeContactState.initialized = false;
    eyeContactState.time = 0;
    eyeContactState.fallbackActive = true;  // Reset to fallback mode for next session
    eyeContactState.initAttempts = 0;       // Reset attempt counter
    eyeContactState.webcamActive = false;
    eyeContactState.faceDetected = false;
    eyeContactState.facePosition = { x: 0, y: 0 };
    eyeContactState.targetYaw = 0;
    eyeContactState.targetPitch = 0;
    eyeContactState.isProcessingFrame = false;
    
    console.log('[Avatar] ✓ Eye contact state fully reset - camera should be OFF');
};

export default InterviewerAvatar;
