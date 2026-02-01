"""
Interview Report Models

SQLAlchemy models for storing final interview reports.
Reports are IMMUTABLE after generation.
"""

from sqlalchemy import Column, String, Text, Integer, Float, DateTime, JSON, Boolean
from datetime import datetime
import uuid

from app.db.base import Base


class InterviewReport(Base):
    """
    Final Interview Report model.
    
    Contains:
    - Overall readiness score (0-100)
    - Skill-wise breakdown
    - Strengths and weaknesses
    - Behavioral insights (text-inferred)
    - Improvement suggestions
    
    Reports are IMMUTABLE after generation.
    """
    
    __tablename__ = "interview_reports"
    
    # Primary key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Relationships
    user_id = Column(String(36), nullable=False, index=True)
    session_id = Column(String(36), nullable=False, unique=True, index=True)
    plan_id = Column(String(36), nullable=True, index=True)
    
    # ===========================================
    # INTERVIEW CONTEXT
    # ===========================================
    
    target_role = Column(String(200), nullable=True)
    company_name = Column(String(200), nullable=True)
    interview_type = Column(String(50), nullable=True)  # technical, behavioral, hr, mixed
    
    # ===========================================
    # READINESS SCORE (0-100)
    # ===========================================
    
    readiness_score = Column(Integer, nullable=False, default=0)
    readiness_grade = Column(String(10), nullable=True)  # A+, A, B+, B, C+, C, D, F
    readiness_level = Column(String(20), nullable=True)  # excellent, good, average, needs_work
    
    # Score breakdown
    score_breakdown = Column(JSON, nullable=True)
    # e.g., {"technical": 75, "communication": 80, "problem_solving": 70, "behavioral": 85}
    
    # Score explanation
    score_explanation = Column(Text, nullable=True)
    
    # ===========================================
    # SKILL-WISE BREAKDOWN
    # ===========================================
    
    skill_scores = Column(JSON, nullable=True)
    # e.g., [{"skill": "Python", "score": 8.5, "level": "proficient", "notes": "..."}]
    
    category_scores = Column(JSON, nullable=True)
    # e.g., {"technical": 7.5, "behavioral": 8.0, "situational": 7.0}
    
    # ===========================================
    # STRENGTHS & WEAKNESSES
    # ===========================================
    
    strengths = Column(JSON, nullable=True)
    # e.g., [{"area": "Problem Solving", "description": "...", "evidence": "..."}]
    
    weaknesses = Column(JSON, nullable=True)
    # e.g., [{"area": "System Design", "description": "...", "suggestion": "..."}]
    
    # ===========================================
    # BEHAVIORAL INSIGHTS (Text-inferred)
    # ===========================================
    
    behavioral_summary = Column(Text, nullable=True)
    emotional_pattern = Column(String(50), nullable=True)  # calm, nervous, confident, uncertain
    confidence_trend = Column(String(20), nullable=True)  # improving, stable, declining
    communication_style = Column(String(50), nullable=True)
    
    # ===========================================
    # IMPROVEMENT SUGGESTIONS
    # ===========================================
    
    improvement_areas = Column(JSON, nullable=True)
    # e.g., [{"area": "...", "priority": "high", "action": "...", "resources": [...]}]
    
    recommended_topics = Column(JSON, nullable=True)
    # Topics to study before real interview
    
    practice_suggestions = Column(JSON, nullable=True)
    # Specific practice recommendations
    
    topics_to_study = Column(JSON, nullable=True)
    # Specific topics from failed questions (detailed list with scores)
    
    # ===========================================
    # INTERVIEW STATISTICS
    # ===========================================
    
    total_questions = Column(Integer, default=0)
    questions_answered = Column(Integer, default=0)
    questions_skipped = Column(Integer, default=0)
    
    avg_response_time = Column(Float, nullable=True)
    total_duration_minutes = Column(Integer, nullable=True)
    
    # ===========================================
    # EXECUTIVE SUMMARY
    # ===========================================
    
    executive_summary = Column(Text, nullable=True)
    recommendation = Column(Text, nullable=True)  # Final hiring recommendation
    
    # ===========================================
    # METADATA
    # ===========================================
    
    generated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)  # For analytics queries
    generation_source = Column(String(20), default="mock")  # gemini or mock
    is_finalized = Column(Boolean, default=True)  # Reports are immutable
    
    # Disclaimer
    disclaimer = Column(Text, default="This report is based on a simulated interview and text-based analysis. Behavioral insights are inferred from language patterns only, not real emotion detection.")
    
    # Alias for overall_score to support analytics queries
    @property
    def overall_score(self):
        """Alias for readiness_score to support analytics queries."""
        return self.readiness_score
    
    def __repr__(self):
        return f"<InterviewReport(id={self.id}, score={self.readiness_score})>"
    
    def get_grade(self) -> str:
        """Get letter grade from score."""
        if self.readiness_score >= 95:
            return "A+"
        elif self.readiness_score >= 90:
            return "A"
        elif self.readiness_score >= 85:
            return "B+"
        elif self.readiness_score >= 80:
            return "B"
        elif self.readiness_score >= 75:
            return "C+"
        elif self.readiness_score >= 70:
            return "C"
        elif self.readiness_score >= 60:
            return "D"
        else:
            return "F"
    
    def get_level(self) -> str:
        """Get readiness level from score."""
        if self.readiness_score >= 85:
            return "excellent"
        elif self.readiness_score >= 70:
            return "good"
        elif self.readiness_score >= 55:
            return "average"
        else:
            return "needs_work"
    
    def to_dict(self) -> dict:
        """
        Convert to dictionary.
        
        Includes defensive clamping of readiness_score to 0-100.
        """
        # DEFENSIVE: Ensure score is always 0-100 (safety net)
        safe_score = max(0, min(100, self.readiness_score or 0))
        
        return {
            "id": self.id,
            "session_id": self.session_id,
            "target_role": self.target_role,
            "company_name": self.company_name,
            "interview_type": self.interview_type,
            "readiness": {
                "score": safe_score,  # Clamped
                "grade": self.readiness_grade or self.get_grade(),
                "level": self.readiness_level or self.get_level(),
                "breakdown": self.score_breakdown or {},
                "explanation": self.score_explanation,
            },
            "skills": {
                "scores": self.skill_scores or [],
                "categories": self.category_scores or {},
            },
            "strengths": self.strengths or [],
            "weaknesses": self.weaknesses or [],
            "behavioral": {
                "summary": self.behavioral_summary,
                "emotional_pattern": self.emotional_pattern,
                "confidence_trend": self.confidence_trend,
                "communication_style": self.communication_style,
            },
            "improvements": {
                "areas": self.improvement_areas or [],
                "topics": self.recommended_topics or [],
                "practice": self.practice_suggestions or [],
                "topics_to_study": self.topics_to_study or [],
            },
            "statistics": {
                "total_questions": self.total_questions,
                "answered": self.questions_answered,
                "skipped": self.questions_skipped,
                "avg_response_time": self.avg_response_time,
                "duration_minutes": self.total_duration_minutes,
            },
            "executive_summary": self.executive_summary,
            "recommendation": self.recommendation,
            "generated_at": self.generated_at.isoformat() if self.generated_at else None,
            "source": self.generation_source,
            "disclaimer": self.disclaimer,
        }
