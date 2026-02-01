"""
Simulated Emotion Detection

TEXT-BASED SIMULATION of emotional state from text patterns.
Per Step 6: Uses sentiment analysis and linguistic markers.

DISCLAIMER: This is a SIMULATION, NOT actual facial/voice analysis.
"""

from typing import Dict, Any, List
import re


class EmotionAnalyzer:
    """Analyzes text patterns to simulate emotion detection."""
    
    POSITIVE_WORDS = [
        'excited', 'love', 'great', 'excellent', 'happy', 'enjoy',
        'passionate', 'thrilled', 'amazing', 'wonderful', 'fantastic'
    ]
    
    NEGATIVE_WORDS = [
        'unfortunately', 'struggle', 'difficult', 'problem', 'hard',
        'challenge', 'worried', 'concerned', 'frustrated', 'confused'
    ]
    
    HEDGING_WORDS = [
        'maybe', 'perhaps', 'possibly', 'might', 'could be',
        'i think', 'i guess', 'not sure', 'kind of', 'sort of'
    ]
    
    def analyze(self, answer_text: str) -> Dict[str, Any]:
        """Analyze text for simulated emotion signals."""
        if not answer_text:
            return self._empty_result()
        
        text_lower = answer_text.lower()
        
        # Count indicators
        positive_count = sum(1 for w in self.POSITIVE_WORDS if w in text_lower)
        negative_count = sum(1 for w in self.NEGATIVE_WORDS if w in text_lower)
        hedging_count = sum(1 for w in self.HEDGING_WORDS if w in text_lower)
        exclamation_count = answer_text.count('!')
        
        # Determine sentiment
        if positive_count > negative_count * 2:
            sentiment = "positive"
        elif negative_count > positive_count * 2:
            sentiment = "negative"
        else:
            sentiment = "neutral"
        
        # Determine tone
        if hedging_count > 3:
            tone = "uncertain"
        elif positive_count > 2 and exclamation_count > 0:
            tone = "enthusiastic"
        elif hedging_count == 0 and len(answer_text.split()) > 50:
            tone = "confident"
        else:
            tone = "calm"
        
        # Calculate scores
        enthusiasm = min(10, positive_count * 2 + exclamation_count)
        stress = min(10, negative_count * 2 + hedging_count)
        overall = max(0, min(10, 7 + positive_count - negative_count - hedging_count * 0.5))
        
        return {
            "dominant_sentiment": sentiment,
            "emotional_tone": tone,
            "enthusiasm_level": {"score": enthusiasm, "level": "HIGH" if enthusiasm > 6 else "MODERATE"},
            "stress_level": {"score": stress, "level": "HIGH" if stress > 5 else "LOW"},
            "overall_score": round(overall, 2),
            "simulation_method": "SENTIMENT_PATTERN_ANALYSIS",
            "disclaimer": "Text-based simulation, not actual emotion detection."
        }
    
    def _empty_result(self) -> Dict[str, Any]:
        return {"dominant_sentiment": "neutral", "emotional_tone": "calm", "overall_score": 5}


emotion_analyzer = EmotionAnalyzer()
