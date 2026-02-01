"""
Behavioral Simulation Service

Text-based behavioral simulation using language pattern analysis.
Derives emotional state, confidence level, and behavioral patterns
from answer text ONLY.

IMPORTANT DISCLAIMER:
This is TEXT-BASED INFERENCE using linguistic patterns.
NOT real emotion detection, sentiment analysis, or psychological assessment.

Per AI Responsibility Split (Step 4):
- Gemini: Deep reasoning and inference
- Groq: Quick pattern flags only
"""

import re
import json
import time
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from collections import Counter

from app.core.config import settings
from app.simulation.models import AnswerBehavioralInsight, SessionBehavioralSummary
from app.admin.service import AIAPILogService


class BehavioralSimulationService:
    """
    Service for text-based behavioral simulation.
    
    Derives simulated emotional state, confidence, and behavioral patterns
    from linguistic analysis of answer text.
    
    NO real emotion detection, audio, video, or sensor data.
    """
    
    # ===========================================
    # LINGUISTIC MARKERS
    # ===========================================
    
    # Filler words (indicate uncertainty/nervousness in text)
    FILLER_WORDS = {
        'um', 'uh', 'er', 'ah', 'like', 'you know', 'basically', 'actually',
        'literally', 'i mean', 'kind of', 'sort of', 'well', 'so yeah',
    }
    
    # Hedging words (indicate uncertainty)
    HEDGING_WORDS = {
        'maybe', 'perhaps', 'possibly', 'might', 'could', 'probably',
        'i think', 'i believe', 'i guess', 'i suppose', 'not sure',
        'i feel like', 'somewhat', 'kind of', 'sort of', 'potentially',
    }
    
    # Assertive words (indicate confidence)
    ASSERTIVE_WORDS = {
        'definitely', 'certainly', 'absolutely', 'clearly', 'obviously',
        'i know', 'i am confident', 'i am certain', 'without doubt',
        'precisely', 'exactly', 'specifically', 'undoubtedly', 'always',
    }
    
    # Hesitation markers (in typed text)
    HESITATION_MARKERS = {
        '...', '..', '—', '-', 'hmm', 'let me think', 'how do i put this',
    }
    
    # Self-correction markers
    SELF_CORRECTION_MARKERS = {
        'i mean', 'rather', 'actually', 'let me rephrase', 'to clarify',
        'what i meant was', 'sorry', 'correction', 'wait',
    }
    
    def __init__(self, db: Session):
        """Initialize service with database session."""
        self.db = db
        self._gemini_client = None
    
    def _get_gemini_client(self):
        """Get Gemini client if configured."""
        if not settings.is_gemini_configured():
            return None
        
        if self._gemini_client is None:
            try:
                import google.generativeai as genai
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self._gemini_client = genai.GenerativeModel('gemini-pro')
            except Exception as e:
                print(f"Failed to initialize Gemini client: {e}")
                return None
        
        return self._gemini_client
    
    # ===========================================
    # TEXT ANALYSIS (Deterministic)
    # ===========================================
    
    def _count_pattern_occurrences(self, text: str, patterns: set) -> int:
        """Count occurrences of patterns in text."""
        text_lower = text.lower()
        count = 0
        for pattern in patterns:
            count += len(re.findall(r'\b' + re.escape(pattern) + r'\b', text_lower))
        return count
    
    def _analyze_language_patterns(self, text: str) -> Dict[str, Any]:
        """
        Analyze language patterns in answer text.
        
        Returns deterministic metrics based on word/phrase counting.
        """
        text_lower = text.lower()
        words = text.split()
        word_count = len(words)
        
        # Sentence analysis
        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        sentence_count = len(sentences)
        avg_sentence_length = word_count / sentence_count if sentence_count > 0 else 0
        
        # Count linguistic markers
        filler_count = self._count_pattern_occurrences(text, self.FILLER_WORDS)
        hedging_count = self._count_pattern_occurrences(text, self.HEDGING_WORDS)
        assertive_count = self._count_pattern_occurrences(text, self.ASSERTIVE_WORDS)
        hesitation_count = self._count_pattern_occurrences(text, self.HESITATION_MARKERS)
        correction_count = self._count_pattern_occurrences(text, self.SELF_CORRECTION_MARKERS)
        
        # Repetition analysis
        word_freq = Counter(words)
        repetition_count = sum(1 for w, c in word_freq.items() 
                              if c > 2 and len(w) > 3 and w.isalpha())
        
        # Vocabulary diversity (type-token ratio)
        unique_words = set(w.lower() for w in words if w.isalpha())
        vocabulary_diversity = len(unique_words) / word_count if word_count > 0 else 0
        
        # Technical term heuristic (words with specific patterns)
        technical_patterns = [
            r'\b\w+(?:api|sdk|db|sql|orm|css|html|js|py)\b',
            r'\b(?:algorithm|framework|architecture|deployment|scalable)\b',
            r'\b(?:database|server|client|backend|frontend|fullstack)\b',
        ]
        technical_count = 0
        for pattern in technical_patterns:
            technical_count += len(re.findall(pattern, text_lower))
        
        return {
            "word_count": word_count,
            "sentence_count": sentence_count,
            "avg_sentence_length": round(avg_sentence_length, 1),
            "filler_words": filler_count,
            "hedging_words": hedging_count,
            "assertive_words": assertive_count,
            "hesitation_markers": hesitation_count,
            "self_corrections": correction_count,
            "repetitions": repetition_count,
            "vocabulary_diversity": round(vocabulary_diversity, 3),
            "technical_terms": technical_count,
        }
    
    def _infer_emotional_state(self, patterns: Dict[str, Any]) -> Dict[str, Any]:
        """
        Infer simulated emotional state from language patterns.
        
        States: calm, nervous, confident, uncertain
        This is TEXT-BASED INFERENCE, not real emotion detection.
        """
        word_count = patterns.get("word_count", 0)
        fillers = patterns.get("filler_words", 0)
        hedging = patterns.get("hedging_words", 0)
        assertive = patterns.get("assertive_words", 0)
        hesitation = patterns.get("hesitation_markers", 0)
        corrections = patterns.get("self_corrections", 0)
        
        # Normalize counts per 100 words for comparison
        if word_count > 0:
            filler_rate = (fillers / word_count) * 100
            hedging_rate = (hedging / word_count) * 100
            assertive_rate = (assertive / word_count) * 100
        else:
            filler_rate = hedging_rate = assertive_rate = 0
        
        # Scoring logic
        nervous_score = filler_rate * 2 + hedging_rate * 1.5 + hesitation * 3 + corrections * 2
        confident_score = assertive_rate * 3 + (patterns.get("avg_sentence_length", 0) / 20)
        uncertain_score = hedging_rate * 2 + (corrections * 1.5)
        calm_score = 10 - nervous_score * 0.5  # Default baseline
        
        # Determine state
        scores = {
            "nervous": min(nervous_score, 10),
            "confident": min(confident_score, 10),
            "uncertain": min(uncertain_score, 10),
            "calm": max(calm_score, 0),
        }
        
        # Select dominant state
        dominant_state = max(scores, key=scores.get)
        
        # If scores are close, default to calm
        max_score = scores[dominant_state]
        if max_score < 3:
            dominant_state = "calm"
        
        # Calculate inference confidence (how sure we are)
        score_range = max(scores.values()) - min(scores.values())
        inference_confidence = min(score_range / 10, 0.9)  # Cap at 0.9
        
        return {
            "state": dominant_state,
            "confidence": round(inference_confidence, 2),
            "indicators": {
                "filler_rate": round(filler_rate, 2),
                "hedging_rate": round(hedging_rate, 2),
                "assertive_rate": round(assertive_rate, 2),
                "hesitation_markers": hesitation,
                "self_corrections": corrections,
            },
            "scores": {k: round(v, 2) for k, v in scores.items()},
        }
    
    def _infer_confidence_level(self, patterns: Dict[str, Any]) -> Dict[str, Any]:
        """
        Infer simulated confidence level from language patterns.
        
        Levels: high, moderate, low
        This is TEXT-BASED INFERENCE, not real confidence measurement.
        """
        word_count = patterns.get("word_count", 0)
        assertive = patterns.get("assertive_words", 0)
        hedging = patterns.get("hedging_words", 0)
        avg_sentence_len = patterns.get("avg_sentence_length", 0)
        vocab_diversity = patterns.get("vocabulary_diversity", 0)
        corrections = patterns.get("self_corrections", 0)
        
        # Base confidence score
        base_score = 0.5
        
        # Positive factors
        if word_count >= 50:
            base_score += 0.1
        if word_count >= 100:
            base_score += 0.1
        if assertive > 0:
            base_score += min(assertive * 0.05, 0.15)
        if avg_sentence_len >= 15:
            base_score += 0.05
        if vocab_diversity >= 0.5:
            base_score += 0.1
        
        # Negative factors
        if hedging > 0:
            base_score -= min(hedging * 0.05, 0.2)
        if corrections > 1:
            base_score -= 0.1
        if word_count < 20:
            base_score -= 0.2
        
        # Clamp to 0-1
        confidence_score = max(0, min(1, base_score))
        
        # Determine level
        if confidence_score >= 0.7:
            level = "high"
        elif confidence_score >= 0.4:
            level = "moderate"
        else:
            level = "low"
        
        return {
            "level": level,
            "score": round(confidence_score, 2),
            "indicators": {
                "assertive_words": assertive,
                "hedging_words": hedging,
                "answer_length": word_count,
                "vocabulary_diversity": round(vocab_diversity, 3),
                "self_corrections": corrections,
            },
        }
    
    def _generate_observations(
        self,
        patterns: Dict[str, Any],
        emotional: Dict[str, Any],
        confidence: Dict[str, Any],
    ) -> List[str]:
        """Generate human-readable observations based on analysis."""
        observations = []
        
        word_count = patterns.get("word_count", 0)
        
        # Length observations
        if word_count >= 100:
            observations.append("Provides comprehensive, detailed response")
        elif word_count >= 50:
            observations.append("Gives adequate response length")
        elif word_count < 20:
            observations.append("Response is notably brief")
        
        # Language pattern observations
        if patterns.get("technical_terms", 0) >= 3:
            observations.append("Uses relevant technical terminology")
        
        if patterns.get("assertive_words", 0) >= 2:
            observations.append("Expresses ideas with assertive language")
        
        if patterns.get("hedging_words", 0) >= 3:
            observations.append("Uses hedging language (e.g., 'maybe', 'I think')")
        
        if patterns.get("filler_words", 0) >= 3:
            observations.append("Contains filler words in written response")
        
        if patterns.get("vocabulary_diversity", 0) >= 0.6:
            observations.append("Demonstrates varied vocabulary")
        
        # Emotional state observations
        if emotional.get("state") == "confident":
            observations.append("Text patterns suggest confident expression")
        elif emotional.get("state") == "nervous":
            observations.append("Text patterns suggest some hesitation")
        elif emotional.get("state") == "uncertain":
            observations.append("Text patterns suggest uncertainty")
        
        return observations[:5]  # Limit to 5 observations
    
    def _generate_suggestions(
        self,
        patterns: Dict[str, Any],
        confidence: Dict[str, Any],
    ) -> List[str]:
        """Generate improvement suggestions based on patterns."""
        suggestions = []
        
        word_count = patterns.get("word_count", 0)
        
        if word_count < 30:
            suggestions.append("Consider providing more detailed responses with specific examples")
        
        if patterns.get("hedging_words", 0) >= 3:
            suggestions.append("Try using more direct, assertive language when you're certain")
        
        if patterns.get("filler_words", 0) >= 2:
            suggestions.append("Reduce filler words for clearer communication")
        
        if patterns.get("vocabulary_diversity", 0) < 0.4:
            suggestions.append("Vary your word choice to demonstrate broader vocabulary")
        
        if patterns.get("technical_terms", 0) == 0 and word_count > 30:
            suggestions.append("Include relevant technical terms when appropriate")
        
        if confidence.get("score", 0.5) < 0.4:
            suggestions.append("Express your knowledge with more conviction")
        
        return suggestions[:3]  # Limit to 3 suggestions
    
    # ===========================================
    # GEMINI ENHANCED ANALYSIS
    # ===========================================
    
    async def _enhance_with_gemini(
        self,
        answer_text: str,
        question_text: Optional[str],
        base_analysis: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Enhance analysis with Gemini for deeper insights.
        
        Gemini provides:
        - More nuanced observations
        - Better suggestions
        - Narrative interpretation
        """
        client = self._get_gemini_client()
        
        if not client:
            return base_analysis
        
        try:
            prompt = f"""Analyze this interview answer for behavioral patterns.
This is TEXT-BASED analysis only (no audio/video).

Question: {question_text or 'Not provided'}

Answer: {answer_text[:1500]}

Current analysis:
- Emotional state: {base_analysis.get('emotional_state', {}).get('state', 'unknown')}
- Confidence level: {base_analysis.get('confidence_level', {}).get('level', 'unknown')}
- Word count: {base_analysis.get('patterns', {}).get('word_count', 0)}

Provide enhanced observations in JSON:
{{
    "refined_observations": ["observation1", "observation2"],
    "refined_suggestions": ["suggestion1"],
    "communication_style": "brief description of communication style",
    "notable_patterns": ["any notable pattern"]
}}

Be professional and constructive. This is text-only inference."""

            start_time_ai = time.time()
            response = client.generate_content(prompt)
            result_text = response.text
            response_time_ms = int((time.time() - start_time_ai) * 1000)
            
            # Log successful Gemini API call
            try:
                AIAPILogService.log_ai_call(
                    db=self.db,
                    provider="gemini",
                    operation="behavioral_analysis",
                    model="gemini-pro",
                    response_time_ms=response_time_ms,
                    status="success"
                )
            except Exception as log_error:
                print(f"[AI Log Error] Failed to log Gemini call: {log_error}")
            
            if "{" in result_text:
                json_str = result_text[result_text.find("{"):result_text.rfind("}")+1]
                parsed = json.loads(json_str)
                
                # Merge with base analysis
                if parsed.get("refined_observations"):
                    base_analysis["observations"] = parsed["refined_observations"][:5]
                if parsed.get("refined_suggestions"):
                    base_analysis["suggestions"] = parsed["refined_suggestions"][:3]
                if parsed.get("communication_style"):
                    base_analysis["communication_style"] = parsed["communication_style"]
                
                base_analysis["enhanced"] = True
                
        except Exception as e:
            print(f"Gemini enhancement error: {e}")
        
        return base_analysis
    
    # ===========================================
    # PUBLIC API - ANSWER ANALYSIS
    # ===========================================
    
    async def analyze_answer(
        self,
        user_id: str,
        session_id: str,
        question_id: str,
        answer_text: str,
        question_text: Optional[str] = None,
        question_type: Optional[str] = None,
        response_time_seconds: Optional[int] = None,
        evaluation_id: Optional[str] = None,
        use_gemini: bool = False,
    ) -> AnswerBehavioralInsight:
        """
        Analyze an answer and generate behavioral insights.
        
        Returns simulated emotional state, confidence, and observations.
        """
        # Analyze language patterns
        patterns = self._analyze_language_patterns(answer_text)
        
        # Infer emotional state
        emotional = self._infer_emotional_state(patterns)
        
        # Infer confidence level
        confidence = self._infer_confidence_level(patterns)
        
        # Generate observations and suggestions
        observations = self._generate_observations(patterns, emotional, confidence)
        suggestions = self._generate_suggestions(patterns, confidence)
        
        # Prepare result
        result = {
            "patterns": patterns,
            "emotional_state": emotional,
            "confidence_level": confidence,
            "observations": observations,
            "suggestions": suggestions,
        }
        
        # Optionally enhance with Gemini
        source = "mock"
        if use_gemini and settings.is_gemini_configured():
            result = await self._enhance_with_gemini(answer_text, question_text, result)
            source = "gemini"
        
        # Create or update insight record
        existing = self.db.query(AnswerBehavioralInsight).filter(
            AnswerBehavioralInsight.session_id == session_id,
            AnswerBehavioralInsight.question_id == question_id,
            AnswerBehavioralInsight.user_id == user_id,
        ).first()
        
        if existing:
            insight = existing
        else:
            insight = AnswerBehavioralInsight(
                user_id=user_id,
                session_id=session_id,
                question_id=question_id,
                evaluation_id=evaluation_id,
            )
            self.db.add(insight)
        
        # Update fields
        insight.emotional_state = emotional["state"]
        insight.emotional_confidence = emotional["confidence"]
        insight.emotional_indicators = emotional.get("indicators", {})
        
        insight.confidence_level = confidence["level"]
        insight.confidence_score = confidence["score"]
        insight.confidence_indicators = confidence.get("indicators", {})
        
        insight.filler_word_count = patterns.get("filler_words", 0)
        insight.hedging_word_count = patterns.get("hedging_words", 0)
        insight.assertive_word_count = patterns.get("assertive_words", 0)
        insight.sentence_count = patterns.get("sentence_count", 0)
        insight.avg_sentence_length = patterns.get("avg_sentence_length", 0)
        insight.self_correction_count = patterns.get("self_corrections", 0)
        insight.repetition_count = patterns.get("repetitions", 0)
        insight.vocabulary_diversity = patterns.get("vocabulary_diversity", 0)
        insight.technical_term_count = patterns.get("technical_terms", 0)
        
        insight.observations = observations
        insight.suggestions = suggestions
        insight.analysis_source = source
        
        self.db.commit()
        self.db.refresh(insight)
        
        return insight
    
    # ===========================================
    # PUBLIC API - SESSION SUMMARY
    # ===========================================
    
    async def generate_session_summary(
        self,
        user_id: str,
        session_id: str,
    ) -> SessionBehavioralSummary:
        """
        Generate behavioral summary for entire session.
        
        Aggregates insights from all answers and identifies patterns.
        """
        # Get all insights for session
        insights = self.db.query(AnswerBehavioralInsight).filter(
            AnswerBehavioralInsight.session_id == session_id,
            AnswerBehavioralInsight.user_id == user_id,
        ).order_by(AnswerBehavioralInsight.created_at).all()
        
        if not insights:
            raise ValueError("No insights found for session")
        
        # Aggregate emotional states
        emotional_counts = Counter(i.emotional_state for i in insights)
        dominant_emotional = emotional_counts.most_common(1)[0][0]
        
        # Calculate emotional stability
        unique_states = len(emotional_counts)
        emotional_stability = 1 - (unique_states - 1) / 4  # Max 4 states
        
        # Calculate emotional trajectory
        first_half = insights[:len(insights)//2] if len(insights) > 1 else insights
        second_half = insights[len(insights)//2:] if len(insights) > 1 else []
        
        if second_half:
            first_nervous = sum(1 for i in first_half if i.emotional_state in ["nervous", "uncertain"])
            second_nervous = sum(1 for i in second_half if i.emotional_state in ["nervous", "uncertain"])
            if second_nervous < first_nervous:
                emotional_trajectory = "improving"
            elif second_nervous > first_nervous:
                emotional_trajectory = "declining"
            else:
                emotional_trajectory = "stable"
        else:
            emotional_trajectory = "stable"
        
        # Aggregate confidence
        avg_confidence = sum(i.confidence_score for i in insights) / len(insights)
        confidence_counts = Counter(i.confidence_level for i in insights)
        
        # Confidence trajectory
        if second_half:
            first_conf = sum(i.confidence_score for i in first_half) / len(first_half)
            second_conf = sum(i.confidence_score for i in second_half) / len(second_half)
            if second_conf > first_conf + 0.1:
                confidence_trajectory = "improving"
            elif second_conf < first_conf - 0.1:
                confidence_trajectory = "declining"
            else:
                confidence_trajectory = "stable"
        else:
            confidence_trajectory = "stable"
        
        # Calculate statistics
        total_answers = len(insights)
        avg_fillers = sum(i.filler_word_count for i in insights) / total_answers
        avg_vocab = sum(i.vocabulary_diversity for i in insights) / total_answers
        
        # Identify patterns
        improvement_areas = []
        weaknesses = []
        strengths = []
        
        # Check for improvement
        if emotional_trajectory == "improving":
            improvement_areas.append("Emotional composure improved throughout the interview")
        if confidence_trajectory == "improving":
            improvement_areas.append("Confidence increased as the interview progressed")
        
        # Check for recurring weaknesses
        high_hedging = sum(1 for i in insights if i.hedging_word_count >= 3)
        if high_hedging >= total_answers * 0.5:
            weaknesses.append("Consistently uses hedging language")
        
        high_fillers = sum(1 for i in insights if i.filler_word_count >= 3)
        if high_fillers >= total_answers * 0.5:
            weaknesses.append("Frequent use of filler words")
        
        low_vocab = sum(1 for i in insights if i.vocabulary_diversity < 0.4)
        if low_vocab >= total_answers * 0.5:
            weaknesses.append("Limited vocabulary diversity")
        
        # Check for strengths
        high_assertive = sum(1 for i in insights if i.assertive_word_count >= 2)
        if high_assertive >= total_answers * 0.5:
            strengths.append("Expresses ideas assertively")
        
        high_technical = sum(1 for i in insights if i.technical_term_count >= 2)
        if high_technical >= total_answers * 0.5:
            strengths.append("Uses relevant technical terminology")
        
        confident_answers = sum(1 for i in insights if i.confidence_level == "high")
        if confident_answers >= total_answers * 0.5:
            strengths.append("Demonstrates confident communication style")
        
        # Generate narrative
        narrative = self._generate_narrative(
            dominant_emotional,
            emotional_trajectory,
            avg_confidence,
            confidence_trajectory,
            strengths,
            weaknesses,
        )
        
        # Key takeaways
        takeaways = []
        if strengths:
            takeaways.append(f"Strength: {strengths[0]}")
        if weaknesses:
            takeaways.append(f"Area to improve: {weaknesses[0]}")
        if improvement_areas:
            takeaways.append(improvement_areas[0])
        
        # Create or update summary
        existing = self.db.query(SessionBehavioralSummary).filter(
            SessionBehavioralSummary.session_id == session_id,
            SessionBehavioralSummary.user_id == user_id,
        ).first()
        
        if existing:
            summary = existing
        else:
            summary = SessionBehavioralSummary(
                user_id=user_id,
                session_id=session_id,
            )
            self.db.add(summary)
        
        # Update fields
        summary.dominant_emotional_state = dominant_emotional
        summary.emotional_stability = round(emotional_stability, 2)
        summary.emotional_trajectory = emotional_trajectory
        summary.emotional_distribution = dict(emotional_counts)
        
        summary.avg_confidence_score = round(avg_confidence, 2)
        summary.confidence_trajectory = confidence_trajectory
        summary.confidence_distribution = dict(confidence_counts)
        
        summary.improvement_observed = len(improvement_areas) > 0
        summary.improvement_areas = improvement_areas
        summary.recurring_weaknesses = weaknesses
        summary.consistent_strengths = strengths
        
        summary.total_answers_analyzed = total_answers
        summary.avg_filler_words = round(avg_fillers, 2)
        summary.avg_vocabulary_diversity = round(avg_vocab, 3)
        
        summary.narrative_summary = narrative
        summary.key_takeaways = takeaways
        summary.analysis_source = "aggregated"
        
        self.db.commit()
        self.db.refresh(summary)
        
        return summary
    
    def _generate_narrative(
        self,
        emotional_state: str,
        emotional_trajectory: str,
        avg_confidence: float,
        confidence_trajectory: str,
        strengths: List[str],
        weaknesses: List[str],
    ) -> str:
        """Generate narrative summary paragraph."""
        parts = []
        
        # Opening
        if avg_confidence >= 0.7:
            parts.append("The candidate demonstrated a confident communication style throughout the interview.")
        elif avg_confidence >= 0.4:
            parts.append("The candidate showed moderate confidence in their responses.")
        else:
            parts.append("The candidate's responses suggest some hesitancy in communication.")
        
        # Emotional trajectory
        if emotional_trajectory == "improving":
            parts.append("Their composure improved as the interview progressed.")
        elif emotional_trajectory == "declining":
            parts.append("There were signs of increased uncertainty later in the interview.")
        
        # Confidence trajectory
        if confidence_trajectory == "improving":
            parts.append("Confidence levels increased over the course of the interview.")
        
        # Strengths
        if strengths:
            parts.append(f"Notable strength: {strengths[0].lower()}.")
        
        # Areas for improvement
        if weaknesses:
            parts.append(f"An area for development is {weaknesses[0].lower()}.")
        
        return " ".join(parts)
    
    # ===========================================
    # PUBLIC API - RETRIEVAL
    # ===========================================
    
    def get_answer_insight(
        self,
        insight_id: str,
        user_id: str,
    ) -> Optional[AnswerBehavioralInsight]:
        """Get a specific answer insight."""
        return self.db.query(AnswerBehavioralInsight).filter(
            AnswerBehavioralInsight.id == insight_id,
            AnswerBehavioralInsight.user_id == user_id,
        ).first()
    
    def get_session_insights(
        self,
        session_id: str,
        user_id: str,
    ) -> List[AnswerBehavioralInsight]:
        """Get all insights for a session."""
        return self.db.query(AnswerBehavioralInsight).filter(
            AnswerBehavioralInsight.session_id == session_id,
            AnswerBehavioralInsight.user_id == user_id,
        ).order_by(AnswerBehavioralInsight.created_at).all()
    
    def get_session_summary(
        self,
        session_id: str,
        user_id: str,
    ) -> Optional[SessionBehavioralSummary]:
        """Get session behavioral summary."""
        return self.db.query(SessionBehavioralSummary).filter(
            SessionBehavioralSummary.session_id == session_id,
            SessionBehavioralSummary.user_id == user_id,
        ).first()


def get_simulation_service(db: Session) -> BehavioralSimulationService:
    """Get simulation service instance."""
    return BehavioralSimulationService(db)
