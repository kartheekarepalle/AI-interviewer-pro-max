"""
Simulated Body Language Analysis

TEXT-BASED SIMULATION of body language from response patterns.
Per Step 6: Uses timing and engagement patterns as proxies.

DISCLAIMER: This is a SIMULATION, NOT actual video/camera analysis.
"""

from typing import Dict, Any, List, Optional


class BehaviorAnalyzer:
    """Analyzes response patterns to simulate body language."""
    
    def analyze(
        self,
        answer_text: str,
        response_time_seconds: Optional[int] = None,
        expected_time_seconds: int = 120,
        word_count: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Analyze response patterns for simulated body language.
        
        Args:
            answer_text: The answer text
            response_time_seconds: Time taken to respond
            expected_time_seconds: Expected response time
            word_count: Word count (calculated if not provided)
        """
        if not answer_text:
            return self._empty_result()
        
        word_count = word_count or len(answer_text.split())
        response_time = response_time_seconds or 60
        
        # Engagement level (based on response length and detail)
        if word_count > 150:
            engagement = 9
            engagement_level = "HIGH"
        elif word_count > 80:
            engagement = 7
            engagement_level = "GOOD"
        elif word_count > 30:
            engagement = 5
            engagement_level = "MODERATE"
        else:
            engagement = 3
            engagement_level = "LOW"
        
        # Presence score (based on response timing)
        time_ratio = response_time / expected_time_seconds if expected_time_seconds else 1
        if 0.3 < time_ratio < 0.8:
            presence = 8
            presence_level = "ATTENTIVE"
        elif time_ratio <= 0.3:
            presence = 6
            presence_level = "QUICK"
        else:
            presence = 5
            presence_level = "DELIBERATE"
        
        # Assertiveness (based on language patterns)
        assertive_patterns = ['I would', 'I believe', 'I know', 'definitely', 'clearly']
        passive_patterns = ['might be', 'could be', 'perhaps', 'maybe']
        
        assertive_count = sum(1 for p in assertive_patterns if p.lower() in answer_text.lower())
        passive_count = sum(1 for p in passive_patterns if p.lower() in answer_text.lower())
        
        assertiveness = min(10, max(3, 6 + assertive_count - passive_count))
        
        # Overall presence
        overall = (engagement * 0.4 + presence * 0.3 + assertiveness * 0.3)
        
        return {
            "engagement_level": {"score": engagement, "level": engagement_level},
            "presence_score": {"score": presence, "level": presence_level},
            "assertiveness_score": assertiveness,
            "overall_presence_score": round(overall, 2),
            "hesitation_patterns": ["Ellipses detected"] if '...' in answer_text else [],
            "simulation_method": "BEHAVIORAL_PATTERN_INFERENCE",
            "confidence_level": "LOW_TO_MODERATE",
            "disclaimer": "Text-based simulation based on response patterns, not video analysis."
        }
    
    def _empty_result(self) -> Dict[str, Any]:
        return {
            "engagement_level": {"score": 0, "level": "NONE"},
            "presence_score": {"score": 0, "level": "NONE"},
            "overall_presence_score": 0
        }


behavior_analyzer = BehaviorAnalyzer()
