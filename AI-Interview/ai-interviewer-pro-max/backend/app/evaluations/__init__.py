"""
Evaluations Module

Two-layer answer evaluation:
- Layer 1: Quick evaluation (Groq) - fast, real-time
- Layer 2: Deep evaluation (Gemini) - detailed analysis
"""

from app.evaluations.models import AnswerEvaluation
from app.evaluations.routes import router as evaluations_router
from app.evaluations.service import EvaluationService, get_evaluation_service

__all__ = [
    "AnswerEvaluation",
    "evaluations_router",
    "EvaluationService",
    "get_evaluation_service",
]
