import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getStoredUser, resumeApi } from '../services/api';
import { loadProfileData, getFormattedStats, computeAnalytics } from '../services/userDataService';
import { getStoredInterviews, getCachedAnalytics } from '../services/interviewStorage';
import {
  User, Mail, Calendar, FileText, Upload, Play, Eye,
  Briefcase, Clock, Award, TrendingUp, TrendingDown,
  ChevronRight, Download, Trash2, Loader2, AlertCircle,
  CheckCircle, Video, BarChart3, Target, Star, Shield
} from 'lucide-react';

// ===========================================
// HELPER FUNCTIONS
// ===========================================

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDuration = (seconds) => {
  if (!seconds) return 'N/A';
  const mins = Math.floor(seconds / 60);
  return `${mins} min`;
};

const getScoreColor = (score) => {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
};

const getScoreLabel = (score) => {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs Work';
};

// ===========================================
// SUB-COMPONENTS
// ===========================================

function ProfileSidebar({ activeSection, onSectionChange, user }) {
  const sections = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'resumes', label: 'Resumes', icon: FileText },
    { id: 'interviews', label: 'Interview History', icon: Briefcase },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <aside className="profile-sidebar">
      <div className="sidebar-header">
        <div className="user-avatar-large">
          {user?.name?.charAt(0).toUpperCase() || 'U'}
        </div>
        <h3 className="user-name">{user?.name || 'User'}</h3>
        <p className="user-email">{user?.email || ''}</p>
      </div>

      <nav className="sidebar-nav">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              className={`nav-item ${activeSection === section.id ? 'active' : ''}`}
              onClick={() => onSectionChange(section.id)}
            >
              <Icon size={18} />
              <span>{section.label}</span>
              <ChevronRight size={16} className="nav-arrow" />
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="member-badge">
          <Shield size={16} />
          <span>Member since {formatDate(user?.created_at)}</span>
        </div>
      </div>
    </aside>
  );
}

