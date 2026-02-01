/**
 * ResumeUpload Component - Premium Design
 * 
 * Professional file upload component for resumes with:
 * - Modern drag and drop zone with visual feedback
 * - Consistent button styling matching Start Interview
 * - Upload progress indication
 * - Clean success/error states
 */

import React, { useState, useRef, useCallback } from 'react';
import { resumeApi } from '../services/api';
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader } from 'lucide-react';

function ResumeUpload({ onUploadSuccess, onUploadError, disabled = false }) {
    // State
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadSuccess, setUploadSuccess] = useState(false);

    // Ref to file input
    const fileInputRef = useRef(null);

    // Allowed file types
    const ALLOWED_EXTENSIONS = ['pdf', 'docx'];
    const MAX_SIZE_MB = 10;

    /**
     * Validate file before upload
     */
    const validateFile = (file) => {
        if (!file) {
            return 'No file selected';
        }

        // Check file type
        const extension = file.name.toLowerCase().split('.').pop();
        if (!ALLOWED_EXTENSIONS.includes(extension)) {
            return `Invalid file type: .${extension}. Only PDF and DOCX files are allowed.`;
        }

        // Check file size
        const sizeMB = file.size / (1024 * 1024);
        if (sizeMB > MAX_SIZE_MB) {
            return `File too large: ${sizeMB.toFixed(1)}MB. Maximum size is ${MAX_SIZE_MB}MB.`;
        }

        return null; // Valid
    };

    /**
     * Handle file selection
     */
    const handleFileSelect = (file) => {
        setError('');
        setUploadSuccess(false);

        const validationError = validateFile(file);
        if (validationError) {
            setError(validationError);
            setSelectedFile(null);
            return;
        }

        setSelectedFile(file);
    };

    /**
     * Handle file input change
     */
    const handleInputChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    /**
     * Handle drag events
     */
    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled && !uploading) setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (disabled || uploading) return;

        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    /**
     * Open file picker
     */
    const openFilePicker = () => {
        if (!disabled && !uploading && fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    /**
     * Upload the selected file
     */
    const handleUpload = async () => {
        if (!selectedFile || uploading || disabled) return;

        setUploading(true);
        setError('');

        try {
            const response = await resumeApi.upload(selectedFile);

            if (response.success) {
                setSelectedFile(null);
                setUploadSuccess(true);
                if (onUploadSuccess) {
                    onUploadSuccess(response.resume);
                }
                // Reset success state after delay
                setTimeout(() => setUploadSuccess(false), 3000);
            } else {
                throw new Error(response.message || 'Upload failed');
            }
        } catch (err) {
            const message = err.message || 'Failed to upload resume. Please try again.';
            setError(message);
            if (onUploadError) {
                onUploadError(message);
            }
        } finally {
            setUploading(false);
        }
    };

    /**
     * Clear selected file
     */
    const clearSelection = () => {
        setSelectedFile(null);
        setError('');
        setUploadSuccess(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
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
     * Get file icon based on extension
     */
    const getFileIcon = (filename) => {
        return filename?.endsWith('.pdf') ? '📕' : '📘';
    };

    return (
        <div className="resume-upload-premium">
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                onChange={handleInputChange}
                style={{ display: 'none' }}
                disabled={disabled || uploading}
            />

            {/* Drop zone */}
            <div
                className={`upload-dropzone-premium ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''} ${uploading ? 'uploading' : ''} ${selectedFile ? 'has-file' : ''}`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={!selectedFile ? openFilePicker : undefined}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => e.key === 'Enter' && !selectedFile && openFilePicker()}
            >
                {!selectedFile ? (
                    <div className="dropzone-content">
                        <div className="upload-icon-wrapper">
                            <Upload size={32} />
                        </div>
                        <p className="upload-title">
                            <strong>Click to upload</strong> or drag and drop
                        </p>
                        <p className="upload-subtitle">PDF or DOCX (max {MAX_SIZE_MB}MB)</p>
                    </div>
                ) : (
                    <div className="selected-file-premium">
                        <div className="file-icon-wrapper">
                            <FileText size={28} />
                        </div>
                        <div className="file-details">
                            <p className="file-name">{selectedFile.name}</p>
                            <p className="file-size">{formatFileSize(selectedFile.size)}</p>
                        </div>
                        <button
                            type="button"
                            className="remove-file-btn"
                            onClick={(e) => { e.stopPropagation(); clearSelection(); }}
                            aria-label="Remove file"
                            disabled={uploading}
                        >
                            <X size={18} />
                        </button>
                    </div>
                )}
            </div>

            {/* Error message */}
            {error && (
                <div className="upload-message error" role="alert">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}

            {/* Success message */}
            {uploadSuccess && (
                <div className="upload-message success">
                    <CheckCircle size={16} />
                    <span>Resume uploaded successfully!</span>
                </div>
            )}

            {/* Upload button */}
            {selectedFile && (
                <button
                    type="button"
                    className="btn btn-primary btn-lg upload-btn-premium"
                    onClick={handleUpload}
                    disabled={uploading || disabled}
                >
                    {uploading ? (
                        <>
                            <Loader size={18} className="spin" />
                            <span>Uploading...</span>
                        </>
                    ) : (
                        <>
                            <Upload size={18} />
                            <span>Upload Resume</span>
                        </>
                    )}
                </button>
            )}
        </div>
    );
}

export default ResumeUpload;
