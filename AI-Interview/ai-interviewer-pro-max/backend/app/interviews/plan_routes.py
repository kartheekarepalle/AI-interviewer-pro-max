"""
Interview Plan Routes

API endpoints for interview plan generation and management.
All routes are protected and require authentication.

CRITICAL: Plan generation NEVER fails - always returns a valid plan.

Endpoints:
- POST /interviews/plan/{resume_id} - Generate plan for resume
- GET /interviews/plan/{plan_id} - Get plan by ID
- GET /interviews/plans/resume/{resume_id} - Get latest plan for resume
- GET /interviews/plans/me - Get all user's plans
"""

import logging
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.interviews.plan_service import InterviewPlanService
from app.interviews.plan_models import InterviewPlan
from app.interviews.plan_schemas import (
    PlanGenerateRequest,
    PlanGenerateResponse,
    PlanGetResponse,
    PlanListResponse,
    PlanQuestionsResponse,
    PlanResponse,
    PlanPreviewResponse,
    PlanErrorResponse,
    QuestionBreakdown,
    QuestionCategory,
    FocusArea,
    PlannedQuestion,
)
from app.resumes.models import Resume

router = APIRouter()
logger = logging.getLogger(__name__)


# ===========================================
# STATIC HARDCODED FALLBACK PLAN
# ===========================================

def create_static_fallback_plan(target_role: str = "Software Engineer") -> Dict[str, Any]:
    """
    Create a STATIC HARDCODED interview plan.
    
    This is the ULTIMATE FAIL-SAFE.
    No external dependencies. No database. No AI.
    Just pure hardcoded data that ALWAYS works.
    """
    logger.warning("=== USING STATIC FALLBACK PLAN ===")
    
    questions = [
        # 5 Technical questions
        {
            "id": "q-1",
            "text": f"Tell me about your technical experience relevant to the {target_role} role.",
            "type": "technical",
            "category": "Technical Skills",
            "difficulty": "medium",
            "time_limit_seconds": 180,
            "expected_topics": ["Technical knowledge", "Experience"],
            "scoring_rubric": {"key_points": ["Clear explanation", "Examples"], "red_flags": ["Vague"]},
        },
        {
            "id": "q-2",
            "text": "Describe a challenging technical problem you solved recently.",
            "type": "technical",
            "category": "Technical Skills",
            "difficulty": "medium",
            "time_limit_seconds": 180,
            "expected_topics": ["Problem solving", "Technical depth"],
            "scoring_rubric": {"key_points": ["Clear approach", "Results"], "red_flags": ["No examples"]},
        },
        {
            "id": "q-3",
            "text": "How do you ensure code quality in your projects?",
            "type": "technical",
            "category": "Technical Skills",
            "difficulty": "medium",
            "time_limit_seconds": 180,
            "expected_topics": ["Testing", "Code review", "Best practices"],
            "scoring_rubric": {"key_points": ["Specific practices"], "red_flags": ["No process"]},
        },
        {
            "id": "q-4",
            "text": "Explain your experience with version control and collaboration tools.",
            "type": "technical",
            "category": "Technical Skills",
            "difficulty": "easy",
            "time_limit_seconds": 120,
            "expected_topics": ["Git", "Team collaboration"],
            "scoring_rubric": {"key_points": ["Practical experience"], "red_flags": ["No experience"]},
        },
        {
            "id": "q-5",
            "text": "How do you stay updated with the latest technology trends?",
            "type": "technical",
            "category": "Technical Skills",
            "difficulty": "easy",
            "time_limit_seconds": 120,
            "expected_topics": ["Learning", "Growth mindset"],
            "scoring_rubric": {"key_points": ["Specific resources"], "red_flags": ["No interest"]},
        },
        # 3 Behavioral questions
        {
            "id": "q-6",
            "text": "Tell me about a time when you worked under pressure to meet a deadline.",
            "type": "behavioral",
            "category": "Behavioral",
            "difficulty": "medium",
            "time_limit_seconds": 180,
            "expected_topics": ["STAR method", "Pressure handling"],
            "scoring_rubric": {"key_points": ["Specific example", "Actions", "Results"], "red_flags": ["Generic"]},
        },
        {
            "id": "q-7",
            "text": "Describe a situation where you had to collaborate with a difficult team member.",
            "type": "behavioral",
            "category": "Behavioral",
            "difficulty": "medium",
            "time_limit_seconds": 180,
            "expected_topics": ["Teamwork", "Conflict resolution"],
            "scoring_rubric": {"key_points": ["Specific situation", "Resolution"], "red_flags": ["Blaming"]},
        },
        {
            "id": "q-8",
            "text": "Give an example of when you took initiative to improve something.",
            "type": "behavioral",
            "category": "Behavioral",
            "difficulty": "medium",
            "time_limit_seconds": 180,
            "expected_topics": ["Initiative", "Impact"],
            "scoring_rubric": {"key_points": ["Proactive action", "Outcome"], "red_flags": ["No examples"]},
        },
        # 2 HR questions
        {
            "id": "q-9",
            "text": f"Why are you interested in this {target_role} position?",
            "type": "hr",
            "category": "HR & Culture Fit",
            "difficulty": "easy",
            "time_limit_seconds": 120,
            "expected_topics": ["Motivation", "Career goals"],
            "scoring_rubric": {"key_points": ["Genuine interest", "Alignment"], "red_flags": ["Only money"]},
        },
        {
            "id": "q-10",
            "text": "Where do you see yourself in 5 years?",
            "type": "hr",
            "category": "HR & Culture Fit",
            "difficulty": "easy",
            "time_limit_seconds": 120,
            "expected_topics": ["Career vision", "Growth"],
            "scoring_rubric": {"key_points": ["Clear goals"], "red_flags": ["Unclear"]},
        },
    ]
    
    return {
        "session_type": "mixed",
        "difficulty_level": "medium",
        "total_questions": 10,
        "estimated_duration_minutes": 35,
        "technical_question_count": 5,
        "behavioral_question_count": 3,
        "hr_question_count": 2,
        "situational_question_count": 0,
        "question_categories": [
            {"category": "Technical", "count": 5, "difficulty": "medium", "rationale": "Core skills assessment"},
            {"category": "Behavioral", "count": 3, "difficulty": "medium", "rationale": "Soft skills assessment"},
            {"category": "HR", "count": 2, "difficulty": "easy", "rationale": "Culture fit assessment"},
        ],
        "strength_focus_areas": [{"area": "Technical Skills", "reason": "Core competency", "question_count": 3}],
        "weakness_focus_areas": [{"area": "To be assessed", "reason": "Will determine during interview", "question_count": 2}],
        "skills_to_test": ["Problem Solving", "Communication", "Technical Knowledge", "Teamwork"],
        "questions": questions,
        "summary": f"Standard interview plan for {target_role} with 10 questions covering technical, behavioral, and HR topics. Duration: ~35 minutes.",
        "rationale": "Generated using fallback method to ensure interview can proceed.",
        "company_mode": None,
        "company_info": None,
    }


