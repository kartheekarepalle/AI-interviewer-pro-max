"""
Live Interview Schemas

Pydantic models for live interview request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ===========================================
# NESTED SCHEMAS
# ===========================================


class MessageSchema(BaseModel):
    """Schema for a chat message."""
    id: str = Field(..., description="Message ID")
    role: str = Field(..., description="Message role: interviewer, candidate, system")
    content: str = Field(..., description="Message content")
    message_type: str = Field(default="message", description="Message type")
    question_id: Optional[str] = Field(None, description="Question ID if applicable")
    question_index: Optional[int] = Field(None, description="Question index")
    created_at: Optional[str] = Field(None, description="Creation timestamp")


class QuickEvalSchema(BaseModel):
    """Schema for quick evaluation result."""
    relevance: int = Field(default=7, ge=0, le=10, description="Relevance score")
    is_complete: bool = Field(default=True, description="Whether answer is complete")
    flags: List[str] = Field(default=[], description="Warning flags")


class ProgressSchema(BaseModel):
    """Schema for interview progress."""
    current_question: int = Field(..., description="Current question number (1-indexed)")
    total_questions: int = Field(..., description="Total questions")
    questions_answered: int = Field(..., description="Questions answered")
    questions_skipped: int = Field(default=0, description="Questions skipped")
    progress_percent: float = Field(..., description="Progress percentage")


# ===========================================
# REQUEST SCHEMAS
# ===========================================


class StartInterviewRequest(BaseModel):
    """Schema for starting an interview."""
    plan_id: str = Field(..., description="Interview plan ID")
    persona: str = Field(
        default="professional",
        description="Interviewer persona: professional, friendly, stress"
    )


class SubmitAnswerRequest(BaseModel):
    """Schema for submitting an answer."""
    answer_text: str = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="Answer text"
    )
    response_time_seconds: Optional[int] = Field(
        None,
        ge=0,
        description="Time taken to respond in seconds"
    )


class SkipQuestionRequest(BaseModel):
    """Schema for skipping a question."""
    reason: Optional[str] = Field(None, description="Optional skip reason")


# ===========================================
# RESPONSE SCHEMAS
# ===========================================


class InterviewStateResponse(BaseModel):
    """Schema for interview state response."""
    success: bool = Field(default=True)
    session_id: str = Field(..., description="Session ID")
    status: str = Field(..., description="Interview status")
    target_role: str = Field(..., description="Target job role")
    interviewer_persona: str = Field(..., description="Current persona")
    progress: ProgressSchema = Field(..., description="Interview progress")
    current_question: Optional[dict] = Field(None, description="Current question details")
    messages: List[MessageSchema] = Field(default=[], description="Chat messages")


class StartInterviewResponse(BaseModel):
    """Schema for start interview response."""
    success: bool = Field(default=True)
    message: str = Field(..., description="Response message")
    session_id: str = Field(..., description="Session ID")
    status: str = Field(..., description="Interview status")
    interviewer_message: str = Field(..., description="Interviewer's opening message")
    first_question: dict = Field(..., description="First question details")
    progress: ProgressSchema = Field(..., description="Initial progress")


class AnswerResponse(BaseModel):
    """Schema for answer submission response."""
    success: bool = Field(default=True)
    message: str = Field(..., description="Response message")
    acknowledgment: str = Field(..., description="Interviewer acknowledgment")
    quick_eval: QuickEvalSchema = Field(..., description="Quick evaluation")
    next_action: str = Field(..., description="Next action: next_question, follow_up, complete")
    next_question: Optional[dict] = Field(None, description="Next question if applicable")
    progress: ProgressSchema = Field(..., description="Updated progress")
    is_complete: bool = Field(default=False, description="Whether interview is complete")


class SkipResponse(BaseModel):
    """Schema for skip question response."""
    success: bool = Field(default=True)
    message: str = Field(..., description="Response message")
    next_question: Optional[dict] = Field(None, description="Next question")
    progress: ProgressSchema = Field(..., description="Updated progress")
    is_complete: bool = Field(default=False, description="Whether interview is complete")


class PauseResumeResponse(BaseModel):
    """Schema for pause/resume response."""
    success: bool = Field(default=True)
    message: str = Field(..., description="Response message")
    status: str = Field(..., description="New status")
    session_id: str = Field(..., description="Session ID")


class CompleteInterviewResponse(BaseModel):
    """Schema for interview completion response."""
    success: bool = Field(default=True)
    message: str = Field(..., description="Response message")
    session_id: str = Field(..., description="Session ID")
    status: str = Field(default="completing", description="Status")
    summary: dict = Field(..., description="Interview summary")


class ErrorResponse(BaseModel):
    """Schema for error responses."""
    success: bool = Field(default=False)
    message: str = Field(..., description="Error message")
    error_code: Optional[str] = Field(None, description="Error code")
