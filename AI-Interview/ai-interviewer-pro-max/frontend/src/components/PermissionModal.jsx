/**
 * PermissionModal - PRODUCTION-GRADE Permission Request UI
 * 
 * Features:
 * - Clear permission status indicators
 * - Proper retry functionality
 * - Blocked state instructions
 * - Working skip option
 */

import React, { useState, useEffect } from 'react';
import { Camera, Mic, AlertCircle, CheckCircle, Loader2, X, RefreshCw, Settings, ExternalLink } from 'lucide-react';
import { PERMISSION_STATES } from '../hooks/useMediaPermissions';

export default function PermissionModal({
  onPermissionsGranted,
  onSkip,
  requestAllPermissions,
  retryPermissions,
  cameraPermission,
  micPermission,
  permissionError,
  isSupported,
  isCameraReady,
  isMicReady,
  isBlocked,
}) {
  const [requesting, setRequesting] = useState(false);
  const [autoRequested, setAutoRequested] = useState(false);

  // Auto-request on mount (first time only)
  useEffect(() => {
    if (!autoRequested && isSupported) {
      setAutoRequested(true);
      handleRequest();
    }
  }, [autoRequested, isSupported]);

  const handleRequest = async () => {
    setRequesting(true);

    try {
      const success = await requestAllPermissions();
      if (success) {
        // Small delay to show success state
        setTimeout(() => {
          onPermissionsGranted();
        }, 300);
      }
    } catch (e) {
      console.error('Permission request failed:', e);
    } finally {
      setRequesting(false);
    }
  };

  const handleRetry = async () => {
    setRequesting(true);

    try {
      const success = await retryPermissions();
      if (success) {
        setTimeout(() => {
          onPermissionsGranted();
        }, 300);
      }
    } catch (e) {
      console.error('Retry failed:', e);
    } finally {
      setRequesting(false);
    }
  };

  const getStatusInfo = (permission, isReady) => {
    if (isReady) {
      return { icon: CheckCircle, color: '#22c55e', label: 'Ready', bg: 'rgba(34, 197, 94, 0.1)' };
    }
    switch (permission) {
      case PERMISSION_STATES.GRANTED:
        return { icon: CheckCircle, color: '#22c55e', label: 'Enabled', bg: 'rgba(34, 197, 94, 0.1)' };
      case PERMISSION_STATES.DENIED:
        return { icon: AlertCircle, color: '#ef4444', label: 'Denied', bg: 'rgba(239, 68, 68, 0.1)' };
      case PERMISSION_STATES.BLOCKED:
        return { icon: AlertCircle, color: '#f97316', label: 'Blocked', bg: 'rgba(249, 115, 22, 0.1)' };
      case PERMISSION_STATES.ERROR:
        return { icon: AlertCircle, color: '#ef4444', label: 'Error', bg: 'rgba(239, 68, 68, 0.1)' };
      case PERMISSION_STATES.NOT_SUPPORTED:
        return { icon: AlertCircle, color: '#6b7280', label: 'Not Supported', bg: 'rgba(107, 114, 128, 0.1)' };
      case PERMISSION_STATES.PENDING:
      default:
        return { icon: Loader2, color: '#3b82f6', label: 'Checking...', bg: 'rgba(59, 130, 246, 0.1)' };
    }
  };

  const cameraInfo = getStatusInfo(cameraPermission, isCameraReady);
  const micInfo = getStatusInfo(micPermission, isMicReady);
  const CameraStatusIcon = cameraInfo.icon;
  const MicStatusIcon = micInfo.icon;

  const bothReady = isCameraReady && isMicReady;
  const anyDenied = cameraPermission === PERMISSION_STATES.DENIED ||
    micPermission === PERMISSION_STATES.DENIED ||
    cameraPermission === PERMISSION_STATES.BLOCKED ||
    micPermission === PERMISSION_STATES.BLOCKED;

  return (
    <div className="permission-modal-overlay">
      <div className="permission-modal">
        {/* Header */}
        <div className="permission-header">
          <div className="permission-icon">
            {bothReady ? (
              <CheckCircle size={32} color="#22c55e" />
            ) : isBlocked ? (
              <AlertCircle size={32} color="#f97316" />
            ) : anyDenied ? (
              <AlertCircle size={32} color="#ef4444" />
            ) : (
              <Camera size={32} />
            )}
          </div>
          <h2>
            {bothReady ? 'Ready to Start!' :
              isBlocked ? 'Access Blocked' :
                anyDenied ? 'Permission Required' :
                  'Camera & Microphone Setup'}
          </h2>
          <button className="close-btn" onClick={onSkip} title="Skip">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="permission-body">
          {/* Status Cards */}
          <div className="permission-status-cards">
            <div className="status-card" style={{ background: cameraInfo.bg }}>
              <div className="status-card-icon">
                <Camera size={24} />
              </div>
              <div className="status-card-content">
                <span className="status-card-title">Camera</span>
                <span className="status-card-subtitle">For eye contact tracking</span>
              </div>
              <div className="status-card-status" style={{ color: cameraInfo.color }}>
                <CameraStatusIcon
                  size={20}
                  className={cameraPermission === PERMISSION_STATES.PENDING && requesting ? 'spin' : ''}
                />
                <span>{cameraInfo.label}</span>
              </div>
            </div>

            <div className="status-card" style={{ background: micInfo.bg }}>
              <div className="status-card-icon">
                <Mic size={24} />
              </div>
              <div className="status-card-content">
                <span className="status-card-title">Microphone</span>
                <span className="status-card-subtitle">For voice responses</span>
              </div>
              <div className="status-card-status" style={{ color: micInfo.color }}>
                <MicStatusIcon
                  size={20}
                  className={micPermission === PERMISSION_STATES.PENDING && requesting ? 'spin' : ''}
                />
                <span>{micInfo.label}</span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {permissionError && (
            <div className={`permission-error-box ${isBlocked ? 'blocked' : ''}`}>
              <AlertCircle size={20} />
              <div className="error-content">
                <strong>{permissionError.title}</strong>
                <p>{permissionError.message}</p>
                {permissionError.action && (
                  <div className="error-action">
                    <Settings size={14} />
                    <span>{permissionError.action}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Blocked State - Detailed Instructions */}
          {isBlocked && (
            <div className="blocked-instructions">
              <h4>📋 How to Enable Access:</h4>
              <ol>
                <li>Look at your browser's <strong>address bar</strong></li>
                <li>Click the <strong>🔒 lock icon</strong> (or camera icon)</li>
                <li>Find <strong>"Camera"</strong> and <strong>"Microphone"</strong></li>
                <li>Change both to <strong>"Allow"</strong></li>
                <li>Click <strong>"Refresh"</strong> or press F5</li>
              </ol>
              <button
                className="btn btn-outline-small"
                onClick={() => window.location.reload()}
              >
                <RefreshCw size={14} /> Refresh Page
              </button>
            </div>
          )}

          {/* Success State */}
          {bothReady && (
            <div className="success-message">
              <CheckCircle size={20} />
              <span>Camera and microphone are ready!</span>
            </div>
          )}

          {/* Privacy Note */}
          <div className="privacy-note">
            <span className="privacy-icon">🔒</span>
            <span>Your video and audio are processed locally. Nothing is recorded or stored.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="permission-footer">
          <button
            className="btn btn-ghost"
            onClick={onSkip}
            disabled={requesting}
          >
            Skip (Text Only)
          </button>

          {bothReady ? (
            <button
              className="btn btn-success"
              onClick={onPermissionsGranted}
            >
              <CheckCircle size={18} />
              Start Interview
            </button>
          ) : isBlocked ? (
            <button
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={18} />
              Refresh Page
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={anyDenied ? handleRetry : handleRequest}
              disabled={requesting}
            >
              {requesting ? (
                <>
                  <Loader2 size={18} className="spin" />
                  Requesting...
                </>
              ) : anyDenied ? (
                <>
                  <RefreshCw size={18} />
                  Retry Permission
                </>
              ) : (
                <>
                  <Camera size={18} />
                  Enable Access
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <style>{`
        .permission-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }
        
        .permission-modal {
          background: var(--bg-card, #1e293b);
          border: 1px solid var(--border-color, #334155);
          border-radius: 20px;
          max-width: 520px;
          width: 100%;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        
        .permission-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.5rem;
          border-bottom: 1px solid var(--border-color, #334155);
        }
        
        .permission-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          background: var(--bg-tertiary, #0f172a);
          border-radius: 12px;
          color: var(--primary, #3b82f6);
        }
        
        .permission-header h2 {
          flex: 1;
          font-size: 1.2rem;
          font-weight: 600;
          color: var(--text-primary, #f8fafc);
          margin: 0;
        }
        
        .close-btn {
          background: none;
          border: none;
          color: var(--text-muted, #64748b);
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 8px;
          transition: all 0.2s;
        }
        
        .close-btn:hover {
          background: var(--bg-tertiary, #0f172a);
          color: var(--text-primary, #f8fafc);
        }
        
        .permission-body {
          padding: 1.5rem;
        }
        
        .permission-status-cards {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }
        
        .status-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.25rem;
          border-radius: 12px;
          border: 1px solid var(--border-color, #334155);
        }
        
        .status-card-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: var(--bg-card, #1e293b);
          border-radius: 10px;
          color: var(--primary, #3b82f6);
        }
        
        .status-card-content {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        
        .status-card-title {
          font-weight: 600;
          color: var(--text-primary, #f8fafc);
          font-size: 0.95rem;
        }
        
        .status-card-subtitle {
          font-size: 0.8rem;
          color: var(--text-muted, #64748b);
        }
        
        .status-card-status {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.85rem;
          font-weight: 500;
        }
        
        .permission-error-box {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 12px;
          margin-bottom: 1rem;
          color: #fca5a5;
        }
        
        .permission-error-box.blocked {
          background: rgba(249, 115, 22, 0.1);
          border-color: rgba(249, 115, 22, 0.3);
          color: #fed7aa;
        }
        
        .permission-error-box > svg {
          flex-shrink: 0;
          color: #ef4444;
          margin-top: 2px;
        }
        
        .permission-error-box.blocked > svg {
          color: #f97316;
        }
        
        .error-content {
          flex: 1;
        }
        
        .error-content strong {
          display: block;
          color: #fecaca;
          margin-bottom: 0.25rem;
        }
        
        .blocked .error-content strong {
          color: #fed7aa;
        }
        
        .error-content p {
          margin: 0 0 0.5rem 0;
          font-size: 0.9rem;
          line-height: 1.5;
        }
        
        .error-action {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          font-size: 0.85rem;
          background: rgba(0, 0, 0, 0.2);
          padding: 0.5rem 0.75rem;
          border-radius: 8px;
          line-height: 1.4;
        }
        
        .error-action svg {
          flex-shrink: 0;
          margin-top: 2px;
        }
        
        .blocked-instructions {
          background: var(--bg-tertiary, #0f172a);
          border-radius: 12px;
          padding: 1rem 1.25rem;
          margin-bottom: 1rem;
          border: 1px solid var(--border-color, #334155);
        }
        
        .blocked-instructions h4 {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text-primary, #f8fafc);
          margin: 0 0 0.75rem 0;
        }
        
        .blocked-instructions ol {
          margin: 0 0 1rem 0;
          padding-left: 1.25rem;
          color: var(--text-secondary, #94a3b8);
          font-size: 0.85rem;
          line-height: 1.8;
        }
        
        .blocked-instructions strong {
          color: var(--text-primary, #f8fafc);
        }
        
        .btn-outline-small {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 1rem;
          font-size: 0.85rem;
          background: transparent;
          border: 1px solid var(--border-color, #475569);
          color: var(--text-secondary, #94a3b8);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn-outline-small:hover {
          background: var(--bg-card-hover, #334155);
          border-color: var(--text-muted, #64748b);
        }
        
        .success-message {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.25);
          border-radius: 12px;
          margin-bottom: 1rem;
          color: #86efac;
          font-weight: 500;
        }
        
        .success-message svg {
          color: #22c55e;
        }
        
        .privacy-note {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-size: 0.8rem;
          color: var(--text-muted, #64748b);
          background: var(--bg-tertiary, #0f172a);
          padding: 0.75rem 1rem;
          border-radius: 10px;
        }
        
        .privacy-icon {
          font-size: 1rem;
        }
        
        .permission-footer {
          display: flex;
          gap: 1rem;
          padding: 1.25rem 1.5rem;
          border-top: 1px solid var(--border-color, #334155);
          background: var(--bg-tertiary, #0f172a);
        }
        
        .permission-footer .btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.875rem 1.5rem;
          font-size: 0.95rem;
          font-weight: 500;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn-ghost {
          background: transparent;
          border: 1px solid var(--border-color, #475569);
          color: var(--text-secondary, #94a3b8);
        }
        
        .btn-ghost:hover:not(:disabled) {
          background: var(--bg-card-hover, #334155);
          border-color: var(--text-muted, #64748b);
        }
        
        .btn-primary {
          background: var(--primary, #3b82f6);
          border: none;
          color: white;
        }
        
        .btn-primary:hover:not(:disabled) {
          background: var(--primary-dark, #2563eb);
        }
        
        .btn-success {
          background: #22c55e;
          border: none;
          color: white;
        }
        
        .btn-success:hover:not(:disabled) {
          background: #16a34a;
        }
        
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .spin {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @media (max-width: 480px) {
          .permission-footer {
            flex-direction: column-reverse;
          }
          
          .permission-header {
            padding: 1rem;
          }
          
          .permission-body {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
