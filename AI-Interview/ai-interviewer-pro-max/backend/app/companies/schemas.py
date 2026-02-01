"""
Company Mode Schemas

Pydantic schemas for company mode API.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class DifficultyBiasSchema(BaseModel):
    """Difficulty distribution."""
    easy: float
    medium: float
    hard: float


class QuestionMixSchema(BaseModel):
    """Question type mix."""
    technical: float
    behavioral: float
    situational: float
    system_design: float
    coding: float


class PhaseSchema(BaseModel):
    """Interview phase."""
    name: str
    duration_minutes: int
    focus: List[str]
    question_count: int


class CompanyProfileSchema(BaseModel):
    """Full company profile."""
    id: str
    name: str
    type: str
    description: str
    focus_areas: List[str]
    key_traits: List[str]
    interview_style: str
    difficulty_bias: DifficultyBiasSchema
    question_mix: QuestionMixSchema
    phases: List[PhaseSchema]
    total_questions: int
    estimated_duration_minutes: int
    behavioral_weight: float
    technical_depth: str
    system_design_required: bool
    coding_round_required: bool
    culture_fit_emphasis: bool
    interviewer_style: str
    follow_up_likelihood: float
    disclaimer: str


class CompanySummarySchema(BaseModel):
    """Company profile summary for list."""
    id: str
    name: str
    type: str
    description: str
    focus_areas: List[str]
    difficulty: str
    total_questions: int
    duration_minutes: int
    interview_style: str


class GetModesResponse(BaseModel):
    """Response for list company modes."""
    success: bool = True
    modes: List[CompanySummarySchema]
    disclaimer: str = Field(
        default="These are simulated interview patterns based on general industry knowledge. They do not represent actual company interview processes.",
    )


class GetModeResponse(BaseModel):
    """Response for single company mode."""
    success: bool = True
    mode: CompanyProfileSchema


class ErrorResponse(BaseModel):
    """Error response."""
    success: bool = False
    message: str
