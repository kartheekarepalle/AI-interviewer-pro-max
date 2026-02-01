"""
Personality Routes

API endpoints for interviewer personality modes.
"""

from fastapi import APIRouter, HTTPException, status, Depends

from app.core.security import get_current_active_user
from app.personalities.modes import (
    get_personality,
    get_all_personalities,
    get_personality_summary,
)
from app.personalities.schemas import (
    GetPersonalitiesResponse,
    GetPersonalityResponse,
    PersonalitySummarySchema,
    PersonalityProfileSchema,
    ToneRulesSchema,
    ResponseStyleSchema,
    FollowUpConfigSchema,
    ErrorResponse,
)

router = APIRouter()


def _build_profile_schema(profile) -> PersonalityProfileSchema:
    """Build profile schema from dataclass."""
    data = profile.to_dict()
    return PersonalityProfileSchema(
        id=data["id"],
        name=data["name"],
        type=data["type"],
        description=data["description"],
        tone_rules=ToneRulesSchema(**data["tone_rules"]),
        response_style=ResponseStyleSchema(**data["response_style"]),
        follow_up_config=FollowUpConfigSchema(**data["follow_up_config"]),
        system_prompt_modifier=data["system_prompt_modifier"],
        question_style_hints=data["question_style_hints"],
        feedback_tone_hints=data["feedback_tone_hints"],
        icon=data["icon"],
        color=data["color"],
        disclaimer=data["disclaimer"],
    )


@router.get(
    "/",
    response_model=GetPersonalitiesResponse,
    summary="Get all interviewer personalities",
    description="Get list of available interviewer personality modes.",
    responses={
        200: {"description": "Personalities retrieved"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def get_personalities(
    current_user: dict = Depends(get_current_active_user),
):
    """
    Get all available interviewer personality modes.
    
    These affect TONE and DELIVERY only, not scoring or evaluation.
    """
    profiles = get_all_personalities()
    summaries = [
        PersonalitySummarySchema(**get_personality_summary(p))
        for p in profiles
    ]
    
    return GetPersonalitiesResponse(
        success=True,
        personalities=summaries,
        disclaimer="Personality modes affect interview tone and delivery only. Scoring and evaluation remain fair and consistent across all modes.",
    )


@router.get(
    "/{personality_id}",
    response_model=GetPersonalityResponse,
    summary="Get specific personality",
    description="Get detailed information about a personality mode.",
    responses={
        200: {"description": "Personality retrieved"},
        404: {"model": ErrorResponse, "description": "Personality not found"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def get_personality_detail(
    personality_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Get detailed personality information."""
    profile = get_personality(personality_id)
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Personality '{personality_id}' not found"
        )
    
    return GetPersonalityResponse(
        success=True,
        personality=_build_profile_schema(profile),
    )
