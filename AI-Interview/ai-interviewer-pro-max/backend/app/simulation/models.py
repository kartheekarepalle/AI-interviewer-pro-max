"""
Behavioral Simulation Models

SQLAlchemy models for storing simulated behavioral insights.
Text-based inference only - no real emotion detection.

IMPORTANT DISCLAIMER:
These are TEXT-BASED INFERENCES derived from language patterns,
NOT real emotion or sentiment detection.
"""

from sqlalchemy import Column, String, Text, Integer, Float, DateTime, JSON, Boolean
from datetime import datetime
import uuid

from app.db.base import Base


class AnswerBehavioralInsight(Base):
    """
    Behavioral insight for a single answer.
    
    Stores simulated emotional state, confidence level,
    and language pattern analysis derived from text only.
    
    DISCLAIMER: These are text-based inferences, not real emotion detection.
    """
    
    __tablename__ = "answer_behavioral_insights"
    
    # Primary key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Relationships
    user_id = Column(String(36), nullable=False, index=True)
    session_id = Column(String(36), nullable=False, index=True)
    question_id = Column(String(36), nullable=False, index=True)
    evaluation_id = Column(String(36), nullable=True, index=True)  # Links to AnswerEvaluation
    
    # ===========================================
    # SIMULATED EMOTIONAL STATE (Text-inferred)
    # ===========================================
    
    # Primary emotional state: calm, nervous, confident, uncertain
    emotional_state = Column(String(20), default="calm")
    emotional_confidence = Column(Float, default=0.5)  # How confident the inference is (0-1)
    
    # Contributing factors
    emotional_indicators = Column(JSON, nullable=True)
    # e.g., {"hesitation_markers": 2, "filler_words": 5, "assertive_phrases": 1}
    
    # ===========================================
    # SIMULATED CONFIDENCE LEVEL (Text-inferred)
    # ===========================================
    
    # Confidence level: high, moderate, low
    confidence_level = Column(String(20), default="moderate")
    confidence_score = Column(Float, default=0.5)  # 0-1 scale
    
    # Key indicators
    confidence_indicators = Column(JSON, nullable=True)
    # e.g., {"tentative_words": 3, "assertive_words": 8, "qualifiers": 2}
    
    # ===========================================
    # LANGUAGE PATTERN ANALYSIS
    # ===========================================
    
    # Word choice patterns
    filler_word_count = Column(Integer, default=0)
    hedging_word_count = Column(Integer, default=0)
    assertive_word_count = Column(Integer, default=0)
    
    # Structural patterns
    sentence_count = Column(Integer, default=0)
    avg_sentence_length = Column(Float, default=0.0)
    self_correction_count = Column(Integer, default=0)
    repetition_count = Column(Integer, default=0)
    
    # Complexity indicators
    vocabulary_diversity = Column(Float, default=0.0)  # Type-token ratio
    technical_term_count = Column(Integer, default=0)
    
    # ===========================================
    # BEHAVIORAL OBSERVATIONS
    # ===========================================
    
    # Key observations (text-based)
    observations = Column(JSON, nullable=True)
    # e.g., ["Uses specific examples", "Shows uncertainty about dates"]
    
    # Improvement suggestions (based on patterns)
    suggestions = Column(JSON, nullable=True)
    
    # ===========================================
    # METADATA
    # ===========================================
    
    analysis_source = Column(String(20), default="mock")  # gemini, groq, mock
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f"<AnswerBehavioralInsight(id={self.id}, state={self.emotional_state})>"
    
    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "session_id": self.session_id,
            "question_id": self.question_id,
            "emotional_state": {
                "state": self.emotional_state,
                "confidence": self.emotional_confidence,
                "indicators": self.emotional_indicators or {},
            },
            "confidence_level": {
                "level": self.confidence_level,
                "score": self.confidence_score,
                "indicators": self.confidence_indicators or {},
            },
            "language_patterns": {
                "filler_words": self.filler_word_count,
                "hedging_words": self.hedging_word_count,
                "assertive_words": self.assertive_word_count,
                "sentence_count": self.sentence_count,
                "avg_sentence_length": self.avg_sentence_length,
                "self_corrections": self.self_correction_count,
                "repetitions": self.repetition_count,
                "vocabulary_diversity": self.vocabulary_diversity,
                "technical_terms": self.technical_term_count,
            },
            "observations": self.observations or [],
            "suggestions": self.suggestions or [],
            "source": self.analysis_source,
            "disclaimer": "Text-based inference only. Not real emotion detection.",
        }


