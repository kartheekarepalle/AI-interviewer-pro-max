"""
Resume Schemas

Pydantic models for request/response validation in resume endpoints.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ===========================================
# RESPONSE SCHEMAS
# ===========================================


class ResumeResponse(BaseModel):
    """Schema for resume data in response."""
    
    id: str = Field(..., description="Resume ID")
    user_id: str = Field(..., description="Owner user ID")
    filename: str = Field(..., description="Original filename")
    file_type: str = Field(..., description="File type (pdf, docx)")
    file_size: int = Field(..., description="File size in bytes")
    is_parsed: str = Field(..., description="Parsing status")
    has_content: bool = Field(..., description="Whether text was extracted")
    created_at: Optional[str] = Field(None, description="Upload timestamp")
    updated_at: Optional[str] = Field(None, description="Last update timestamp")


class ResumeDetailResponse(ResumeResponse):
    """Schema for detailed resume response including content."""
    
    text_content: Optional[str] = Field(None, description="Extracted text content")
    parse_error: Optional[str] = Field(None, description="Parse error if any")


class ResumeUploadResponse(BaseModel):
    """Schema for resume upload response."""
    
    success: bool = Field(default=True)
    message: str = Field(..., description="Response message")
    resume: Optional[ResumeResponse] = Field(None, description="Uploaded resume data")


class ResumeListResponse(BaseModel):
    """Schema for resume list response."""
    
    success: bool = Field(default=True)
    resumes: List[ResumeResponse] = Field(default=[], description="List of resumes")
    total: int = Field(default=0, description="Total count")


class ResumeGetResponse(BaseModel):
    """Schema for single resume response."""
    
    success: bool = Field(default=True)
    resume: Optional[ResumeDetailResponse] = Field(None, description="Resume data")


class ResumeDeleteResponse(BaseModel):
    """Schema for resume deletion response."""
    
    success: bool = Field(default=True)
    message: str = Field(default="Resume deleted successfully")


# ===========================================
# ERROR SCHEMAS
# ===========================================


class ResumeErrorResponse(BaseModel):
    """Schema for error responses."""
    
    success: bool = Field(default=False)
    message: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Additional error details")
