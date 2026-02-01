"""
Analytics Module

User analytics and progress tracking.
"""

from app.analytics.service import AnalyticsService, get_analytics_service
from app.analytics.routes import router as analytics_router

__all__ = [
    "AnalyticsService",
    "get_analytics_service",
    "analytics_router",
]