class SessionBehavioralSummary(Base):
    """
    Behavioral summary for an entire interview session.
    
    Aggregates behavioral patterns across all answers.
    Tracks improvement, consistency, and recurring patterns.
    
    DISCLAIMER: These are text-based inferences, not real emotion detection.
    """
    
    __tablename__ = "session_behavioral_summaries"
    
    # Primary key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Relationships
    user_id = Column(String(36), nullable=False, index=True)
    session_id = Column(String(36), nullable=False, unique=True, index=True)
    
    # ===========================================
    # OVERALL EMOTIONAL PATTERN
    # ===========================================
    
    # Dominant emotional state across session
    dominant_emotional_state = Column(String(20), default="calm")
    emotional_stability = Column(Float, default=0.5)  # How consistent (0-1)
    emotional_trajectory = Column(String(20), default="stable")  # improving, declining, stable
    
    # State distribution
    emotional_distribution = Column(JSON, nullable=True)
    # e.g., {"calm": 5, "nervous": 2, "confident": 3, "uncertain": 0}
    
    # ===========================================
    # OVERALL CONFIDENCE PATTERN
    # ===========================================
    
    # Average confidence across session
    avg_confidence_score = Column(Float, default=0.5)
    confidence_trajectory = Column(String(20), default="stable")  # improving, declining, stable
    
    # Confidence distribution
    confidence_distribution = Column(JSON, nullable=True)
    # e.g., {"high": 4, "moderate": 5, "low": 1}
    
    # ===========================================
    # BEHAVIORAL PATTERNS
    # ===========================================
    
    # Improvement tracking
    improvement_observed = Column(Boolean, default=False)
    improvement_areas = Column(JSON, nullable=True)
    # e.g., ["Answer length increased over time", "Fewer filler words in later answers"]
    
    # Recurring weaknesses
    recurring_weaknesses = Column(JSON, nullable=True)
    # e.g., ["Consistently uses hedging language", "Short answers on technical questions"]
    
    # Strengths
    consistent_strengths = Column(JSON, nullable=True)
    # e.g., ["Provides specific examples", "Clear structure in behavioral answers"]
    
    # ===========================================
    # SUMMARY STATISTICS
    # ===========================================
    
    total_answers_analyzed = Column(Integer, default=0)
    avg_answer_length = Column(Float, default=0.0)
    avg_filler_words = Column(Float, default=0.0)
    avg_vocabulary_diversity = Column(Float, default=0.0)
    
    # Response time patterns
    avg_response_time = Column(Float, nullable=True)
    response_time_trend = Column(String(20), nullable=True)  # faster, slower, consistent
    
    # ===========================================
    # NARRATIVE SUMMARY
    # ===========================================
    
    # AI-generated narrative for the report
    narrative_summary = Column(Text, nullable=True)
    
    # Key takeaways (bullet points)
    key_takeaways = Column(JSON, nullable=True)
    
    # ===========================================
    # METADATA
    # ===========================================
    
    analysis_source = Column(String(20), default="mock")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f"<SessionBehavioralSummary(id={self.id}, session={self.session_id})>"
    
    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "session_id": self.session_id,
            "emotional_pattern": {
                "dominant_state": self.dominant_emotional_state,
                "stability": self.emotional_stability,
                "trajectory": self.emotional_trajectory,
                "distribution": self.emotional_distribution or {},
            },
            "confidence_pattern": {
                "average_score": self.avg_confidence_score,
                "trajectory": self.confidence_trajectory,
                "distribution": self.confidence_distribution or {},
            },
            "behavioral_patterns": {
                "improvement_observed": self.improvement_observed,
                "improvement_areas": self.improvement_areas or [],
                "recurring_weaknesses": self.recurring_weaknesses or [],
                "consistent_strengths": self.consistent_strengths or [],
            },
            "statistics": {
                "total_answers": self.total_answers_analyzed,
                "avg_answer_length": self.avg_answer_length,
                "avg_filler_words": self.avg_filler_words,
                "avg_vocabulary_diversity": self.avg_vocabulary_diversity,
                "avg_response_time": self.avg_response_time,
                "response_time_trend": self.response_time_trend,
            },
            "narrative": self.narrative_summary,
            "key_takeaways": self.key_takeaways or [],
            "source": self.analysis_source,
            "disclaimer": "Text-based inference only. Not real emotion detection.",
        }
