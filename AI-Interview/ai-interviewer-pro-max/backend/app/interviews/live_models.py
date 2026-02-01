"""
Live Interview Session Models

SQLAlchemy models for live interview session tracking.
Stores interview state, questions asked, and answers received.
"""

from sqlalchemy import Column, String, Text, Integer, DateTime, JSON, Boolean
from datetime import datetime
import uuid

from app.db.base import Base


class LiveInterviewSession(Base):
    """
    Live Interview Session model.
    
    Tracks the state of an active interview including:
    - Current question index
    - Asked questions history
    - User answers
    - Interview state (in_progress, paused, completed)
    """
    
    __tablename__ = "live_interview_sessions"
    
    # Primary key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # User and plan relationships
    user_id = Column(String(36), nullable=False, index=True)
    plan_id = Column(String(36), nullable=False, index=True)
    resume_id = Column(String(36), nullable=False, index=True)
    
    # Interview configuration
    target_role = Column(String(200), nullable=False)
    session_type = Column(String(50), default="mixed")
    difficulty_level = Column(String(20), default="medium")
    interviewer_persona = Column(String(50), default="professional")  # professional, friendly, stress
    
    # Progress tracking
    total_questions = Column(Integer, default=10)
    current_question_index = Column(Integer, default=0)
    questions_answered = Column(Integer, default=0)
    questions_skipped = Column(Integer, default=0)
    
    # State machine
    status = Column(String(20), default="ready")  # ready, in_progress, paused, completing, completed, abandoned
    
    # Timestamps
    started_at = Column(DateTime, nullable=True)
    last_activity_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Duration tracking
    total_duration_seconds = Column(Integer, default=0)
    pause_start_at = Column(DateTime, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f"<LiveInterviewSession(id={self.id}, status={self.status})>"
    
    def to_dict(self) -> dict:
        """Convert to dictionary for API response."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "plan_id": self.plan_id,
            "resume_id": self.resume_id,
            "target_role": self.target_role,
            "session_type": self.session_type,
            "difficulty_level": self.difficulty_level,
            "interviewer_persona": self.interviewer_persona,
            "total_questions": self.total_questions,
            "current_question_index": self.current_question_index,
            "questions_answered": self.questions_answered,
            "questions_skipped": self.questions_skipped,
            "status": self.status,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "last_activity_at": self.last_activity_at.isoformat() if self.last_activity_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "total_duration_seconds": self.total_duration_seconds,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class InterviewMessage(Base):
    """
    Interview Message model.
    
    Stores chat-style messages between interviewer and candidate.
    Used for display in the chat UI.
    """
    
    __tablename__ = "interview_messages"
    
    # Primary key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Session relationship
    session_id = Column(String(36), nullable=False, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    
    # Message content
    role = Column(String(20), nullable=False)  # interviewer, candidate, system
    content = Column(Text, nullable=False)
    
    # Message metadata
    message_type = Column(String(30), default="message")  # message, question, answer, acknowledgment, transition
    question_id = Column(String(36), nullable=True)  # Links to plan question if applicable
    question_index = Column(Integer, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f"<InterviewMessage(id={self.id}, role={self.role})>"
    
    def to_dict(self) -> dict:
        """Convert to dictionary for API response."""
        return {
            "id": self.id,
            "session_id": self.session_id,
            "role": self.role,
            "content": self.content,
            "message_type": self.message_type,
            "question_id": self.question_id,
            "question_index": self.question_index,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class InterviewAnswer(Base):
    """
    Interview Answer model.
    
    Stores user's answers to interview questions.
    """
    
    __tablename__ = "interview_answers_live"
    
    # Primary key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Relationships
    session_id = Column(String(36), nullable=False, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    question_id = Column(String(36), nullable=False)
    message_id = Column(String(36), nullable=True)  # Link to message
    
    # Answer content
    answer_text = Column(Text, nullable=False)
    word_count = Column(Integer, default=0)
    
    # Response time
    response_time_seconds = Column(Integer, nullable=True)
    
    # Status
    is_skipped = Column(Boolean, default=False)
    
    # Quick evaluation (by Groq)
    quick_eval_relevance = Column(Integer, nullable=True)  # 0-10
    quick_eval_complete = Column(Boolean, nullable=True)
    quick_eval_flags = Column(JSON, nullable=True)  # ["too_short", "off_topic", etc.]
    
    # Timestamps
    submitted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f"<InterviewAnswer(id={self.id}, question_id={self.question_id})>"
    
    def to_dict(self) -> dict:
        """Convert to dictionary for API response."""
        return {
            "id": self.id,
            "session_id": self.session_id,
            "question_id": self.question_id,
            "answer_text": self.answer_text,
            "word_count": self.word_count,
            "response_time_seconds": self.response_time_seconds,
            "is_skipped": self.is_skipped,
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
        }
