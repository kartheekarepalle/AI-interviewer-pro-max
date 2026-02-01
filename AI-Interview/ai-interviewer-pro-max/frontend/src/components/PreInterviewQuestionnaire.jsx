/**
 * Pre-Interview Questionnaire
 * 
 * A step-based form shown BEFORE the interview starts.
 * Collects user preferences to personalize the interview experience.
 */

import React, { useState, useCallback } from 'react';
import {
    Briefcase, GraduationCap, Target, AlertCircle,
    Star, TrendingUp, ChevronRight, ChevronLeft,
    Check, Sparkles, User
} from 'lucide-react';

// ===========================================
// QUESTION DEFINITIONS
// ===========================================

const QUESTIONS = [
    {
        id: 'target_role',
        title: 'Target Role',
        question: 'What role are you preparing for?',
        description: 'Enter the job title you\'re targeting',
        type: 'text',
        placeholder: 'e.g., Software Engineer, Product Manager',
        icon: Briefcase,
        required: true,
    },
    {
        id: 'experience_level',
        title: 'Experience Level',
        question: 'What is your experience level?',
        description: 'This helps us tailor the difficulty',
        type: 'select',
        icon: GraduationCap,
        required: true,
        options: [
            { value: 'student', label: 'Student', description: 'Currently studying, limited work experience' },
            { value: 'fresher', label: 'Fresher / Entry-Level', description: '0-1 years of professional experience' },
            { value: 'mid', label: 'Mid-Level', description: '2-5 years of professional experience' },
            { value: 'senior', label: 'Senior', description: '6+ years of professional experience' },
        ],
    },
    {
        id: 'strengths',
        title: 'Your Strengths',
        question: 'What are your key strengths?',
        description: 'Select areas where you excel (choose up to 3)',
        type: 'multi-select',
        icon: Star,
        required: true,
        maxSelect: 3,
        options: [
            { value: 'problem_solving', label: 'Problem Solving' },
            { value: 'communication', label: 'Communication' },
            { value: 'leadership', label: 'Leadership' },
            { value: 'technical_skills', label: 'Technical Skills' },
            { value: 'teamwork', label: 'Teamwork' },
            { value: 'adaptability', label: 'Adaptability' },
            { value: 'creativity', label: 'Creativity' },
            { value: 'analytical', label: 'Analytical Thinking' },
        ],
    },
    {
        id: 'weaknesses',
        title: 'Areas to Improve',
        question: 'What areas do you want to improve?',
        description: 'Select areas you want to work on (choose up to 2)',
        type: 'multi-select',
        icon: AlertCircle,
        required: true,
        maxSelect: 2,
        options: [
            { value: 'public_speaking', label: 'Public Speaking' },
            { value: 'technical_depth', label: 'Technical Depth' },
            { value: 'time_management', label: 'Time Management' },
            { value: 'confidence', label: 'Confidence' },
            { value: 'structured_answers', label: 'Structured Answers' },
            { value: 'handling_pressure', label: 'Handling Pressure' },
            { value: 'asking_questions', label: 'Asking Questions' },
        ],
    },
    {
        id: 'interview_goal',
        title: 'Your Goal',
        question: 'What is your goal for this interview?',
        description: 'This helps us focus the session',
        type: 'select',
        icon: Target,
        required: true,
        options: [
            { value: 'practice', label: 'Practice & Learn', description: 'Casual practice to improve skills' },
            { value: 'preparation', label: 'Real Interview Prep', description: 'Preparing for an upcoming interview' },
            { value: 'confidence', label: 'Build Confidence', description: 'Reduce interview anxiety' },
            { value: 'assessment', label: 'Self Assessment', description: 'Evaluate current interview readiness' },
        ],
    },
    {
        id: 'difficulty',
        title: 'Difficulty Level',
        question: 'What difficulty do you prefer?',
        description: 'Higher difficulty means tougher questions',
        type: 'select',
        icon: TrendingUp,
        required: true,
        options: [
            { value: 'easy', label: 'Easy', description: 'Foundational questions, more guidance' },
            { value: 'medium', label: 'Medium', description: 'Balanced challenge, standard interview' },
            { value: 'hard', label: 'Hard', description: 'Challenging questions, less hints' },
        ],
    },
];

// ===========================================
// MAIN COMPONENT
// ===========================================

