"""
Reports Module

Interview report generation with readiness scoring.
Reports are IMMUTABLE after generation.
"""

from app.reports.models import InterviewReport
from app.reports.routes import router as reports_router
from app.reports.service import ReportService, get_report_service

__all__ = [
    "InterviewReport",
    "reports_router",
    "ReportService",
    "get_report_service",
]
