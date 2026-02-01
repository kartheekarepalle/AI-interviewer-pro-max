"""
Career Roadmap Schemas

Pydantic schemas for roadmap request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ===========================================
# NESTED SCHEMAS
# ===========================================


class SkillGapSchema(BaseModel):
    """Schema for a skill gap."""
    skill: str = Field(..., description="Skill name")
    current_level: str = Field(default="basic", description="Current proficiency")
    target_level: str = Field(default="advanced", description="Target proficiency")
    priority: str = Field(default="medium", description="Priority: high, medium, low")


class SkillGapsSchema(BaseModel):
    """Schema for all skill gaps."""
    gaps: List[SkillGapSchema] = Field(default=[], description="Skill gaps")
    missing: List[str] = Field(default=[], description="Missing skills")
    to_improve: List[str] = Field(default=[], description="Skills to improve")


class LearningTopicSchema(BaseModel):
    """Schema for a learning topic."""
    topic: str = Field(..., description="Topic name")
    description: str = Field(..., description="Topic description")
    duration_weeks: int = Field(default=1, description="Duration in weeks")
    resources: List[str] = Field(default=[], description="Suggested resources")
    order: int = Field(default=1, description="Order in learning path")


class LearningSchema(BaseModel):
    """Schema for learning path."""
    topics: List[LearningTopicSchema] = Field(default=[], description="Learning topics")
    courses: List[str] = Field(default=[], description="Recommended courses")
    books: List[str] = Field(default=[], description="Books to read")


class ProjectSchema(BaseModel):
    """Schema for a recommended project."""
    title: str = Field(..., description="Project title")
    description: str = Field(..., description="Project description")
    skills_covered: List[str] = Field(default=[], description="Skills covered")
    difficulty: str = Field(default="medium", description="Difficulty level")
    duration_weeks: int = Field(default=2, description="Duration in weeks")


class ProjectsSchema(BaseModel):
    """Schema for projects."""
    recommended: List[ProjectSchema] = Field(default=[], description="Recommended projects")
    portfolio: List[str] = Field(default=[], description="Portfolio suggestions")


class PracticeStrategySchema(BaseModel):
    """Schema for practice strategy."""
    daily_routine: Optional[str] = Field(None, description="Daily practice routine")
    weekly_goals: List[str] = Field(default=[], description="Weekly goals")
    mock_interview_frequency: Optional[str] = Field(None, description="Mock interview frequency")


class PracticeSchema(BaseModel):
    """Schema for practice section."""
    strategy: PracticeStrategySchema = Field(default=PracticeStrategySchema())
    interview_tips: List[str] = Field(default=[], description="Interview tips")
    behavioral: List[str] = Field(default=[], description="Behavioral practice")


class MilestoneSchema(BaseModel):
    """Schema for a milestone."""
    week: int = Field(..., description="Week number")
    milestone: str = Field(..., description="Milestone description")
    deliverables: List[str] = Field(default=[], description="Expected deliverables")


class PhaseSchema(BaseModel):
    """Schema for a phase."""
    phase: int = Field(..., description="Phase number")
    name: str = Field(..., description="Phase name")
    weeks: str = Field(..., description="Week range, e.g., '1-4'")
    focus: List[str] = Field(default=[], description="Focus areas")


class TimelineSchema(BaseModel):
    """Schema for timeline."""
    total_weeks: Optional[int] = Field(None, description="Total duration in weeks")
    milestones: List[MilestoneSchema] = Field(default=[], description="Milestones")
    phases: List[PhaseSchema] = Field(default=[], description="Phases")


class SummarySchema(BaseModel):
    """Schema for summary."""
    executive: Optional[str] = Field(None, description="Executive summary")
    key_actions: List[str] = Field(default=[], description="Key actions")
    success_metrics: List[str] = Field(default=[], description="Success metrics")


class ContextSchema(BaseModel):
    """Schema for context."""
    target_role: str
    current_level: Optional[str]
    target_level: Optional[str]
    readiness_score: Optional[int]


# ===========================================
# MAIN ROADMAP SCHEMA
# ===========================================


class CareerRoadmapSchema(BaseModel):
    """Schema for complete career roadmap."""
    id: str
    session_id: Optional[str]
    version: int
    is_active: bool
    context: ContextSchema
    skill_gaps: SkillGapsSchema
    learning: LearningSchema
    projects: ProjectsSchema
    practice: PracticeSchema
    timeline: TimelineSchema
    summary: SummarySchema
    generated_at: Optional[str]
    source: str
    disclaimer: str


# ===========================================
# REQUEST SCHEMAS
# ===========================================


class GenerateRoadmapRequest(BaseModel):
    """Schema for generate roadmap request."""
    target_role: Optional[str] = Field(None, description="Override target role")
    current_level: Optional[str] = Field(None, description="Current level")
    target_level: Optional[str] = Field(None, description="Target level")
    focus_areas: Optional[List[str]] = Field(None, description="Areas to focus on")


# ===========================================
# RESPONSE SCHEMAS
# ===========================================


class GenerateRoadmapResponse(BaseModel):
    """Schema for generate roadmap response."""
    success: bool = True
    message: str
    roadmap: CareerRoadmapSchema


class GetRoadmapResponse(BaseModel):
    """Schema for get roadmap response."""
    success: bool = True
    roadmap: CareerRoadmapSchema


class RoadmapSummarySchema(BaseModel):
    """Schema for roadmap summary (list view)."""
    id: str
    session_id: Optional[str]
    target_role: str
    version: int
    total_weeks: Optional[int]
    generated_at: Optional[str]
    is_active: bool


class RoadmapsListResponse(BaseModel):
    """Schema for roadmaps list."""
    success: bool = True
    roadmaps: List[RoadmapSummarySchema]
    total: int


class ErrorResponse(BaseModel):
    """Schema for error responses."""
    success: bool = False
    message: str
