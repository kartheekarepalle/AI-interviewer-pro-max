/**
 * ResumeList Component
 * 
 * Displays a list of uploaded resumes with:
 * - Resume metadata
 * - Parsing status
 * - Delete functionality
 * - Selection for interview
 */

import React, { useState } from 'react';
import { resumeApi } from '../services/api';

function ResumeList({
    resumes,
    selectedResumeId,
    onSelect,
    onDelete,
    loading = false
}) {
    const [deletingId, setDeletingId] = useState(null);

    /**
     * Handle delete with confirmation
     */
    const handleDelete = async (resume) => {
        if (!window.confirm(`Delete "${resume.filename}"? This cannot be undone.`)) {
            return;
        }

        setDeletingId(resume.id);

        try {
            await resumeApi.delete(resume.id);
            if (onDelete) {
                onDelete(resume.id);
            }
        } catch (err) {
            console.error('Failed to delete resume:', err);
            alert('Failed to delete resume. Please try again.');
        } finally {
            setDeletingId(null);
        }
    };

    /**
     * Format file size for display
     */
    const formatFileSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    /**
     * Format date for display
     */
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    /**
     * Get status badge
     */
    const getStatusBadge = (status) => {
        switch (status) {
            case 'success':
                return <span className="status-badge success">✓ Parsed</span>;
            case 'pending':
                return <span className="status-badge pending">⏳ Processing</span>;
            case 'failed':
                return <span className="status-badge failed">✕ Failed</span>;
            default:
                return null;
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="resume-list-loading">
                <div className="spinner"></div>
                <p>Loading resumes...</p>
            </div>
        );
    }

    // Empty state
    if (!resumes || resumes.length === 0) {
        return (
            <div className="resume-list-empty">
                <div className="empty-icon">📄</div>
                <p>No resumes uploaded yet</p>
                <p className="hint">Upload your resume to get personalized interview questions</p>
            </div>
        );
    }

    return (
        <div className="resume-list">
            {resumes.map((resume) => (
                <div
                    key={resume.id}
                    className={`resume-item ${selectedResumeId === resume.id ? 'selected' : ''}`}
                    onClick={() => onSelect && onSelect(resume)}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => e.key === 'Enter' && onSelect && onSelect(resume)}
                >
                    {/* File icon */}
                    <div className="resume-icon">
                        {resume.file_type === 'pdf' ? '📕' : '📘'}
                    </div>

                    {/* Resume info */}
                    <div className="resume-info">
                        <div className="resume-header">
                            <span className="resume-name">{resume.filename}</span>
                            {getStatusBadge(resume.is_parsed)}
                        </div>
                        <div className="resume-meta">
                            <span>{formatFileSize(resume.file_size)}</span>
                            <span className="separator">•</span>
                            <span>{formatDate(resume.created_at)}</span>
                        </div>
                    </div>

                    {/* Selection indicator */}
                    {selectedResumeId === resume.id && (
                        <div className="selected-indicator">✓</div>
                    )}

                    {/* Delete button */}
                    <button
                        type="button"
                        className="delete-button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(resume);
                        }}
                        disabled={deletingId === resume.id}
                        aria-label={`Delete ${resume.filename}`}
                    >
                        {deletingId === resume.id ? '...' : '🗑️'}
                    </button>
                </div>
            ))}
        </div>
    );
}

export default ResumeList;
