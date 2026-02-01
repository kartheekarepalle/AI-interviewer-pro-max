"""
Behavioral Simulation Schemas

Pydantic schemas for behavioral simulation request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ===========================================
# EMOTIONAL STATE SCHEMAS
# ===========================================


class EmotionalStateSchema(BaseModel):
    """Schema for emotional state."""
    state: str = Field(..., description="Emotional state: calm, nervous, confident, uncertain")
    confidence: float = Field(..., ge=0, le=1, description="Inference confidence 0-1")
    indicators: Dict[str, Any] = Field(default={}, description="Contributing indicators")


class ConfidenceLevelSchema(BaseModel):
    """Schema for confidence level."""
    level: str = Field(..., description="Confidence level: high, moderate, low")
    score: float = Field(..., ge=0, le=1, description="Confidence score 0-1")
    indicators: Dict[str, Any] = Field(default={}, description="Contributing indicators")


class LanguagePatternsSchema(BaseModel):
    """Schema for language patterns."""
    filler_words: int = Field(default=0, description="Filler word count")
    hedging_words: int = Field(default=0, description="Hedging word count")
    assertive_words: int = Field(default=0, description="Assertive word count")
    sentence_count: int = Field(default=0, description="Sentence count")
    avg_sentence_length: float = Field(default=0, description="Average sentence length")
    self_corrections: int = Field(default=0, description="Self-correction count")
    repetitions: int = Field(default=0, description="Repetition count")
    vocabulary_diversity: float = Field(default=0, description="Type-token ratio")
    technical_terms: int = Field(default=0, description="Technical term count")


# ===========================================
# ANSWER INSIGHT SCHEMAS
# ===========================================


class AnswerInsightSchema(BaseModel):
    """Schema for answer behavioral insight."""
    id: str
    question_id: str
    emotional_state: EmotionalStateSchema
    confidence_level: ConfidenceLevelSchema
    language_patterns: LanguagePatternsSchema
    observations: List[str] = Field(default=[], description="Key observations")
    suggestions: List[str] = Field(default=[], description="Improvement suggestions")
    source: str = Field(default="mock", description="Analysis source")
    disclaimer: str = Field(
        default="Text-based inference only. Not real emotion detection.",
        description="Disclaimer"
    )


# ===========================================
# SESSION SUMMARY SCHEMAS
# ===========================================


class EmotionalPatternSchema(BaseModel):
    """Schema for emotional pattern across session."""
    dominant_state: str
    stability: float
    trajectory: str
    distribution: Dict[str, int]


class ConfidencePatternSchema(BaseModel):
    """Schema for confidence pattern across session."""
    average_score: float
    trajectory: str
    distribution: Dict[str, int]


class BehavioralPatternsSchema(BaseModel):
    """Schema for behavioral patterns."""
    improvement_observed: bool
    improvement_areas: List[str]
    recurring_weaknesses: List[str]
    consistent_strengths: List[str]


class SessionStatisticsSchema(BaseModel):
    """Schema for session statistics."""
    total_answers: int
    avg_answer_length: float
    avg_filler_words: float
    avg_vocabulary_diversity: float
    avg_response_time: Optional[float]
    response_time_trend: Optional[str]


class SessionSummarySchema(BaseModel):
    """Schema for session behavioral summary."""
    id: str
    session_id: str
    emotional_pattern: EmotionalPatternSchema
    confidence_pattern: ConfidencePatternSchema
    behavioral_patterns: BehavioralPatternsSchema
    statistics: SessionStatisticsSchema
    narrative: Optional[str]
    key_takeaways: List[str]
    source: str
    disclaimer: str = Field(
        default="Text-based inference only. Not real emotion detection."
    )


# ===========================================
# REQUEST SCHEMAS
# ===========================================


class AnalyzeAnswerRequest(BaseModel):
    """Schema for analyze answer request."""
    session_id: str = Field(..., description="Session ID")
    question_id: str = Field(..., description="Question ID")
    answer_text: str = Field(..., min_length=1, description="Answer text")
    question_text: Optional[str] = Field(None, description="Question text")
    question_type: Optional[str] = Field(None, description="Question type")
    response_time_seconds: Optional[int] = Field(None, description="Response time")
    evaluation_id: Optional[str] = Field(None, description="Linked evaluation ID")


class GenerateSessionSummaryRequest(BaseModel):
    """Schema for generate session summary request."""
    session_id: str = Field(..., description="Session ID")


# ===========================================
# RESPONSE SCHEMAS
# ===========================================


class AnalyzeAnswerResponse(BaseModel):
    """Schema for analyze answer response."""
    success: bool = True
    message: str
    insight: AnswerInsightSchema
    

class SessionSummaryResponse(BaseModel):
    """Schema for session summary response."""
    success: bool = True
    message: str
    summary: SessionSummarySchema


class SessionInsightsResponse(BaseModel):
    """Schema for session insights list."""
    success: bool = True
    session_id: str
    insights: List[AnswerInsightSchema]
    total: int
    summary: Optional[SessionSummarySchema] = None


class ErrorResponse(BaseModel):
    """Schema for error responses."""
    success: bool = False
    message: str
