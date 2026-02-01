"""
Scoring Evaluator

Implements the multi-dimensional scoring system defined in Step 5.

Scoring Dimensions:
- Relevance (REL): How well answer addresses the question (0-10)
- Depth (DEP): Technical/conceptual completeness (0-10)
- Clarity (CLR): Structure, grammar, readability (0-10)
- Confidence (CON): Text-inferred certainty (0-10)
- Technical Accuracy (TEC): Correctness (0-10, for technical Qs)
- Problem Solving (PSV): Analytical approach (0-10, for applicable Qs)

Simulated Dimensions (presence modifier):
- Speech Clarity (SSC): 10% of presence
- Emotion (SED): 5% of presence
- Body Language (SBL): 5% of presence
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from enum import Enum


# ===========================================
# ENUMS AND CONSTANTS
# ===========================================


class RoleCategory(str, Enum):
    """Role categories for weight adjustment."""
    TECHNICAL = "technical"
    PRODUCT = "product"
    BEHAVIORAL = "behavioral"
    DESIGN = "design"
    DEFAULT = "default"


class Grade(str, Enum):
    """Letter grades."""
    A_PLUS = "A+"
    A = "A"
    A_MINUS = "A-"
    B_PLUS = "B+"
    B = "B"
    B_MINUS = "B-"
    C_PLUS = "C+"
    C = "C"
    C_MINUS = "C-"
    D = "D"
    F = "F"


class HiringRecommendation(str, Enum):
    """Hiring recommendations."""
    STRONG_HIRE = "strong_hire"
    HIRE = "hire"
    MAYBE = "maybe"
    NO_HIRE = "no_hire"
    STRONG_NO_HIRE = "strong_no_hire"


# ===========================================
# WEIGHT CONFIGURATIONS
# ===========================================

# Default weights (per Step 5)
DEFAULT_WEIGHTS = {
    "relevance": 0.20,
    "depth": 0.25,
    "clarity": 0.20,
    "confidence": 0.10,
    "technical_accuracy": 0.15,
    "problem_solving": 0.10,
}

# Role-specific weight adjustments
ROLE_WEIGHTS = {
    RoleCategory.TECHNICAL: {
        "relevance": 0.15,
        "depth": 0.30,
        "clarity": 0.15,
        "confidence": 0.05,
        "technical_accuracy": 0.25,
        "problem_solving": 0.10,
    },
    RoleCategory.PRODUCT: {
        "relevance": 0.20,
        "depth": 0.15,
        "clarity": 0.25,
        "confidence": 0.15,
        "technical_accuracy": 0.05,
        "problem_solving": 0.20,
    },
    RoleCategory.BEHAVIORAL: {
        "relevance": 0.25,
        "depth": 0.15,
        "clarity": 0.30,
        "confidence": 0.15,
        "technical_accuracy": 0.00,
        "problem_solving": 0.15,
    },
    RoleCategory.DESIGN: {
        "relevance": 0.20,
        "depth": 0.20,
        "clarity": 0.25,
        "confidence": 0.15,
        "technical_accuracy": 0.10,
        "problem_solving": 0.10,
    },
}

# Difficulty multipliers
DIFFICULTY_MULTIPLIERS = {
    "easy": 0.8,
    "medium": 1.0,
    "hard": 1.2,
    "expert": 1.5,
}

# Grade thresholds
GRADE_THRESHOLDS = [
    (90, Grade.A_PLUS),
    (85, Grade.A),
    (80, Grade.A_MINUS),
    (75, Grade.B_PLUS),
    (70, Grade.B),
    (65, Grade.B_MINUS),
    (60, Grade.C_PLUS),
    (55, Grade.C),
    (50, Grade.C_MINUS),
    (40, Grade.D),
    (0, Grade.F),
]


# ===========================================
# EVALUATOR CLASS
# ===========================================


class ScoringEvaluator:
    """
    Implements the scoring and evaluation system.
    
    Per Step 5 Scoring & Evaluation System:
    - Multi-dimensional scoring
    - Role-specific weight adjustments
    - Presence modifier from simulated features
    - Grade and recommendation calculation
    """
    
    def __init__(self, role_category: RoleCategory = RoleCategory.DEFAULT):
        """
        Initialize evaluator with role-specific weights.
        
        Args:
            role_category: Category for weight selection
        """
        self.role_category = role_category
        self.weights = ROLE_WEIGHTS.get(role_category, DEFAULT_WEIGHTS)
    
    # ===========================================
    # ANSWER-LEVEL SCORING
    # ===========================================
    
    def calculate_answer_score(
        self,
        dimension_scores: Dict[str, int],
        presence_scores: Optional[Dict[str, int]] = None,
        difficulty: str = "medium"
    ) -> Dict[str, Any]:
        """
        Calculate weighted score for a single answer.
        
        Args:
            dimension_scores: Dict with relevance, depth, clarity, confidence, etc. (0-10)
            presence_scores: Optional dict with speech, emotion, body scores (0-10)
            difficulty: Question difficulty level
            
        Returns:
            Score breakdown with weighted total
        """
        # Calculate weighted sum
        weighted_sum = 0.0
        total_weight = 0.0
        
        for dimension, weight in self.weights.items():
            score = dimension_scores.get(dimension, 0)
            if score is not None and weight > 0:
                weighted_sum += score * weight
                total_weight += weight
        
        # Normalize to 0-100
        if total_weight > 0:
            raw_score = (weighted_sum / total_weight) * 10
        else:
            raw_score = 0
        
        # Apply presence modifier if available
        presence_modifier = 1.0
        if presence_scores:
            presence_total = (
                presence_scores.get("speech_clarity", 5) * 0.10 +
                presence_scores.get("emotion", 5) * 0.05 +
                presence_scores.get("body_language", 5) * 0.05
            )
            # Modifier: 1 + ((presence - 5) * 0.02)
            presence_modifier = 1 + ((presence_total * 5 - 5) * 0.02)
            presence_modifier = max(0.9, min(1.1, presence_modifier))  # Cap at ±10%
        
        # Apply difficulty multiplier for weighting purposes
        difficulty_multiplier = DIFFICULTY_MULTIPLIERS.get(difficulty, 1.0)
        
        final_score = min(100, max(0, raw_score * presence_modifier))
        
        return {
            "raw_score": round(raw_score, 2),
            "presence_modifier": round(presence_modifier, 4),
            "final_score": round(final_score, 2),
            "difficulty_weight": difficulty_multiplier,
            "dimension_breakdown": dimension_scores,
            "weights_used": self.weights,
        }
    
    # ===========================================
    # SESSION-LEVEL AGGREGATION
    # ===========================================
    
    def aggregate_session_scores(
        self,
        answer_scores: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Aggregate all answer scores into session-level score.
        
        Args:
            answer_scores: List of per-answer score breakdowns
            
        Returns:
            Aggregated session scores
        """
        if not answer_scores:
            return {
                "overall_score": 0,
                "grade": Grade.F,
                "pass_status": False,
                "total_questions": 0,
            }
        
        # Weighted average based on difficulty
        weighted_sum = 0.0
        weight_total = 0.0
        
        for answer in answer_scores:
            score = answer.get("final_score", 0)
            weight = answer.get("difficulty_weight", 1.0)
            weighted_sum += score * weight
            weight_total += weight
        
        overall_score = weighted_sum / weight_total if weight_total > 0 else 0
        
        # Determine grade
        grade = Grade.F
        for threshold, g in GRADE_THRESHOLDS:
            if overall_score >= threshold:
                grade = g
                break
        
        # Pass status (default threshold: 65)
        pass_status = overall_score >= 65
        
        # Calculate category scores
        category_scores = self._calculate_category_scores(answer_scores)
        
        return {
            "overall_score": round(overall_score, 2),
            "grade": grade.value,
            "pass_status": pass_status,
            "total_questions": len(answer_scores),
            "category_scores": category_scores,
            "raw_points_earned": round(weighted_sum, 2),
            "raw_points_possible": round(weight_total * 100, 2),
        }
    
    def _calculate_category_scores(
        self,
        answer_scores: List[Dict[str, Any]]
    ) -> Dict[str, float]:
        """Calculate average scores per dimension category."""
        dimension_totals = {}
        dimension_counts = {}
        
        for answer in answer_scores:
            breakdown = answer.get("dimension_breakdown", {})
            for dim, score in breakdown.items():
                if score is not None:
                    dimension_totals[dim] = dimension_totals.get(dim, 0) + score
                    dimension_counts[dim] = dimension_counts.get(dim, 0) + 1
        
        category_scores = {}
        for dim in dimension_totals:
            if dimension_counts[dim] > 0:
                category_scores[dim] = round(
                    dimension_totals[dim] / dimension_counts[dim],
                    2
                )
        
        return category_scores
    
    # ===========================================
    # HIRING RECOMMENDATION
    # ===========================================
    
    def calculate_recommendation(
        self,
        overall_score: float,
        category_scores: Dict[str, float],
        flags: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Calculate hiring recommendation based on scores.
        
        Args:
            overall_score: Aggregate interview score (0-100)
            category_scores: Per-category averages
            flags: Any red flags to consider
            
        Returns:
            Recommendation with rationale
        """
        flags = flags or []
        
        # Base recommendation on score
        if overall_score >= 90:
            recommendation = HiringRecommendation.STRONG_HIRE
        elif overall_score >= 80:
            recommendation = HiringRecommendation.HIRE
        elif overall_score >= 65:
            recommendation = HiringRecommendation.MAYBE
        elif overall_score >= 50:
            recommendation = HiringRecommendation.NO_HIRE
        else:
            recommendation = HiringRecommendation.STRONG_NO_HIRE
        
        # Adjust for flags
        if "critical_weakness" in flags and recommendation in [
            HiringRecommendation.STRONG_HIRE,
            HiringRecommendation.HIRE
        ]:
            recommendation = HiringRecommendation.MAYBE
        
        # Generate rationale
        rationale = self._generate_rationale(
            overall_score, category_scores, recommendation
        )
        
        return {
            "recommendation": recommendation.value,
            "rationale": rationale,
            "score_basis": overall_score,
            "flags_considered": flags,
        }
    
    def _generate_rationale(
        self,
        score: float,
        categories: Dict[str, float],
        recommendation: HiringRecommendation
    ) -> str:
        """Generate human-readable rationale for recommendation."""
        # Find strengths and weaknesses
        strengths = [k for k, v in categories.items() if v >= 7]
        weaknesses = [k for k, v in categories.items() if v < 5]
        
        if recommendation == HiringRecommendation.STRONG_HIRE:
            return f"Exceptional performance (score: {score:.1f}) with strong results across all areas."
        elif recommendation == HiringRecommendation.HIRE:
            return f"Good performance (score: {score:.1f}) demonstrating competency in required areas."
        elif recommendation == HiringRecommendation.MAYBE:
            weak_str = ", ".join(weaknesses) if weaknesses else "some areas"
            return f"Mixed performance (score: {score:.1f}). Consider for role with development support in {weak_str}."
        elif recommendation == HiringRecommendation.NO_HIRE:
            return f"Below threshold performance (score: {score:.1f}). Does not meet current requirements."
        else:
            return f"Significantly below expectations (score: {score:.1f}). Not recommended for this role."
    
    # ===========================================
    # EDGE CASE HANDLING
    # ===========================================
    
    def handle_empty_answer(self) -> Dict[str, int]:
        """Return scores for empty/no response."""
        return {
            "relevance": 0,
            "depth": 0,
            "clarity": 0,
            "confidence": 0,
            "technical_accuracy": 0,
            "problem_solving": 0,
        }
    
    def handle_short_answer(self, word_count: int) -> Dict[str, int]:
        """
        Return score caps for very short answers.
        
        Per Step 5:
        - 0-5 words: Depth capped at 3, Clarity capped at 4
        - 6-15 words: Depth capped at 5
        - 16-30 words: Depth capped at 7
        """
        if word_count <= 5:
            return {"depth_cap": 3, "clarity_cap": 4}
        elif word_count <= 15:
            return {"depth_cap": 5, "clarity_cap": None}
        elif word_count <= 30:
            return {"depth_cap": 7, "clarity_cap": None}
        return {"depth_cap": None, "clarity_cap": None}
    
    def handle_off_topic(self) -> Dict[str, int]:
        """Return score caps for off-topic answers."""
        return {
            "relevance_cap": 2,
        }
    
    def handle_skipped(self) -> Dict[str, int]:
        """Return scores for skipped questions."""
        return {
            "relevance": 0,
            "depth": 0,
            "clarity": 0,
            "confidence": 0,
            "technical_accuracy": 0,
            "problem_solving": 0,
            "skipped": True,
        }


# ===========================================
# MODULE FUNCTIONS
# ===========================================


def get_evaluator(role_category: str = "default") -> ScoringEvaluator:
    """
    Get a scoring evaluator for the specified role category.
    
    Args:
        role_category: technical, product, behavioral, design, or default
        
    Returns:
        Configured ScoringEvaluator instance
    """
    try:
        category = RoleCategory(role_category)
    except ValueError:
        category = RoleCategory.DEFAULT
    
    return ScoringEvaluator(category)


def score_to_grade(score: float) -> str:
    """Convert numeric score to letter grade."""
    for threshold, grade in GRADE_THRESHOLDS:
        if score >= threshold:
            return grade.value
    return Grade.F.value