def create_fallback_plan_model(
    db: Session,
    user_id: str,
    resume_id: str,
    target_role: str,
) -> InterviewPlan:
    """
    Create a fallback InterviewPlan database record.
    
    This ALWAYS works - no external dependencies.
    """
    plan_data = create_static_fallback_plan(target_role)
    
    plan = InterviewPlan(
        id=str(uuid.uuid4()),
        user_id=user_id,
        resume_id=resume_id,
        ats_analysis_id=None,
        target_role=target_role,
        target_role_description=None,
        
        session_type=plan_data["session_type"],
        difficulty_level=plan_data["difficulty_level"],
        total_questions=plan_data["total_questions"],
        estimated_duration_minutes=plan_data["estimated_duration_minutes"],
        
        technical_question_count=plan_data["technical_question_count"],
        behavioral_question_count=plan_data["behavioral_question_count"],
        hr_question_count=plan_data["hr_question_count"],
        situational_question_count=plan_data["situational_question_count"],
        
        question_categories=plan_data["question_categories"],
        strength_focus_areas=plan_data["strength_focus_areas"],
        weakness_focus_areas=plan_data["weakness_focus_areas"],
        skills_to_test=plan_data["skills_to_test"],
        questions=plan_data["questions"],
        
        summary=plan_data["summary"],
        rationale=plan_data["rationale"],
        
        company_mode=None,
        company_info=None,
        
        generation_source="fallback",
        generation_model=None,
        processing_time_ms=0,
        status="ready",
    )
    
    try:
        db.add(plan)
        db.commit()
        db.refresh(plan)
        logger.info(f"Fallback plan saved to database: {plan.id}")
    except Exception as e:
        logger.error(f"Failed to save fallback plan to database: {e}")
        db.rollback()
        # Even if DB save fails, return the plan object
        plan.id = str(uuid.uuid4())
    
    return plan


