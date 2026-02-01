"""
Company Modes Routes

API endpoints for company interview modes.
"""

from fastapi import APIRouter, HTTPException, status, Depends

from app.core.security import get_current_active_user
from app.companies.modes import (
    get_company_profile,
    get_all_profiles,
    get_profile_summary,
)
from app.companies.schemas import (
    GetModesResponse,
    GetModeResponse,
    CompanySummarySchema,
    CompanyProfileSchema,
    DifficultyBiasSchema,
    QuestionMixSchema,
    PhaseSchema,
    ErrorResponse,
)

router = APIRouter()


@router.get(
    "/modes",
    response_model=GetModesResponse,
    summary="Get all company modes",
    description="Get list of available company interview modes.",
    responses={
        200: {"description": "Modes retrieved"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def get_modes(
    current_user: dict = Depends(get_current_active_user),
):
    """
    Get all available company interview modes.
    
    These are SIMULATED interview patterns based on general
    industry knowledge, not real company data.
    """
    profiles = get_all_profiles()
    summaries = [
        CompanySummarySchema(**get_profile_summary(p))
        for p in profiles
    ]
    
    return GetModesResponse(
        success=True,
        modes=summaries,
        disclaimer="These are simulated interview patterns based on general industry knowledge. They do not represent actual company interview processes.",
    )


@router.get(
    "/modes/{mode_id}",
    response_model=GetModeResponse,
    summary="Get specific company mode",
    description="Get detailed information about a company mode.",
    responses={
        200: {"description": "Mode retrieved"},
        404: {"model": ErrorResponse, "description": "Mode not found"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def get_mode(
    mode_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Get detailed company mode information."""
    profile = get_company_profile(mode_id)
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company mode '{mode_id}' not found"
        )
    
    # Build schema
    mode_data = profile.to_dict()
    
    mode_schema = CompanyProfileSchema(
        id=mode_data["id"],
        name=mode_data["name"],
        type=mode_data["type"],
        description=mode_data["description"],
        focus_areas=mode_data["focus_areas"],
        key_traits=mode_data["key_traits"],
        interview_style=mode_data["interview_style"],
        difficulty_bias=DifficultyBiasSchema(**mode_data["difficulty_bias"]),
        question_mix=QuestionMixSchema(**mode_data["question_mix"]),
        phases=[PhaseSchema(**p) for p in mode_data["phases"]],
        total_questions=mode_data["total_questions"],
        estimated_duration_minutes=mode_data["estimated_duration_minutes"],
        behavioral_weight=mode_data["behavioral_weight"],
        technical_depth=mode_data["technical_depth"],
        system_design_required=mode_data["system_design_required"],
        coding_round_required=mode_data["coding_round_required"],
        culture_fit_emphasis=mode_data["culture_fit_emphasis"],
        interviewer_style=mode_data["interviewer_style"],
        follow_up_likelihood=mode_data["follow_up_likelihood"],
        disclaimer=mode_data["disclaimer"],
    )
    
    return GetModeResponse(
        success=True,
        mode=mode_schema,
    )
