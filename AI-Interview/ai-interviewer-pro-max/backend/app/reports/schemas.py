"""
Interview Report Schemas

Pydantic schemas for report request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ===========================================
# NESTED SCHEMAS
# ===========================================


class ReadinessSchema(BaseModel):
    """Schema for readiness score."""
    score: int = Field(..., ge=0, le=100, description="Readiness score 0-100")
    grade: str = Field(..., description="Letter grade (A+, A, B+, etc.)")
    level: str = Field(..., description="Level: excellent, good, average, needs_work")
    breakdown: Dict[str, float] = Field(default={}, description="Score breakdown by category")
    explanation: Optional[str] = Field(None, description="Score explanation")


class SkillScoreSchema(BaseModel):
    """Schema for individual skill score."""
    skill: str = Field(..., description="Skill name")
    score: float = Field(..., ge=0, le=10, description="Skill score 0-10")
    level: str = Field(..., description="Proficiency level")
    notes: Optional[str] = Field(None, description="Notes about this skill")


class SkillsSchema(BaseModel):
    """Schema for skills breakdown."""
    scores: List[SkillScoreSchema] = Field(default=[], description="Individual skill scores")
    categories: Dict[str, float] = Field(default={}, description="Category averages")


class StrengthSchema(BaseModel):
    """Schema for a strength."""
    area: str = Field(..., description="Strength area")
    description: str = Field(..., description="Description")
    evidence: Optional[str] = Field(None, description="Supporting evidence")


class WeaknessSchema(BaseModel):
    """Schema for a weakness."""
    area: str = Field(..., description="Weakness area")
    description: str = Field(..., description="Description")
    suggestion: Optional[str] = Field(None, description="Improvement suggestion")


class BehavioralSchema(BaseModel):
    """Schema for behavioral insights."""
    summary: Optional[str] = Field(None, description="Behavioral summary narrative")
    emotional_pattern: Optional[str] = Field(None, description="Dominant emotional pattern")
    confidence_trend: Optional[str] = Field(None, description="Confidence trajectory")
    communication_style: Optional[str] = Field(None, description="Communication style")


class ImprovementAreaSchema(BaseModel):
    """Schema for improvement area."""
    area: str = Field(..., description="Area to improve")
    priority: str = Field(default="medium", description="Priority: high, medium, low")
    action: str = Field(..., description="Recommended action")
    resources: List[str] = Field(default=[], description="Suggested resources")


class TopicToStudySchema(BaseModel):
    """Schema for specific topic to study based on poor performance."""
    topic: str = Field(..., description="Topic to study")
    category: str = Field(default="general", description="Question category")
    score: float = Field(..., ge=0, le=10, description="Score received")
    reason: str = Field(..., description="Why this topic needs study")


class QuestionFeedbackSchema(BaseModel):
    """Schema for question-by-question feedback."""
    question_number: int = Field(..., description="Question number")
    question_text: Optional[str] = Field(None, description="Question text")
    question_type: Optional[str] = Field(None, description="Question type")
    score: float = Field(..., ge=0, le=10, description="Score received")
    feedback: str = Field(..., description="Brief feedback")
    strengths: List[str] = Field(default=[], description="What was done well")
    improvements: List[str] = Field(default=[], description="What to improve")


class ImprovementsSchema(BaseModel):
    """Schema for improvements."""
    areas: List[ImprovementAreaSchema] = Field(default=[], description="Areas to improve")
    topics: List[str] = Field(default=[], description="Topics to study")
    practice: List[str] = Field(default=[], description="Practice suggestions")
    topics_to_study: List[TopicToStudySchema] = Field(default=[], description="Specific topics to study based on poor performance")


class StatisticsSchema(BaseModel):
    """Schema for interview statistics."""
    total_questions: int = Field(default=0, description="Total questions")
    answered: int = Field(default=0, description="Questions answered")
    skipped: int = Field(default=0, description="Questions skipped")
    avg_response_time: Optional[float] = Field(None, description="Average response time (seconds)")
    duration_minutes: Optional[int] = Field(None, description="Total duration in minutes")


# ===========================================
# MAIN REPORT SCHEMA
# ===========================================


class InterviewReportSchema(BaseModel):
    """Schema for complete interview report."""
    id: str
    session_id: str
    target_role: Optional[str]
    company_name: Optional[str]
    interview_type: Optional[str]
    readiness: ReadinessSchema
    skills: SkillsSchema
    strengths: List[StrengthSchema]
    weaknesses: List[WeaknessSchema]
    behavioral: BehavioralSchema
    improvements: ImprovementsSchema
    statistics: StatisticsSchema
    executive_summary: Optional[str]
    recommendation: Optional[str]
    generated_at: Optional[str]
    source: str
    disclaimer: str
    question_feedback: List[QuestionFeedbackSchema] = Field(default=[], description="Question-by-question feedback")


# ===========================================
# REQUEST SCHEMAS
# ===========================================


class GenerateReportRequest(BaseModel):
    """Schema for generate report request."""
    include_behavioral: bool = Field(default=True, description="Include behavioral insights")
    include_skills: bool = Field(default=True, description="Include skill breakdown")


# ===========================================
# RESPONSE SCHEMAS
# ===========================================


class GenerateReportResponse(BaseModel):
    """Schema for generate report response."""
    success: bool = True
    message: str
    report: InterviewReportSchema


class GetReportResponse(BaseModel):
    """Schema for get report response."""
    success: bool = True
    report: InterviewReportSchema


class ReportSummarySchema(BaseModel):
    """Schema for report summary (list view)."""
    id: str
    session_id: str
    target_role: Optional[str]
    readiness_score: int
    readiness_grade: str
    generated_at: Optional[str]


class ReportsListResponse(BaseModel):
    """Schema for reports list."""
    success: bool = True
    reports: List[ReportSummarySchema]
    total: int


class ErrorResponse(BaseModel):
    """Schema for error responses."""
    success: bool = False
    message: str