# ===========================================
# HELPER: Convert plan to response
# ===========================================


def plan_to_response(plan) -> PlanResponse:
    """Convert plan model to response schema.
    
    SAFETY: All values are explicitly cast to handle NULL from SQLite.
    """
    return PlanResponse(
        id=plan.id,
        user_id=plan.user_id,
        resume_id=plan.resume_id,
        ats_analysis_id=plan.ats_analysis_id,
        target_role=plan.target_role or "Unknown Role",
        session_type=plan.session_type or "mixed",
        difficulty_level=plan.difficulty_level or "medium",
        total_questions=plan.total_questions or 10,
        estimated_duration_minutes=plan.estimated_duration_minutes or 30,
        breakdown=QuestionBreakdown(
            dsa=getattr(plan, 'dsa_question_count', 0) or 0,
            technical=plan.technical_question_count or 0,
            behavioral=plan.behavioral_question_count or 0,
            hr=plan.hr_question_count or 0,
            situational=plan.situational_question_count or 0,
        ),
        question_categories=[
            QuestionCategory(**c) for c in (plan.question_categories or [])
        ],
        strength_focus_areas=[
            FocusArea(**f) for f in (plan.strength_focus_areas or [])
        ],
        weakness_focus_areas=[
            FocusArea(**f) for f in (plan.weakness_focus_areas or [])
        ],
        skills_to_test=plan.skills_to_test or [],
        summary=plan.summary or "",
        rationale=plan.rationale or "",
        company_mode=plan.company_mode,  # OK to be None
        company_info=plan.company_info,  # OK to be None
        generation_source=plan.generation_source or "mock",
        status=plan.status or "ready",
        # CRITICAL: is_used MUST be a boolean, never None
        is_used=bool(plan.is_used) if plan.is_used is not None else False,
        created_at=plan.created_at.isoformat() if plan.created_at else None,
    )


def plan_to_preview(plan) -> PlanPreviewResponse:
    """Convert plan model to preview schema.
    
    SAFETY: All values are explicitly cast to handle NULL from SQLite.
    """
    return PlanPreviewResponse(
        id=plan.id,
        target_role=plan.target_role or "Unknown Role",
        session_type=plan.session_type or "mixed",
        difficulty_level=plan.difficulty_level or "medium",
        total_questions=plan.total_questions or 10,
        estimated_duration_minutes=plan.estimated_duration_minutes or 30,
        breakdown=QuestionBreakdown(
            dsa=getattr(plan, 'dsa_question_count', 0) or 0,
            technical=plan.technical_question_count or 0,
            behavioral=plan.behavioral_question_count or 0,
            hr=plan.hr_question_count or 0,
            situational=plan.situational_question_count or 0,
        ),
        summary=plan.summary or "",
        company_mode=plan.company_mode,  # OK to be None
        company_info=plan.company_info,  # OK to be None
        status=plan.status or "ready",
        is_used=bool(plan.is_used) if plan.is_used is not None else False,
        created_at=plan.created_at.isoformat() if plan.created_at else None,
    )


# ===========================================
# GENERATE INTERVIEW PLAN
# ===========================================


