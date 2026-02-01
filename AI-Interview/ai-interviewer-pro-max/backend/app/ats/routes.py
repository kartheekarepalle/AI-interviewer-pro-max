"""
ATS Analysis Routes

API endpoints for ATS scoring and resume analysis.
All routes are protected and require authentication.

Endpoints:
- POST /ats/analyze/{resume_id} - Analyze resume
- GET /ats/result/{analysis_id} - Get analysis result
- GET /ats/resume/{resume_id} - Get latest analysis for resume
- GET /ats/history - Get user's analysis history
"""

from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.core.config import settings
from app.ats.service import ATSService
from app.ats.schemas import (
    ATSAnalyzeRequest,
    ATSAnalyzeResponse,
    ATSGetResponse,
    ATSListResponse,
    ATSResultResponse,
    ATSSummaryResponse,
    ATSErrorResponse,
    ScoreBreakdown,
    SkillInfo,
    StrengthArea,
    WeakArea,
    Recommendation,
)
from app.resumes.models import Resume

router = APIRouter()


# ===========================================
# ANALYZE RESUME (POST)
# ===========================================


@router.post(
    "/analyze/{resume_id}",
    response_model=ATSAnalyzeResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze resume for ATS compatibility",
    description="Perform ATS analysis on a resume against a target job role.",
    responses={
        200: {"description": "Analysis completed successfully"},
        400: {"model": ATSErrorResponse, "description": "Invalid request"},
        401: {"model": ATSErrorResponse, "description": "Not authenticated"},
        404: {"model": ATSErrorResponse, "description": "Resume not found"},
    }
)
async def analyze_resume(
    resume_id: str,
    request: ATSAnalyzeRequest,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Analyze a resume for ATS compatibility.
    
    - Requires a target job role
    - Uses Gemini API if configured, otherwise returns mock analysis
    - Stores results for future reference
    
    **Security:**
    - User can only analyze their own resumes
    
    **Note:**
    - If GEMINI_API_KEY is not configured, returns a deterministic mock response
    """
    # Get resume (user-scoped)
    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == current_user["id"],
    ).first()
    
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found"
        )
    
    if not resume.text_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume has no extracted text. Please re-upload."
        )
    
    try:
        # Perform analysis
        service = ATSService(db)
        analysis = await service.analyze_resume(
            resume=resume,
            user_id=current_user["id"],
            target_role=request.target_role,
            target_description=request.target_role_description,
        )
        
        # Build response
        result = ATSResultResponse(
            id=analysis.id,
            user_id=analysis.user_id,
            resume_id=analysis.resume_id,
            target_role=analysis.target_role,
            overall_score=analysis.overall_score,
            breakdown=ScoreBreakdown(
                keyword_match=analysis.keyword_match_score,
                skills_coverage=analysis.skills_coverage_score,
                experience_alignment=analysis.experience_alignment_score,
                education_fit=analysis.education_fit_score,
                format_quality=analysis.format_quality_score,
            ),
            skills_extracted=[
                SkillInfo(**s) for s in (analysis.skills_extracted or [])
            ],
            matched_keywords=analysis.matched_keywords or [],
            missing_keywords=analysis.missing_keywords or [],
            strength_areas=[
                StrengthArea(**s) for s in (analysis.strength_areas or [])
            ],
            weak_areas=[
                WeakArea(**w) for w in (analysis.weak_areas or [])
            ],
            recommendations=[
                Recommendation(**r) for r in (analysis.recommendations or [])
            ],
            summary=analysis.summary,
            analysis_source=analysis.analysis_source,
            created_at=analysis.created_at.isoformat() if analysis.created_at else None,
        )
        
        return ATSAnalyzeResponse(
            success=True,
            message="Analysis completed successfully" + (
                " (using mock data)" if analysis.analysis_source == "mock" else ""
            ),
            result=result,
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        print(f"ATS analysis error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Analysis failed. Please try again."
        )


# ===========================================
# GET ANALYSIS RESULT
# ===========================================


@router.get(
    "/result/{analysis_id}",
    response_model=ATSGetResponse,
    summary="Get ATS analysis result",
    description="Get a specific ATS analysis result by ID.",
    responses={
        200: {"description": "Analysis retrieved successfully"},
        401: {"model": ATSErrorResponse, "description": "Not authenticated"},
        404: {"model": ATSErrorResponse, "description": "Analysis not found"},
    }
)
async def get_analysis_result(
    analysis_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get a specific ATS analysis result.
    
    **Security:**
    - Only returns if user owns this analysis
    """
    service = ATSService(db)
    analysis = service.get_analysis_by_id(analysis_id, current_user["id"])
    
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found"
        )
    
    result = ATSResultResponse(
        id=analysis.id,
        user_id=analysis.user_id,
        resume_id=analysis.resume_id,
        target_role=analysis.target_role,
        overall_score=analysis.overall_score,
        breakdown=ScoreBreakdown(
            keyword_match=analysis.keyword_match_score,
            skills_coverage=analysis.skills_coverage_score,
            experience_alignment=analysis.experience_alignment_score,
            education_fit=analysis.education_fit_score,
            format_quality=analysis.format_quality_score,
        ),
        skills_extracted=[
            SkillInfo(**s) for s in (analysis.skills_extracted or [])
        ],
        matched_keywords=analysis.matched_keywords or [],
        missing_keywords=analysis.missing_keywords or [],
        strength_areas=[
            StrengthArea(**s) for s in (analysis.strength_areas or [])
        ],
        weak_areas=[
            WeakArea(**w) for w in (analysis.weak_areas or [])
        ],
        recommendations=[
            Recommendation(**r) for r in (analysis.recommendations or [])
        ],
        summary=analysis.summary,
        analysis_source=analysis.analysis_source,
        created_at=analysis.created_at.isoformat() if analysis.created_at else None,
    )
    
    return ATSGetResponse(success=True, result=result)


