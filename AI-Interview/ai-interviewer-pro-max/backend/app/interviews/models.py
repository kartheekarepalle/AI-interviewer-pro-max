"""
Interview Models

SQLAlchemy models for interview-related database tables.
Covers the complete interview lifecycle from setup to report.
"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, Enum, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.db.base import Base


# ===========================================
# ENUMS
# ===========================================


class SessionType(str, enum.Enum):
    """Interview session types."""
    TECHNICAL = "technical"
    BEHAVIORAL = "behavioral"
    MIXED = "mixed"
    HR = "hr"
    CASE_STUDY = "case_study"
    SYSTEM_DESIGN = "system_design"


class DifficultyLevel(str, enum.Enum):
    """Interview difficulty levels."""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    EXPERT = "expert"


class SessionStatus(str, enum.Enum):
    """Interview session status."""
    SCHEDULED = "scheduled"
    CONFIGURING = "configuring"
    PLANNING = "planning"
    READY = "ready"
    IN_PROGRESS = "in_progress"
    PAUSED = "paused"
    COMPLETING = "completing"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class QuestionType(str, enum.Enum):
    """Interview question types."""
    TECHNICAL = "technical"
    BEHAVIORAL = "behavioral"
    SITUATIONAL = "situational"
    FOLLOW_UP = "follow_up"
    SYSTEM_DESIGN = "system_design"


# ===========================================
# MODELS
# ===========================================


class JobRole(Base):
    """
    Job Role model - Defines interview target roles with requirements.
    """
    
    __tablename__ = "job_roles"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=True)  # NULL = system role
    
    title = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False)  # engineering, design, product, etc.
    seniority_level = Column(String(20), nullable=False)  # intern, junior, mid, senior, lead
    industry = Column(String(100), nullable=True)
    required_skills = Column(JSON, nullable=False, default=list)
    description = Column(Text, nullable=True)
    
    is_active = Column(Boolean, default=True)
    is_system = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f"<JobRole(title={self.title})>"


class InterviewSession(Base):
    """
    Interview Session model - Core interview instance tracking lifecycle.
    """
    
    __tablename__ = "interview_sessions"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False, index=True)
    resume_id = Column(String(36), nullable=True)
    job_role_id = Column(String(36), nullable=True)
    
    session_type = Column(String(20), nullable=False, default="mixed")
    difficulty_level = Column(String(20), nullable=False, default="medium")
    status = Column(String(20), nullable=False, default="configuring")
    
    total_questions = Column(Integer, nullable=False, default=10)
    questions_answered = Column(Integer, default=0)
    time_limit_minutes = Column(Integer, nullable=True)
    actual_duration_seconds = Column(Integer, nullable=True)
    
    scheduled_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f"<InterviewSession(id={self.id}, status={self.status})>"


class InterviewQuestion(Base):
    """
    Interview Question model - Stores generated questions per session.
    """
    
    __tablename__ = "interview_questions"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), nullable=False, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    
    question_order = Column(Integer, nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(20), nullable=False)
    category = Column(String(100), nullable=True)
    difficulty = Column(String(20), nullable=False)
    
    expected_topics = Column(JSON, nullable=True)
    max_score = Column(Integer, default=10)
    time_limit_seconds = Column(Integer, nullable=True)
    
    is_follow_up = Column(Boolean, default=False)
    parent_question_id = Column(String(36), nullable=True)
    generated_by = Column(String(20), nullable=False, default="gemini")  # gemini or groq
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f"<InterviewQuestion(id={self.id}, order={self.question_order})>"


class InterviewAnswer(Base):
    """
    Interview Answer model - Stores user responses to interview questions.
    """
    
    __tablename__ = "interview_answers"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    question_id = Column(String(36), unique=True, nullable=False)
    session_id = Column(String(36), nullable=False, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    
    answer_text = Column(Text, nullable=False)
    word_count = Column(Integer, nullable=False)
    response_time_seconds = Column(Integer, nullable=True)
    
    is_skipped = Column(Boolean, default=False)
    submitted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f"<InterviewAnswer(question_id={self.question_id})>"


# Note: AnswerEvaluation, InterviewScore, and InterviewReport models
# are defined in their respective modules:
# - app.evaluations.models.AnswerEvaluation
# - app.reports.models.InterviewReport
