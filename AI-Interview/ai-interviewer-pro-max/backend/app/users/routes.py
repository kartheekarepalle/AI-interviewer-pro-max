"""
User Routes

API endpoints for user management and profile operations.
All routes are protected and require authentication.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.core.security import get_current_user, get_current_active_user

router = APIRouter()


# ===========================================
# PROFILE ENDPOINTS (All protected)
# ===========================================


@router.get(
    "/profile",
    summary="Get user profile",
    description="Get the current authenticated user's full profile."
)
async def get_profile(
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get current user's profile.
    
    Returns full user data including preferences.
    Requires authentication.
    """
    return {
        "success": True,
        "user": current_user,
    }


@router.put(
    "/profile",
    summary="Update user profile",
    description="Update the current user's profile information."
)
async def update_profile(
    name: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Update current user's profile.
    
    - name: Update user's display name
    Requires authentication.
    """
    from app.users.models import User
    
    user = db.query(User).filter(User.id == current_user["id"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if name:
        user.name = name.strip()
    
    db.commit()
    db.refresh(user)
    
    return {
        "success": True,
        "message": "Profile updated successfully",
        "user": user.to_dict(),
    }


# ===========================================
# RESUME ENDPOINTS (All protected)
# ===========================================


@router.get(
    "/resumes",
    summary="Get user resumes",
    description="Get all resumes uploaded by the current user."
)
async def get_resumes(
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get all resumes for current user.
    
    Returns list of uploaded resumes from REAL database.
    Requires authentication.
    """
    from app.resumes.models import Resume
    from app.ats.models import ATSAnalysis
    
    user_id = current_user["id"]
    
    # Get all resumes for user
    resumes = db.query(Resume).filter(
        Resume.user_id == user_id
    ).order_by(Resume.created_at.desc()).all()
    
    # Get ATS analyses for these resumes
    resume_ids = [r.id for r in resumes]
    analyses = db.query(ATSAnalysis).filter(
        ATSAnalysis.resume_id.in_(resume_ids)
    ).all()
    analysis_map = {a.resume_id: a for a in analyses}
    
    # Build resume list
    resume_list = []
    for resume in resumes:
        ats = analysis_map.get(resume.id)
        resume_list.append({
            "id": resume.id,
            "filename": resume.filename,
            "file_type": resume.file_type,
            "file_size": resume.file_size,
            "has_analysis": ats is not None,
            "ats_score": ats.overall_score if ats else None,
            "created_at": resume.created_at.isoformat() if resume.created_at else None,
        })
    
    return {
        "success": True,
        "resumes": resume_list,
        "total": len(resume_list),
    }


@router.post(
    "/resumes/upload",
    summary="Upload resume",
    description="Upload a new resume (PDF or DOCX)."
)
async def upload_resume(
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Upload a new resume.
    
    Accepts PDF and DOCX files.
    Requires authentication.
    """
    # TODO: Implement file upload handling
    return {
        "success": False,
        "message": "Resume upload not yet implemented",
    }


# ===========================================
# ANALYTICS ENDPOINTS (All protected)
# ===========================================


@router.get(
    "/analytics",
    summary="Get user analytics",
    description="Get performance analytics for the current user."
)
async def get_analytics(
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get performance analytics for current user.
    
    Computes analytics from REAL interview session data.
    Requires authentication.
    """
    from app.interviews.live_models import LiveInterviewSession
    from app.reports.models import InterviewReport
    from sqlalchemy import func
    
    user_id = current_user["id"]
    
    # Get all sessions for this user
    sessions = db.query(LiveInterviewSession).filter(
        LiveInterviewSession.user_id == user_id
    ).all()
    
    total_interviews = len(sessions)
    completed_sessions = [s for s in sessions if s.status == "completed"]
    completed_interviews = len(completed_sessions)
    
    # Get scores from reports
    reports = db.query(InterviewReport).filter(
        InterviewReport.user_id == user_id
    ).all()
    
    scores = [r.readiness_score for r in reports if r.readiness_score is not None]
    
    average_score = round(sum(scores) / len(scores), 1) if scores else None
    best_score = max(scores) if scores else None
    
    # Calculate trend (last 3 vs previous 3)
    trend = "stable"
    if len(scores) >= 6:
        recent_avg = sum(scores[-3:]) / 3
        older_avg = sum(scores[-6:-3]) / 3
        if recent_avg > older_avg + 5:
            trend = "improving"
        elif recent_avg < older_avg - 5:
            trend = "declining"
    
    # Get last interview date
    last_session = db.query(LiveInterviewSession).filter(
        LiveInterviewSession.user_id == user_id,
        LiveInterviewSession.status == "completed"
    ).order_by(LiveInterviewSession.completed_at.desc()).first()
    
    last_interview_at = last_session.completed_at.isoformat() if last_session and last_session.completed_at else None
    
    # Calculate completion rate
    completion_rate = round((completed_interviews / total_interviews * 100), 1) if total_interviews > 0 else 0
    
    # Count total questions answered
    total_questions_answered = sum(s.questions_answered or 0 for s in completed_sessions)
    
    return {
        "success": True,
        "analytics": {
            "total_interviews": total_interviews,
            "completed_interviews": completed_interviews,
            "average_score": average_score,
            "best_score": best_score,
            "trend": trend,
            "last_interview_at": last_interview_at,
            "completion_rate": completion_rate,
            "total_questions_answered": total_questions_answered,
        }
    }


@router.get(
    "/history",
    summary="Get interview history",
    description="Get the current user's interview history."
)
async def get_interview_history(
    limit: int = 10,
    offset: int = 0,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get interview history for current user.
    
    Returns paginated list of past interviews from REAL database.
    Requires authentication.
    """
    from app.interviews.live_models import LiveInterviewSession
    from app.reports.models import InterviewReport
    
    user_id = current_user["id"]
    
    # Count total sessions
    total = db.query(LiveInterviewSession).filter(
        LiveInterviewSession.user_id == user_id
    ).count()
    
    # Get paginated sessions (most recent first)
    sessions = db.query(LiveInterviewSession).filter(
        LiveInterviewSession.user_id == user_id
    ).order_by(
        LiveInterviewSession.created_at.desc()
    ).offset(offset).limit(limit).all()
    
    # Get reports for these sessions to include scores
    session_ids = [s.id for s in sessions]
    reports = db.query(InterviewReport).filter(
        InterviewReport.session_id.in_(session_ids)
    ).all()
    report_map = {r.session_id: r for r in reports}
    
    # Build interview history items
    interviews = []
    for session in sessions:
        report = report_map.get(session.id)
        
        interviews.append({
            "id": session.id,
            "plan_id": session.plan_id,
            "target_role": session.target_role,
            "status": session.status,
            "session_type": session.session_type,
            "difficulty_level": session.difficulty_level,
            "total_questions": session.total_questions,
            "questions_answered": session.questions_answered or 0,
            "questions_skipped": session.questions_skipped or 0,
            "score": report.readiness_score if report else None,
            "has_report": report is not None,
            "started_at": session.started_at.isoformat() if session.started_at else None,
            "completed_at": session.completed_at.isoformat() if session.completed_at else None,
            "created_at": session.created_at.isoformat() if session.created_at else None,
            "duration_seconds": session.total_duration_seconds or 0,
            # Include report summary if available
            "strengths": report.strengths[:2] if report and report.strengths else [],
            "weaknesses": report.weaknesses[:2] if report and report.weaknesses else [],
        })
    
    return {
        "success": True,
        "interviews": interviews,
        "total": total,
        "limit": limit,
        "offset": offset,
    }