# ===========================================
# GET LATEST ANALYSIS FOR RESUME
# ===========================================


@router.get(
    "/resume/{resume_id}",
    response_model=ATSGetResponse,
    summary="Get latest ATS analysis for resume",
    description="Get the most recent ATS analysis for a specific resume.",
    responses={
        200: {"description": "Analysis retrieved successfully"},
        401: {"model": ATSErrorResponse, "description": "Not authenticated"},
        404: {"model": ATSErrorResponse, "description": "No analysis found"},
    }
)
async def get_resume_analysis(
    resume_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get the latest ATS analysis for a resume.
    
    **Security:**
    - Only returns if user owns this resume
    """
    service = ATSService(db)
    analysis = service.get_analysis_by_resume(resume_id, current_user["id"])
    
    if not analysis:
        return ATSGetResponse(success=True, result=None)
    
    result = ATSResultResponse(
        id=analysis.id,
        user_id=analysis.user_id,
        resume_id=analysis.resume_id,
        target_role=analysis.target_role,
        overall_score=analysis.overall_score,
        breakdown=ScoreBreakdown(
            keyword_match=analysis.keyword_match_score,
            skills_coverage=analysis.skills_coverage_score,
            experience_alignment=analysis.experience_alignment_score,
            education_fit=analysis.education_fit_score,
            format_quality=analysis.format_quality_score,
        ),
        skills_extracted=[
            SkillInfo(**s) for s in (analysis.skills_extracted or [])
        ],
        matched_keywords=analysis.matched_keywords or [],
        missing_keywords=analysis.missing_keywords or [],
        strength_areas=[
            StrengthArea(**s) for s in (analysis.strength_areas or [])
        ],
        weak_areas=[
            WeakArea(**w) for w in (analysis.weak_areas or [])
        ],
        recommendations=[
            Recommendation(**r) for r in (analysis.recommendations or [])
        ],
        summary=analysis.summary,
        analysis_source=analysis.analysis_source,
        created_at=analysis.created_at.isoformat() if analysis.created_at else None,
    )
    
    return ATSGetResponse(success=True, result=result)


# ===========================================
# GET ANALYSIS HISTORY
# ===========================================


@router.get(
    "/history",
    response_model=ATSListResponse,
    summary="Get ATS analysis history",
    description="Get all ATS analyses for the current user.",
    responses={
        200: {"description": "History retrieved successfully"},
        401: {"model": ATSErrorResponse, "description": "Not authenticated"},
    }
)
async def get_analysis_history(
    limit: int = 10,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get user's ATS analysis history.
    
    Returns summary of all analyses, ordered by most recent first.
    """
    service = ATSService(db)
    analyses = service.get_user_analyses(current_user["id"], limit=limit)
    
    results = [
        ATSSummaryResponse(
            id=a.id,
            resume_id=a.resume_id,
            target_role=a.target_role,
            overall_score=a.overall_score,
            analysis_source=a.analysis_source,
            created_at=a.created_at.isoformat() if a.created_at else None,
        )
        for a in analyses
    ]
    
    return ATSListResponse(
        success=True,
        results=results,
        total=len(results),
    )


# ===========================================
# API STATUS
# ===========================================


@router.get(
    "/status",
    summary="Get ATS API status",
    description="Check if Gemini API is configured for real analysis.",
)
async def get_ats_status(
    current_user: dict = Depends(get_current_active_user),
):
    """
    Get ATS analysis capability status.
    
    Returns whether Gemini API is configured for real analysis
    or if mock responses will be used.
    """
    return {
        "success": True,
        "gemini_configured": settings.is_gemini_configured(),
        "analysis_mode": "gemini" if settings.is_gemini_configured() else "mock",
        "message": (
            "Real AI analysis available" if settings.is_gemini_configured()
            else "Using mock analysis (configure GEMINI_API_KEY for real analysis)"
        ),
    }
