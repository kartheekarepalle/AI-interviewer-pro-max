/**
 * Resumes Page - Premium Design
 * 
 * Resume management with drag & drop upload and ATS analysis.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ResumeUpload from '../components/ResumeUpload';
import ResumeList from '../components/ResumeList';
import ATSAnalyzer from '../components/ATSAnalyzer';
import { resumeApi, getStoredUser } from '../services/api';
import { FileText, Upload, BarChart2, Target, Lightbulb, CheckCircle } from 'lucide-react';

function Resumes() {
    const navigate = useNavigate();
    const location = useLocation();

    const [loading, setLoading] = useState(true);
    const [resumes, setResumes] = useState([]);
    const [selectedResume, setSelectedResume] = useState(null);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    // Check if navigated from Dashboard with activeTab state
    const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'upload');

    const user = getStoredUser();

    const loadResumes = useCallback(async () => {
        try {
            setLoading(true);
            const response = await resumeApi.getAll();
            if (response.success) {
                setResumes(response.resumes || []);
                if (response.resumes?.length > 0 && !selectedResume) {
                    setSelectedResume(response.resumes[0]);
                }
            }
        } catch (err) {
            setError('Failed to load resumes. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadResumes();
    }, [loadResumes]);

    const handleUploadSuccess = (resume) => {
        setResumes(prev => [resume, ...prev]);
        setSelectedResume(resume);
        setSuccessMessage('Resume uploaded successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    const handleUploadError = (message) => {
        setError(message);
        setTimeout(() => setError(''), 5000);
    };

    const handleDelete = (resumeId) => {
        setResumes(prev => prev.filter(r => r.id !== resumeId));
        if (selectedResume?.id === resumeId) {
            setSelectedResume(resumes.length > 1 ? resumes.find(r => r.id !== resumeId) : null);
        }
        setSuccessMessage('Resume deleted successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    const handleSelect = (resume) => setSelectedResume(resume);

    const handleAnalysisComplete = (result) => {
        setSuccessMessage(`ATS Analysis complete! Score: ${result.overall_score}/100`);
        setTimeout(() => setSuccessMessage(''), 5000);
    };

    const startInterview = () => {
        if (selectedResume) {
            navigate('/select-domain', { state: { resumeId: selectedResume.id } });
        }
    };

    return (
        <div className="resumes-container">
            <Navbar user={user} />

            <main className="resumes-main">
                {/* Header */}
                <section className="page-header">
                    <div className="header-content">
                        <h1>
                            <FileText size={32} style={{ marginRight: '12px', color: 'var(--primary)' }} />
                            My Resumes
                        </h1>
                        <p>Upload, analyze, and manage your resumes for personalized interviews</p>
                    </div>

                    {selectedResume && (
                        <button className="btn btn-primary btn-lg" onClick={startInterview}>
                            <Target size={18} />
                            Start Interview
                        </button>
                    )}
                </section>

                {/* Messages */}
                {successMessage && (
                    <div className="success-banner">
                        <CheckCircle size={16} />
                        <span>{successMessage}</span>
                    </div>
                )}

                {error && (
                    <div className="error-banner">
                        <span>⚠️ {error}</span>
                        <button onClick={() => setError(null)}>×</button>
                    </div>
                )}

                {/* Tab Navigation */}
                <div className="tab-navigation">
                    <button
                        className={`tab-button ${activeTab === 'upload' ? 'active' : ''}`}
                        onClick={() => setActiveTab('upload')}
                    >
                        <Upload size={16} style={{ marginRight: '6px' }} />
                        Upload & Manage
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'analyze' ? 'active' : ''}`}
                        onClick={() => setActiveTab('analyze')}
                        disabled={resumes.length === 0}
                    >
                        <BarChart2 size={16} style={{ marginRight: '6px' }} />
                        ATS Analysis
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'upload' ? (
                    <div className="resumes-grid">
                        <section className="upload-section">
                            <h2>
                                <Upload size={20} style={{ marginRight: '8px' }} />
                                Upload New Resume
                            </h2>
                            <ResumeUpload
                                onUploadSuccess={handleUploadSuccess}
                                onUploadError={handleUploadError}
                            />
                        </section>

                        <section className="list-section">
                            <h2>
                                <FileText size={20} style={{ marginRight: '8px' }} />
                                Your Resumes ({resumes.length})
                            </h2>
                            <ResumeList
                                resumes={resumes}
                                selectedResumeId={selectedResume?.id}
                                onSelect={handleSelect}
                                onDelete={handleDelete}
                                loading={loading}
                            />
                        </section>
                    </div>
                ) : (
                    <div className="ats-tab-content">
                        <div className="ats-resume-selector">
                            <label>Select Resume to Analyze:</label>
                            <select
                                value={selectedResume?.id || ''}
                                onChange={(e) => {
                                    const resume = resumes.find(r => r.id === e.target.value);
                                    setSelectedResume(resume);
                                }}
                            >
                                {resumes.map((resume) => (
                                    <option key={resume.id} value={resume.id}>
                                        {resume.filename} ({resume.is_parsed === 'success' ? '✓ Parsed' : '⏳'})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <ATSAnalyzer
                            resume={selectedResume}
                            onAnalysisComplete={handleAnalysisComplete}
                        />
                    </div>
                )}

                {/* Tips Section */}
                <section className="help-section">
                    <h3>
                        <Lightbulb size={20} style={{ marginRight: '8px', color: 'var(--warning)' }} />
                        Pro Tips
                    </h3>
                    <ul>
                        <li>Upload your resume to get personalized interview questions based on your experience</li>
                        <li>Use ATS Analysis to check how well your resume matches job requirements</li>
                        <li>Supported formats: PDF and DOCX (max 10MB)</li>
                        <li>Your resume is securely stored and only accessible by you</li>
                    </ul>
                </section>
            </main>
        </div>
    );
}

export default Resumes;