@router.post(
    "/plan/{resume_id}",
    response_model=PlanGenerateResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate interview plan for resume",
    description="Generate a personalized interview plan based on resume and ATS analysis.",
    responses={
        200: {"description": "Plan generated successfully"},
        401: {"model": PlanErrorResponse, "description": "Not authenticated"},
        404: {"model": PlanErrorResponse, "description": "Resume not found"},
    }
)
async def generate_plan(
    resume_id: str,
    request: PlanGenerateRequest,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Generate a personalized interview plan.
    
    GUARANTEED: Always returns a valid plan. NEVER fails.
    
    - Analyzes resume content and ATS results
    - Creates question breakdown by category
    - Focuses on weak areas (more questions) and strengths (deeper questions)
    - Always includes HR and behavioral questions
    
    If anything fails, returns a static fallback plan.
    """
    logger.info(f"=== PLAN GENERATION REQUEST ===")
    logger.info(f"resume_id: {resume_id}")
    logger.info(f"user_id: {current_user.get('id')}")
    logger.info(f"target_role: {request.target_role}")
    
    # Extract target role with fallback
    target_role = request.target_role or "Software Engineer"
    
    # =============================================
    # STEP 1: Get resume (with fallback)
    # =============================================
    resume = None
    try:
        resume = db.query(Resume).filter(
            Resume.id == resume_id,
            Resume.user_id == current_user["id"],
        ).first()
    except Exception as e:
        logger.error(f"Failed to query resume: {e}")
    
    if not resume:
        logger.warning(f"Resume not found: {resume_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found"
        )
    
    # Ensure resume has text content (fallback to filename)
    if not resume.text_content:
        logger.warning(f"Resume {resume_id} has no text content, using filename")
        try:
            resume.text_content = f"Resume for {resume.filename or 'candidate'}"
            db.commit()
        except Exception:
            pass
    
    # =============================================
    # STEP 2: Try to generate plan using service
    # =============================================
    plan = None
    generation_method = "unknown"
    
    try:
        logger.info("Attempting plan generation via InterviewPlanService...")
        
        service = InterviewPlanService(db)
        
        # Extract round_config if provided
        round_config_dict = None
        if request.round_config:
            round_config_dict = {
                "dsa_questions": request.round_config.dsa_questions,
                "technical_questions": request.round_config.technical_questions,
                "behavioral_questions": request.round_config.behavioral_questions,
                "hr_questions": request.round_config.hr_questions,
            }
        
        plan = await service.generate_plan(
            resume=resume,
            user_id=current_user["id"],
            target_role=target_role,
            target_description=request.target_role_description,
            session_type=request.session_type or "mixed",
            difficulty=request.difficulty_level or "medium",
            question_count=request.question_count or 10,
            company_mode=request.company_mode,
            round_config=round_config_dict,
            persona=request.persona,
        )
        
        if plan:
            generation_method = plan.generation_source or "service"
            logger.info(f"Plan generated via service: {plan.id}, source: {generation_method}")
        
    except Exception as e:
        logger.error(f"Service plan generation failed: {e}")
        plan = None
    
    # =============================================
    # STEP 3: If service failed, use STATIC FALLBACK
    # =============================================
    if not plan:
        logger.warning("Service failed, using STATIC FALLBACK PLAN")
        
        try:
            plan = create_fallback_plan_model(
                db=db,
                user_id=current_user["id"],
                resume_id=resume_id,
                target_role=target_role,
            )
            generation_method = "fallback"
            logger.info(f"Fallback plan created: {plan.id}")
            
        except Exception as e:
            logger.error(f"Even fallback plan creation failed: {e}")
            
            # ULTIMATE FALLBACK: Create in-memory plan object
            plan_data = create_static_fallback_plan(target_role)
            
            class InMemoryPlan:
                pass
            
            plan = InMemoryPlan()
            plan.id = str(uuid.uuid4())
            plan.user_id = current_user["id"]
            plan.resume_id = resume_id
            plan.ats_analysis_id = None
            plan.target_role = target_role
            plan.session_type = plan_data["session_type"]
            plan.difficulty_level = plan_data["difficulty_level"]
            plan.total_questions = plan_data["total_questions"]
            plan.estimated_duration_minutes = plan_data["estimated_duration_minutes"]
            plan.technical_question_count = plan_data["technical_question_count"]
            plan.behavioral_question_count = plan_data["behavioral_question_count"]
            plan.hr_question_count = plan_data["hr_question_count"]
            plan.situational_question_count = plan_data["situational_question_count"]
            plan.question_categories = plan_data["question_categories"]
            plan.strength_focus_areas = plan_data["strength_focus_areas"]
            plan.weakness_focus_areas = plan_data["weakness_focus_areas"]
            plan.skills_to_test = plan_data["skills_to_test"]
            plan.questions = plan_data["questions"]
            plan.summary = plan_data["summary"]
            plan.rationale = plan_data["rationale"]
            plan.company_mode = None
            plan.company_info = None
            plan.generation_source = "emergency_fallback"
            plan.status = "ready"
            plan.is_used = False
            plan.created_at = datetime.utcnow()
            
            generation_method = "emergency_fallback"
            logger.warning(f"Emergency fallback plan created in-memory: {plan.id}")
    
    # =============================================
    # STEP 4: Return response (ALWAYS succeeds)
    # =============================================
    try:
        response_plan = plan_to_response(plan)
    except Exception as e:
        logger.error(f"Failed to convert plan to response: {e}")
        # Manual response construction
        response_plan = PlanResponse(
            id=getattr(plan, 'id', str(uuid.uuid4())),
            user_id=current_user["id"],
            resume_id=resume_id,
            ats_analysis_id=None,
            target_role=target_role,
            session_type="mixed",
            difficulty_level="medium",
            total_questions=10,
            estimated_duration_minutes=35,
            breakdown=QuestionBreakdown(technical=5, behavioral=3, hr=2, situational=0),
            question_categories=[],
            strength_focus_areas=[],
            weakness_focus_areas=[],
            skills_to_test=["Problem Solving", "Communication"],
            summary=f"Interview plan for {target_role}",
            rationale="Generated using fallback",
            company_mode=None,
            company_info=None,
            generation_source="fallback",
            status="ready",
            is_used=False,
            created_at=datetime.utcnow().isoformat(),
        )
    
    # Determine message
    if generation_method == "gemini":
        message = "Interview plan generated successfully using AI"
    elif generation_method == "mock":
        message = "Interview plan generated successfully"
    elif generation_method in ["fallback", "emergency_fallback"]:
        message = "Interview plan generated (using fallback)"
    else:
        message = "Interview plan ready"
    
    logger.info(f"=== PLAN GENERATION COMPLETE: {generation_method} ===")
    
    return PlanGenerateResponse(
        success=True,
        message=message,
        plan=response_plan,
    )


# ===========================================
# GET PLAN BY ID
# ===========================================


@router.get(
    "/plan/{plan_id}",
    response_model=PlanGetResponse,
    summary="Get interview plan by ID",
    description="Get a specific interview plan.",
    responses={
        200: {"description": "Plan retrieved successfully"},
        401: {"model": PlanErrorResponse, "description": "Not authenticated"},
        404: {"model": PlanErrorResponse, "description": "Plan not found"},
    }
)
async def get_plan(
    plan_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get an interview plan by ID.
    
    **Security:**
    - Only returns if user owns this plan
    """
    service = InterviewPlanService(db)
    plan = service.get_plan_by_id(plan_id, current_user["id"])
    
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found"
        )
    
    return PlanGetResponse(success=True, plan=plan_to_response(plan))


