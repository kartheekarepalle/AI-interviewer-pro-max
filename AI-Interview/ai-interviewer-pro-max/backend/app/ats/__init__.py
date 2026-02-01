"""
ATS Module

ATS scoring and resume analysis functionality.
Uses Gemini API for deep analysis with mock fallback.
"""

from app.ats.models import ATSAnalysis
from app.ats.service import ATSService, get_ats_service
from app.ats.routes import router