function PreInterviewQuestionnaire({ onComplete, onSkip, defaultValues = {} }) {
    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState({
        target_role: defaultValues.target_role || '',
        experience_level: defaultValues.experience_level || '',
        strengths: defaultValues.strengths || [],
        weaknesses: defaultValues.weaknesses || [],
        interview_goal: defaultValues.interview_goal || '',
        difficulty: defaultValues.difficulty || 'medium',
    });
    const [errors, setErrors] = useState({});

    const currentQuestion = QUESTIONS[currentStep];
    const isLastStep = currentStep === QUESTIONS.length - 1;
    const isFirstStep = currentStep === 0;

    // Validate current step
    const validateStep = useCallback(() => {
        const question = QUESTIONS[currentStep];
        const value = answers[question.id];

        if (question.required) {
            if (question.type === 'multi-select') {
                if (!value || value.length === 0) {
                    setErrors(prev => ({ ...prev, [question.id]: 'Please select at least one option' }));
                    return false;
                }
            } else if (!value || value.trim() === '') {
                setErrors(prev => ({ ...prev, [question.id]: 'This field is required' }));
                return false;
            }
        }

        setErrors(prev => ({ ...prev, [question.id]: null }));
        return true;
    }, [currentStep, answers]);

    // Navigation
    const handleNext = useCallback(() => {
        if (!validateStep()) return;

        if (isLastStep) {
            onComplete?.(answers);
        } else {
            setCurrentStep(prev => prev + 1);
        }
    }, [validateStep, isLastStep, answers, onComplete]);

    const handleBack = useCallback(() => {
        if (!isFirstStep) {
            setCurrentStep(prev => prev - 1);
        }
    }, [isFirstStep]);

    // Update answer
    const updateAnswer = useCallback((questionId, value) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
        setErrors(prev => ({ ...prev, [questionId]: null }));
    }, []);

    // Toggle multi-select option
    const toggleOption = useCallback((questionId, optionValue, maxSelect = 10) => {
        setAnswers(prev => {
            const current = prev[questionId] || [];
            if (current.includes(optionValue)) {
                return { ...prev, [questionId]: current.filter(v => v !== optionValue) };
            } else if (current.length < maxSelect) {
                return { ...prev, [questionId]: [...current, optionValue] };
            }
            return prev;
        });
        setErrors(prev => ({ ...prev, [questionId]: null }));
    }, []);

    // Render question content
    const renderQuestionContent = () => {
        const question = currentQuestion;
        const value = answers[question.id];
        const error = errors[question.id];
        const Icon = question.icon;

        return (
            <div className="question-content">
                <div className="question-header">
                    <div className="question-icon">
                        <Icon size={28} />
                    </div>
                    <div className="question-text">
                        <h2>{question.question}</h2>
                        <p>{question.description}</p>
                    </div>
                </div>

                <div className="question-input">
                    {question.type === 'text' && (
                        <input
                            type="text"
                            className="form-input"
                            placeholder={question.placeholder}
                            value={value}
                            onChange={(e) => updateAnswer(question.id, e.target.value)}
                            autoFocus
                        />
                    )}

                    {question.type === 'select' && (
                        <div className="select-options">
                            {question.options.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={`option-card ${value === option.value ? 'selected' : ''}`}
                                    onClick={() => updateAnswer(question.id, option.value)}
                                >
                                    <div className="option-check">
                                        {value === option.value && <Check size={16} />}
                                    </div>
                                    <div className="option-content">
                                        <span className="option-label">{option.label}</span>
                                        {option.description && (
                                            <span className="option-desc">{option.description}</span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {question.type === 'multi-select' && (
                        <div className="multi-select-options">
                            {question.options.map((option) => {
                                const isSelected = (value || []).includes(option.value);
                                const isMaxed = (value || []).length >= question.maxSelect && !isSelected;

                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        className={`chip ${isSelected ? 'selected' : ''} ${isMaxed ? 'disabled' : ''}`}
                                        onClick={() => !isMaxed && toggleOption(question.id, option.value, question.maxSelect)}
                                        disabled={isMaxed}
                                    >
                                        {isSelected && <Check size={14} />}
                                        {option.label}
                                    </button>
                                );
                            })}
                            <p className="select-hint">
                                Select up to {question.maxSelect} ({(value || []).length}/{question.maxSelect})
                            </p>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="field-error">
                        <AlertCircle size={14} />
                        {error}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="pre-interview-questionnaire">
            {/* Progress */}
            <div className="questionnaire-progress">
                <div className="progress-bar">
                    <div
                        className="progress-fill"
                        style={{ width: `${((currentStep + 1) / QUESTIONS.length) * 100}%` }}
                    />
                </div>
                <span className="progress-text">
                    Step {currentStep + 1} of {QUESTIONS.length}
                </span>
            </div>

            {/* Question */}
            <div className="questionnaire-body">
                {renderQuestionContent()}
            </div>

            {/* Navigation */}
            <div className="questionnaire-footer">
                <div className="footer-left">
                    {!isFirstStep && (
                        <button type="button" className="btn btn-ghost" onClick={handleBack}>
                            <ChevronLeft size={18} />
                            Back
                        </button>
                    )}
                </div>

                <div className="footer-right">
                    {onSkip && (
                        <button type="button" className="btn btn-ghost" onClick={onSkip}>
                            Skip for now
                        </button>
                    )}
                    <button type="button" className="btn btn-primary" onClick={handleNext}>
                        {isLastStep ? (
                            <>
                                <Sparkles size={18} />
                                Start Interview
                            </>
                        ) : (
                            <>
                                Next
                                <ChevronRight size={18} />
                            </>
                        )}
                    </button>
                </div>
            </div>

            <style jsx>{`
        .pre-interview-questionnaire {
          max-width: 600px;
          margin: 0 auto;
          padding: var(--space-8);
        }

        .questionnaire-progress {
          display: flex;
          align-items: center;
          gap: var(--space-4);
          margin-bottom: var(--space-8);
        }

        .progress-bar {
          flex: 1;
          height: 6px;
          background: var(--bg-tertiary);
          border-radius: var(--radius-full);
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: var(--primary-gradient);
          border-radius: var(--radius-full);
          transition: width 0.3s ease;
        }

        .progress-text {
          font-size: var(--text-sm);
          color: var(--text-muted);
          white-space: nowrap;
        }

        .questionnaire-body {
          min-height: 320px;
        }

        .question-header {
          display: flex;
          align-items: flex-start;
          gap: var(--space-4);
          margin-bottom: var(--space-8);
        }

        .question-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          background: var(--primary-glow);
          border-radius: var(--radius-xl);
          color: var(--primary);
          flex-shrink: 0;
        }

        .question-text h2 {
          font-family: var(--font-display);
          font-size: var(--text-2xl);
          font-weight: var(--font-bold);
          color: var(--text-primary);
          margin-bottom: var(--space-1);
        }

        .question-text p {
          font-size: var(--text-base);
          color: var(--text-muted);
        }

        .question-input {
          margin-top: var(--space-6);
        }

        .form-input {
          width: 100%;
          padding: var(--space-4);
          font-size: var(--text-lg);
          background: var(--bg-card);
          border: 2px solid var(--border-color);
          border-radius: var(--radius-xl);
          color: var(--text-primary);
          transition: all var(--transition-fast);
        }

        .form-input:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 4px var(--primary-glow);
        }

        .form-input::placeholder {
          color: var(--text-muted);
        }

        .select-options {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .option-card {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          width: 100%;
          padding: var(--space-4);
          background: var(--bg-card);
          border: 2px solid var(--border-color);
          border-radius: var(--radius-xl);
          text-align: left;
          transition: all var(--transition-fast);
        }

        .option-card:hover {
          border-color: var(--primary);
          background: var(--bg-card-hover);
        }

        .option-card.selected {
          border-color: var(--primary);
          background: var(--primary-glow);
        }

        .option-check {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: var(--radius-full);
          border: 2px solid var(--border-color);
          color: white;
          flex-shrink: 0;
          transition: all var(--transition-fast);
        }

        .option-card.selected .option-check {
          background: var(--primary);
          border-color: var(--primary);
        }

        .option-content {
          flex: 1;
        }

        .option-label {
          display: block;
          font-weight: var(--font-semibold);
          color: var(--text-primary);
        }

        .option-desc {
          display: block;
          font-size: var(--text-sm);
          color: var(--text-muted);
          margin-top: 2px;
        }

        .multi-select-options {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
        }

        .chip {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          padding: var(--space-2) var(--space-4);
          background: var(--bg-tertiary);
          border: 2px solid var(--border-color);
          border-radius: var(--radius-full);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text-primary);
          transition: all var(--transition-fast);
        }

        .chip:hover:not(.disabled) {
          border-color: var(--primary);
        }

        .chip.selected {
          background: var(--primary-glow);
          border-color: var(--primary);
          color: var(--primary);
        }

        .chip.disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .select-hint {
          width: 100%;
          font-size: var(--text-xs);
          color: var(--text-muted);
          margin-top: var(--space-2);
        }

        .field-error {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-top: var(--space-3);
          font-size: var(--text-sm);
          color: var(--danger);
        }

        .questionnaire-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: var(--space-8);
          padding-top: var(--space-6);
          border-top: 1px solid var(--border-color);
        }

        .footer-left,
        .footer-right {
          display: flex;
          gap: var(--space-3);
        }

        @media (max-width: 600px) {
          .pre-interview-questionnaire {
            padding: var(--space-4);
          }

          .question-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .question-text h2 {
            font-size: var(--text-xl);
          }

          .questionnaire-footer {
            flex-direction: column;
            gap: var(--space-4);
          }

          .footer-left,
          .footer-right {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
        </div>
    );
}

export default PreInterviewQuestionnaire;
