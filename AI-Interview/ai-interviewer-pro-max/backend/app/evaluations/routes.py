"""
Answer Evaluation Routes

API endpoints for answer evaluation.
All routes are protected and require authentication.

Endpoints:
- POST /evaluations/quick - Quick evaluation (Groq)
- POST /evaluations/deep - Deep evaluation (Gemini)
- POST /evaluations/batch - Batch deep evaluation
- GET /evaluations/{session_id} - Get session evaluations
- GET /evaluations/single/{evaluation_id} - Get single evaluation
- POST /evaluations/finalize/{session_id} - Finalize session evaluations
"""

from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.core.config import settings
from app.evaluations.service import EvaluationService
from app.evaluations.schemas import (
    QuickEvaluateRequest,
    DeepEvaluateRequest,
    BatchDeepEvaluateRequest,
    QuickEvaluateResponse,
    DeepEvaluateResponse,
    SessionEvaluationsResponse,
    EvaluationStatusResponse,
    EvaluationSummary,
    QuickEvaluationResult,
    DeepEvaluationResult,
    DeepScoreExplanations,
    ErrorResponse,
)

router = APIRouter()


# ===========================================
# QUICK EVALUATION (GROQ - Layer 1)
# ===========================================


@router.post(
    "/quick",
    response_model=QuickEvaluateResponse,
    summary="Quick evaluation (Groq)",
    description="Perform quick evaluation on an answer using Groq (fast, real-time).",
    responses={
        200: {"description": "Evaluation completed"},
        400: {"model": ErrorResponse, "description": "Invalid request"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def quick_evaluate(
    request: QuickEvaluateRequest,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Perform quick evaluation on an answer.
    
    This is Layer 1 evaluation using Groq for fast feedback.
    Provides:
    - Relevance score (0-10)
    - Off-topic detection
    - Brief feedback (1-2 lines)
    """
    try:
        service = EvaluationService(db)
        evaluation = await service.quick_evaluate(
            user_id=current_user["id"],
            session_id=request.session_id,
            question_id=request.question_id,
            question_text=request.question_text,
            answer_text=request.answer_text,
            question_type=request.question_type,
            answer_id=request.answer_id,
        )
        
        result = QuickEvaluationResult(
            relevance_score=evaluation.quick_relevance_score or 5.0,
            is_off_topic=evaluation.quick_is_off_topic or False,
            is_too_short=evaluation.quick_is_too_short or False,
            feedback=evaluation.quick_feedback or "Answer received.",
            source=evaluation.quick_evaluation_source or "mock",
        )
        
        mode_msg = " (demo mode)" if not settings.is_groq_configured() else ""
        
        return QuickEvaluateResponse(
            success=True,
            message=f"Quick evaluation complete{mode_msg}",
            evaluation_id=evaluation.id,
            result=result,
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        print(f"Quick evaluation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to perform quick evaluation"
        )


# ===========================================
# DEEP EVALUATION (GEMINI - Layer 2)
# ===========================================


@router.post(
    "/deep",
    response_model=DeepEvaluateResponse,
    summary="Deep evaluation (Gemini)",
    description="Perform deep evaluation on an answer using Gemini (detailed analysis).",
    responses={
        200: {"description": "Evaluation completed"},
        400: {"model": ErrorResponse, "description": "Invalid request"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def deep_evaluate(
    request: DeepEvaluateRequest,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Perform deep evaluation on an answer.
    
    This is Layer 2 evaluation using Gemini for detailed analysis.
    Provides:
    - Multi-dimensional scores (relevance, depth, clarity, confidence)
    - Explanations for each score
    - Strengths and areas for improvement
    - Detailed feedback
    """
    try:
        service = EvaluationService(db)
        evaluation = await service.deep_evaluate(
            user_id=current_user["id"],
            session_id=request.session_id,
            question_id=request.question_id,
            question_text=request.question_text,
            answer_text=request.answer_text,
            question_type=request.question_type,
            resume_context=request.resume_context,
            expected_topics=request.expected_topics,
        )
        
        result = DeepEvaluationResult(
            relevance_score=evaluation.deep_relevance_score or 5.0,
            depth_score=evaluation.deep_depth_score or 5.0,
            clarity_score=evaluation.deep_clarity_score or 5.0,
            confidence_score=evaluation.deep_confidence_score or 5.0,
            overall_score=evaluation.deep_overall_score or 5.0,
            explanations=DeepScoreExplanations(
                relevance=evaluation.deep_relevance_explanation,
                depth=evaluation.deep_depth_explanation,
                clarity=evaluation.deep_clarity_explanation,
                confidence=evaluation.deep_confidence_explanation,
            ),
            strengths=evaluation.deep_strengths or [],
            improvements=evaluation.deep_improvements or [],
            key_points_covered=evaluation.deep_key_points_covered or [],
            missing_points=evaluation.deep_missing_points or [],
            feedback=evaluation.deep_feedback or "Evaluation complete.",
            source=evaluation.deep_evaluation_source or "mock",
        )
        
        mode_msg = " (demo mode)" if not settings.is_gemini_configured() else ""
        
        return DeepEvaluateResponse(
            success=True,
            message=f"Deep evaluation complete{mode_msg}",
            evaluation_id=evaluation.id,
            result=result,
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        print(f"Deep evaluation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to perform deep evaluation"
        )


# ===========================================
# BATCH DEEP EVALUATION
# ===========================================


@router.post(
    "/batch",
    summary="Batch deep evaluation",
    description="Perform deep evaluation on all pending answers in a session.",
    responses={
        200: {"description": "Batch evaluation initiated"},
        400: {"model": ErrorResponse, "description": "Invalid request"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def batch_deep_evaluate(
    request: BatchDeepEvaluateRequest,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Perform deep evaluation on all pending answers in a session.
    
    This is typically called after interview completion.
    """
    try:
        service = EvaluationService(db)
        
        # Get resume context if available
        # TODO: Fetch resume context from session/plan
        resume_context = None
        
        results = await service.batch_deep_evaluate(
            session_id=request.session_id,
            user_id=current_user["id"],
            resume_context=resume_context,
        )
        
        return {
            "success": True,
            "message": f"Batch evaluation completed for {len(results)} answers",
            "processed": len(results),
            "evaluation_ids": [e.id for e in results],
        }
        
    except Exception as e:
        print(f"Batch evaluation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to perform batch evaluation"
        )


# ===========================================
# GET SESSION EVALUATIONS
# ===========================================


@router.get(
    "/{session_id}",
    response_model=SessionEvaluationsResponse,
    summary="Get session evaluations",
    description="Get all evaluations for an interview session.",
    responses={
        200: {"description": "Evaluations retrieved"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def get_session_evaluations(
    session_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get all evaluations for an interview session.
    
    Returns both quick and deep evaluations for each answer.
    """
    try:
        service = EvaluationService(db)
        evaluations = service.get_session_evaluations(
            session_id=session_id,
            user_id=current_user["id"],
        )
        
        summaries = []
        quick_complete = 0
        deep_complete = 0
        
        for e in evaluations:
            quick_eval = None
            if e.is_quick_complete:
                quick_eval = QuickEvaluationResult(
                    relevance_score=e.quick_relevance_score or 5.0,
                    is_off_topic=e.quick_is_off_topic or False,
                    is_too_short=e.quick_is_too_short or False,
                    feedback=e.quick_feedback or "",
                    source=e.quick_evaluation_source or "mock",
                )
                quick_complete += 1
            
            deep_eval = None
            if e.is_deep_complete:
                deep_eval = DeepEvaluationResult(
                    relevance_score=e.deep_relevance_score or 5.0,
                    depth_score=e.deep_depth_score or 5.0,
                    clarity_score=e.deep_clarity_score or 5.0,
                    confidence_score=e.deep_confidence_score or 5.0,
                    overall_score=e.deep_overall_score or 5.0,
                    explanations=DeepScoreExplanations(
                        relevance=e.deep_relevance_explanation,
                        depth=e.deep_depth_explanation,
                        clarity=e.deep_clarity_explanation,
                        confidence=e.deep_confidence_explanation,
                    ),
                    strengths=e.deep_strengths or [],
                    improvements=e.deep_improvements or [],
                    key_points_covered=e.deep_key_points_covered or [],
                    missing_points=e.deep_missing_points or [],
                    feedback=e.deep_feedback or "",
                    source=e.deep_evaluation_source or "pending",
                )
                deep_complete += 1
            
            summaries.append(EvaluationSummary(
                id=e.id,
                question_id=e.question_id,
                question_type=e.question_type,
                quick_evaluation=quick_eval,
                deep_evaluation=deep_eval,
                is_quick_complete=e.is_quick_complete,
                is_deep_complete=e.is_deep_complete,
                status=e.evaluation_status,
            ))
        
        return SessionEvaluationsResponse(
            success=True,
            session_id=session_id,
            evaluations=summaries,
            total=len(evaluations),
            quick_complete=quick_complete,
            deep_complete=deep_complete,
        )
        
    except Exception as e:
        print(f"Get evaluations error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get evaluations"
        )


# ===========================================
# GET SINGLE EVALUATION
# ===========================================


@router.get(
    "/single/{evaluation_id}",
    summary="Get single evaluation",
    description="Get a specific evaluation by ID.",
    responses={
        200: {"description": "Evaluation retrieved"},
        404: {"model": ErrorResponse, "description": "Not found"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def get_evaluation(
    evaluation_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get a specific evaluation by ID."""
    service = EvaluationService(db)
    evaluation = service.get_evaluation(
        evaluation_id=evaluation_id,
        user_id=current_user["id"],
    )
    
    if not evaluation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation not found"
        )
    
    return {
        "success": True,
        "evaluation": evaluation.to_dict(),
    }


# ===========================================
# FINALIZE EVALUATIONS
# ===========================================


@router.post(
    "/finalize/{session_id}",
    summary="Finalize session evaluations",
    description="Finalize all evaluations for a session (makes them immutable).",
    responses={
        200: {"description": "Evaluations finalized"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def finalize_evaluations(
    session_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Finalize all evaluations for a session.
    
    Once finalized, scores are immutable.
    """
    try:
        service = EvaluationService(db)
        count = service.finalize_evaluations(
            session_id=session_id,
            user_id=current_user["id"],
        )
        
        return {
            "success": True,
            "message": f"Finalized {count} evaluations",
            "finalized_count": count,
        }
        
    except Exception as e:
        print(f"Finalize error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to finalize evaluations"
        )


# ===========================================
# API STATUS
# ===========================================


@router.get(
    "/status",
    summary="Get evaluation API status",
    description="Check if Groq and Gemini are configured for evaluations.",
)
async def get_evaluation_status():
    """Check evaluation API status."""
    return {
        "groq_configured": settings.is_groq_configured(),
        "gemini_configured": settings.is_gemini_configured(),
        "quick_mode": "live" if settings.is_groq_configured() else "demo",
        "deep_mode": "live" if settings.is_gemini_configured() else "demo",
    }
