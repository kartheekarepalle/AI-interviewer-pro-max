"""
Live Interview Routes

API endpoints for live interview session management.
All routes are protected and require authentication.

Endpoints:
- POST /interviews/live/start - Start interview
- POST /interviews/live/{session_id}/answer - Submit answer
- POST /interviews/live/{session_id}/skip - Skip question
- POST /interviews/live/{session_id}/pause - Pause interview
- POST /interviews/live/{session_id}/resume - Resume interview
- POST /interviews/live/{session_id}/end - End interview early
- GET /interviews/live/{session_id}/state - Get session state
"""

from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.core.config import settings
from app.interviews.live_service import LiveInterviewService
from app.interviews.live_schemas import (
    StartInterviewRequest,
    SubmitAnswerRequest,
    SkipQuestionRequest,
    StartInterviewResponse,
    AnswerResponse,
    SkipResponse,
    PauseResumeResponse,
    CompleteInterviewResponse,
    InterviewStateResponse,
    ErrorResponse,
    ProgressSchema,
    QuickEvalSchema,
    MessageSchema,
)

router = APIRouter()


# ===========================================
# START INTERVIEW
# ===========================================


@router.post(
    "/live/start",
    response_model=StartInterviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Start a live interview session",
    description="Start a new interview session from a plan.",
    responses={
        200: {"description": "Interview started successfully"},
        400: {"model": ErrorResponse, "description": "Invalid request"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Plan not found"},
    }
)
async def start_interview(
    request: StartInterviewRequest,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Start a live interview session.
    
    Requires an interview plan ID. The plan's questions will be asked
    in the order defined by the plan.
    
    **Personas:**
    - `professional`: Formal, business-like
    - `friendly`: Warm, encouraging
    - `stress`: Challenging, probing
    
    **SAFETY:**
    - Never throws 500 for user mistakes
    - Proper 404 for missing plans
    - Proper 400 for invalid plan states
    """
    # Validate request
    if not request.plan_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="plan_id is required"
        )
    
    try:
        service = LiveInterviewService(db)
        result = await service.start_interview(
            plan_id=request.plan_id,
            user_id=current_user["id"],
            persona=request.persona or "professional",
        )
        
        return StartInterviewResponse(
            success=True,
            message="Interview started" + (" (demo mode)" if not settings.is_groq_configured() else ""),
            session_id=result["session_id"],
            status=result["status"],
            interviewer_message=result["interviewer_message"],
            first_question=result["first_question"],
            progress=ProgressSchema(**result["progress"]),
        )
        
    except ValueError as e:
        error_msg = str(e)
        
        # Check for 404 prefix
        if error_msg.startswith("PLAN_NOT_FOUND:"):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_msg.replace("PLAN_NOT_FOUND: ", "")
            )
        
        # All other ValueErrors are 400 (bad request)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
        
    except Exception as e:
        # Log the actual error for debugging
        print(f"[START_INTERVIEW] Unexpected error: {type(e).__name__}: {e}")
        
        # Return clean error to user (never 500 for user-facing issues)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start interview. Please try again or generate a new plan."
        )


# ===========================================
# CONFIRM CONSENT (NEW)
# Completes: Greeting -> Consent -> First Question
# ===========================================


@router.post(
    "/live/{session_id}/consent",
    summary="Confirm user consent to start interview",
    description="Called after user says 'yes' to start the interview. Records first question.",
    responses={
        200: {"description": "Consent confirmed, interview starting"},
        400: {"description": "Invalid session state"},
        404: {"description": "Session not found"},
    }
)
async def confirm_consent(
    session_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Confirm user consent and officially start the interview.
    
    CRITICAL: Call this AFTER the user says "yes" to the greeting.
    This records the first question in the session and returns it.
    """
    try:
        service = LiveInterviewService(db)
        result = await service.confirm_consent(
            session_id=session_id,
            user_id=current_user["id"],
        )
        
        return result
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        print(f"[CONFIRM_CONSENT] Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to confirm consent"
        )


# ===========================================
# GET SESSION STATE
# ===========================================


@router.get(
    "/live/{session_id}/state",
    response_model=InterviewStateResponse,
    summary="Get interview session state",
    description="Get the current state of an interview session.",
    responses={
        200: {"description": "State retrieved successfully"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Session not found"},
    }
)
async def get_session_state(
    session_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get the current state of an interview session.
    
    Use this to resume after a page refresh or reconnection.
    Returns all messages and current question.
    """
    try:
        service = LiveInterviewService(db)
        result = await service.get_session_state(
            session_id=session_id,
            user_id=current_user["id"],
        )
        
        return InterviewStateResponse(
            success=True,
            session_id=result["session_id"],
            status=result["status"],
            target_role=result["target_role"],
            interviewer_persona=result["interviewer_persona"],
            progress=ProgressSchema(**result["progress"]),
            current_question=result["current_question"],
            messages=[MessageSchema(**m) for m in result["messages"]],
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        print(f"Get state error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get session state"
        )


# ===========================================
# SUBMIT ANSWER
# ===========================================


@router.post(
    "/live/{session_id}/answer",
    response_model=AnswerResponse,
    summary="Submit an answer",
    description="Submit an answer to the current question.",
    responses={
        200: {"description": "Answer submitted successfully"},
        400: {"model": ErrorResponse, "description": "Invalid answer"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Session not found"},
    }
)
async def submit_answer(
    session_id: str,
    request: SubmitAnswerRequest,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Submit an answer to the current question.
    
    Returns the interviewer's acknowledgment and the next question
    (if there is one) or indicates interview completion.
    """
    # Validate answer text
    answer_text = request.answer_text.strip()
    if len(answer_text) < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Answer cannot be empty"
        )
    
    try:
        service = LiveInterviewService(db)
        result = await service.submit_answer(
            session_id=session_id,
            user_id=current_user["id"],
            answer_text=answer_text,
            response_time_seconds=request.response_time_seconds,
        )
        
        return AnswerResponse(
            success=True,
            message="Answer submitted",
            acknowledgment=result["acknowledgment"],
            quick_eval=QuickEvalSchema(**result["quick_eval"]),
            next_action=result["next_action"],
            next_question=result["next_question"],
            progress=ProgressSchema(**result["progress"]),
            is_complete=result["is_complete"],
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        print(f"Submit answer error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit answer"
        )


# ===========================================
# SKIP QUESTION
# ===========================================


@router.post(
    "/live/{session_id}/skip",
    response_model=SkipResponse,
    summary="Skip the current question",
    description="Skip the current question and move to the next one.",
    responses={
        200: {"description": "Question skipped successfully"},
        400: {"model": ErrorResponse, "description": "Cannot skip"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Session not found"},
    }
)
async def skip_question(
    session_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Skip the current question.
    
    Note: Skipped questions will affect your final score.
    """
    try:
        service = LiveInterviewService(db)
        result = await service.skip_question(
            session_id=session_id,
            user_id=current_user["id"],
        )
        
        return SkipResponse(
            success=True,
            message="Question skipped",
            next_question=result["next_question"],
            progress=ProgressSchema(**result["progress"]),
            is_complete=result["is_complete"],
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        print(f"Skip question error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to skip question"
        )


# ===========================================
# PAUSE INTERVIEW
# ===========================================


@router.post(
    "/live/{session_id}/pause",
    response_model=PauseResumeResponse,
    summary="Pause the interview",
    description="Pause an active interview session.",
    responses={
        200: {"description": "Interview paused successfully"},
        400: {"model": ErrorResponse, "description": "Cannot pause"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Session not found"},
    }
)
async def pause_interview(
    session_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Pause the interview.
    
    You can resume the interview later. The session state is preserved.
    """
    try:
        service = LiveInterviewService(db)
        result = await service.pause_interview(
            session_id=session_id,
            user_id=current_user["id"],
        )
        
        return PauseResumeResponse(**result)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        print(f"Pause error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to pause interview"
        )


# ===========================================
# RESUME INTERVIEW
# ===========================================


@router.post(
    "/live/{session_id}/resume",
    response_model=PauseResumeResponse,
    summary="Resume the interview",
    description="Resume a paused interview session.",
    responses={
        200: {"description": "Interview resumed successfully"},
        400: {"model": ErrorResponse, "description": "Cannot resume"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Session not found"},
    }
)
async def resume_interview(
    session_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Resume a paused interview.
    """
    try:
        service = LiveInterviewService(db)
        result = await service.resume_interview(
            session_id=session_id,
            user_id=current_user["id"],
        )
        
        return PauseResumeResponse(**result)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        print(f"Resume error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resume interview"
        )


# ===========================================
# END INTERVIEW
# ===========================================


@router.post(
    "/live/{session_id}/end",
    response_model=CompleteInterviewResponse,
    summary="End the interview",
    description="End the interview early and begin processing.",
    responses={
        200: {"description": "Interview ended successfully"},
        400: {"model": ErrorResponse, "description": "Cannot end"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Session not found"},
    }
)
async def end_interview(
    session_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    End the interview early.
    
    Your results will be based on the questions answered so far.
    """
    try:
        service = LiveInterviewService(db)
        result = await service.end_interview(
            session_id=session_id,
            user_id=current_user["id"],
        )
        
        return CompleteInterviewResponse(**result)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        print(f"End interview error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to end interview"
        )


# ===========================================
# API STATUS
# ===========================================


@router.get(
    "/live/status",
    summary="Get live interview API status",
    description="Check if Groq API is configured for live interviews.",
)
async def get_live_status():
    """Check if Groq is configured for live interviews."""
    return {
        "groq_configured": settings.is_groq_configured(),
        "mode": "live" if settings.is_groq_configured() else "demo",
        "message": "Groq API is configured" if settings.is_groq_configured() else "Running in demo mode (mock responses)",
    }
