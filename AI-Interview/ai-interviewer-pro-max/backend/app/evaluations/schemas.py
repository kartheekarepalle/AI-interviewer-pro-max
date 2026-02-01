"""
Answer Evaluation Schemas

Pydantic models for evaluation request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ===========================================
# NESTED SCHEMAS
# ===========================================


class QuickEvaluationResult(BaseModel):
    """Schema for quick (Groq) evaluation result."""
    relevance_score: float = Field(..., ge=0, le=10, description="Relevance score 0-10")
    is_off_topic: bool = Field(default=False, description="Whether answer is off-topic")
    is_too_short: bool = Field(default=False, description="Whether answer is too short")
    feedback: str = Field(..., description="Brief feedback (1-2 lines)")
    source: str = Field(default="mock", description="Evaluation source")


class DeepScoreExplanations(BaseModel):
    """Schema for deep evaluation explanations."""
    relevance: Optional[str] = Field(None, description="Relevance explanation")
    depth: Optional[str] = Field(None, description="Depth explanation")
    clarity: Optional[str] = Field(None, description="Clarity explanation")
    confidence: Optional[str] = Field(None, description="Confidence explanation")


class DeepEvaluationResult(BaseModel):
    """Schema for deep (Gemini) evaluation result."""
    relevance_score: float = Field(..., ge=0, le=10, description="Relevance score")
    depth_score: float = Field(..., ge=0, le=10, description="Depth score")
    clarity_score: float = Field(..., ge=0, le=10, description="Clarity score")
    confidence_score: float = Field(..., ge=0, le=10, description="Confidence score")
    overall_score: float = Field(..., ge=0, le=10, description="Overall score")
    explanations: DeepScoreExplanations = Field(..., description="Score explanations")
    strengths: List[str] = Field(default=[], description="Answer strengths")
    improvements: List[str] = Field(default=[], description="Areas for improvement")
    key_points_covered: List[str] = Field(default=[], description="Key points covered")
    missing_points: List[str] = Field(default=[], description="Missing points")
    feedback: str = Field(..., description="Detailed feedback")
    source: str = Field(default="pending", description="Evaluation source")


class EvaluationSummary(BaseModel):
    """Schema for evaluation summary."""
    id: str
    question_id: str
    question_type: Optional[str]
    quick_evaluation: Optional[QuickEvaluationResult]
    deep_evaluation: Optional[DeepEvaluationResult]
    is_quick_complete: bool
    is_deep_complete: bool
    status: str


# ===========================================
# REQUEST SCHEMAS
# ===========================================


class QuickEvaluateRequest(BaseModel):
    """Schema for quick evaluation request."""
    session_id: str = Field(..., description="Interview session ID")
    question_id: str = Field(..., description="Question ID")
    question_text: str = Field(..., max_length=2000, description="Question text")
    question_type: Optional[str] = Field(None, description="Question type")
    answer_text: str = Field(..., min_length=1, max_length=10000, description="Answer text")
    answer_id: Optional[str] = Field(None, description="Answer record ID")


class DeepEvaluateRequest(BaseModel):
    """Schema for deep evaluation request."""
    session_id: str = Field(..., description="Interview session ID")
    question_id: str = Field(..., description="Question ID")
    question_text: str = Field(..., max_length=2000, description="Question text")
    question_type: Optional[str] = Field(None, description="Question type")
    answer_text: str = Field(..., min_length=1, max_length=10000, description="Answer text")
    resume_context: Optional[str] = Field(None, max_length=5000, description="Resume context")
    expected_topics: Optional[List[str]] = Field(None, description="Expected topics")
    scoring_rubric: Optional[Dict[str, Any]] = Field(None, description="Scoring rubric")


class BatchDeepEvaluateRequest(BaseModel):
    """Schema for batch deep evaluation request."""
    session_id: str = Field(..., description="Session ID")
    evaluation_ids: Optional[List[str]] = Field(None, description="Specific evaluation IDs to process")


# ===========================================
# RESPONSE SCHEMAS
# ===========================================


class QuickEvaluateResponse(BaseModel):
    """Schema for quick evaluation response."""
    success: bool = Field(default=True)
    message: str = Field(..., description="Response message")
    evaluation_id: str = Field(..., description="Evaluation ID")
    result: QuickEvaluationResult = Field(..., description="Evaluation result")


class DeepEvaluateResponse(BaseModel):
    """Schema for deep evaluation response."""
    success: bool = Field(default=True)
    message: str = Field(..., description="Response message")
    evaluation_id: str = Field(..., description="Evaluation ID")
    result: DeepEvaluationResult = Field(..., description="Evaluation result")


class EvaluationStatusResponse(BaseModel):
    """Schema for evaluation status."""
    success: bool = Field(default=True)
    evaluation_id: str = Field(..., description="Evaluation ID")
    is_quick_complete: bool = Field(..., description="Quick evaluation complete")
    is_deep_complete: bool = Field(..., description="Deep evaluation complete")
    status: str = Field(..., description="Overall status")


class SessionEvaluationsResponse(BaseModel):
    """Schema for session evaluations."""
    success: bool = Field(default=True)
    session_id: str = Field(..., description="Session ID")
    evaluations: List[EvaluationSummary] = Field(default=[], description="Evaluations")
    total: int = Field(default=0, description="Total count")
    quick_complete: int = Field(default=0, description="Quick evaluations complete")
    deep_complete: int = Field(default=0, description="Deep evaluations complete")


class ErrorResponse(BaseModel):
    """Schema for error responses."""
    success: bool = Field(default=False)
    message: str = Field(..., description="Error message")
