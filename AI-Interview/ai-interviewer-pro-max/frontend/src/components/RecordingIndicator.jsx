/**
 * Recording Indicator
 * 
 * Subtle indicator showing that the interview is being recorded.
 * Non-distracting but always visible.
 * 
 * HARDENING: Uses inline styles for maximum compatibility
 */

import React from 'react';
import { Video } from 'lucide-react';

const styles = {
  indicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#ef4444',
    userSelect: 'none',
  },
  dot: {
    width: '8px',
    height: '8px',
    background: '#ef4444',
    borderRadius: '50%',
    animation: 'pulse-rec 1.5s ease-in-out infinite',
  },
  text: {
    letterSpacing: '0.1em',
  },
  duration: {
    opacity: 0.8,
    fontVariantNumeric: 'tabular-nums',
  },
};

// CSS animation keyframes (injected once)
const styleSheet = `
@keyframes pulse-rec {
    0%, 100% {
        opacity: 1;
        transform: scale(1);
    }
    50% {
        opacity: 0.5;
        transform: scale(0.85);
    }
}
`;

// Inject keyframes if not already present
if (typeof document !== 'undefined') {
  const styleId = 'recording-indicator-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = styleSheet;
    document.head.appendChild(style);
  }
}

function RecordingIndicator({ isRecording, duration, className = '' }) {
  // Defensive: don't render if not recording
  if (!isRecording) {
    return null;
  }

  return (
    <div className={`recording-indicator ${className}`.trim()} style={styles.indicator}>
      <span style={styles.dot}></span>
      <Video size={14} />
      <span style={styles.text}>REC</span>
      {duration && <span style={styles.duration}>{duration}</span>}
    </div>
  );
}

export default RecordingIndicator;
