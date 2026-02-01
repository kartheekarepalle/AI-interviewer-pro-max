"""
ATS Schemas

Pydantic models for ATS analysis request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ===========================================
# NESTED SCHEMAS
# ===========================================


class SkillInfo(BaseModel):
    """Schema for extracted skill information."""
    name: str = Field(..., description="Skill name")
    category: str = Field(default="general", description="Skill category")
    proficiency: str = Field(default="intermediate", description="Proficiency level")


class StrengthArea(BaseModel):
    """Schema for strength areas."""
    area: str = Field(..., description="Area name")
    description: str = Field(..., description="Why this is a strength")


class WeakArea(BaseModel):
    """Schema for weak/missing areas."""
    area: str = Field(..., description="Area name")
    description: str = Field(..., description="Why this needs improvement")
    suggestion: Optional[str] = Field(None, description="How to improve")


class Recommendation(BaseModel):
    """Schema for improvement recommendations."""
    area: str = Field(..., description="Area to improve")
    suggestion: str = Field(..., description="Specific suggestion")
    impact: str = Field(default="medium", description="Impact level")


class ScoreBreakdown(BaseModel):
    """Schema for score breakdown."""
    keyword_match: int = Field(..., ge=0, le=100)
    skills_coverage: int = Field(..., ge=0, le=100)
    experience_alignment: int = Field(..., ge=0, le=100)
    education_fit: int = Field(..., ge=0, le=100)
    format_quality: int = Field(..., ge=0, le=100)


# ===========================================
# REQUEST SCHEMAS
# ===========================================


class ATSAnalyzeRequest(BaseModel):
    """Schema for ATS analysis request."""
    target_role: str = Field(
        ..., 
        min_length=2, 
        max_length=200,
        description="Target job role for analysis"
    )
    target_role_description: Optional[str] = Field(
        None,
        max_length=2000,
        description="Optional job description for better matching"
    )


# ===========================================
# RESPONSE SCHEMAS
# ===========================================


class ATSResultResponse(BaseModel):
    """Schema for ATS analysis result."""
    id: str = Field(..., description="Analysis ID")
    user_id: str = Field(..., description="Owner user ID")
    resume_id: str = Field(..., description="Analyzed resume ID")
    target_role: str = Field(..., description="Target role")
    
    # Scores
    overall_score: int = Field(..., ge=0, le=100, description="Overall ATS score")
    breakdown: ScoreBreakdown = Field(..., description="Score breakdown")
    
    # Extracted data
    skills_extracted: List[SkillInfo] = Field(default=[], description="Extracted skills")
    matched_keywords: List[str] = Field(default=[], description="Matched keywords")
    missing_keywords: List[str] = Field(default=[], description="Missing keywords")
    
    # Insights
    strength_areas: List[StrengthArea] = Field(default=[], description="Strength areas")
    weak_areas: List[WeakArea] = Field(default=[], description="Weak areas")
    recommendations: List[Recommendation] = Field(default=[], description="Recommendations")
    
    # Summary
    summary: Optional[str] = Field(None, description="Human-readable summary")
    
    # Metadata
    analysis_source: str = Field(default="mock", description="Analysis source")
    created_at: Optional[str] = Field(None, description="Analysis timestamp")


class ATSSummaryResponse(BaseModel):
    """Schema for brief ATS result summary."""
    id: str
    resume_id: str
    target_role: str
    overall_score: int
    analysis_source: str
    created_at: Optional[str]


class ATSAnalyzeResponse(BaseModel):
    """Schema for analysis trigger response."""
    success: bool = Field(default=True)
    message: str = Field(..., description="Response message")
    result: Optional[ATSResultResponse] = Field(None, description="Analysis result")


class ATSGetResponse(BaseModel):
    """Schema for getting analysis result."""
    success: bool = Field(default=True)
    result: Optional[ATSResultResponse] = Field(None, description="Analysis result")


class ATSListResponse(BaseModel):
    """Schema for listing analysis history."""
    success: bool = Field(default=True)
    results: List[ATSSummaryResponse] = Field(default=[], description="Analysis history")
    total: int = Field(default=0, description="Total count")


class ATSErrorResponse(BaseModel):
    """Schema for error responses."""
    success: bool = Field(default=False)
    message: str = Field(..., description="Error message")