function OverviewSection({ user, stats }) {
  return (
    <div className="profile-section">
      <h2 className="section-title">
        <User size={24} />
        Profile Overview
      </h2>

      <div className="overview-grid">
        <div className="info-card">
          <h4>Personal Information</h4>
          <div className="info-row">
            <User size={16} />
            <span className="info-label">Name</span>
            <span className="info-value">{user?.name || 'Not set'}</span>
          </div>
          <div className="info-row">
            <Mail size={16} />
            <span className="info-label">Email</span>
            <span className="info-value">{user?.email || 'Not set'}</span>
          </div>
          <div className="info-row">
            <Calendar size={16} />
            <span className="info-label">Joined</span>
            <span className="info-value">{formatDate(user?.created_at)}</span>
          </div>
        </div>

        <div className="stats-card">
          <h4>Quick Stats</h4>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-number">{stats?.total_interviews || 0}</span>
              <span className="stat-label">Interviews</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{stats?.completed_interviews || 0}</span>
              <span className="stat-label">Completed</span>
            </div>
            <div className="stat-item">
              <span className="stat-number" style={{ color: getScoreColor(stats?.average_score || 0) }}>
                {stats?.average_score || 0}%
              </span>
              <span className="stat-label">Avg Score</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{stats?.total_resumes || 0}</span>
              <span className="stat-label">Resumes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResumesSection({ resumes, loading, onUpload, onDelete, onStartInterview }) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="profile-section">
        <h2 className="section-title">
          <FileText size={24} />
          My Resumes
        </h2>
        <div className="loading-state">
          <Loader2 size={32} className="spin" />
          <p>Loading resumes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-section">
      <div className="section-header-row">
        <h2 className="section-title">
          <FileText size={24} />
          My Resumes
        </h2>
        <button className="btn btn-primary" onClick={() => navigate('/interview-prep')}>
          <Upload size={16} />
          Upload New Resume
        </button>
      </div>

      {(!resumes || resumes.length === 0) ? (
        <div className="empty-state-card">
          <FileText size={48} />
          <h3>No resumes uploaded</h3>
          <p>Upload your resume to get personalized interview preparation</p>
          <button className="btn btn-primary" onClick={() => navigate('/interview-prep')}>
            Upload Resume
          </button>
        </div>
      ) : (
        <div className="resume-list">
          {resumes.map((resume) => (
            <div key={resume.id} className="resume-card">
              <div className="resume-icon">
                <FileText size={24} />
              </div>
              <div className="resume-info">
                <h4 className="resume-name">{resume.filename || 'Resume'}</h4>
                <div className="resume-meta">
                  <span className="meta-item">
                    <Calendar size={14} />
                    {formatDate(resume.created_at || resume.uploaded_at)}
                  </span>
                  <span className={`status-badge ${resume.is_parsed === 'success' ? 'success' : 'pending'}`}>
                    {resume.is_parsed === 'success' ? 'Parsed' : 'Processing'}
                  </span>
                </div>
              </div>
              <div className="resume-actions">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => onStartInterview(resume.id)}
                >
                  <Play size={14} />
                  Start Interview
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => onDelete(resume.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InterviewHistorySection({ interviews, loading }) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="profile-section">
        <h2 className="section-title">
          <Briefcase size={24} />
          Interview History
        </h2>
        <div className="loading-state">
          <Loader2 size={32} className="spin" />
          <p>Loading interview history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-section">
      <h2 className="section-title">
        <Briefcase size={24} />
        Interview History
      </h2>

      {(!interviews || interviews.length === 0) ? (
        <div className="empty-state-card">
          <Briefcase size={48} />
          <h3>No interviews yet</h3>
          <p>Complete your first mock interview to see your history here</p>
          <button className="btn btn-primary" onClick={() => navigate('/interview-prep')}>
            Start First Interview
          </button>
        </div>
      ) : (
        <div className="interview-list">
          {interviews.map((interview) => (
            <div key={interview.id} className="interview-card">
              <div className="interview-header">
                <div className="interview-title">
                  <h4>{interview.target_role || interview.job_role || 'Interview Session'}</h4>
                  <span className="interview-date">{formatDateTime(interview.created_at)}</span>
                </div>
                <div className="interview-score" style={{ color: getScoreColor(interview.score || 0) }}>
                  {interview.score !== null && interview.score !== undefined ? (
                    <>
                      <span className="score-value">{Math.round(interview.score)}%</span>
                      <span className="score-label">{getScoreLabel(interview.score)}</span>
                    </>
                  ) : (
                    <span className="score-pending">Pending</span>
                  )}
                </div>
              </div>

              <div className="interview-details">
                <div className="detail-row">
                  <span className="detail-item">
                    <Target size={14} />
                    {interview.session_type || 'Mixed'}
                  </span>
                  <span className="detail-item">
                    <Award size={14} />
                    {interview.difficulty || 'Medium'}
                  </span>
                  <span className="detail-item">
                    <Clock size={14} />
                    {formatDuration(interview.duration)}
                  </span>
                  <span className={`status-badge ${interview.status === 'completed' ? 'success' : 'info'}`}>
                    {interview.status || 'In Progress'}
                  </span>
                </div>
              </div>

              {interview.status === 'completed' && (
                <div className="interview-summary">
                  {interview.strengths && interview.strengths.length > 0 && (
                    <div className="summary-section">
                      <h5><Star size={14} /> Strengths</h5>
                      <div className="tags">
                        {interview.strengths.slice(0, 3).map((s, i) => (
                          <span key={i} className="tag success">{typeof s === 'string' ? s : s.skill || s.area}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {interview.weaknesses && interview.weaknesses.length > 0 && (
                    <div className="summary-section">
                      <h5><AlertCircle size={14} /> Areas to Improve</h5>
                      <div className="tags">
                        {interview.weaknesses.slice(0, 3).map((w, i) => (
                          <span key={i} className="tag warning">{typeof w === 'string' ? w : w.skill || w.area}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="interview-actions">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate(`/report/${interview.id}`)}
                >
                  <Eye size={14} />
                  View Report
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    // Generate PDF (placeholder - would use a PDF library)
                    window.print();
                  }}
                >
                  <Download size={14} />
                  Download PDF
                </button>
                {interview.has_recording && (
                  <button className="btn btn-ghost btn-sm">
                    <Video size={14} />
                    Replay
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AnalyticsSection({ analytics, loading }) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="profile-section">
        <h2 className="section-title">
          <BarChart3 size={24} />
          Performance Analytics
        </h2>
        <div className="loading-state">
          <Loader2 size={32} className="spin" />
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-section">
      <div className="section-header-row">
        <h2 className="section-title">
          <BarChart3 size={24} />
          Performance Analytics
        </h2>
        <button className="btn btn-ghost" onClick={() => navigate('/analytics')}>
          View Full Dashboard
          <ChevronRight size={16} />
        </button>
      </div>

      {(!analytics || analytics.total_interviews === 0) ? (
        <div className="empty-state-card">
          <BarChart3 size={48} />
          <h3>No analytics data yet</h3>
          <p>Complete interviews to see your performance analytics</p>
        </div>
      ) : (
        <div className="analytics-overview">
          <div className="analytics-grid">
            <div className="analytics-card highlight">
              <div className="analytics-value" style={{ color: getScoreColor(analytics.average_score || 0) }}>
                {analytics.average_score || 0}%
              </div>
              <div className="analytics-label">Average Score</div>
              {analytics.trend && (
                <div className={`trend ${analytics.trend}`}>
                  {analytics.trend === 'improving' ? (
                    <><TrendingUp size={14} /> Improving</>
                  ) : analytics.trend === 'declining' ? (
                    <><TrendingDown size={14} /> Declining</>
                  ) : (
                    'Stable'
                  )}
                </div>
              )}
            </div>

            <div className="analytics-card">
              <div className="analytics-value">{analytics.completed_interviews || 0}</div>
              <div className="analytics-label">Completed Interviews</div>
            </div>

            <div className="analytics-card">
              <div className="analytics-value">{analytics.completion_rate || 0}%</div>
              <div className="analytics-label">Completion Rate</div>
            </div>

            <div className="analytics-card">
              <div className="analytics-value">{analytics.best_score || 0}%</div>
              <div className="analytics-label">Best Score</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

function UserProfile() {
  const navigate = useNavigate();
  const user = getStoredUser();

  const [activeSection, setActiveSection] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data states - UNIFIED from userDataService
  const [resumes, setResumes] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [stats, setStats] = useState({
    total_interviews: 0,
    completed_interviews: 0,
    average_score: 0,
    total_resumes: 0,
  });

  // Load profile data using UNIFIED service
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Use unified data service - SAME SOURCE as Dashboard
        const data = await loadProfileData();

        setAnalytics(data.analytics);
        setInterviews(data.interviews);
        setResumes(data.resumes);
        setStats(getFormattedStats(data.analytics, data.resumes.length));

      } catch (err) {
        console.error('Failed to load profile:', err);
        setError('Failed to load profile data');

        // Even on error, try localStorage fallback
        const localInterviews = getStoredInterviews();
        const localAnalytics = getCachedAnalytics();
        setInterviews(localInterviews);
        setAnalytics(localAnalytics);
        setStats(getFormattedStats(localAnalytics, 0));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleDeleteResume = async (resumeId) => {
    if (!window.confirm('Are you sure you want to delete this resume?')) return;

    try {
      await resumeApi.delete(resumeId);
      setResumes(prev => prev.filter(r => r.id !== resumeId));
    } catch (err) {
      console.error('Failed to delete resume:', err);
    }
  };

  const handleStartInterview = (resumeId) => {
    navigate('/interview-prep', { state: { resumeId } });
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return <OverviewSection user={user} stats={stats} />;
      case 'resumes':
        return (
          <ResumesSection
            resumes={resumes}
            loading={loading}
            onDelete={handleDeleteResume}
            onStartInterview={handleStartInterview}
          />
        );
      case 'interviews':
        return <InterviewHistorySection interviews={interviews} loading={loading} />;
      case 'analytics':
        return <AnalyticsSection analytics={analytics} loading={loading} />;
      default:
        return <OverviewSection user={user} stats={stats} />;
    }
  };

  return (
    <div className="profile-container">
      <Navbar user={user} />

      <main className="profile-main">
        <ProfileSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          user={user}
        />

        <div className="profile-content">
          {error && (
            <div className="error-banner">
              <AlertCircle size={16} />
              <span>{error}</span>
              <button onClick={() => setError(null)}>×</button>
            </div>
          )}

          {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default UserProfile;
