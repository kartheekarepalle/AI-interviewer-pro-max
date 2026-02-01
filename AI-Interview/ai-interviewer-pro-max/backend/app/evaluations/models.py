"""
Answer Evaluation Models

SQLAlchemy models for storing answer evaluation scores.
Two-layer evaluation: Quick (Groq) and Deep (Gemini).
"""

from sqlalchemy import Column, String, Text, Integer, Float, DateTime, JSON, Boolean
from datetime import datetime
import uuid

from app.db.base import Base


class AnswerEvaluation(Base):
    """
    Answer Evaluation model.
    
    Stores both quick (Groq) and deep (Gemini) evaluation scores.
    Per requirements:
    - Scores are immutable after finalization
    - User-scoped access only
    """
    
    __tablename__ = "answer_evaluations"
    
    # Primary key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Relationships
    user_id = Column(String(36), nullable=False, index=True)
    session_id = Column(String(36), nullable=False, index=True)
    question_id = Column(String(36), nullable=False, index=True)
    answer_id = Column(String(36), nullable=True, index=True)
    
    # Question context
    question_text = Column(Text, nullable=True)
    question_type = Column(String(50), nullable=True)  # technical, behavioral, hr, situational
    
    # Answer content
    answer_text = Column(Text, nullable=False)
    answer_word_count = Column(Integer, default=0)
    response_time_seconds = Column(Integer, nullable=True)
    
    # ===========================================
    # QUICK EVALUATION (Groq) - Layer 1
    # ===========================================
    
    quick_relevance_score = Column(Float, nullable=True)  # 0.0-10.0
    quick_is_off_topic = Column(Boolean, default=False)
    quick_is_too_short = Column(Boolean, default=False)
    quick_feedback = Column(Text, nullable=True)  # 1-2 line feedback
    quick_evaluated_at = Column(DateTime, nullable=True)
    quick_evaluation_source = Column(String(20), default="mock")  # groq or mock
    
    # ===========================================
    # DEEP EVALUATION (Gemini) - Layer 2
    # ===========================================
    
    # Core scores (0.0-10.0)
    deep_relevance_score = Column(Float, nullable=True)
    deep_depth_score = Column(Float, nullable=True)
    deep_clarity_score = Column(Float, nullable=True)
    deep_confidence_score = Column(Float, nullable=True)  # Inferred from text
    
    # Overall score (weighted average)
    deep_overall_score = Column(Float, nullable=True)
    
    # Score explanations
    deep_relevance_explanation = Column(Text, nullable=True)
    deep_depth_explanation = Column(Text, nullable=True)
    deep_clarity_explanation = Column(Text, nullable=True)
    deep_confidence_explanation = Column(Text, nullable=True)
    
    # Detailed analysis
    deep_strengths = Column(JSON, nullable=True)  # List of strengths
    deep_improvements = Column(JSON, nullable=True)  # List of improvements
    deep_key_points_covered = Column(JSON, nullable=True)  # Expected points that were covered
    deep_missing_points = Column(JSON, nullable=True)  # Expected points that were missed
    
    # Full feedback
    deep_feedback = Column(Text, nullable=True)
    deep_evaluated_at = Column(DateTime, nullable=True)
    deep_evaluation_source = Column(String(20), default="pending")  # gemini, mock, or pending
    
    # ===========================================
    # STATUS FLAGS
    # ===========================================
    
    is_quick_complete = Column(Boolean, default=False)
    is_deep_complete = Column(Boolean, default=False)
    is_finalized = Column(Boolean, default=False)  # Once finalized, scores are immutable
    
    evaluation_status = Column(String(20), default="pending")  # pending, partial, complete
    
    # ===========================================
    # METADATA
    # ===========================================
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f"<AnswerEvaluation(id={self.id}, question_id={self.question_id})>"
    
    def to_quick_dict(self) -> dict:
        """Get quick evaluation as dict."""
        return {
            "relevance_score": self.quick_relevance_score,
            "is_off_topic": self.quick_is_off_topic,
            "is_too_short": self.quick_is_too_short,
            "feedback": self.quick_feedback,
            "evaluated_at": self.quick_evaluated_at.isoformat() if self.quick_evaluated_at else None,
            "source": self.quick_evaluation_source,
        }
    
    def to_deep_dict(self) -> dict:
        """Get deep evaluation as dict."""
        return {
            "relevance_score": self.deep_relevance_score,
            "depth_score": self.deep_depth_score,
            "clarity_score": self.deep_clarity_score,
            "confidence_score": self.deep_confidence_score,
            "overall_score": self.deep_overall_score,
            "explanations": {
                "relevance": self.deep_relevance_explanation,
                "depth": self.deep_depth_explanation,
                "clarity": self.deep_clarity_explanation,
                "confidence": self.deep_confidence_explanation,
            },
            "strengths": self.deep_strengths or [],
            "improvements": self.deep_improvements or [],
            "key_points_covered": self.deep_key_points_covered or [],
            "missing_points": self.deep_missing_points or [],
            "feedback": self.deep_feedback,
            "evaluated_at": self.deep_evaluated_at.isoformat() if self.deep_evaluated_at else None,
            "source": self.deep_evaluation_source,
        }
    
    def to_dict(self) -> dict:
        """Convert to full dictionary."""
        return {
            "id": self.id,
            "session_id": self.session_id,
            "question_id": self.question_id,
            "answer_id": self.answer_id,
            "question_type": self.question_type,
            "answer_word_count": self.answer_word_count,
            "quick_evaluation": self.to_quick_dict(),
            "deep_evaluation": self.to_deep_dict(),
            "is_quick_complete": self.is_quick_complete,
            "is_deep_complete": self.is_deep_complete,
            "is_finalized": self.is_finalized,
            "status": self.evaluation_status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
