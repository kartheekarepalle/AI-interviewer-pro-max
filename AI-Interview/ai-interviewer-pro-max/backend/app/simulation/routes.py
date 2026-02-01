"""
Behavioral Simulation Routes

API endpoints for behavioral simulation.
All routes are protected and require authentication.

IMPORTANT: All behavioral insights are TEXT-BASED INFERENCES
derived from language patterns, NOT real emotion detection.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.simulation.service import BehavioralSimulationService
from app.simulation.schemas import (
    AnalyzeAnswerRequest,
    GenerateSessionSummaryRequest,
    AnalyzeAnswerResponse,
    SessionSummaryResponse,
    SessionInsightsResponse,
    AnswerInsightSchema,
    SessionSummarySchema,
    EmotionalStateSchema,
    ConfidenceLevelSchema,
    LanguagePatternsSchema,
    EmotionalPatternSchema,
    ConfidencePatternSchema,
    BehavioralPatternsSchema,
    SessionStatisticsSchema,
    ErrorResponse,
)

router = APIRouter()


# ===========================================
# ANSWER ANALYSIS
# ===========================================


@router.post(
    "/analyze",
    response_model=AnalyzeAnswerResponse,
    summary="Analyze answer for behavioral patterns",
    description="Analyze an answer for simulated emotional state, confidence, and behavioral patterns. TEXT-BASED INFERENCE ONLY.",
    responses={
        200: {"description": "Analysis complete"},
        400: {"model": ErrorResponse, "description": "Invalid request"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def analyze_answer(
    request: AnalyzeAnswerRequest,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Analyze an answer for behavioral patterns.
    
    Derives:
    - Simulated emotional state (calm, nervous, confident, uncertain)
    - Simulated confidence level (high, moderate, low)
    - Language pattern metrics
    - Observations and suggestions
    
    DISCLAIMER: This is text-based inference, not real emotion detection.
    """
    try:
        service = BehavioralSimulationService(db)
        insight = await service.analyze_answer(
            user_id=current_user["id"],
            session_id=request.session_id,
            question_id=request.question_id,
            answer_text=request.answer_text,
            question_text=request.question_text,
            question_type=request.question_type,
            response_time_seconds=request.response_time_seconds,
            evaluation_id=request.evaluation_id,
            use_gemini=True,  # Use Gemini if available
        )
        
        # Build response
        insight_data = insight.to_dict()
        
        result = AnswerInsightSchema(
            id=insight.id,
            question_id=insight.question_id,
            emotional_state=EmotionalStateSchema(
                state=insight_data["emotional_state"]["state"],
                confidence=insight_data["emotional_state"]["confidence"],
                indicators=insight_data["emotional_state"]["indicators"],
            ),
            confidence_level=ConfidenceLevelSchema(
                level=insight_data["confidence_level"]["level"],
                score=insight_data["confidence_level"]["score"],
                indicators=insight_data["confidence_level"]["indicators"],
            ),
            language_patterns=LanguagePatternsSchema(
                filler_words=insight_data["language_patterns"]["filler_words"],
                hedging_words=insight_data["language_patterns"]["hedging_words"],
                assertive_words=insight_data["language_patterns"]["assertive_words"],
                sentence_count=insight_data["language_patterns"]["sentence_count"],
                avg_sentence_length=insight_data["language_patterns"]["avg_sentence_length"],
                self_corrections=insight_data["language_patterns"]["self_corrections"],
                repetitions=insight_data["language_patterns"]["repetitions"],
                vocabulary_diversity=insight_data["language_patterns"]["vocabulary_diversity"],
                technical_terms=insight_data["language_patterns"]["technical_terms"],
            ),
            observations=insight_data["observations"],
            suggestions=insight_data["suggestions"],
            source=insight_data["source"],
            disclaimer=insight_data["disclaimer"],
        )
        
        return AnalyzeAnswerResponse(
            success=True,
            message="Behavioral analysis complete (text-based inference)",
            insight=result,
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        print(f"Analyze error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to analyze answer"
        )


# ===========================================
# SESSION SUMMARY
# ===========================================


@router.post(
    "/session/summary",
    response_model=SessionSummaryResponse,
    summary="Generate session behavioral summary",
    description="Generate behavioral summary for entire interview session.",
    responses={
        200: {"description": "Summary generated"},
        400: {"model": ErrorResponse, "description": "Invalid request"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def generate_session_summary(
    request: GenerateSessionSummaryRequest,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Generate behavioral summary for entire session.
    
    Aggregates insights across all answers and identifies:
    - Dominant emotional state
    - Confidence trajectory
    - Improvement areas
    - Recurring patterns
    
    DISCLAIMER: This is text-based inference, not real emotion detection.
    """
    try:
        service = BehavioralSimulationService(db)
        summary = await service.generate_session_summary(
            user_id=current_user["id"],
            session_id=request.session_id,
        )
        
        # Build response
        summary_data = summary.to_dict()
        
        result = SessionSummarySchema(
            id=summary.id,
            session_id=summary.session_id,
            emotional_pattern=EmotionalPatternSchema(
                dominant_state=summary_data["emotional_pattern"]["dominant_state"],
                stability=summary_data["emotional_pattern"]["stability"],
                trajectory=summary_data["emotional_pattern"]["trajectory"],
                distribution=summary_data["emotional_pattern"]["distribution"],
            ),
            confidence_pattern=ConfidencePatternSchema(
                average_score=summary_data["confidence_pattern"]["average_score"],
                trajectory=summary_data["confidence_pattern"]["trajectory"],
                distribution=summary_data["confidence_pattern"]["distribution"],
            ),
            behavioral_patterns=BehavioralPatternsSchema(
                improvement_observed=summary_data["behavioral_patterns"]["improvement_observed"],
                improvement_areas=summary_data["behavioral_patterns"]["improvement_areas"],
                recurring_weaknesses=summary_data["behavioral_patterns"]["recurring_weaknesses"],
                consistent_strengths=summary_data["behavioral_patterns"]["consistent_strengths"],
            ),
            statistics=SessionStatisticsSchema(
                total_answers=summary_data["statistics"]["total_answers"],
                avg_answer_length=summary_data["statistics"]["avg_answer_length"],
                avg_filler_words=summary_data["statistics"]["avg_filler_words"],
                avg_vocabulary_diversity=summary_data["statistics"]["avg_vocabulary_diversity"],
                avg_response_time=summary_data["statistics"]["avg_response_time"],
                response_time_trend=summary_data["statistics"]["response_time_trend"],
            ),
            narrative=summary_data["narrative"],
            key_takeaways=summary_data["key_takeaways"],
            source=summary_data["source"],
            disclaimer=summary_data["disclaimer"],
        )
        
        return SessionSummaryResponse(
            success=True,
            message="Session summary generated (text-based inference)",
            summary=result,
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        print(f"Summary error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate session summary"
        )


# ===========================================
# GET SESSION INSIGHTS
# ===========================================


@router.get(
    "/session/{session_id}",
    response_model=SessionInsightsResponse,
    summary="Get session behavioral insights",
    description="Get all behavioral insights for an interview session.",
    responses={
        200: {"description": "Insights retrieved"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def get_session_insights(
    session_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get all behavioral insights for a session.
    
    Includes per-answer insights and optional session summary.
    """
    try:
        service = BehavioralSimulationService(db)
        
        # Get insights
        insights = service.get_session_insights(
            session_id=session_id,
            user_id=current_user["id"],
        )
        
        # Get summary if exists
        summary = service.get_session_summary(
            session_id=session_id,
            user_id=current_user["id"],
        )
        
        # Build response
        insight_schemas = []
        for insight in insights:
            data = insight.to_dict()
            insight_schemas.append(AnswerInsightSchema(
                id=insight.id,
                question_id=insight.question_id,
                emotional_state=EmotionalStateSchema(
                    state=data["emotional_state"]["state"],
                    confidence=data["emotional_state"]["confidence"],
                    indicators=data["emotional_state"]["indicators"],
                ),
                confidence_level=ConfidenceLevelSchema(
                    level=data["confidence_level"]["level"],
                    score=data["confidence_level"]["score"],
                    indicators=data["confidence_level"]["indicators"],
                ),
                language_patterns=LanguagePatternsSchema(**data["language_patterns"]),
                observations=data["observations"],
                suggestions=data["suggestions"],
                source=data["source"],
                disclaimer=data["disclaimer"],
            ))
        
        summary_schema = None
        if summary:
            sdata = summary.to_dict()
            summary_schema = SessionSummarySchema(
                id=summary.id,
                session_id=summary.session_id,
                emotional_pattern=EmotionalPatternSchema(**sdata["emotional_pattern"]),
                confidence_pattern=ConfidencePatternSchema(**sdata["confidence_pattern"]),
                behavioral_patterns=BehavioralPatternsSchema(**sdata["behavioral_patterns"]),
                statistics=SessionStatisticsSchema(**sdata["statistics"]),
                narrative=sdata["narrative"],
                key_takeaways=sdata["key_takeaways"],
                source=sdata["source"],
                disclaimer=sdata["disclaimer"],
            )
        
        return SessionInsightsResponse(
            success=True,
            session_id=session_id,
            insights=insight_schemas,
            total=len(insights),
            summary=summary_schema,
        )
        
    except Exception as e:
        print(f"Get insights error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get session insights"
        )


# ===========================================
# GET SINGLE INSIGHT
# ===========================================


@router.get(
    "/insight/{insight_id}",
    summary="Get single behavioral insight",
    description="Get a specific behavioral insight by ID.",
    responses={
        200: {"description": "Insight retrieved"},
        404: {"model": ErrorResponse, "description": "Not found"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def get_insight(
    insight_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get a specific behavioral insight."""
    service = BehavioralSimulationService(db)
    insight = service.get_answer_insight(
        insight_id=insight_id,
        user_id=current_user["id"],
    )
    
    if not insight:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insight not found"
        )
    
    return {
        "success": True,
        "insight": insight.to_dict(),
    }


# ===========================================
# DISCLAIMER ENDPOINT
# ===========================================


@router.get(
    "/disclaimer",
    summary="Get behavioral simulation disclaimer",
    description="Get the disclaimer for behavioral simulation features.",
)
async def get_disclaimer():
    """
    Get the disclaimer for behavioral simulation.
    
    Returns clear explanation of limitations and methodology.
    """
    return {
        "disclaimer": "Text-based inference only. Not real emotion detection.",
        "methodology": "Behavioral insights are derived from linguistic pattern analysis of written text, including word choice, sentence structure, and language markers.",
        "limitations": [
            "Cannot detect actual emotions or feelings",
            "Based solely on written text patterns",
            "No audio, video, or sensor data is used",
            "Results are simulated inferences, not measurements",
            "Should not be used for clinical or diagnostic purposes",
        ],
        "purpose": "To provide constructive feedback on communication style and language patterns in interview responses.",
        "data_used": [
            "Answer text content",
            "Word frequency and vocabulary diversity",
            "Linguistic markers (hedging, assertive, filler words)",
            "Sentence structure and length",
        ],
    }
