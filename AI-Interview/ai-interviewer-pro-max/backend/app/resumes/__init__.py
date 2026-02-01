"""
Resume Module

Resume upload, parsing, and management functionality.
"""

from app.resumes.models import Resume
from app.resumes.service import ResumeService, get_resume_service
from app.resumes.routes import router
