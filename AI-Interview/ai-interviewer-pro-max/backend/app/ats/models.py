"""
ATS Analysis Models

SQLAlchemy models for storing ATS analysis results.
Results are linked to users and resumes.
"""

from sqlalchemy import Column, String, Text, Integer, Float, DateTime, JSON, ForeignKey
from datetime import datetime
import uuid

from app.db.base import Base


class ATSAnalysis(Base):
    """
    ATS Analysis Result model.
    
    Stores the results of ATS scoring and resume analysis.
    Per MASTER CONSTRAINTS:
    - Results are user-scoped
    - Historical attempts are preserved
    - Reusable for interview planning
    """
    
    __tablename__ = "ats_analyses"
    
    # Primary key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # User and Resume relationships
    user_id = Column(String(36), nullable=False, index=True)
    resume_id = Column(String(36), nullable=False, index=True)
    
    # Target job role
    target_role = Column(String(200), nullable=False)
    target_role_description = Column(Text, nullable=True)
    
    # ===========================================
    # ATS SCORES (0-100)
    # ===========================================
    
    overall_score = Column(Integer, nullable=False, default=0)
    
    # Score breakdown
    keyword_match_score = Column(Integer, default=0)
    skills_coverage_score = Column(Integer, default=0)
    experience_alignment_score = Column(Integer, default=0)
    education_fit_score = Column(Integer, default=0)
    format_quality_score = Column(Integer, default=0)
    
    # ===========================================
    # EXTRACTED INSIGHTS
    # ===========================================
    
    # Skills (normalized list)
    skills_extracted = Column(JSON, default=list)  # [{name, category, proficiency}]
    
    # Matched and missing keywords
    matched_keywords = Column(JSON, default=list)  # [str]
    missing_keywords = Column(JSON, default=list)  # [str]
    
    # Strength and weakness areas
    strength_areas = Column(JSON, default=list)  # [{area, description}]
    weak_areas = Column(JSON, default=list)  # [{area, description, suggestion}]
    
    # Recommendations
    recommendations = Column(JSON, default=list)  # [{area, suggestion, impact}]
    
    # Human-readable summary
    summary = Column(Text, nullable=True)
    
    # ===========================================
    # RAW ANALYSIS DATA
    # ===========================================
    
    # Full analysis result (for debugging and future use)
    raw_analysis = Column(JSON, nullable=True)
    
    # ===========================================
    # METADATA
    # ===========================================
    
    # Analysis source
    analysis_source = Column(String(50), default="mock")  # mock or gemini
    analysis_model = Column(String(100), nullable=True)  # model version used
    
    # Processing time
    processing_time_ms = Column(Integer, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f"<ATSAnalysis(id={self.id}, resume_id={self.resume_id}, score={self.overall_score})>"
    
    def to_dict(self) -> dict:
        """Convert to dictionary for API response."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "resume_id": self.resume_id,
            "target_role": self.target_role,
            "overall_score": self.overall_score,
            "breakdown": {
                "keyword_match": self.keyword_match_score,
                "skills_coverage": self.skills_coverage_score,
                "experience_alignment": self.experience_alignment_score,
                "education_fit": self.education_fit_score,
                "format_quality": self.format_quality_score,
            },
            "skills_extracted": self.skills_extracted or [],
            "matched_keywords": self.matched_keywords or [],
            "missing_keywords": self.missing_keywords or [],
            "strength_areas": self.strength_areas or [],
            "weak_areas": self.weak_areas or [],
            "recommendations": self.recommendations or [],
            "summary": self.summary,
            "analysis_source": self.analysis_source,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
    
    def to_summary_dict(self) -> dict:
        """Convert to summary dictionary (lighter version)."""
        return {
            "id": self.id,
            "resume_id": self.resume_id,
            "target_role": self.target_role,
            "overall_score": self.overall_score,
            "analysis_source": self.analysis_source,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
