"""
Analytics Schemas

Pydantic schemas for analytics API.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


# ===========================================
# OVERVIEW
# ===========================================

class OverviewStats(BaseModel):
    """Overview statistics."""
    total_interviews: int = 0
    completed_interviews: int = 0
    completion_rate: float = 0.0
    average_score: float = 0.0
    trend: str = "insufficient_data"
    trend_percent: float = 0.0
    recent_activity_count: int = 0
    total_questions_answered: int = 0
    avg_questions_per_session: float = 0.0
    days_analyzed: int = 30


class OverviewResponse(BaseModel):
    """Response for overview endpoint."""
    success: bool = True
    stats: OverviewStats


# ===========================================
# SKILLS
# ===========================================

class SkillPerformance(BaseModel):
    """Individual skill performance."""
    skill: str
    average_score: float
    total_evaluations: int
    max_score: float
    min_score: float


class SkillsResponse(BaseModel):
    """Response for skills endpoint."""
    success: bool = True
    skills: List[SkillPerformance] = []
    strengths: List[SkillPerformance] = []
    weaknesses: List[SkillPerformance] = []
    total_skills_analyzed: int = 0


# ===========================================
# PROGRESS
# ===========================================

class TimeSeriesPoint(BaseModel):
    """Single point in time series."""
    date: str
    label: str
    score: Optional[float] = None
    count: int = 0


class ProgressResponse(BaseModel):
    """Response for progress endpoint."""
    success: bool = True
    time_series: List[TimeSeriesPoint] = []
    total_interviews_in_period: int = 0
    improvement_points: float = 0.0
    interval: str = "week"
    days_analyzed: int = 90


# ===========================================
# QUESTION TYPE BREAKDOWN
# ===========================================

class QuestionTypeStats(BaseModel):
    """Stats for a question type."""
    type: str
    label: str
    average_score: float
    count: int


class QuestionTypeResponse(BaseModel):
    """Response for question type breakdown."""
    success: bool = True
    breakdown: List[QuestionTypeStats] = []
    total_evaluated: int = 0


# ===========================================
# RECENT INTERVIEWS
# ===========================================

class RecentInterview(BaseModel):
    """Recent interview summary."""
    id: str
    target_role: str
    session_type: str
    difficulty: str
    score: Optional[float] = None
    date: str
    questions_count: int


class RecentInterviewsResponse(BaseModel):
    """Response for recent interviews."""
    success: bool = True
    interviews: List[RecentInterview] = []


# ===========================================
# FULL DASHBOARD
# ===========================================

class DashboardResponse(BaseModel):
    """Full dashboard data."""
    success: bool = True
    overview: OverviewStats
    skill_summary: Dict[str, Any] = {}
    progress_summary: Dict[str, Any] = {}
    question_types: Dict[str, Any] = {}
    recent_interviews: List[RecentInterview] = []
    disclaimer: str = Field(
        default="Analytics are based on your interview history and provide insights for improvement. They do not predict actual job interview outcomes.",
    )


class ErrorResponse(BaseModel):
    """Error response."""
    success: bool = False
    message: str
