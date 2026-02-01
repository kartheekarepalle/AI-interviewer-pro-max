"""
Interview Plan Schemas

Pydantic models for interview plan request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ===========================================
# NESTED SCHEMAS
# ===========================================


class QuestionBreakdown(BaseModel):
    """Schema for question breakdown by category."""
    dsa: int = Field(default=0, ge=0)  # DSA/Algorithm questions
    technical: int = Field(default=0, ge=0)
    behavioral: int = Field(default=0, ge=0)
    hr: int = Field(default=0, ge=0)
    situational: int = Field(default=0, ge=0)


class QuestionCategory(BaseModel):
    """Schema for a question category in the plan."""
    category: str = Field(..., description="Category name")
    count: int = Field(..., ge=0, description="Number of questions")
    difficulty: str = Field(default="medium", description="Difficulty level")
    focus_area: Optional[str] = Field(None, description="Focus area")
    rationale: Optional[str] = Field(None, description="Why this category")


class FocusArea(BaseModel):
    """Schema for focus area (strength or weakness)."""
    area: str = Field(..., description="Area name")
    reason: str = Field(..., description="Why focus on this")
    question_count: int = Field(default=1, ge=0, description="Questions for this area")


class PlannedQuestion(BaseModel):
    """Schema for a planned question."""
    id: str = Field(..., description="Question ID")
    text: str = Field(..., description="Question text")
    type: str = Field(..., description="Question type")
    category: str = Field(..., description="Question category")
    difficulty: str = Field(default="medium", description="Difficulty level")
    time_limit_seconds: int = Field(default=180, description="Time limit")
    expected_topics: List[str] = Field(default=[], description="Expected topics in answer")
    scoring_rubric: Optional[Dict[str, Any]] = Field(None, description="Scoring criteria")


# ===========================================
# REQUEST SCHEMAS
# ===========================================


class RoundConfig(BaseModel):
    """Schema for per-round question configuration."""
    dsa_questions: int = Field(default=2, ge=0, le=10, description="DSA questions count")
    technical_questions: int = Field(default=4, ge=0, le=10, description="Technical questions count")
    behavioral_questions: int = Field(default=2, ge=0, le=10, description="Behavioral questions count")
    hr_questions: int = Field(default=2, ge=0, le=10, description="HR questions count")


class PlanGenerateRequest(BaseModel):
    """Schema for generating an interview plan."""
    target_role: str = Field(
        ..., 
        min_length=2, 
        max_length=200,
        description="Target job role"
    )
    target_role_description: Optional[str] = Field(
        None,
        max_length=2000,
        description="Optional job description"
    )
    session_type: str = Field(
        default="mixed",
        description="Interview type: technical, behavioral, mixed, hr"
    )
    difficulty_level: str = Field(
        default="medium",
        description="Difficulty: easy, medium, hard, expert"
    )
    question_count: int = Field(
        default=10,
        ge=3,
        le=40,
        description="Number of questions (3-40)"
    )
    company_mode: Optional[str] = Field(
        None,
        description="Company mode: faang, startup, service, product, custom"
    )
    # NEW: Per-round question configuration
    round_config: Optional[RoundConfig] = Field(
        None,
        description="Optional per-round question configuration"
    )
    # NEW: Interviewer persona mode
    persona: Optional[str] = Field(
        None,
        description="Interviewer persona: strict, stress, friendly, neutral. Strict/stress modes generate more challenging questions."
    )


# ===========================================
# RESPONSE SCHEMAS
# ===========================================


class PlanResponse(BaseModel):
    """Schema for interview plan response."""
    id: str = Field(..., description="Plan ID")
    user_id: str = Field(..., description="Owner user ID")
    resume_id: str = Field(..., description="Resume ID")
    ats_analysis_id: Optional[str] = Field(None, description="ATS analysis ID")
    
    target_role: str = Field(..., description="Target role")
    session_type: str = Field(..., description="Session type")
    difficulty_level: str = Field(..., description="Difficulty level")
    total_questions: int = Field(..., description="Total questions")
    estimated_duration_minutes: int = Field(..., description="Estimated duration")
    
    breakdown: QuestionBreakdown = Field(..., description="Question breakdown")
    question_categories: List[QuestionCategory] = Field(default=[], description="Categories")
    
    strength_focus_areas: List[FocusArea] = Field(default=[], description="Strengths to probe")
    weakness_focus_areas: List[FocusArea] = Field(default=[], description="Gaps to test")
    skills_to_test: List[str] = Field(default=[], description="Skills to test")
    
    summary: Optional[str] = Field(None, description="Plan summary")
    rationale: Optional[str] = Field(None, description="Plan rationale")
    
    company_mode: Optional[str] = Field(None, description="Company interview mode")
    company_info: Optional[Dict[str, Any]] = Field(None, description="Company mode details")
    
    generation_source: str = Field(default="mock", description="Generation source")
    status: str = Field(default="ready", description="Plan status")
    is_used: bool = Field(default=False, description="Whether plan is used")
    
    created_at: Optional[str] = Field(None, description="Creation timestamp")


class PlanPreviewResponse(BaseModel):
    """Schema for plan preview (lighter)."""
    id: str
    target_role: str = ""
    session_type: str = "mixed"
    difficulty_level: str = "medium"
    total_questions: int = 10
    estimated_duration_minutes: int = 30
    breakdown: QuestionBreakdown = Field(default_factory=QuestionBreakdown)
    summary: Optional[str] = ""
    company_mode: Optional[str] = None
    company_info: Optional[Dict[str, Any]] = None
    status: str = "draft"
    is_used: bool = False  # Added to match to_preview_dict
    created_at: Optional[str] = None


class PlanGenerateResponse(BaseModel):
    """Schema for plan generation response."""
    success: bool = Field(default=True)
    message: str = Field(..., description="Response message")
    plan: Optional[PlanResponse] = Field(None, description="Generated plan")


class PlanGetResponse(BaseModel):
    """Schema for getting a plan."""
    success: bool = Field(default=True)
    plan: Optional[PlanResponse] = Field(None, description="Plan data")


class PlanListResponse(BaseModel):
    """Schema for listing plans."""
    success: bool = Field(default=True)
    plans: List[PlanPreviewResponse] = Field(default=[], description="Plans list")
    total: int = Field(default=0, description="Total count")


class PlanQuestionsResponse(BaseModel):
    """Schema for getting plan questions."""
    success: bool = Field(default=True)
    questions: List[PlannedQuestion] = Field(default=[], description="Questions")
    total: int = Field(default=0, description="Total count")


class PlanErrorResponse(BaseModel):
    """Schema for error responses."""
    success: bool = Field(default=False)
    message: str = Field(..., description="Error message")