# ===========================================
# GET PLAN BY RESUME
# ===========================================


@router.get(
    "/plans/resume/{resume_id}",
    response_model=PlanGetResponse,
    summary="Get latest plan for resume",
    description="Get the most recent interview plan for a specific resume.",
    responses={
        200: {"description": "Plan retrieved successfully"},
        401: {"model": PlanErrorResponse, "description": "Not authenticated"},
    }
)
async def get_resume_plan(
    resume_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get the latest interview plan for a resume.
    
    **Security:**
    - Only returns if user owns this resume
    """
    service = InterviewPlanService(db)
    plan = service.get_plan_by_resume(resume_id, current_user["id"])
    
    if not plan:
        return PlanGetResponse(success=True, plan=None)
    
    return PlanGetResponse(success=True, plan=plan_to_response(plan))


# ===========================================
# GET USER'S PLANS
# ===========================================


@router.get(
    "/plans/me",
    response_model=PlanListResponse,
    summary="Get user's interview plans",
    description="Get all interview plans for the current user.",
    responses={
        200: {"description": "Plans retrieved successfully"},
        401: {"model": PlanErrorResponse, "description": "Not authenticated"},
    }
)
async def get_user_plans(
    limit: int = 10,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get all interview plans for the current user.
    
    Returns plan previews, ordered by most recent first.
    """
    service = InterviewPlanService(db)
    plans = service.get_user_plans(current_user["id"], limit=limit)
    
    previews = [plan_to_preview(p) for p in plans]
    
    return PlanListResponse(
        success=True,
        plans=previews,
        total=len(previews),
    )


# ===========================================
# GET PLAN QUESTIONS
# ===========================================


@router.get(
    "/plan/{plan_id}/questions",
    response_model=PlanQuestionsResponse,
    summary="Get questions from plan",
    description="Get the generated questions from an interview plan.",
    responses={
        200: {"description": "Questions retrieved successfully"},
        401: {"model": PlanErrorResponse, "description": "Not authenticated"},
        404: {"model": PlanErrorResponse, "description": "Plan not found"},
    }
)
async def get_plan_questions(
    plan_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get the questions from an interview plan.
    
    Use this to preview questions before starting the interview.
    
    **Security:**
    - Only returns if user owns this plan
    """
    service = InterviewPlanService(db)
    plan = service.get_plan_by_id(plan_id, current_user["id"])
    
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found"
        )
    
    questions = [
        PlannedQuestion(**q) for q in (plan.questions or [])
    ]
    
    return PlanQuestionsResponse(
        success=True,
        questions=questions,
        total=len(questions),
    )
