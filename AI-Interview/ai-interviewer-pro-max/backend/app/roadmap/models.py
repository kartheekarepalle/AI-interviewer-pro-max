"""
Career Roadmap Models

SQLAlchemy models for storing personalized career roadmaps.
Roadmaps are versioned to allow regeneration.
"""

from sqlalchemy import Column, String, Text, Integer, Float, DateTime, JSON, Boolean
from datetime import datetime
import uuid

from app.db.base import Base


class CareerRoadmap(Base):
    """
    Career Roadmap model.
    
    Contains personalized career guidance:
    - Skill gaps to address
    - Learning topics (ordered)
    - Recommended projects
    - Practice strategy
    - Timeline with milestones
    
    Roadmaps are versioned to allow regeneration.
    """
    
    __tablename__ = "career_roadmaps"
    
    # Primary key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Relationships
    user_id = Column(String(36), nullable=False, index=True)
    session_id = Column(String(36), nullable=True, index=True)
    report_id = Column(String(36), nullable=True, index=True)
    
    # Versioning
    version = Column(Integer, default=1, nullable=False)
    is_active = Column(Boolean, default=True)  # Only one active per session
    
    # ===========================================
    # CONTEXT
    # ===========================================
    
    target_role = Column(String(200), nullable=False)
    current_level = Column(String(50), nullable=True)  # junior, mid, senior, etc.
    target_level = Column(String(50), nullable=True)
    
    readiness_score = Column(Integer, nullable=True)  # From interview report
    
    # ===========================================
    # SKILL GAPS
    # ===========================================
    
    skill_gaps = Column(JSON, nullable=True)
    # e.g., [{"skill": "System Design", "current_level": "basic", "target_level": "advanced", "priority": "high"}]
    
    missing_skills = Column(JSON, nullable=True)
    # Skills to learn from scratch
    
    skills_to_improve = Column(JSON, nullable=True)
    # Existing skills that need strengthening
    
    # ===========================================
    # LEARNING PATH
    # ===========================================
    
    learning_topics = Column(JSON, nullable=True)
    # e.g., [{"topic": "...", "description": "...", "duration_weeks": 2, "resources": [...], "order": 1}]
    
    recommended_courses = Column(JSON, nullable=True)
    # General course suggestions (no specific URLs required)
    
    books_to_read = Column(JSON, nullable=True)
    
    # ===========================================
    # PROJECT RECOMMENDATIONS
    # ===========================================
    
    recommended_projects = Column(JSON, nullable=True)
    # e.g., [{"title": "...", "description": "...", "skills_covered": [...], "difficulty": "medium", "duration_weeks": 3}]
    
    portfolio_suggestions = Column(JSON, nullable=True)
    
    # ===========================================
    # PRACTICE STRATEGY
    # ===========================================
    
    practice_strategy = Column(JSON, nullable=True)
    # e.g., {"daily_routine": "...", "weekly_goals": [...], "mock_interview_frequency": "weekly"}
    
    interview_tips = Column(JSON, nullable=True)
    # Specific tips based on weaknesses
    
    behavioral_practice = Column(JSON, nullable=True)
    # STAR method practice suggestions
    
    # ===========================================
    # TIMELINE
    # ===========================================
    
    total_duration_weeks = Column(Integer, nullable=True)
    
    milestones = Column(JSON, nullable=True)
    # e.g., [{"week": 2, "milestone": "Complete DS basics", "deliverables": [...]}]
    
    phases = Column(JSON, nullable=True)
    # e.g., [{"phase": 1, "name": "Foundation", "weeks": "1-4", "focus": [...]}]
    
    # ===========================================
    # SUMMARY
    # ===========================================
    
    executive_summary = Column(Text, nullable=True)
    key_actions = Column(JSON, nullable=True)  # Top 3-5 immediate actions
    success_metrics = Column(JSON, nullable=True)  # How to measure progress
    
    # ===========================================
    # METADATA
    # ===========================================
    
    generated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    generation_source = Column(String(20), default="mock")  # gemini or mock
    
    # Disclaimer
    disclaimer = Column(Text, default="This roadmap is AI-generated guidance based on your interview performance. Results may vary. No job guarantee is implied.")
    
    def __repr__(self):
        return f"<CareerRoadmap(id={self.id}, role={self.target_role}, v={self.version})>"
    
    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "session_id": self.session_id,
            "version": self.version,
            "is_active": self.is_active,
            "context": {
                "target_role": self.target_role,
                "current_level": self.current_level,
                "target_level": self.target_level,
                "readiness_score": self.readiness_score,
            },
            "skill_gaps": {
                "gaps": self.skill_gaps or [],
                "missing": self.missing_skills or [],
                "to_improve": self.skills_to_improve or [],
            },
            "learning": {
                "topics": self.learning_topics or [],
                "courses": self.recommended_courses or [],
                "books": self.books_to_read or [],
            },
            "projects": {
                "recommended": self.recommended_projects or [],
                "portfolio": self.portfolio_suggestions or [],
            },
            "practice": {
                "strategy": self.practice_strategy or {},
                "interview_tips": self.interview_tips or [],
                "behavioral": self.behavioral_practice or [],
            },
            "timeline": {
                "total_weeks": self.total_duration_weeks,
                "milestones": self.milestones or [],
                "phases": self.phases or [],
            },
            "summary": {
                "executive": self.executive_summary,
                "key_actions": self.key_actions or [],
                "success_metrics": self.success_metrics or [],
            },
            "generated_at": self.generated_at.isoformat() if self.generated_at else None,
            "source": self.generation_source,
            "disclaimer": self.disclaimer,
        }
