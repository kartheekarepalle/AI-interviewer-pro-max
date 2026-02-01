"""
Roadmap Module

Career roadmap generation with personalized learning paths.
"""

from app.roadmap.models import CareerRoadmap
from app.roadmap.routes import router as roadmap_router
from app.roadmap.service import RoadmapService, get_roadmap_service

__all__ = [
    "CareerRoadmap",
    "roadmap_router",
    "RoadmapService",
    "get_roadmap_service",
]
