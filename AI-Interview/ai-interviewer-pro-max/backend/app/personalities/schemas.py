"""
Personality Schemas

Pydantic schemas for personality API.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class ToneRulesSchema(BaseModel):
    """Tone rules schema."""
    formality: str
    warmth: str
    directness: str
    encouragement_level: str


class ResponseStyleSchema(BaseModel):
    """Response style schema."""
    greeting_style: str
    question_prefix: str
    follow_up_style: str
    transition_phrases: List[str]
    acknowledgment_style: str


class FollowUpConfigSchema(BaseModel):
    """Follow-up configuration schema."""
    intensity: str
    typical_count: int
    pressure_level: str
    depth_probing: bool
    time_pressure_cues: bool


class PersonalityProfileSchema(BaseModel):
    """Full personality profile."""
    id: str
    name: str
    type: str
    description: str
    tone_rules: ToneRulesSchema
    response_style: ResponseStyleSchema
    follow_up_config: FollowUpConfigSchema
    system_prompt_modifier: str
    question_style_hints: List[str]
    feedback_tone_hints: List[str]
    icon: str
    color: str
    disclaimer: str


class PersonalitySummarySchema(BaseModel):
    """Personality summary for list display."""
    id: str
    name: str
    type: str
    description: str
    icon: str
    color: str
    intensity: str
    pressure_level: str


class GetPersonalitiesResponse(BaseModel):
    """Response for list personalities."""
    success: bool = True
    personalities: List[PersonalitySummarySchema]
    disclaimer: str = Field(
        default="Personality modes affect interview tone and delivery only. Scoring and evaluation remain fair and consistent across all modes.",
    )


class GetPersonalityResponse(BaseModel):
    """Response for single personality."""
    success: bool = True
    personality: PersonalityProfileSchema


class ErrorResponse(BaseModel):
    """Error response."""
    success: bool = False
    message: str
