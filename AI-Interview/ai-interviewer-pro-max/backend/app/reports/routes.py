"""
Interview Report Routes

API endpoints for interview report generation and retrieval.
All routes are protected and require authentication.

Reports are IMMUTABLE after generation.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.reports.service import ReportService
from app.reports.schemas import (
    GenerateReportRequest,
    GenerateReportResponse,
    GetReportResponse,
    ReportsListResponse,
    ReportSummarySchema,
    InterviewReportSchema,
    ReadinessSchema,
    SkillsSchema,
    SkillScoreSchema,
    StrengthSchema,
    WeaknessSchema,
    BehavioralSchema,
    ImprovementsSchema,
    ImprovementAreaSchema,
    StatisticsSchema,
    QuestionFeedbackSchema,
    TopicToStudySchema,
    ErrorResponse,
)

router = APIRouter()


# ===========================================
# GENERATE REPORT
# ===========================================


@router.post(
    "/generate/{session_id}",
    response_model=GenerateReportResponse,
    summary="Generate interview report",
    description="Generate comprehensive interview report with readiness score.",
    responses={
        200: {"description": "Report generated"},
        400: {"model": ErrorResponse, "description": "Invalid request"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Session not found"},
    }
)
async def generate_report(
    session_id: str,
    request: GenerateReportRequest = GenerateReportRequest(),
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Generate comprehensive interview report.
    
    Aggregates:
    - Answer evaluations
    - Behavioral insights
    - Interview statistics
    
    Produces:
    - Readiness score (0-100)
    - Skill breakdown
    - Strengths & weaknesses
    - Improvement suggestions
    
    NOTE: Reports are IMMUTABLE after generation.
    """
    try:
        service = ReportService(db)
        report = await service.generate_report(
            user_id=current_user["id"],
            session_id=session_id,
        )
        
        # Build response
        report_data = report.to_dict()
        
        # Build schema objects - clamp score to 0-100 for safety
        readiness = ReadinessSchema(
            score=max(0, min(100, report_data["readiness"]["score"] or 0)),
            grade=report_data["readiness"]["grade"],
            level=report_data["readiness"]["level"],
            breakdown=report_data["readiness"]["breakdown"],
            explanation=report_data["readiness"]["explanation"],
        )
        
        skills = SkillsSchema(
            scores=[SkillScoreSchema(**s) for s in report_data["skills"]["scores"]] if report_data["skills"]["scores"] else [],
            categories=report_data["skills"]["categories"],
        )
        
        strengths = [StrengthSchema(**s) for s in report_data["strengths"]]
        weaknesses = [WeaknessSchema(**s) for s in report_data["weaknesses"]]
        
        behavioral = BehavioralSchema(
            summary=report_data["behavioral"]["summary"],
            emotional_pattern=report_data["behavioral"]["emotional_pattern"],
            confidence_trend=report_data["behavioral"]["confidence_trend"],
            communication_style=report_data["behavioral"]["communication_style"],
        )
        
        improvements = ImprovementsSchema(
            areas=[ImprovementAreaSchema(**a) for a in report_data["improvements"]["areas"]],
            topics=report_data["improvements"]["topics"],
            practice=report_data["improvements"]["practice"],
            topics_to_study=[TopicToStudySchema(**t) for t in report_data["improvements"].get("topics_to_study", [])],
        )
        
        statistics = StatisticsSchema(
            total_questions=report_data["statistics"]["total_questions"],
            answered=report_data["statistics"]["answered"],
            skipped=report_data["statistics"]["skipped"],
            avg_response_time=report_data["statistics"]["avg_response_time"],
            duration_minutes=report_data["statistics"]["duration_minutes"],
        )
        
        # Get question-by-question feedback
        question_feedback_data = service.get_question_feedback(
            session_id=session_id,
            user_id=current_user["id"],
        )
        question_feedback = [QuestionFeedbackSchema(**q) for q in question_feedback_data]
        
        report_schema = InterviewReportSchema(
            id=report_data["id"],
            session_id=report_data["session_id"],
            target_role=report_data["target_role"],
            company_name=report_data["company_name"],
            interview_type=report_data["interview_type"],
            readiness=readiness,
            skills=skills,
            strengths=strengths,
            weaknesses=weaknesses,
            behavioral=behavioral,
            improvements=improvements,
            statistics=statistics,
            executive_summary=report_data["executive_summary"],
            recommendation=report_data["recommendation"],
            generated_at=report_data["generated_at"],
            source=report_data["source"],
            disclaimer=report_data["disclaimer"],
            question_feedback=question_feedback,
        )
        
        return GenerateReportResponse(
            success=True,
            message="Report generated successfully",
            report=report_schema,
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        print(f"Report generation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate report"
        )


# ===========================================
# FINALIZE INTERVIEW (GUARANTEED REPORT)
# ===========================================


@router.post(
    "/finalize/{session_id}",
    response_model=GenerateReportResponse,
    summary="Finalize interview and generate report",
    description="Finalize a completed interview session and generate the report. This is the guaranteed entry point for report generation.",
    responses={
        200: {"description": "Report generated/retrieved"},
        400: {"model": ErrorResponse, "description": "Invalid request"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "Session not found"},
    }
)
async def finalize_interview_endpoint(
    session_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Finalize an interview and generate the report.
    
    GUARANTEED to:
    ✔ Generate final summary (Gemini if available)
    ✔ Compute final scores
    ✔ Create structured report
    ✔ Persist report to database
    ✔ Mark session as COMPLETED
    
    This is idempotent - calling multiple times returns the same report.
    """
    try:
        service = ReportService(db)
        report = await service.finalize_interview(
            session_id=session_id,
            user_id=current_user["id"],
        )
        
        # Build response using same logic as generate_report
        report_data = report.to_dict()
        
        readiness = ReadinessSchema(
            score=max(0, min(100, report_data["readiness"]["score"] or 0)),
            grade=report_data["readiness"]["grade"],
            level=report_data["readiness"]["level"],
            breakdown=report_data["readiness"]["breakdown"],
            explanation=report_data["readiness"]["explanation"],
        )
        
        skills = SkillsSchema(
            scores=[SkillScoreSchema(**s) for s in report_data["skills"]["scores"]] if report_data["skills"]["scores"] else [],
            categories=report_data["skills"]["categories"],
        )
        
        strengths = [StrengthSchema(**s) for s in report_data["strengths"]]
        weaknesses = [WeaknessSchema(**s) for s in report_data["weaknesses"]]
        
        behavioral = BehavioralSchema(
            summary=report_data["behavioral"]["summary"],
            emotional_pattern=report_data["behavioral"]["emotional_pattern"],
            confidence_trend=report_data["behavioral"]["confidence_trend"],
            communication_style=report_data["behavioral"]["communication_style"],
        )
        
        improvements = ImprovementsSchema(
            areas=[ImprovementAreaSchema(**a) for a in report_data["improvements"]["areas"]],
            topics=report_data["improvements"]["topics"],
            practice=report_data["improvements"]["practice"],
            topics_to_study=[TopicToStudySchema(**t) for t in report_data["improvements"].get("topics_to_study", [])],
        )
        
        statistics = StatisticsSchema(
            total_questions=report_data["statistics"]["total_questions"],
            answered=report_data["statistics"]["answered"],
            skipped=report_data["statistics"]["skipped"],
            avg_response_time=report_data["statistics"]["avg_response_time"],
            duration_minutes=report_data["statistics"]["duration_minutes"],
        )
        
        # Get question-by-question feedback
        question_feedback_data = service.get_question_feedback(
            session_id=session_id,
            user_id=current_user["id"],
        )
        question_feedback = [QuestionFeedbackSchema(**q) for q in question_feedback_data]
        
        report_schema = InterviewReportSchema(
            id=report_data["id"],
            session_id=report_data["session_id"],
            target_role=report_data["target_role"],
            company_name=report_data["company_name"],
            interview_type=report_data["interview_type"],
            readiness=readiness,
            skills=skills,
            strengths=strengths,
            weaknesses=weaknesses,
            behavioral=behavioral,
            improvements=improvements,
            statistics=statistics,
            executive_summary=report_data["executive_summary"],
            recommendation=report_data["recommendation"],
            generated_at=report_data["generated_at"],
            source=report_data["source"],
            disclaimer=report_data["disclaimer"],
            question_feedback=question_feedback,
        )
        
        return GenerateReportResponse(
            success=True,
            message="Interview finalized and report generated successfully",
            report=report_schema,
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        print(f"Finalize interview error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to finalize interview"
        )


# ===========================================
# GET REPORT
# ===========================================


@router.get(
    "/{session_id}",
    response_model=GetReportResponse,
    summary="Get interview report",
    description="Get interview report by session ID.",
    responses={
        200: {"description": "Report retrieved"},
        404: {"model": ErrorResponse, "description": "Report not found"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def get_report(
    session_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get interview report by session ID.
    
    If the report doesn't exist but the session is completed,
    this endpoint will attempt to generate the report automatically.
    """
    service = ReportService(db)
    report = service.get_report(
        session_id=session_id,
        user_id=current_user["id"],
    )
    
    if not report:
        # Check if session exists and is completed - if so, try to generate report
        from app.interviews.live_models import LiveInterviewSession
        session = db.query(LiveInterviewSession).filter(
            LiveInterviewSession.id == session_id,
            LiveInterviewSession.user_id == current_user["id"],
        ).first()
        
        if session and session.status == "completed":
            # Session is completed but report missing - generate it now
            try:
                print(f"[GET_REPORT] Report missing for completed session {session_id}, generating now...")
                report = await service.finalize_interview(
                    session_id=session_id,
                    user_id=current_user["id"],
                )
            except Exception as e:
                print(f"[GET_REPORT] Failed to generate report: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Report generation failed. Please try again."
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report not found. Complete an interview first."
            )
    
    # Build response (same as generate) - clamp score to 0-100 for safety
    report_data = report.to_dict()
    
    readiness = ReadinessSchema(
        score=max(0, min(100, report_data["readiness"]["score"] or 0)),
        grade=report_data["readiness"]["grade"],
        level=report_data["readiness"]["level"],
        breakdown=report_data["readiness"]["breakdown"],
        explanation=report_data["readiness"]["explanation"],
    )
    
    skills = SkillsSchema(
        scores=[SkillScoreSchema(**s) for s in report_data["skills"]["scores"]] if report_data["skills"]["scores"] else [],
        categories=report_data["skills"]["categories"],
    )
    
    strengths = [StrengthSchema(**s) for s in report_data["strengths"]]
    weaknesses = [WeaknessSchema(**s) for s in report_data["weaknesses"]]
    
    behavioral = BehavioralSchema(
        summary=report_data["behavioral"]["summary"],
        emotional_pattern=report_data["behavioral"]["emotional_pattern"],
        confidence_trend=report_data["behavioral"]["confidence_trend"],
        communication_style=report_data["behavioral"]["communication_style"],
    )
    
    improvements = ImprovementsSchema(
        areas=[ImprovementAreaSchema(**a) for a in report_data["improvements"]["areas"]],
        topics=report_data["improvements"]["topics"],
        practice=report_data["improvements"]["practice"],
        topics_to_study=[TopicToStudySchema(**t) for t in report_data["improvements"].get("topics_to_study", [])],
    )
    
    statistics = StatisticsSchema(
        total_questions=report_data["statistics"]["total_questions"],
        answered=report_data["statistics"]["answered"],
        skipped=report_data["statistics"]["skipped"],
        avg_response_time=report_data["statistics"]["avg_response_time"],
        duration_minutes=report_data["statistics"]["duration_minutes"],
    )
    
    # Get question-by-question feedback
    question_feedback_data = service.get_question_feedback(
        session_id=session_id,
        user_id=current_user["id"],
    )
    question_feedback = [QuestionFeedbackSchema(**q) for q in question_feedback_data]
    
    report_schema = InterviewReportSchema(
        id=report_data["id"],
        session_id=report_data["session_id"],
        target_role=report_data["target_role"],
        company_name=report_data["company_name"],
        interview_type=report_data["interview_type"],
        readiness=readiness,
        skills=skills,
        strengths=strengths,
        weaknesses=weaknesses,
        behavioral=behavioral,
        improvements=improvements,
        statistics=statistics,
        executive_summary=report_data["executive_summary"],
        recommendation=report_data["recommendation"],
        generated_at=report_data["generated_at"],
        source=report_data["source"],
        disclaimer=report_data["disclaimer"],
        question_feedback=question_feedback,
    )
    
    return GetReportResponse(
        success=True,
        report=report_schema,
    )


# ===========================================
# LIST USER REPORTS
# ===========================================


@router.get(
    "/",
    response_model=ReportsListResponse,
    summary="List user reports",
    description="Get list of user's interview reports.",
    responses={
        200: {"description": "Reports retrieved"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def list_reports(
    limit: int = 10,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get list of user's interview reports."""
    service = ReportService(db)
    reports = service.get_user_reports(
        user_id=current_user["id"],
        limit=limit,
    )
    
    summaries = [
        ReportSummarySchema(
            id=r.id,
            session_id=r.session_id,
            target_role=r.target_role,
            readiness_score=r.readiness_score,
            readiness_grade=r.readiness_grade or r.get_grade(),
            generated_at=r.generated_at.isoformat() if r.generated_at else None,
        )
        for r in reports
    ]
    
    return ReportsListResponse(
        success=True,
        reports=summaries,
        total=len(summaries),
    )
