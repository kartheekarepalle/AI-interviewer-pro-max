"""
Career Roadmap Routes

API endpoints for career roadmap generation and retrieval.
All routes are protected and require authentication.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.roadmap.service import RoadmapService
from app.roadmap.schemas import (
    GenerateRoadmapRequest,
    GenerateRoadmapResponse,
    GetRoadmapResponse,
    RoadmapsListResponse,
    RoadmapSummarySchema,
    CareerRoadmapSchema,
    ContextSchema,
    SkillGapsSchema,
    SkillGapSchema,
    LearningSchema,
    LearningTopicSchema,
    ProjectsSchema,
    ProjectSchema,
    PracticeSchema,
    PracticeStrategySchema,
    TimelineSchema,
    MilestoneSchema,
    PhaseSchema,
    SummarySchema,
    ErrorResponse,
)

router = APIRouter()


def _build_roadmap_schema(roadmap_data: dict) -> CareerRoadmapSchema:
    """Build roadmap schema from dict."""
    # Build nested schemas
    context = ContextSchema(
        target_role=roadmap_data["context"]["target_role"],
        current_level=roadmap_data["context"]["current_level"],
        target_level=roadmap_data["context"]["target_level"],
        readiness_score=roadmap_data["context"]["readiness_score"],
    )
    
    skill_gaps = SkillGapsSchema(
        gaps=[SkillGapSchema(**g) for g in roadmap_data["skill_gaps"]["gaps"]],
        missing=roadmap_data["skill_gaps"]["missing"],
        to_improve=roadmap_data["skill_gaps"]["to_improve"],
    )
    
    learning = LearningSchema(
        topics=[LearningTopicSchema(**t) for t in roadmap_data["learning"]["topics"]],
        courses=roadmap_data["learning"]["courses"],
        books=roadmap_data["learning"]["books"],
    )
    
    projects = ProjectsSchema(
        recommended=[ProjectSchema(**p) for p in roadmap_data["projects"]["recommended"]],
        portfolio=roadmap_data["projects"]["portfolio"],
    )
    
    practice_strategy_data = roadmap_data["practice"]["strategy"]
    practice = PracticeSchema(
        strategy=PracticeStrategySchema(
            daily_routine=practice_strategy_data.get("daily_routine"),
            weekly_goals=practice_strategy_data.get("weekly_goals", []),
            mock_interview_frequency=practice_strategy_data.get("mock_interview_frequency"),
        ),
        interview_tips=roadmap_data["practice"]["interview_tips"],
        behavioral=roadmap_data["practice"]["behavioral"],
    )
    
    timeline = TimelineSchema(
        total_weeks=roadmap_data["timeline"]["total_weeks"],
        milestones=[MilestoneSchema(**m) for m in roadmap_data["timeline"]["milestones"]],
        phases=[PhaseSchema(**p) for p in roadmap_data["timeline"]["phases"]],
    )
    
    summary = SummarySchema(
        executive=roadmap_data["summary"]["executive"],
        key_actions=roadmap_data["summary"]["key_actions"],
        success_metrics=roadmap_data["summary"]["success_metrics"],
    )
    
    return CareerRoadmapSchema(
        id=roadmap_data["id"],
        session_id=roadmap_data["session_id"],
        version=roadmap_data["version"],
        is_active=roadmap_data["is_active"],
        context=context,
        skill_gaps=skill_gaps,
        learning=learning,
        projects=projects,
        practice=practice,
        timeline=timeline,
        summary=summary,
        generated_at=roadmap_data["generated_at"],
        source=roadmap_data["source"],
        disclaimer=roadmap_data["disclaimer"],
    )


# ===========================================
# GENERATE ROADMAP
# ===========================================


@router.post(
    "/generate/{session_id}",
    response_model=GenerateRoadmapResponse,
    summary="Generate career roadmap",
    description="Generate personalized career roadmap based on interview performance.",
    responses={
        200: {"description": "Roadmap generated"},
        400: {"model": ErrorResponse, "description": "Invalid request"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def generate_roadmap(
    session_id: str,
    request: GenerateRoadmapRequest = GenerateRoadmapRequest(),
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Generate personalized career roadmap.
    
    Based on:
    - Interview performance
    - Resume skills
    - ATS analysis
    - Target role
    
    Returns actionable learning path with timeline.
    """
    try:
        service = RoadmapService(db)
        roadmap = await service.generate_roadmap(
            user_id=current_user["id"],
            session_id=session_id,
            target_role=request.target_role,
            current_level=request.current_level,
            target_level=request.target_level,
        )
        
        roadmap_data = roadmap.to_dict()
        roadmap_schema = _build_roadmap_schema(roadmap_data)
        
        return GenerateRoadmapResponse(
            success=True,
            message="Career roadmap generated successfully",
            roadmap=roadmap_schema,
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        print(f"Roadmap generation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate roadmap"
        )


@router.post(
    "/generate",
    response_model=GenerateRoadmapResponse,
    summary="Generate standalone roadmap",
    description="Generate career roadmap without a specific interview session.",
    responses={
        200: {"description": "Roadmap generated"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def generate_standalone_roadmap(
    request: GenerateRoadmapRequest = GenerateRoadmapRequest(),
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Generate standalone roadmap without interview session."""
    try:
        service = RoadmapService(db)
        roadmap = await service.generate_roadmap(
            user_id=current_user["id"],
            session_id=None,
            target_role=request.target_role or "Software Developer",
            current_level=request.current_level,
            target_level=request.target_level,
        )
        
        roadmap_data = roadmap.to_dict()
        roadmap_schema = _build_roadmap_schema(roadmap_data)
        
        return GenerateRoadmapResponse(
            success=True,
            message="Career roadmap generated successfully",
            roadmap=roadmap_schema,
        )
        
    except Exception as e:
        print(f"Roadmap generation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate roadmap"
        )


# ===========================================
# GET ROADMAP
# ===========================================


@router.get(
    "/{session_id}",
    response_model=GetRoadmapResponse,
    summary="Get career roadmap",
    description="Get active roadmap for session.",
    responses={
        200: {"description": "Roadmap retrieved"},
        404: {"model": ErrorResponse, "description": "Not found"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def get_roadmap(
    session_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get active roadmap for session."""
    service = RoadmapService(db)
    roadmap = service.get_roadmap(
        session_id=session_id,
        user_id=current_user["id"],
    )
    
    if not roadmap:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roadmap not found. Generate one first."
        )
    
    roadmap_data = roadmap.to_dict()
    roadmap_schema = _build_roadmap_schema(roadmap_data)
    
    return GetRoadmapResponse(
        success=True,
        roadmap=roadmap_schema,
    )


# ===========================================
# LIST USER ROADMAPS
# ===========================================


@router.get(
    "/",
    response_model=RoadmapsListResponse,
    summary="List user roadmaps",
    description="Get list of user's roadmaps.",
    responses={
        200: {"description": "Roadmaps retrieved"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def list_roadmaps(
    limit: int = 10,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get list of user's roadmaps."""
    service = RoadmapService(db)
    roadmaps = service.get_user_roadmaps(
        user_id=current_user["id"],
        limit=limit,
    )
    
    summaries = [
        RoadmapSummarySchema(
            id=r.id,
            session_id=r.session_id,
            target_role=r.target_role,
            version=r.version,
            total_weeks=r.total_duration_weeks,
            generated_at=r.generated_at.isoformat() if r.generated_at else None,
            is_active=r.is_active,
        )
        for r in roadmaps
    ]
    
    return RoadmapsListResponse(
        success=True,
        roadmaps=summaries,
        total=len(summaries),
    )
