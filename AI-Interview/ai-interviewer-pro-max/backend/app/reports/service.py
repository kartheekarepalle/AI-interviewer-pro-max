"""
Interview Report Service

Generates comprehensive interview reports with readiness scoring.
Uses Gemini for AI-powered analysis and narrative generation.

Reports are IMMUTABLE after generation.
"""

import json
import time
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.reports.models import InterviewReport
from app.evaluations.models import AnswerEvaluation
from app.simulation.models import AnswerBehavioralInsight, SessionBehavioralSummary
from app.interviews.live_models import LiveInterviewSession, InterviewAnswer
from app.admin.service import AIAPILogService


class ReportService:
    """
    Service for generating interview reports.
    
    Aggregates:
    - Answer evaluations (technical scores)
    - Behavioral insights (text-inferred)
    - Interview statistics
    
    Produces:
    - Readiness score (0-100)
    - Skill breakdown
    - Strengths & weaknesses
    - Improvement suggestions
    """
    
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
    # DATA COLLECTION
    # ===========================================
    
    def _get_session_data(self, session_id: str, user_id: str) -> Dict[str, Any]:
        """Collect all session data for report generation."""
        # Get interview session
        session = self.db.query(LiveInterviewSession).filter(
            LiveInterviewSession.id == session_id,
            LiveInterviewSession.user_id == user_id,
        ).first()
        
        if not session:
            raise ValueError("Interview session not found")
        
        # Get evaluations
        evaluations = self.db.query(AnswerEvaluation).filter(
            AnswerEvaluation.session_id == session_id,
            AnswerEvaluation.user_id == user_id,
        ).all()
        
        # Get behavioral insights
        insights = self.db.query(AnswerBehavioralInsight).filter(
            AnswerBehavioralInsight.session_id == session_id,
            AnswerBehavioralInsight.user_id == user_id,
        ).all()
        
        # Get behavioral summary
        behavioral_summary = self.db.query(SessionBehavioralSummary).filter(
            SessionBehavioralSummary.session_id == session_id,
            SessionBehavioralSummary.user_id == user_id,
        ).first()
        
        # Get answers
        answers = self.db.query(InterviewAnswer).filter(
            InterviewAnswer.session_id == session_id,
        ).all()
        
        return {
            "session": session,
            "evaluations": evaluations,
            "insights": insights,
            "behavioral_summary": behavioral_summary,
            "answers": answers,
        }
    
    # ===========================================
    # SCORE CALCULATION
    # ===========================================
    
    def _calculate_technical_score(self, evaluations: List[AnswerEvaluation]) -> Dict[str, Any]:
        """
        Calculate aggregated technical scores from evaluations.
        
        Returns scores on 0-10 scale.
        """
        if not evaluations:
            # Default score on 0-10 scale (5 = average)
            return {"overall": 5, "breakdown": {}}
        
        # Collect scores (clamp each to 0-10 range)
        relevance_scores = []
        depth_scores = []
        clarity_scores = []
        confidence_scores = []
        
        for e in evaluations:
            if e.is_deep_complete:
                # Use actual scores, default to LOW (2) if missing = penalize unknowns
                relevance_scores.append(max(0, min(10, e.deep_relevance_score or 2)))
                depth_scores.append(max(0, min(10, e.deep_depth_score or 2)))
                clarity_scores.append(max(0, min(10, e.deep_clarity_score or 2)))
                confidence_scores.append(max(0, min(10, e.deep_confidence_score or 2)))
            elif e.is_quick_complete:
                # Quick eval only has relevance - default LOW
                relevance_scores.append(max(0, min(10, e.quick_relevance_score or 2)))
        
        # Calculate averages - DEFAULT TO LOW (2) if no scores = penalize unanswered
        avg_relevance = sum(relevance_scores) / len(relevance_scores) if relevance_scores else 2
        avg_depth = sum(depth_scores) / len(depth_scores) if depth_scores else 2
        avg_clarity = sum(clarity_scores) / len(clarity_scores) if clarity_scores else 2
        avg_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 2
        
        # Calculate overall (weighted) - result is on 0-10 scale
        overall = (
            avg_relevance * 0.3 +
            avg_depth * 0.3 +
            avg_clarity * 0.2 +
            avg_confidence * 0.2
        )
        
        # Clamp final overall to 0-10
        overall = max(0, min(10, overall))
        
        return {
            "overall": round(overall, 1),
            "breakdown": {
                "relevance": round(max(0, min(10, avg_relevance)), 1),
                "depth": round(max(0, min(10, avg_depth)), 1),
                "clarity": round(max(0, min(10, avg_clarity)), 1),
                "confidence": round(max(0, min(10, avg_confidence)), 1),
            }
        }
    
    def _calculate_behavioral_score(
        self,
        insights: List[AnswerBehavioralInsight],
        summary: Optional[SessionBehavioralSummary],
    ) -> Dict[str, Any]:
        """
        Calculate behavioral score from insights.
        
        Returns scores on 0-10 scale.
        """
        if not insights:
            # DEFAULT TO VERY LOW (1.5/10 = 15%) when no behavioral data
            # This prevents inflating scores just because we couldn't analyze
            return {"overall": 1.5, "breakdown": {}}
        
        # Aggregate confidence scores (clamp to 0-1)
        confidence_scores = [max(0, min(1, i.confidence_score or 0.5)) for i in insights if i.confidence_score is not None]
        avg_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0.5
        avg_confidence = max(0, min(1, avg_confidence))  # Ensure 0-1
        
        # Count emotional states (ratio is naturally 0-1)
        calm_count = sum(1 for i in insights if i.emotional_state == "calm")
        confident_count = sum(1 for i in insights if i.emotional_state == "confident")
        positive_ratio = (calm_count + confident_count) / len(insights) if insights else 0.5
        positive_ratio = max(0, min(1, positive_ratio))
        
        # Stability from summary (clamp to 0-1)
        stability = max(0, min(1, summary.emotional_stability if summary else 0.5))
        
        # Calculate overall behavioral score (0-10 scale)
        # Formula: confidence(0-1)*4 + ratio(0-1)*4 + stability(0-1)*2 = max 10
        behavioral_score = (avg_confidence * 4 + positive_ratio * 4 + stability * 2)
        
        # Clamp to 0-10
        behavioral_score = max(0, min(10, behavioral_score))
        
        return {
            "overall": round(behavioral_score, 1),
            "breakdown": {
                "confidence": round(max(0, min(10, avg_confidence * 10)), 1),
                "composure": round(max(0, min(10, positive_ratio * 10)), 1),
                "stability": round(max(0, min(10, stability * 10)), 1),
            }
        }
    
    def _calculate_readiness_score(
        self,
        technical: Dict[str, Any],
        behavioral: Dict[str, Any],
        completion_rate: float,
        skipped_count: int = 0,
        total_questions: int = 1,
    ) -> int:
        """
        Calculate final readiness score (0-100).
        
        UNBIASED SCORING ALGORITHM (Fixed in V1.1):
        - Technical performance carries the most weight (70%)
        - Behavioral is inferred from text only, so lower weight (15%)
        - Completion rate is a minor factor (10%)
        - Skip penalty applied for skipped questions (5% weight as penalty)
        
        IMPORTANT: This method ALWAYS returns a value between 0-100.
        """
        # ===========================================
        # WEIGHT DISTRIBUTION (UNBIASED - Technical Dominant)
        # ===========================================
        # Technical: 70% - The PRIMARY indicator of interview readiness
        # Behavioral: 15% - Text-inferred only, not reliable, reduced weight
        # Completion: 10% - Minor bonus for completing questions
        # Skip Penalty: 5% - Deduction for skipped questions
        
        TECHNICAL_WEIGHT = 0.70
        BEHAVIORAL_WEIGHT = 0.15
        COMPLETION_WEIGHT = 0.10
        SKIP_PENALTY_WEIGHT = 0.05
        
        # ===========================================
        # GET RAW SCORES (Pre-validation)
        # DEFAULTS ARE LOW to penalize missing/bad answers
        # ===========================================
        raw_technical = technical.get("overall", 2)   # Default LOW (2/10 = 20%)
        raw_behavioral = behavioral.get("overall", 1.5)  # Default VERY LOW (1.5/10 = 15%)
        raw_completion = completion_rate
        
        # ===========================================
        # CLAMP TO EXPECTED RANGES
        # ===========================================
        raw_technical = max(0, min(10, raw_technical))
        raw_behavioral = max(0, min(10, raw_behavioral))
        raw_completion = max(0, min(1, raw_completion))
        
        # ===========================================
        # NORMALIZE ALL SCORES TO 0-100
        # ===========================================
        technical_normalized = raw_technical * 10  # 0-10 -> 0-100
        behavioral_normalized = raw_behavioral * 10  # 0-10 -> 0-100
        completion_normalized = raw_completion * 100  # 0-1 -> 0-100
        
        # ===========================================
        # SKIP PENALTY CALCULATION
        # Skipping questions indicates lack of readiness
        # ===========================================
        skip_rate = skipped_count / total_questions if total_questions > 0 else 0
        skip_penalty = skip_rate * 100  # 0-100 scale (higher = more skipped = worse)
        skip_deduction = skip_penalty * SKIP_PENALTY_WEIGHT  # This will be subtracted
        
        # ===========================================
        # CALCULATE WEIGHTED SCORE
        # ===========================================
        raw_score = (
            technical_normalized * TECHNICAL_WEIGHT +
            behavioral_normalized * BEHAVIORAL_WEIGHT +
            completion_normalized * COMPLETION_WEIGHT
        ) - skip_deduction
        
        # ===========================================
        # FINAL CLAMP: Ensure 0-100 range
        # ===========================================
        final_score = max(0, min(100, round(raw_score)))
        
        # ===========================================
        # DEBUG LOGGING (For transparency)
        # ===========================================
        print(f"[SCORE CALC] Technical: {raw_technical:.1f}/10 (weight: {TECHNICAL_WEIGHT*100:.0f}%)")
        print(f"[SCORE CALC] Behavioral: {raw_behavioral:.1f}/10 (weight: {BEHAVIORAL_WEIGHT*100:.0f}%)")
        print(f"[SCORE CALC] Completion: {raw_completion*100:.1f}% (weight: {COMPLETION_WEIGHT*100:.0f}%)")
        print(f"[SCORE CALC] Skip penalty: {skip_deduction:.1f} (skipped: {skipped_count}/{total_questions})")
        print(f"[SCORE CALC] Final Score: {final_score}/100")
        
        return final_score
    
    # ===========================================
    # INSIGHT GENERATION
    # ===========================================
    
    def _generate_strengths(
        self,
        evaluations: List[AnswerEvaluation],
        insights: List[AnswerBehavioralInsight],
    ) -> List[Dict[str, str]]:
        """Generate list of strengths from evaluations."""
        strengths = []
        
        # High relevance answers
        high_relevance = [e for e in evaluations if (e.deep_relevance_score or 0) >= 7]
        if len(high_relevance) >= len(evaluations) * 0.5:
            strengths.append({
                "area": "Question Understanding",
                "description": "Consistently provided relevant answers that addressed the questions directly",
                "evidence": f"{len(high_relevance)} out of {len(evaluations)} answers showed strong relevance"
            })
        
        # High depth answers
        high_depth = [e for e in evaluations if (e.deep_depth_score or 0) >= 7]
        if len(high_depth) >= len(evaluations) * 0.4:
            strengths.append({
                "area": "Answer Depth",
                "description": "Provided thorough and detailed responses with good examples",
                "evidence": f"Demonstrated depth in {len(high_depth)} answers"
            })
        
        # High clarity
        high_clarity = [e for e in evaluations if (e.deep_clarity_score or 0) >= 7]
        if len(high_clarity) >= len(evaluations) * 0.5:
            strengths.append({
                "area": "Communication Clarity",
                "description": "Expressed ideas clearly and in a well-structured manner",
                "evidence": f"Clear communication in {len(high_clarity)} answers"
            })
        
        # Confident communication from behavioral
        confident_insights = [i for i in insights if i.confidence_level == "high"]
        if len(confident_insights) >= len(insights) * 0.4:
            strengths.append({
                "area": "Confident Expression",
                "description": "Communicated with conviction and assertive language",
                "evidence": "Text patterns indicate confident expression"
            })
        
        # Technical vocabulary
        technical_usage = [i for i in insights if (i.technical_term_count or 0) >= 2]
        if len(technical_usage) >= len(insights) * 0.4:
            strengths.append({
                "area": "Technical Vocabulary",
                "description": "Effectively used relevant technical terminology",
                "evidence": "Consistent use of domain-specific language"
            })
        
        return strengths[:5]  # Limit to 5 strengths
    
    def _generate_weaknesses(
        self,
        evaluations: List[AnswerEvaluation],
        insights: List[AnswerBehavioralInsight],
    ) -> List[Dict[str, str]]:
        """Generate list of weaknesses from evaluations."""
        weaknesses = []
        
        # Low relevance
        low_relevance = [e for e in evaluations if (e.deep_relevance_score or 5) < 5]
        if len(low_relevance) >= len(evaluations) * 0.3:
            weaknesses.append({
                "area": "Question Focus",
                "description": "Some answers did not directly address the questions asked",
                "suggestion": "Practice identifying the core of the question before answering"
            })
        
        # Low depth
        low_depth = [e for e in evaluations if (e.deep_depth_score or 5) < 5]
        if len(low_depth) >= len(evaluations) * 0.3:
            weaknesses.append({
                "area": "Answer Detail",
                "description": "Answers lacked sufficient detail and specific examples",
                "suggestion": "Prepare specific examples from your experience to illustrate points"
            })
        
        # Short answers
        short_answers = [e for e in evaluations if (e.answer_word_count or 0) < 30]
        if len(short_answers) >= len(evaluations) * 0.3:
            weaknesses.append({
                "area": "Response Length",
                "description": "Several answers were notably brief",
                "suggestion": "Aim for more comprehensive responses using the STAR method"
            })
        
        # Hedging language
        high_hedging = [i for i in insights if (i.hedging_word_count or 0) >= 3]
        if len(high_hedging) >= len(insights) * 0.4:
            weaknesses.append({
                "area": "Assertive Language",
                "description": "Frequent use of hedging language (maybe, I think, perhaps)",
                "suggestion": "Practice expressing ideas with more conviction when confident"
            })
        
        # Low confidence
        low_confidence = [i for i in insights if i.confidence_level == "low"]
        if len(low_confidence) >= len(insights) * 0.3:
            weaknesses.append({
                "area": "Expression Confidence",
                "description": "Text patterns suggest hesitant communication style",
                "suggestion": "Practice speaking about your experience with more assertiveness"
            })
        
        return weaknesses[:5]  # Limit to 5 weaknesses
    
    def _generate_improvements(
        self,
        weaknesses: List[Dict[str, str]],
        evaluations: List[AnswerEvaluation],
    ) -> Dict[str, Any]:
        """
        Generate improvement suggestions based on actual interview performance.
        
        CRITICAL: Provides specific, actionable topics based on:
        1. Questions with low scores (relevance < 5)
        2. Questions where depth was lacking (depth < 5)
        3. Specific question types/categories that need work
        4. Extracted keywords from poorly answered questions
        """
        areas = []
        topics = []
        practice = []
        topics_to_study = []  # Specific topics from failed questions
        
        # ===========================================
        # ANALYZE EACH QUESTION FOR WEAK AREAS
        # ===========================================
        for e in evaluations:
            relevance = e.deep_relevance_score or e.quick_relevance_score or 5
            depth = e.deep_depth_score or 5
            overall = e.deep_overall_score or relevance
            
            # Low-performing questions (score < 4) - extract topics
            if overall < 4 and e.question_text:
                # Extract key topic from question
                question_topic = self._extract_topic_from_question(e.question_text, e.question_type)
                if question_topic:
                    topics_to_study.append({
                        "topic": question_topic,
                        "category": e.question_type or "general",
                        "score": round(overall, 1),
                        "reason": f"Scored {round(overall, 1)}/10 - needs improvement"
                    })
            
            # Medium-low questions (4-5) - suggest review
            elif overall < 5 and e.question_text:
                question_topic = self._extract_topic_from_question(e.question_text, e.question_type)
                if question_topic:
                    topics_to_study.append({
                        "topic": question_topic,
                        "category": e.question_type or "general",
                        "score": round(overall, 1),
                        "reason": f"Scored {round(overall, 1)}/10 - review recommended"
                    })
        
        # ===========================================
        # CREATE IMPROVEMENT AREAS FROM WEAKNESSES
        # ===========================================
        for i, weakness in enumerate(weaknesses[:3]):
            priority = "high" if i == 0 else ("medium" if i == 1 else "low")
            areas.append({
                "area": weakness["area"],
                "priority": priority,
                "action": weakness.get("suggestion", "Focus on improving this area"),
                "resources": []
            })
        
        # ===========================================
        # GENERATE SPECIFIC TOPIC RECOMMENDATIONS
        # ===========================================
        # From poorly answered questions
        for ts in topics_to_study[:10]:  # Limit to top 10
            topic_entry = f"{ts['topic']} ({ts['category'].replace('_', ' ').title()}) - {ts['reason']}"
            topics.append(topic_entry)
        
        # General topics based on weakness patterns
        if any("depth" in (w.get("area", "").lower()) for w in weaknesses):
            topics.extend([
                "Practice structuring detailed responses using STAR method",
                "Prepare 3-5 specific examples for common scenarios"
            ])
        
        if any("relevance" in (w.get("area", "").lower()) or "focus" in (w.get("area", "").lower()) for w in weaknesses):
            topics.extend([
                "Practice identifying key points in interview questions",
                "Work on directly addressing what's being asked"
            ])
        
        if any("technical" in (w.get("area", "").lower()) for w in weaknesses):
            topics.extend([
                "Review core technical concepts for your role",
                "Practice explaining technical solutions clearly"
            ])
        
        if any("confidence" in (w.get("area", "").lower()) for w in weaknesses):
            topics.extend([
                "Practice speaking with conviction",
                "Avoid hedging words like 'maybe', 'I think', 'perhaps'"
            ])
        
        # ===========================================
        # GENERATE PRACTICE SUGGESTIONS
        # ===========================================
        practice.extend([
            "Record yourself answering practice questions and review",
            "Practice with a friend or mentor for feedback",
            "Time your responses - aim for 1-2 minutes per answer",
            "Review and refine your key talking points"
        ])
        
        # Deduplicate and limit topics
        unique_topics = list(dict.fromkeys(topics))[:8]
        
        return {
            "areas": areas,
            "topics": unique_topics,
            "practice": practice[:4],
            "topics_to_study": topics_to_study[:10]  # Detailed list for report
        }
    
    def _extract_topic_from_question(self, question_text: str, question_type: Optional[str] = None) -> Optional[str]:
        """
        Extract the main topic/concept from a question for learning recommendations.
        
        Examples:
        - "Explain polymorphism in OOP" -> "Polymorphism in Object-Oriented Programming"
        - "Tell me about a time when you..." -> "Behavioral scenario handling"
        - "What is your experience with React?" -> "React framework"
        """
        import re
        
        question_lower = question_text.lower().strip()
        
        # Common question prefixes to strip
        prefixes = [
            r"^(tell me about|describe|explain|what is|what are|how do you|how would you|give an example of|can you|could you|please)\s+",
            r"^(what's your|what is your|describe your|share your)\s+",
            r"^(a time when|a situation where|an example of)\s+",
        ]
        
        cleaned = question_lower
        for prefix in prefixes:
            cleaned = re.sub(prefix, "", cleaned)
        
        # Remove trailing punctuation and common endings
        cleaned = re.sub(r"[?.!]+$", "", cleaned)
        cleaned = re.sub(r"\s+(in your career|in your experience|you've handled).*$", "", cleaned)
        
        # Capitalize and format
        if len(cleaned) > 5 and len(cleaned) < 100:
            # Capitalize first letter of each major word
            topic = cleaned.strip().capitalize()
            
            # Add category context if available
            if question_type:
                category_label = question_type.replace("_", " ").title()
                return f"{topic}"  # Keep it clean, category is already tracked
            return topic
        
        # Fallback for very short or very long questions
        if question_type:
            return f"{question_type.replace('_', ' ').title()} concepts"
        
        return None
    
    # ===========================================
    # GEMINI ENHANCED GENERATION
    # ===========================================
    
    async def _generate_with_gemini(
        self,
        session_data: Dict[str, Any],
        technical_scores: Dict[str, Any],
        behavioral_scores: Dict[str, Any],
        strengths: List[Dict[str, str]],
        weaknesses: List[Dict[str, str]],
    ) -> Dict[str, Any]:
        """Use Gemini to generate enhanced report narrative."""
        client = self._get_gemini_client()
        
        if not client:
            return self._generate_mock_narrative(technical_scores, behavioral_scores, strengths, weaknesses)
        
        try:
            session = session_data["session"]
            evaluations = session_data["evaluations"]
            
            # Build context
            eval_summaries = []
            for e in evaluations[:10]:  # Limit to 10 for context
                eval_summaries.append({
                    "question_type": e.question_type,
                    "relevance": e.deep_relevance_score,
                    "depth": e.deep_depth_score,
                })
            
            prompt = f"""Generate a professional interview performance report.

Interview Context:
- Target Role: {session.target_role or 'Software Developer'}
- Questions Answered: {session.questions_answered}
- Interview Type: Mixed (Technical & Behavioral)

Technical Scores:
{json.dumps(technical_scores, indent=2)}

Behavioral Scores (text-inferred):
{json.dumps(behavioral_scores, indent=2)}

Strengths Identified:
{json.dumps([s['area'] for s in strengths], indent=2)}

Weaknesses Identified:
{json.dumps([w['area'] for w in weaknesses], indent=2)}

Generate in JSON format:
{{
    "executive_summary": "<3-4 sentence professional summary of performance>",
    "recommendation": "<1-2 sentence hiring readiness recommendation>",
    "score_explanation": "<Brief explanation of how the score was determined>",
    "behavioral_narrative": "<2-3 sentence summary of communication style, text-based inference only>",
    "top_improvement": "<Most important area to improve>"
}}

Be professional, constructive, and specific. Avoid vague praise."""

            start_time = time.time()
            response = client.generate_content(prompt)
            result_text = response.text
            response_time_ms = int((time.time() - start_time) * 1000)
            
            # Log successful Gemini API call
            try:
                AIAPILogService.log_ai_call(
                    db=self.db,
                    provider="gemini",
                    operation="generate_report_narrative",
                    model="gemini-pro",
                    response_time_ms=response_time_ms,
                    status="success"
                )
            except Exception as log_error:
                print(f"[AI Log Error] Failed to log Gemini call: {log_error}")
            
            if "{" in result_text:
                json_str = result_text[result_text.find("{"):result_text.rfind("}")+1]
                parsed = json.loads(json_str)
                return {
                    "executive_summary": parsed.get("executive_summary", ""),
                    "recommendation": parsed.get("recommendation", ""),
                    "score_explanation": parsed.get("score_explanation", ""),
                    "behavioral_narrative": parsed.get("behavioral_narrative", ""),
                    "source": "gemini",
                }
        except Exception as e:
            error_msg = str(e)
            print(f"Gemini report generation error: {error_msg}")
            
            # Log failed Gemini API call
            try:
                AIAPILogService.log_ai_call(
                    db=self.db,
                    provider="gemini",
                    operation="generate_report_narrative",
                    model="gemini-pro",
                    status="error",
                    error_message=error_msg[:500]
                )
            except Exception as log_error:
                print(f"[AI Log Error] Failed to log Gemini error: {log_error}")
        
        return self._generate_mock_narrative(technical_scores, behavioral_scores, strengths, weaknesses)
    
    def _generate_mock_narrative(
        self,
        technical: Dict[str, Any],
        behavioral: Dict[str, Any],
        strengths: List[Dict[str, str]],
        weaknesses: List[Dict[str, str]],
    ) -> Dict[str, Any]:
        """Generate mock narrative without Gemini."""
        overall = technical.get("overall", 5)
        
        if overall >= 7:
            summary = "The candidate demonstrated strong performance across the interview, showing good technical understanding and clear communication. Answers were generally relevant and well-structured."
            recommendation = "Ready for interviews. Continue practicing to maintain and improve performance."
        elif overall >= 5:
            summary = "The candidate showed adequate performance with room for improvement. Technical knowledge is present but could be demonstrated more clearly."
            recommendation = "Needs some preparation. Focus on the improvement areas before important interviews."
        else:
            summary = "The candidate's performance indicates significant areas for improvement. More practice and preparation is recommended."
            recommendation = "Requires additional preparation. Focus on fundamentals and practice extensively."
        
        explanation = (
            f"The readiness score is calculated from technical performance ({int(technical.get('overall', 5) * 10)}% weight: 70%), "
            f"communication patterns ({int(behavioral.get('overall', 3) * 10)}% weight: 15%), "
            f"interview completion (weight: 10%), minus any skip penalty (weight: 5%)."
        )
        
        behavioral_narrative = "Based on text analysis, the candidate's communication style was generally clear. " \
                              "Language patterns suggest a composed approach to answering questions."
        
        return {
            "executive_summary": summary,
            "recommendation": recommendation,
            "score_explanation": explanation,
            "behavioral_narrative": behavioral_narrative,
            "source": "mock",
        }
    
    # ===========================================
    # PUBLIC API
    # ===========================================
    
    async def generate_report(
        self,
        user_id: str,
        session_id: str,
    ) -> InterviewReport:
        """
        Generate comprehensive interview report.
        
        Aggregates all data and produces final readiness score.
        Report is IMMUTABLE after generation.
        """
        # Check if report already exists
        existing = self.db.query(InterviewReport).filter(
            InterviewReport.session_id == session_id,
            InterviewReport.user_id == user_id,
        ).first()
        
        if existing:
            return existing  # Reports are immutable
        
        # Collect session data
        session_data = self._get_session_data(session_id, user_id)
        session = session_data["session"]
        evaluations = session_data["evaluations"]
        insights = session_data["insights"]
        behavioral_summary = session_data["behavioral_summary"]
        answers = session_data["answers"]
        
        # Calculate scores
        technical_scores = self._calculate_technical_score(evaluations)
        behavioral_scores = self._calculate_behavioral_score(insights, behavioral_summary)
        
        # Calculate completion rate
        total_q = session.total_questions or 1
        answered = session.questions_answered or 0
        completion_rate = answered / total_q if total_q > 0 else 0
        
        # Calculate readiness score (UNBIASED V1.1)
        skipped = session.questions_skipped or 0
        readiness_score = self._calculate_readiness_score(
            technical_scores,
            behavioral_scores,
            completion_rate,
            skipped_count=skipped,
            total_questions=total_q
        )
        
        # Generate insights
        strengths = self._generate_strengths(evaluations, insights)
        weaknesses = self._generate_weaknesses(evaluations, insights)
        improvements = self._generate_improvements(weaknesses, evaluations)
        
        # Generate narrative with Gemini
        narrative = await self._generate_with_gemini(
            session_data, technical_scores, behavioral_scores, strengths, weaknesses
        )
        
        # Create report
        report = InterviewReport(
            user_id=user_id,
            session_id=session_id,
            plan_id=session.plan_id,
            target_role=session.target_role,
            interview_type="mixed",
            readiness_score=readiness_score,
            score_breakdown={
                "technical": technical_scores["overall"] * 10,
                "behavioral": behavioral_scores["overall"] * 10,
                "completion": completion_rate * 100,
            },
            score_explanation=narrative.get("score_explanation"),
            category_scores={
                "relevance": technical_scores["breakdown"].get("relevance", 5),
                "depth": technical_scores["breakdown"].get("depth", 5),
                "clarity": technical_scores["breakdown"].get("clarity", 5),
                "confidence": behavioral_scores["breakdown"].get("confidence", 5),
            },
            strengths=strengths,
            weaknesses=weaknesses,
            behavioral_summary=narrative.get("behavioral_narrative"),
            emotional_pattern=behavioral_summary.dominant_emotional_state if behavioral_summary else "calm",
            confidence_trend=behavioral_summary.confidence_trajectory if behavioral_summary else "stable",
            improvement_areas=improvements["areas"],
            recommended_topics=improvements["topics"],
            practice_suggestions=improvements["practice"],
            topics_to_study=improvements.get("topics_to_study", []),
            total_questions=session.total_questions or 0,
            questions_answered=session.questions_answered or 0,
            questions_skipped=session.questions_skipped or 0,
            executive_summary=narrative.get("executive_summary"),
            recommendation=narrative.get("recommendation"),
            generation_source=narrative.get("source", "mock"),
        )
        
        # Set grade and level
        report.readiness_grade = report.get_grade()
        report.readiness_level = report.get_level()
        
        self.db.add(report)
        self.db.commit()
        self.db.refresh(report)
        
        return report
    
    def get_report(
        self,
        session_id: str,
        user_id: str,
    ) -> Optional[InterviewReport]:
        """Get report by session ID."""
        return self.db.query(InterviewReport).filter(
            InterviewReport.session_id == session_id,
            InterviewReport.user_id == user_id,
        ).first()
    
    def get_question_feedback(
        self,
        session_id: str,
        user_id: str,
    ) -> List[Dict[str, Any]]:
        """
        Generate question-by-question feedback for the report.
        
        Returns a list of feedback objects, one for each answered question,
        including score, feedback, strengths, and improvements.
        """
        # Get evaluations for this session
        evaluations = self.db.query(AnswerEvaluation).filter(
            AnswerEvaluation.session_id == session_id,
            AnswerEvaluation.user_id == user_id,
        ).order_by(AnswerEvaluation.created_at).all()
        
        feedback_list = []
        
        for idx, eval_ in enumerate(evaluations, 1):
            # Get the best available score
            overall_score = eval_.deep_overall_score or eval_.quick_relevance_score or 5.0
            
            # Get feedback text
            feedback_text = eval_.deep_feedback or eval_.quick_feedback or "Evaluation not available."
            
            # Get strengths and improvements
            strengths = eval_.deep_strengths or []
            improvements = eval_.deep_improvements or []
            
            # Build feedback object
            feedback_obj = {
                "question_number": idx,
                "question_text": eval_.question_text,
                "question_type": eval_.question_type,
                "score": round(overall_score, 1),
                "feedback": feedback_text,
                "strengths": strengths,
                "improvements": improvements,
            }
            
            feedback_list.append(feedback_obj)
        
        return feedback_list
    
    def get_user_reports(
        self,
        user_id: str,
        limit: int = 10,
    ) -> List[InterviewReport]:
        """Get user's reports."""
        return self.db.query(InterviewReport).filter(
            InterviewReport.user_id == user_id,
        ).order_by(InterviewReport.generated_at.desc()).limit(limit).all()
    
    async def finalize_interview(
        self,
        session_id: str,
        user_id: str,
    ) -> InterviewReport:
        """
        CRITICAL: Finalize an interview session and generate the final report.
        
        This is the GUARANTEED entry point for interview finalization.
        Called automatically when:
        - Last question is answered (is_complete = True)
        - Interview is ended early (end_interview)
        - Manual trigger from frontend
        
        Guarantees:
        ✔ Generates final summary (Gemini if available, otherwise mock)
        ✔ Computes final scores
        ✔ Creates structured report object
        ✔ Saves report in database
        ✔ Marks interview session as COMPLETED
        ✔ Returns the saved report
        
        Returns:
            InterviewReport: The persisted report object
            
        Raises:
            ValueError: If session not found or already finalized
        """
        print(f"[FINALIZE] Starting finalization for session: {session_id}")
        
        # Check if report already exists (idempotent)
        existing_report = self.db.query(InterviewReport).filter(
            InterviewReport.session_id == session_id,
            InterviewReport.user_id == user_id,
        ).first()
        
        if existing_report:
            print(f"[FINALIZE] Report already exists for session {session_id}, returning existing")
            return existing_report
        
        # Get the session
        from app.interviews.live_models import LiveInterviewSession
        session = self.db.query(LiveInterviewSession).filter(
            LiveInterviewSession.id == session_id,
            LiveInterviewSession.user_id == user_id,
        ).first()
        
        if not session:
            raise ValueError(f"Session not found: {session_id}")
        
        # Ensure session is marked as completed
        if session.status not in ["completed", "completing"]:
            session.status = "completed"
            session.completed_at = datetime.utcnow()
            self.db.commit()
            print(f"[FINALIZE] Session status updated to 'completed'")
        
        # Generate the full report using existing logic
        try:
            report = await self.generate_report(
                user_id=user_id,
                session_id=session_id,
            )
            print(f"[FINALIZE] Report generated successfully: {report.id}")
            print(f"[FINALIZE] Report score: {report.readiness_score}")
            return report
        except Exception as e:
            print(f"[FINALIZE] Report generation failed: {e}")
            # Create a fallback minimal report to ensure something is saved
            return await self._create_fallback_report(session_id, user_id, session)
    
    async def _create_fallback_report(
        self,
        session_id: str,
        user_id: str,
        session: Any,
    ) -> InterviewReport:
        """
        Create a minimal fallback report when full generation fails.
        
        CRITICAL: This ensures a report is ALWAYS saved, even on failures.
        """
        print(f"[FALLBACK] Creating fallback report for session: {session_id}")
        
        # Calculate basic completion stats
        total_q = session.total_questions or 1
        answered = session.questions_answered or 0
        skipped = session.questions_skipped or 0
        completion_rate = answered / total_q if total_q > 0 else 0
        
        # Compute a basic score based on completion (UNBIASED V1.1)
        # Technical: Not available in fallback, so use completion as proxy
        # Skip penalty: Applied to discourage skipping
        skip_penalty_rate = skipped / total_q if total_q > 0 else 0
        basic_score = int(completion_rate * 70) - int(skip_penalty_rate * 10)  # Max 70, with skip penalty
        basic_score = max(0, min(100, basic_score))
        
        # Create minimal report
        report = InterviewReport(
            user_id=user_id,
            session_id=session_id,
            plan_id=session.plan_id,
            target_role=session.target_role or "Unknown Role",
            interview_type="mixed",
            readiness_score=basic_score,
            score_breakdown={
                "technical": basic_score,
                "behavioral": basic_score,
                "completion": completion_rate * 100,
            },
            score_explanation="This report was generated with limited data. Complete more questions for a detailed analysis.",
            strengths=[],
            weaknesses=[],
            improvement_areas=[],
            recommended_topics=["Practice more interviews for detailed insights"],
            practice_suggestions=["Complete full interview sessions for comprehensive feedback"],
            total_questions=session.total_questions or 0,
            questions_answered=session.questions_answered or 0,
            questions_skipped=session.questions_skipped or 0,
            executive_summary=f"Interview completed with {answered} of {total_q} questions answered.",
            recommendation="Continue practicing to improve your interview skills.",
            generation_source="fallback",
        )
        
        # Set grade and level
        report.readiness_grade = report.get_grade()
        report.readiness_level = report.get_level()
        
        try:
            self.db.add(report)
            self.db.commit()
            self.db.refresh(report)
            print(f"[FALLBACK] Fallback report saved: {report.id}")
            return report
        except Exception as e:
            print(f"[FALLBACK] Failed to save fallback report: {e}")
            self.db.rollback()
            raise ValueError(f"Failed to create report: {e}")
    
    def get_report_or_generate(
        self,
        session_id: str,
        user_id: str,
    ) -> Optional[InterviewReport]:
        """
        Get report if exists, otherwise check if session is completed and eligible for generation.
        
        This is a sync helper for GET /api/reports/{session_id} to provide better UX.
        """
        # First check for existing report
        report = self.get_report(session_id=session_id, user_id=user_id)
        if report:
            return report
        
        # Check if session exists and is completed
        from app.interviews.live_models import LiveInterviewSession
        session = self.db.query(LiveInterviewSession).filter(
            LiveInterviewSession.id == session_id,
            LiveInterviewSession.user_id == user_id,
        ).first()
        
        if session and session.status == "completed":
            # Session is completed but report doesn't exist - return None
            # The caller should trigger async generation
            return None
        
        return None


def get_report_service(db: Session) -> ReportService:
    """Get report service instance."""
    return ReportService(db)
