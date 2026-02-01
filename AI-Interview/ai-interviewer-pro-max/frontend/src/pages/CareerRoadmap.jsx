/**
 * Career Roadmap Page - Premium Design
 * 
 * Displays personalized career roadmap with
 * timeline layout and actionable cards.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { roadmapApi, getStoredUser } from '../services/api';
import {
    Map, Target, BookOpen, Briefcase, Calendar, Clock,
    CheckCircle, ArrowRight, Loader2, AlertCircle,
    Lightbulb, Flag, Award, Sparkles, ChevronRight
} from 'lucide-react';

const PRIORITY_COLORS = {
    high: 'priority-high',
    medium: 'priority-medium',
    low: 'priority-low',
};

const DIFFICULTY_COLORS = {
    easy: 'difficulty-easy',
    medium: 'difficulty-medium',
    hard: 'difficulty-hard',
};

function CareerRoadmap() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const user = getStoredUser();

    const [roadmap, setRoadmap] = useState(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadRoadmap = async () => {
            if (!sessionId) {
                setError('No session ID provided');
                setLoading(false);
                return;
            }

            try {
                const response = await roadmapApi.get(sessionId);
                if (response.success && response.roadmap) {
                    setRoadmap(response.roadmap);
                    setLoading(false);
                    return;
                }
            } catch (err) {
                console.log('Roadmap not found, generating...');
            }

            try {
                setGenerating(true);
                const genResponse = await roadmapApi.generate(sessionId);
                if (genResponse.success && genResponse.roadmap) {
                    setRoadmap(genResponse.roadmap);
                } else {
                    throw new Error(genResponse.message || 'Failed to generate roadmap');
                }
            } catch (err) {
                setError(err.message || 'Failed to load roadmap');
            } finally {
                setLoading(false);
                setGenerating(false);
            }
        };

        loadRoadmap();
    }, [sessionId]);

    if (loading) {
        return (
            <div className="roadmap-container">
                <Navbar user={user} />
                <main className="roadmap-loading">
                    <div className="loading-card">
                        <Loader2 size={48} className="spin" />
                        <h2>{generating ? 'Creating Your Roadmap...' : 'Loading Roadmap...'}</h2>
                        {generating && <p>Analyzing your performance and building a personalized plan</p>}
                    </div>
                </main>
            </div>
        );
    }

    if (error || !roadmap) {
        return (
            <div className="roadmap-container">
                <Navbar user={user} />
                <main className="roadmap-loading">
                    <div className="error-card">
                        <AlertCircle size={48} />
                        <h2>Roadmap Unavailable</h2>
                        <p>{error || 'Unable to load roadmap'}</p>
                        <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
                            Return to Dashboard
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="roadmap-container">
            <Navbar user={user} />

            <main className="roadmap-main">
                {/* Header */}
                <header className="roadmap-header">
                    <div className="header-icon">
                        <Map size={40} />
                    </div>
                    <div className="header-content">
                        <h1>Your Career Roadmap</h1>
                        <p className="roadmap-role">{roadmap.context?.target_role || 'Career Plan'}</p>
                        {roadmap.timeline?.total_weeks && (
                            <div className="duration-badge">
                                <Clock size={16} />
                                <span>{roadmap.timeline.total_weeks} Week Plan</span>
                            </div>
                        )}
                    </div>
                </header>

                {/* Executive Summary */}
                {roadmap.summary?.executive && (
                    <section className="roadmap-card summary-card">
                        <div className="card-header">
                            <Target size={24} />
                            <h2>Your Personalized Plan</h2>
                        </div>
                        <p className="summary-text">{roadmap.summary.executive}</p>

                        {roadmap.summary.key_actions && roadmap.summary.key_actions.length > 0 && (
                            <div className="key-actions">
                                <h3>
                                    <Sparkles size={18} />
                                    Start Here
                                </h3>
                                <ol className="action-list">
                                    {roadmap.summary.key_actions.map((action, i) => (
                                        <li key={i}>
                                            <span className="action-number">{i + 1}</span>
                                            <span className="action-text">{action}</span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}
                    </section>
                )}

                {/* Timeline / Phases */}
                {roadmap.timeline?.phases && roadmap.timeline.phases.length > 0 && (
                    <section className="roadmap-card timeline-card">
                        <div className="card-header">
                            <Calendar size={24} />
                            <h2>Timeline</h2>
                        </div>
                        <div className="phases-timeline">
                            {roadmap.timeline.phases.map((phase, i) => (
                                <div key={i} className="phase-item">
                                    <div className="phase-marker">
                                        <span className="phase-number">{phase.phase}</span>
                                    </div>
                                    <div className="phase-content">
                                        <div className="phase-header">
                                            <h3>{phase.name}</h3>
                                            <span className="phase-weeks">Weeks {phase.weeks}</span>
                                        </div>
                                        <ul className="phase-focus">
                                            {phase.focus.map((item, j) => (
                                                <li key={j}>
                                                    <ChevronRight size={14} />
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Skill Gaps */}
                {roadmap.skill_gaps?.gaps && roadmap.skill_gaps.gaps.length > 0 && (
                    <section className="roadmap-card">
                        <div className="card-header">
                            <Target size={24} />
                            <h2>Skill Gaps to Address</h2>
                        </div>
                        <div className="gaps-grid">
                            {roadmap.skill_gaps.gaps.map((gap, i) => (
                                <div key={i} className="gap-card">
                                    <div className="gap-header">
                                        <span className="gap-skill">{gap.skill}</span>
                                        <span className={`priority-badge ${PRIORITY_COLORS[gap.priority]}`}>
                                            {gap.priority}
                                        </span>
                                    </div>
                                    <div className="gap-levels">
                                        <span className="level current">{gap.current_level}</span>
                                        <ArrowRight size={16} />
                                        <span className="level target">{gap.target_level}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Learning Topics */}
                {roadmap.learning?.topics && roadmap.learning.topics.length > 0 && (
                    <section className="roadmap-card">
                        <div className="card-header">
                            <BookOpen size={24} />
                            <h2>Learning Path</h2>
                        </div>
                        <div className="learning-timeline">
                            {roadmap.learning.topics.map((topic, i) => (
                                <div key={i} className="learning-item">
                                    <div className="learning-order">
                                        <span>{topic.order}</span>
                                    </div>
                                    <div className="learning-content">
                                        <h3>{topic.topic}</h3>
                                        <p>{topic.description}</p>
                                        <div className="learning-meta">
                                            <span className="duration">
                                                <Clock size={14} />
                                                {topic.duration_weeks} week{topic.duration_weeks > 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        {topic.resources && topic.resources.length > 0 && (
                                            <div className="resources">
                                                <strong>Resources:</strong>
                                                <ul>
                                                    {topic.resources.map((r, j) => (
                                                        <li key={j}>{r}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Recommended Projects */}
                {roadmap.projects?.recommended && roadmap.projects.recommended.length > 0 && (
                    <section className="roadmap-card">
                        <div className="card-header">
                            <Briefcase size={24} />
                            <h2>Projects to Build</h2>
                        </div>
                        <div className="projects-grid">
                            {roadmap.projects.recommended.map((project, i) => (
                                <div key={i} className="project-card">
                                    <h3>{project.title}</h3>
                                    <p>{project.description}</p>
                                    <div className="project-meta">
                                        <span className={`difficulty-badge ${DIFFICULTY_COLORS[project.difficulty]}`}>
                                            {project.difficulty}
                                        </span>
                                        <span className="duration">
                                            <Clock size={14} />
                                            {project.duration_weeks} week{project.duration_weeks > 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    {project.skills_covered && project.skills_covered.length > 0 && (
                                        <div className="skill-tags">
                                            {project.skills_covered.map((skill, j) => (
                                                <span key={j} className="skill-tag">{skill}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Practice Strategy */}
                {roadmap.practice && (
                    <section className="roadmap-card">
                        <div className="card-header">
                            <Lightbulb size={24} />
                            <h2>Practice Strategy</h2>
                        </div>

                        {roadmap.practice.strategy?.daily_routine && (
                            <div className="practice-block">
                                <h3>
                                    <Calendar size={18} />
                                    Daily Routine
                                </h3>
                                <p>{roadmap.practice.strategy.daily_routine}</p>
                            </div>
                        )}

                        {roadmap.practice.strategy?.weekly_goals && roadmap.practice.strategy.weekly_goals.length > 0 && (
                            <div className="practice-block">
                                <h3>
                                    <Target size={18} />
                                    Weekly Goals
                                </h3>
                                <ul className="practice-list">
                                    {roadmap.practice.strategy.weekly_goals.map((goal, i) => (
                                        <li key={i}>
                                            <CheckCircle size={16} />
                                            {goal}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {roadmap.practice.interview_tips && roadmap.practice.interview_tips.length > 0 && (
                            <div className="practice-block tips">
                                <h3>
                                    <Lightbulb size={18} />
                                    Interview Tips
                                </h3>
                                <ul className="practice-list">
                                    {roadmap.practice.interview_tips.map((tip, i) => (
                                        <li key={i}>
                                            <Sparkles size={16} />
                                            {tip}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </section>
                )}

                {/* Success Metrics */}
                {roadmap.summary?.success_metrics && roadmap.summary.success_metrics.length > 0 && (
                    <section className="roadmap-card">
                        <div className="card-header">
                            <Award size={24} />
                            <h2>How to Measure Progress</h2>
                        </div>
                        <ul className="metrics-list">
                            {roadmap.summary.success_metrics.map((metric, i) => (
                                <li key={i}>
                                    <CheckCircle size={18} />
                                    <span>{metric}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {/* Milestones */}
                {roadmap.timeline?.milestones && roadmap.timeline.milestones.length > 0 && (
                    <section className="roadmap-card milestones-card">
                        <div className="card-header">
                            <Flag size={24} />
                            <h2>Milestones</h2>
                        </div>
                        <div className="milestones-timeline">
                            {roadmap.timeline.milestones.map((milestone, i) => (
                                <div key={i} className="milestone-item">
                                    <div className="milestone-marker">
                                        <Flag size={16} />
                                        <span>Week {milestone.week}</span>
                                    </div>
                                    <div className="milestone-content">
                                        <h4>{milestone.milestone}</h4>
                                        {milestone.deliverables && milestone.deliverables.length > 0 && (
                                            <ul className="deliverables">
                                                {milestone.deliverables.map((d, j) => (
                                                    <li key={j}>
                                                        <CheckCircle size={14} />
                                                        {d}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Disclaimer */}
                <section className="roadmap-disclaimer">
                    <p>{roadmap.disclaimer}</p>
                </section>

                {/* Actions */}
                <div className="roadmap-actions">
                    <button className="btn btn-secondary" onClick={() => navigate(`/report/${sessionId}`)}>
                        View Interview Report
                    </button>
                    <button className="btn btn-primary" onClick={() => navigate('/interview-prep')}>
                        <Sparkles size={18} />
                        Practice Again
                    </button>
                </div>
            </main>
        </div>
    );
}

export default CareerRoadmap;
