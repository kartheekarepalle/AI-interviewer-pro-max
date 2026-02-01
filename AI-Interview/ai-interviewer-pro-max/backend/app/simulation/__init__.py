"""
Simulation Module

Text-based behavioral simulation:
- Emotional state inference
- Confidence level inference
- Behavioral pattern tracking

DISCLAIMER: These are TEXT-BASED INFERENCES,
NOT real emotion or sentiment detection.
"""

from app.simulation.models import AnswerBehavioralInsight, SessionBehavioralSummary
from app.simulation.routes import router as simulation_router
from app.simulation.service import BehavioralSimulationService, get_simulation_service

__all__ = [
    "AnswerBehavioralInsight",
    "SessionBehavioralSummary",
    "simulation_router",
    "BehavioralSimulationService",
    "get_simulation_service",
]
