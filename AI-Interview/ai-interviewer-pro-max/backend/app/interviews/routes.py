"""
Interview Routes

API endpoints for interview session management.
All routes are protected and require authentication.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.interviews.service import interview_service

router = APIRouter()


# ===========================================
# SESSION MANAGEMENT (All protected)
# ===========================================


@router.post(
    "/sessions",
    summary="Create interview session",
    description="Create a new interview session with specified parameters."
)
async def create_session(
    resume_id: Optional[str] = None,
    job_role_id: Optional[str] = None,
    session_type: str = "mixed",
    difficulty: str = "medium",
    question_count: int = 10,
    time_limit_minutes: Optional[int] = None,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create a new interview session.
    
    Requires authentication.
    """
    result = await interview_service.create_session(
        user_id=current_user["id"],
        resume_id=resume_id,
        job_role_id=job_role_id,
        session_type=session_type,
        difficulty=difficulty,
        question_count=question_count,
        time_limit_minutes=time_limit_minutes,
    )
    return {"success": True, **result}


@router.get(
    "/sessions/{session_id}",
    summary="Get session details",
    description="Get details of a specific interview session."
)
async def get_session(
    session_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get session details.
    
    Requires authentication and session ownership.
    """
    result = await interview_service.get_session(
        session_id=session_id,
        user_id=current_user["id"],
    )
    return {"success": True, **result}


@router.post(
    "/sessions/{session_id}/plan",
    summary="Start question planning",
    description="Start AI question generation for the session."
)
async def start_planning(
    session_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Start question generation with Gemini.
    
    Requires authentication.
    """
    result = await interview_service.start_planning(
        session_id=session_id,
        user_id=current_user["id"],
    )
    return {"success": True, **result}


@router.post(
    "/sessions/{session_id}/start",
    summary="Start interview",
    description="Start the interview session."
)
async def start_interview(
    session_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Start the interview.
    
    Requires authentication.
    """
    result = await interview_service.start_interview(
        session_id=session_id,
        user_id=current_user["id"],
    )
    return {"success": True, **result}


@router.post(
    "/sessions/{session_id}/pause",
    summary="Pause interview",
    description="Pause the active interview session."
)
async def pause_interview(
    session_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Pause the interview.
    
    Requires authentication.
    """
    result = await interview_service.pause_session(
        session_id=session_id,
        user_id=current_user["id"],
    )
    return {"success": True, **result}


@router.post(
    "/sessions/{session_id}/resume",
    summary="Resume interview",
    description="Resume a paused interview session."
)
async def resume_interview(
    session_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Resume the interview.
    
    Requires authentication.
    """
    result = await interview_service.resume_session(
        session_id=session_id,
        user_id=current_user["id"],
    )
    return {"success": True, **result}


@router.post(
    "/sessions/{session_id}/end",
    summary="End interview",
    description="End the interview and start processing results."
)
async def end_interview(
    session_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    End the interview.
    
    Requires authentication.
    """
    result = await interview_service.end_session(
        session_id=session_id,
        user_id=current_user["id"],
    )
    return {"success": True, **result}


@router.post(
    "/sessions/{session_id}/abandon",
    summary="Abandon interview",
    description="Abandon the interview session."
)
async def abandon_interview(
    session_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Abandon the interview.
    
    Requires authentication.
    """
    result = await interview_service.abandon_session(
        session_id=session_id,
        user_id=current_user["id"],
    )
    return {"success": True, **result}


# ===========================================
# QUESTION MANAGEMENT (All protected)
# ===========================================


@router.get(
    "/sessions/{session_id}/question",
    summary="Get current question",
    description="Get the current question for the session."
)
async def get_current_question(
    session_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get current question.
    
    Requires authentication.
    """
    result = await interview_service.get_current_question(
        session_id=session_id,
        user_id=current_user["id"],
    )
    return {"success": True, **result}


@router.post(
    "/sessions/{session_id}/answer",
    summary="Submit answer",
    description="Submit an answer to the current question."
)
async def submit_answer(
    session_id: str,
    question_id: str,
    answer_text: str,
    response_time_seconds: int = 0,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Submit answer to current question.
    
    Requires authentication.
    """
    result = await interview_service.submit_answer(
        session_id=session_id,
        user_id=current_user["id"],
        question_id=question_id,
        answer_text=answer_text,
        response_time_seconds=response_time_seconds,
    )
    return {"success": True, **result}


@router.post(
    "/sessions/{session_id}/skip",
    summary="Skip question",
    description="Skip the current question."
)
async def skip_question(
    session_id: str,
    question_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Skip current question.
    
    Requires authentication.
    """
    result = await interview_service.skip_question(
        session_id=session_id,
        user_id=current_user["id"],
        question_id=question_id,
    )
    return {"success": True, **result}


# ===========================================
# RESULTS (All protected)
# ===========================================


@router.get(
    "/sessions/{session_id}/results",
    summary="Get session results",
    description="Get the final results for a completed session."
)
async def get_results(
    session_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get session results.
    
    Requires authentication and session ownership.
    """
    result = await interview_service.get_session_results(
        session_id=session_id,
        user_id=current_user["id"],
    )
    return {"success": True, **result}


# ===========================================
# JOB ROLES (Protected)
# ===========================================


@router.get(
    "/roles",
    summary="Get available job roles",
    description="Get list of available job roles for interview."
)
async def get_job_roles(
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get available job roles.
    
    Requires authentication.
    """
    # TODO: Fetch from database
    return {
        "success": True,
        "roles": [
            {"id": "1", "title": "Software Engineer", "category": "engineering"},
            {"id": "2", "title": "Data Scientist", "category": "data"},
            {"id": "3", "title": "Product Manager", "category": "product"},
            {"id": "4", "title": "Frontend Developer", "category": "engineering"},
            {"id": "5", "title": "Backend Developer", "category": "engineering"},
        ]
    }
