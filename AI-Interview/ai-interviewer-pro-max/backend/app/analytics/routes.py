"""
Analytics Routes

API endpoints for user analytics dashboard.
All endpoints are user-scoped and require authentication.
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.analytics.service import AnalyticsService
from app.analytics.schemas import (
    OverviewResponse,
    OverviewStats,
    SkillsResponse,
    SkillPerformance,
    ProgressResponse,
    TimeSeriesPoint,
    QuestionTypeResponse,
    QuestionTypeStats,
    RecentInterviewsResponse,
    RecentInterview,
    DashboardResponse,
    ErrorResponse,
)

router = APIRouter()


# ===========================================
# OVERVIEW
# ===========================================

@router.get(
    "/overview",
    response_model=OverviewResponse,
    summary="Get analytics overview",
    description="Get summary statistics for user's interview performance.",
    responses={
        200: {"description": "Overview retrieved"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def get_overview(
    days: int = Query(default=30, ge=7, le=365, description="Days to analyze"),
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get analytics overview including:
    - Total interviews
    - Completion rate
    - Average score
    - Improvement trend
    - Recent activity
    """
    service = AnalyticsService(db)
    data = service.get_overview(current_user["id"], days=days)
    
    return OverviewResponse(
        success=True,
        stats=OverviewStats(**data),
    )


# ===========================================
# SKILLS PERFORMANCE
# ===========================================

@router.get(
    "/skills",
    response_model=SkillsResponse,
    summary="Get skill performance",
    description="Get performance breakdown by skill category.",
    responses={
        200: {"description": "Skills data retrieved"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def get_skills(
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get skill-wise performance including:
    - Performance by skill
    - Strengths (top 3)
    - Weaknesses (bottom 3)
    """
    service = AnalyticsService(db)
    data = service.get_skill_performance(current_user["id"])
    
    return SkillsResponse(
        success=True,
        skills=[SkillPerformance(**s) for s in data["skills"]],
        strengths=[SkillPerformance(**s) for s in data["strengths"]],
        weaknesses=[SkillPerformance(**s) for s in data["weaknesses"]],
        total_skills_analyzed=data["total_skills_analyzed"],
    )


# ===========================================
# PROGRESS OVER TIME
# ===========================================

@router.get(
    "/progress",
    response_model=ProgressResponse,
    summary="Get progress over time",
    description="Get score progression for charts.",
    responses={
        200: {"description": "Progress data retrieved"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def get_progress(
    days: int = Query(default=90, ge=7, le=365, description="Days to analyze"),
    interval: str = Query(default="week", regex="^(day|week|month)$", description="Grouping interval"),
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get progress time series including:
    - Score over time
    - Interview count per period
    - Improvement points
    """
    service = AnalyticsService(db)
    data = service.get_progress_over_time(current_user["id"], days=days, interval=interval)
    
    return ProgressResponse(
        success=True,
        time_series=[TimeSeriesPoint(**p) for p in data["time_series"]],
        total_interviews_in_period=data["total_interviews_in_period"],
        improvement_points=data["improvement_points"],
        interval=data["interval"],
        days_analyzed=data["days_analyzed"],
    )


# ===========================================
# QUESTION TYPE BREAKDOWN
# ===========================================

@router.get(
    "/question-types",
    response_model=QuestionTypeResponse,
    summary="Get question type breakdown",
    description="Get performance by question type.",
    responses={
        200: {"description": "Question type data retrieved"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def get_question_types(
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get performance breakdown by question type:
    - Technical
    - Behavioral
    - Situational
    - HR
    """
    service = AnalyticsService(db)
    data = service.get_question_type_breakdown(current_user["id"])
    
    return QuestionTypeResponse(
        success=True,
        breakdown=[QuestionTypeStats(**b) for b in data["breakdown"]],
        total_evaluated=data["total_evaluated"],
    )


# ===========================================
# RECENT INTERVIEWS
# ===========================================

@router.get(
    "/recent",
    response_model=RecentInterviewsResponse,
    summary="Get recent interviews",
    description="Get summary of recent completed interviews.",
    responses={
        200: {"description": "Recent interviews retrieved"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def get_recent_interviews(
    limit: int = Query(default=5, ge=1, le=20, description="Number of interviews"),
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get recent completed interviews with scores."""
    service = AnalyticsService(db)
    data = service.get_recent_interviews(current_user["id"], limit=limit)
    
    return RecentInterviewsResponse(
        success=True,
        interviews=[RecentInterview(**i) for i in data],
    )


# ===========================================
# FULL DASHBOARD
# ===========================================

@router.get(
    "/dashboard",
    response_model=DashboardResponse,
    summary="Get full dashboard data",
    description="Get all analytics data in single request.",
    responses={
        200: {"description": "Dashboard data retrieved"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def get_dashboard(
    days: int = Query(default=30, ge=7, le=365, description="Days to analyze"),
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get complete dashboard data including:
    - Overview statistics
    - Skill summary
    - Progress summary
    - Question type breakdown
    - Recent interviews
    
    Useful for single-page dashboard load.
    """
    service = AnalyticsService(db)
    
    # Get all data
    overview = service.get_overview(current_user["id"], days=days)
    skills = service.get_skill_performance(current_user["id"])
    progress = service.get_progress_over_time(current_user["id"], days=days)
    question_types = service.get_question_type_breakdown(current_user["id"])
    recent = service.get_recent_interviews(current_user["id"], limit=5)
    
    return DashboardResponse(
        success=True,
        overview=OverviewStats(**overview),
        skill_summary={
            "strengths": skills["strengths"][:3],
            "weaknesses": skills["weaknesses"][:3],
            "total_analyzed": skills["total_skills_analyzed"],
        },
        progress_summary={
            "improvement_points": progress["improvement_points"],
            "total_interviews": progress["total_interviews_in_period"],
            "time_series": progress["time_series"][-8:],  # Last 8 points
        },
        question_types={
            "breakdown": question_types["breakdown"],
            "total": question_types["total_evaluated"],
        },
        recent_interviews=[RecentInterview(**i) for i in recent],
        disclaimer="Analytics are based on your interview history and provide insights for improvement. They do not predict actual job interview outcomes.",
    )
