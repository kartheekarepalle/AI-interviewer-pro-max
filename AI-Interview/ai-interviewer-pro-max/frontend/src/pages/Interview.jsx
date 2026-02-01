/**
 * Interview Page
 * 
 * The main interview interface with:
 * - 3D Avatar (visual only, no AI)
 * - Question display
 * - Answer input
 * - Progress tracking
 * - Timer
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import InterviewerAvatar from '../components/InterviewerAvatar';

import Navbar from '../components/Navbar';



function Interview() {
    const { sessionId } = useParams();
    const navigate = useNavigate();

    // Interview state
    const [status, setStatus] = useState('configuring'); // configuring, ready, in_progress, completed
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [questionNumber, setQuestionNumber] = useState(0);
    const [totalQuestions, setTotalQuestions] = useState(10);
    const [answer, setAnswer] = useState('');
    const [timeRemaining, setTimeRemaining] = useState(180);
    const [loading, setLoading] = useState(false);

    // Configuration state
    const [config, setConfig] = useState({
        sessionType: 'mixed',
        difficulty: 'medium',
        questionCount: 10,
    });

    // Timer effect
    useEffect(() => {
        if (status !== 'in_progress' || timeRemaining <= 0) return;

        const timer = setInterval(() => {
            setTimeRemaining((prev) => Math.max(0, prev - 1));
        }, 1000);

        return () => clearInterval(timer);
    }, [status, timeRemaining]);

    const handleStartInterview = async () => {
        setLoading(true);
        // TODO: Call API to create session and generate questions
        // Simulate loading
        setTimeout(() => {
            setStatus('in_progress');
            setQuestionNumber(1);
            setCurrentQuestion({
                id: 'q1',
                text: 'Tell me about yourself and your experience.',
                type: 'behavioral',
            });
            setLoading(false);
        }, 1500);
    };

    const handleSubmitAnswer = async () => {
        if (!answer.trim()) return;

        setLoading(true);
        // TODO: Call API to submit answer and get next question

        setTimeout(() => {
            if (questionNumber >= totalQuestions) {
                setStatus('completed');
                navigate(`/report/${sessionId || 'demo'}`);
            } else {
                setQuestionNumber((prev) => prev + 1);
                setCurrentQuestion({
                    id: `q${questionNumber + 1}`,
                    text: 'What is your greatest strength?',
                    type: 'behavioral',
                });
                setAnswer('');
                setTimeRemaining(180);
            }
            setLoading(false);
        }, 1000);
    };

    const handleEndInterview = () => {
        if (window.confirm('Are you sure you want to end the interview?')) {
            navigate(`/report/${sessionId || 'demo'}`);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="interview-container">
            <Navbar minimal />

            <main className="interview-main">
                {/* Configuration Phase */}
                {status === 'configuring' && (
                    <div className="config-panel">
                        <h2>Configure Your Interview</h2>

                        <div className="config-options">
                            <div className="config-group">
                                <label>Interview Type</label>
                                <select
                                    value={config.sessionType}
                                    onChange={(e) => setConfig({ ...config, sessionType: e.target.value })}
                                >
                                    <option value="technical">Technical</option>
                                    <option value="behavioral">Behavioral</option>
                                    <option value="mixed">Mixed</option>
                                </select>
                            </div>

                            <div className="config-group">
                                <label>Difficulty</label>
                                <select
                                    value={config.difficulty}
                                    onChange={(e) => setConfig({ ...config, difficulty: e.target.value })}
                                >
                                    <option value="easy">Easy</option>
                                    <option value="medium">Medium</option>
                                    <option value="hard">Hard</option>
                                    <option value="expert">Expert</option>
                                </select>
                            </div>

                            <div className="config-group">
                                <label>Number of Questions</label>
                                <select
                                    value={config.questionCount}
                                    onChange={(e) => setConfig({ ...config, questionCount: Number(e.target.value) })}
                                >
                                    <option value="5">5 Questions</option>
                                    <option value="10">10 Questions</option>
                                    <option value="15">15 Questions</option>
                                </select>
                            </div>
                        </div>

                        <button
                            className="btn-primary btn-large"
                            onClick={handleStartInterview}
                            disabled={loading}
                        >
                            {loading ? 'Preparing...' : 'Start Interview'}
                        </button>
                    </div>
                )}

                {/* Interview Phase */}
                {status === 'in_progress' && (
                    <div className="interview-panel">
                        {/* Avatar Section */}
                        <div className="avatar-section">
                            <InterviewerAvatar speaking={false} enableWebcam={false} />
                        </div>

                        {/* Question & Answer Section */}
                        <div className="qa-section">
                            {/* Progress */}
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
                                />
                            </div>
                            <div className="progress-text">
                                Question {questionNumber} of {totalQuestions}
                            </div>

                            {/* Timer */}
                            <div className={`timer ${timeRemaining < 30 ? 'warning' : ''}`}>
                                {formatTime(timeRemaining)}
                            </div>

                            {/* Question */}
                            <div className="question-box">
                                <span className="question-type">{currentQuestion?.type}</span>
                                <p className="question-text">{currentQuestion?.text}</p>
                            </div>

                            {/* Answer Input */}
                            <textarea
                                className="answer-input"
                                value={answer}
                                onChange={(e) => setAnswer(e.target.value)}
                                placeholder="Type your answer here..."
                                rows={6}
                            />

                            {/* Actions */}
                            <div className="interview-actions">
                                <button className="btn-secondary" onClick={handleEndInterview}>
                                    End Interview
                                </button>
                                <button
                                    className="btn-primary"
                                    onClick={handleSubmitAnswer}
                                    disabled={loading || !answer.trim()}
                                >
                                    {loading ? 'Submitting...' : 'Submit Answer'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default Interview;
