"""
Resume Routes

API endpoints for resume upload, retrieval, and management.
All routes are protected and require authentication.

Per requirements:
- POST /resumes/upload
- GET /resumes/me (get all user resumes)
- GET /resumes/{resume_id}
- DELETE /resumes/{resume_id}
"""

from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.resumes.service import ResumeService, ResumeParsingError
from app.resumes.schemas import (
    ResumeResponse,
    ResumeDetailResponse,
    ResumeUploadResponse,
    ResumeListResponse,
    ResumeGetResponse,
    ResumeDeleteResponse,
    ResumeErrorResponse,
)

router = APIRouter()


# ===========================================
# RESUME UPLOAD (Protected)
# ===========================================


@router.post(
    "/upload",
    response_model=ResumeUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload resume",
    description="Upload a new resume (PDF or DOCX). File is parsed and text is extracted.",
    responses={
        201: {"description": "Resume uploaded successfully"},
        400: {"model": ResumeErrorResponse, "description": "Invalid file"},
        401: {"model": ResumeErrorResponse, "description": "Not authenticated"},
        413: {"model": ResumeErrorResponse, "description": "File too large"},
    }
)
async def upload_resume(
    file: UploadFile = File(..., description="Resume file (PDF or DOCX)"),
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Upload and parse a resume.
    
    - Accepts PDF and DOCX files
    - Maximum size: 10MB
    - Extracts text content automatically
    - Requires authentication
    
    **Security:**
    - File type validation
    - File size validation
    - Path traversal prevention
    - User-scoped storage
    """
    try:
        service = ResumeService(db)
        resume = await service.upload_resume(file, current_user["id"])
        
        return ResumeUploadResponse(
            success=True,
            message="Resume uploaded successfully" if resume.is_parsed == "success" 
                    else "Resume uploaded but parsing failed",
            resume=ResumeResponse(**resume.to_dict())
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload resume. Please try again."
        )


# ===========================================
# GET USER RESUMES (Protected)
# ===========================================


@router.get(
    "/me",
    response_model=ResumeListResponse,
    summary="Get my resumes",
    description="Get all resumes uploaded by the current user.",
    responses={
        200: {"description": "Resumes retrieved successfully"},
        401: {"model": ResumeErrorResponse, "description": "Not authenticated"},
    }
)
async def get_my_resumes(
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get all resumes for the current user.
    
    Returns list of resumes with metadata (not full content).
    Requires authentication.
    
    **Security:**
    - Only returns resumes owned by the authenticated user
    """
    service = ResumeService(db)
    resumes = service.get_user_resumes(current_user["id"])
    
    return ResumeListResponse(
        success=True,
        resumes=[ResumeResponse(**r.to_dict()) for r in resumes],
        total=len(resumes)
    )


# ===========================================
# GET SINGLE RESUME (Protected)
# ===========================================


@router.get(
    "/{resume_id}",
    response_model=ResumeGetResponse,
    summary="Get resume by ID",
    description="Get a specific resume with full content.",
    responses={
        200: {"description": "Resume retrieved successfully"},
        401: {"model": ResumeErrorResponse, "description": "Not authenticated"},
        404: {"model": ResumeErrorResponse, "description": "Resume not found"},
    }
)
async def get_resume(
    resume_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific resume by ID.
    
    Returns full resume data including extracted text content.
    Requires authentication and ownership.
    
    **Security:**
    - Only returns if the authenticated user owns this resume
    """
    service = ResumeService(db)
    resume = service.get_resume_by_id(resume_id, current_user["id"])
    
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found"
        )
    
    return ResumeGetResponse(
        success=True,
        resume=ResumeDetailResponse(**resume.to_dict_with_content())
    )


# ===========================================
# DELETE RESUME (Protected)
# ===========================================


@router.delete(
    "/{resume_id}",
    response_model=ResumeDeleteResponse,
    summary="Delete resume",
    description="Delete a resume and its associated file.",
    responses={
        200: {"description": "Resume deleted successfully"},
        401: {"model": ResumeErrorResponse, "description": "Not authenticated"},
        404: {"model": ResumeErrorResponse, "description": "Resume not found"},
    }
)
async def delete_resume(
    resume_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Delete a resume.
    
    Removes both the database record and the file from storage.
    Requires authentication and ownership.
    
    **Security:**
    - Only deletes if the authenticated user owns this resume
    """
    service = ResumeService(db)
    deleted = service.delete_resume(resume_id, current_user["id"])
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found"
        )
    
    return ResumeDeleteResponse(
        success=True,
        message="Resume deleted successfully"
    )
