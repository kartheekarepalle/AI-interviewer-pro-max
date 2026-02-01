"""
Answer Evaluation Service

Two-layer evaluation system:
- Layer 1: Quick evaluation with Groq (fast, real-time)
- Layer 2: Deep evaluation with Gemini (async, detailed)

Per AI Responsibility Split (Step 4):
- Groq: Quick relevance check, off-topic detection
- Gemini: Deep analysis, multi-dimensional scoring, explanations
"""

import json
import time
import hashlib
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.evaluations.models import AnswerEvaluation
from app.admin.service import AIAPILogService


class EvaluationService:
    """
    Service class for answer evaluation.
    
    Implements two-layer evaluation:
    1. Quick (Groq): Immediate feedback, coarse scoring
    2. Deep (Gemini): Detailed analysis, multi-dimensional scoring
    """
    
    def __init__(self, db: Session):
        """Initialize service with database session."""
        self.db = db
        self._groq_client = None
        self._gemini_client = None
    
    # ===========================================
    # CLIENT INITIALIZATION
    # ===========================================
    
    def _get_groq_client(self):
        """Get Groq client if configured."""
        if not settings.is_groq_configured():
            return None
        
        if self._groq_client is None:
            try:
                from groq import Groq
                self._groq_client = Groq(api_key=settings.GROQ_API_KEY)
            except Exception as e:
                print(f"Failed to initialize Groq client: {e}")
                return None
        
        return self._groq_client
    
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
    # MOCK EVALUATION (Fallback)
    # ===========================================
    
    def _generate_mock_quick_evaluation(
        self,
        question_text: str,
        answer_text: str,
    ) -> Dict[str, Any]:
        """
        Generate FAIR, UNBIASED mock quick evaluation.
        
        CRITICAL RULES:
        1. "I don't know" and similar non-answers MUST receive score of 0
        2. Empty or deflection answers = 0 score (STRICT)
        3. Scores must reflect actual answer quality, not length alone
        4. No padding scores - be honest and accurate
        """
        word_count = len(answer_text.split())
        answer_lower = answer_text.lower().strip()
        sentence_count = answer_text.count('.') + answer_text.count('!') + answer_text.count('?')
        
        # ===========================================
        # STRICT NON-ANSWER DETECTION (SCORE = 0)
        # ===========================================
        # These patterns indicate the user doesn't know or is deflecting
        non_answer_patterns = [
            # Direct "I don't know" variations
            "i don't know", "i dont know", "idk", "i do not know",
            "i have no idea", "no idea", "not sure", "i'm not sure",
            "i am not sure", "no clue", "i have no clue",
            # Deflections
            "i cannot answer", "i can't answer", "cannot answer this",
            "can't answer this", "i'm unable to", "i am unable to",
            "i haven't learned", "i haven't studied", "haven't covered",
            "skip", "pass", "next question", "move on",
            # Explicit uncertainty
            "i really don't know", "honestly don't know", "truly don't know",
            "absolutely no idea", "no knowledge", "never heard of",
            "don't understand the question", "not familiar with",
            # Short deflections (must match closely)
            "dunno", "beats me", "who knows", "not a clue",
        ]
        
        # Check for non-answer patterns
        is_non_answer = False
        for pattern in non_answer_patterns:
            if pattern in answer_lower:
                is_non_answer = True
                break
        
        # Also check if the answer is essentially just the non-answer (very short)
        if word_count <= 10 and is_non_answer:
            # User said "I don't know" or similar with minimal other content
            return {
                "relevance_score": 0.0,
                "is_off_topic": False,
                "is_too_short": True,
                "feedback": "You indicated you don't know the answer. Try to provide at least a partial answer or explanation of your thought process.",
                "source": "mock",
            }
        
        # Check for extremely short/empty answers
        if word_count < 3:
            return {
                "relevance_score": 0.0,
                "is_off_topic": False,
                "is_too_short": True,
                "feedback": "Your answer is too short to evaluate. Please provide a more complete response.",
                "source": "mock",
            }
        
        # Check compound non-answer + minimal effort (e.g., "I don't know, maybe X?")
        if is_non_answer and word_count <= 20:
            return {
                "relevance_score": 1.0,  # Minimal credit for trying
                "is_off_topic": False,
                "is_too_short": True,
                "feedback": "While you indicated uncertainty, try to elaborate more on what you do know about the topic.",
                "source": "mock",
            }
        
        # ===========================================
        # FAIR BASE SCORING FOR REAL ANSWERS
        # ===========================================
        # Start from 5.0 (truly neutral) - scores must be EARNED through quality
        base_score = 5.0
        
        # ===========================================
        # LENGTH SCORING (Proportional, not generous)
        # ===========================================
        if word_count < 10:
            length_factor = -2.0
            is_too_short = True
        elif word_count < 20:
            length_factor = -1.0
            is_too_short = True
        elif word_count < 40:
            length_factor = 0.0  # Neutral
            is_too_short = False
        elif word_count < 80:
            length_factor = 0.5
            is_too_short = False
        elif word_count < 150:
            length_factor = 1.0
            is_too_short = False
        else:
            length_factor = 1.5
            is_too_short = False
        
        # ===========================================
        # SMART RELEVANCE SCORING
        # ===========================================
        import re
        common_stopwords = {
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of',
            'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
            'and', 'but', 'or', 'if', 'because', 'about', 'it', 'this', 'that',
            'i', 'me', 'my', 'we', 'our', 'you', 'your', 'they', 'them', 'their',
            'what', 'which', 'who', 'when', 'where', 'how', 'why', 'all', 'some',
            'any', 'no', 'not', 'only', 'same', 'so', 'than', 'too', 'very',
            'just', 'also', 'now', 'then', 'still', 'well', 'way', 'use', 'used',
            'like', 'make', 'made', 'get', 'got', 'go', 'going', 'know', 'think',
            'see', 'come', 'take', 'want', 'look', 'give', 'first', 'new', 'good'
        }
        
        question_words = set(re.findall(r'\b[a-z]+\b', question_text.lower()))
        answer_words = set(re.findall(r'\b[a-z]+\b', answer_text.lower()))
        
        question_keywords = question_words - common_stopwords
        answer_keywords = answer_words - common_stopwords
        
        common_keywords = question_keywords & answer_keywords
        
        # Relevance factor - more strict
        if len(question_keywords) > 0:
            overlap_ratio = len(common_keywords) / len(question_keywords)
            relevance_factor = min(overlap_ratio * 3.0, 2.0)  # Max +2.0, harder to achieve
        else:
            relevance_factor = 0.0  # Conservative when no keywords
        
        is_off_topic = (
            len(answer_keywords) > 10 and 
            len(common_keywords) < 2 and 
            overlap_ratio < 0.15
        ) if len(question_keywords) > 0 else False
        
        # ===========================================
        # SENTENCE STRUCTURE BONUS
        # ===========================================
        if sentence_count >= 3 and word_count >= 40:
            structure_bonus = 0.75
        elif sentence_count >= 2 and word_count >= 20:
            structure_bonus = 0.5
        elif sentence_count >= 1 and word_count >= 10:
            structure_bonus = 0.25
        else:
            structure_bonus = 0.0
        
        # ===========================================
        # CALCULATE FINAL SCORE (HONEST formula)
        # ===========================================
        final_score = base_score + length_factor + relevance_factor + structure_bonus
        
        # Off-topic heavy penalty
        if is_off_topic:
            final_score -= 2.0
        
        # Clamp to valid range
        final_score = max(0, min(10, final_score))
        
        # ===========================================
        # GENERATE HONEST FEEDBACK
        # ===========================================
        if is_too_short and word_count < 15:
            feedback = "Your answer is quite brief. Provide more detail and examples to demonstrate your knowledge."
        elif is_off_topic:
            feedback = "Your answer doesn't directly address the question asked. Focus on the key points of the question."
        elif final_score >= 8:
            feedback = "Excellent response! Well-structured and directly relevant to the question."
        elif final_score >= 6:
            feedback = "Good answer that addresses the question. Consider adding more specific examples."
        elif final_score >= 4:
            feedback = "Adequate response. Strengthen it with more details and concrete examples from your experience."
        elif final_score >= 2:
            feedback = "The answer needs improvement. Focus more directly on what was asked and provide specific examples."
        else:
            feedback = "The answer does not adequately address the question. Please provide a more relevant response."
        
        return {
            "relevance_score": round(final_score, 1),
            "is_off_topic": is_off_topic,
            "is_too_short": is_too_short,
            "feedback": feedback,
            "source": "mock",
        }
    
    def _generate_mock_deep_evaluation(
        self,
        question_text: str,
        answer_text: str,
        question_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate FAIR, UNBIASED mock deep evaluation.
        
        CRITICAL RULES:
        1. "I don't know" and similar non-answers MUST receive score of 0
        2. Empty or deflection answers = 0 score (STRICT)
        3. Scores must reflect actual answer quality honestly
        4. No padding scores - grades must be earned
        """
        word_count = len(answer_text.split())
        answer_lower = answer_text.lower().strip()
        sentence_count = answer_text.count('.') + answer_text.count('!') + answer_text.count('?')
        
        # ===========================================
        # STRICT NON-ANSWER DETECTION (ALL SCORES = 0)
        # ===========================================
        non_answer_patterns = [
            "i don't know", "i dont know", "idk", "i do not know",
            "i have no idea", "no idea", "not sure", "i'm not sure",
            "i am not sure", "no clue", "i have no clue",
            "i cannot answer", "i can't answer", "cannot answer this",
            "can't answer this", "i'm unable to", "i am unable to",
            "i haven't learned", "i haven't studied", "haven't covered",
            "skip", "pass", "next question", "move on",
            "i really don't know", "honestly don't know", "truly don't know",
            "absolutely no idea", "no knowledge", "never heard of",
            "don't understand the question", "not familiar with",
            "dunno", "beats me", "who knows", "not a clue",
        ]
        
        is_non_answer = any(pattern in answer_lower for pattern in non_answer_patterns)
        
        # STRICT: Non-answer with minimal content = ALL zeros
        if word_count <= 10 and is_non_answer:
            return {
                "relevance_score": 0.0,
                "depth_score": 0.0,
                "clarity_score": 0.0,
                "confidence_score": 0.0,
                "overall_score": 0.0,
                "explanations": {
                    "relevance": "The answer indicates no knowledge of the topic.",
                    "depth": "No substantive content provided.",
                    "clarity": "Cannot evaluate clarity without content.",
                    "confidence": "Response indicates uncertainty or inability to answer.",
                },
                "strengths": [],
                "improvements": [
                    "Study this topic thoroughly before the interview",
                    "Practice explaining concepts even when uncertain",
                    "Try to provide at least a partial answer showing thought process"
                ],
                "key_points_covered": [],
                "missing_points": ["Complete answer required for this question"],
                "feedback": "You indicated you don't know the answer. Focus on studying this topic and practice explaining your thought process even when uncertain.",
                "source": "mock",
            }
        
        # Extremely short answers also get very low scores
        if word_count < 5:
            return {
                "relevance_score": 0.0,
                "depth_score": 0.0,
                "clarity_score": 1.0,
                "confidence_score": 0.0,
                "overall_score": 0.25,
                "explanations": {
                    "relevance": "Answer is too brief to evaluate relevance.",
                    "depth": "No meaningful depth in the response.",
                    "clarity": "Answer is brief but clear.",
                    "confidence": "Very short response suggests uncertainty.",
                },
                "strengths": [],
                "improvements": [
                    "Provide a complete and detailed answer",
                    "Include specific examples from experience",
                    "Structure your response with clear points"
                ],
                "key_points_covered": [],
                "missing_points": ["Substantial answer required"],
                "feedback": "Your answer is too short to evaluate. Please provide a complete response with details and examples.",
                "source": "mock",
            }
        
        # Non-answer with some effort (e.g., "I don't know, but maybe...")
        if is_non_answer and word_count <= 25:
            return {
                "relevance_score": 1.0,
                "depth_score": 0.5,
                "clarity_score": 2.0,
                "confidence_score": 0.5,
                "overall_score": 1.0,
                "explanations": {
                    "relevance": "Shows some attempt but admits not knowing the answer.",
                    "depth": "Limited depth due to uncertainty.",
                    "clarity": "Communication is clear but lacks substance.",
                    "confidence": "Indicates uncertainty about the topic.",
                },
                "strengths": ["Honest about knowledge gaps"],
                "improvements": [
                    "Study this topic before interviews",
                    "Try to explain your thought process even when uncertain",
                    "Share related knowledge if exact answer is unknown"
                ],
                "key_points_covered": [],
                "missing_points": ["Core concepts need to be addressed"],
                "feedback": "While you were honest about uncertainty, try to share what you do know about the topic or a related concept.",
                "source": "mock",
            }
        
        # ===========================================
        # FAIR BASE SCORING FOR REAL ANSWERS
        # ===========================================
        # Start from 5.0 (truly neutral) - scores must be EARNED
        base_relevance = 5.0
        base_depth = 4.5
        base_clarity = 5.0
        base_confidence = 5.0
        
        # ===========================================
        # LENGTH ADJUSTMENT (Honest curve)
        # ===========================================
        if word_count >= 120:
            length_bonus = 2.0
        elif word_count >= 80:
            length_bonus = 1.5
        elif word_count >= 50:
            length_bonus = 1.0
        elif word_count >= 30:
            length_bonus = 0.5
        elif word_count >= 20:
            length_bonus = 0.0
        elif word_count >= 10:
            length_bonus = -1.0
        else:
            length_bonus = -2.0
        
        # ===========================================
        # STRUCTURE QUALITY
        # ===========================================
        if sentence_count >= 4 and word_count >= 60:
            structure_bonus = 1.0
        elif sentence_count >= 3 and word_count >= 40:
            structure_bonus = 0.5
        elif sentence_count >= 2 and word_count >= 20:
            structure_bonus = 0.25
        elif sentence_count >= 1:
            structure_bonus = 0.0
        else:
            structure_bonus = -0.5
        
        # ===========================================
        # CALCULATE HONEST SCORES
        # ===========================================
        relevance_score = max(0, min(10, base_relevance + length_bonus * 0.5 + structure_bonus * 0.5))
        depth_score = max(0, min(10, base_depth + length_bonus * 0.8 + structure_bonus * 0.3))
        clarity_score = max(0, min(10, base_clarity + structure_bonus * 1.5 + length_bonus * 0.2))
        confidence_score = max(0, min(10, base_confidence + length_bonus * 0.4 + structure_bonus * 0.5))
        
        # Overall score (weighted average)
        overall_score = (
            relevance_score * 0.30 +
            depth_score * 0.30 +
            clarity_score * 0.20 +
            confidence_score * 0.20
        )
        
        # ===========================================
        # GENERATE HONEST EXPLANATIONS
        # ===========================================
        explanations = {
            "relevance": f"The answer {'directly and thoroughly addresses' if relevance_score >= 7 else 'addresses' if relevance_score >= 5 else 'partially addresses' if relevance_score >= 3 else 'does not adequately address'} the question asked.",
            "depth": f"The response provides {'excellent' if depth_score >= 7 else 'adequate' if depth_score >= 5 else 'limited' if depth_score >= 3 else 'insufficient'} depth and detail.",
            "clarity": f"The answer is {'very well' if clarity_score >= 7 else 'adequately' if clarity_score >= 5 else 'somewhat' if clarity_score >= 3 else 'poorly'} structured.",
            "confidence": f"The candidate {'demonstrates strong confidence' if confidence_score >= 7 else 'shows reasonable confidence' if confidence_score >= 5 else 'could be more confident' if confidence_score >= 3 else 'appears uncertain'}.",
        }
        
        # ===========================================
        # GENERATE HONEST STRENGTHS/IMPROVEMENTS
        # ===========================================
        strengths = []
        improvements = []
        
        if relevance_score >= 6:
            strengths.append("Addresses the core question effectively")
        elif relevance_score >= 4:
            improvements.append("Focus more directly on the specific question asked")
        else:
            improvements.append("Answer needs to address the question more directly")
        
        if depth_score >= 6:
            strengths.append("Provides good detail and examples")
        elif depth_score >= 4:
            improvements.append("Add more specific examples and details")
        else:
            improvements.append("Significantly more depth and detail needed")
        
        if clarity_score >= 6:
            strengths.append("Well-organized and clear communication")
        elif clarity_score >= 4:
            improvements.append("Improve answer structure and organization")
        else:
            improvements.append("Work on clarity and logical flow")
        
        if confidence_score >= 6:
            strengths.append("Demonstrates confidence in response")
        elif confidence_score < 4:
            improvements.append("Practice speaking with more conviction")
        
        # ===========================================
        # GENERATE HONEST FEEDBACK
        # ===========================================
        if overall_score >= 8:
            feedback = "Excellent answer! Well-structured with relevant details and clear communication."
        elif overall_score >= 6:
            feedback = "Good response that addresses the question. Adding more specific examples would strengthen it."
        elif overall_score >= 4:
            feedback = "Adequate response but needs more depth. Focus on providing concrete examples from your experience."
        elif overall_score >= 2:
            feedback = "The answer needs significant improvement. Focus directly on the question and provide specific details."
        else:
            feedback = "The answer does not adequately address the question. Study this topic and practice explaining it clearly."
        
        return {
            "relevance_score": round(relevance_score, 1),
            "depth_score": round(depth_score, 1),
            "clarity_score": round(clarity_score, 1),
            "confidence_score": round(confidence_score, 1),
            "overall_score": round(overall_score, 1),
            "explanations": explanations,
            "strengths": strengths if strengths else [],
            "improvements": improvements if improvements else ["Continue practicing for improvement"],
            "key_points_covered": ["Demonstrates understanding of topic"] if overall_score >= 5 else ["Partial understanding shown"] if overall_score >= 3 else [],
            "missing_points": ["More specific examples needed"] if overall_score < 7 else [],
            "feedback": feedback,
            "source": "mock",
        }
    
    # ===========================================
    # GROQ QUICK EVALUATION
    # ===========================================
    
    async def _evaluate_with_groq(
        self,
        question_text: str,
        answer_text: str,
    ) -> Dict[str, Any]:
        """Perform quick evaluation using Groq."""
        client = self._get_groq_client()
        
        if not client:
            return self._generate_mock_quick_evaluation(question_text, answer_text)
        
        try:
            prompt = f"""Evaluate this interview answer quickly.

Question: {question_text[:500]}

Answer: {answer_text[:1000]}

Provide a brief evaluation in JSON format:
{{
    "relevance_score": <0-10>,
    "is_off_topic": <true/false>,
    "is_too_short": <true/false>,
    "feedback": "<1-2 sentence feedback>"
}}

Be concise. Score based on how well the answer addresses the question."""

            # Use currently supported model (mixtral-8x7b-32768 is decommissioned)
            model = "llama-3.1-8b-instant"
            start_time = time.time()
            
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "You are a professional interview evaluator. Provide quick, accurate assessments."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=200,
                temperature=0.3,
            )
            
            result_text = response.choices[0].message.content.strip()
            response_time_ms = int((time.time() - start_time) * 1000)
            
            # Log successful Groq API call
            try:
                prompt_tokens = getattr(response.usage, 'prompt_tokens', None) if hasattr(response, 'usage') else None
                completion_tokens = getattr(response.usage, 'completion_tokens', None) if hasattr(response, 'usage') else None
                total_tokens = getattr(response.usage, 'total_tokens', None) if hasattr(response, 'usage') else None
                
                AIAPILogService.log_ai_call(
                    db=self.db,
                    provider="groq",
                    operation="quick_answer_evaluation",
                    model=model,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                    response_time_ms=response_time_ms,
                    status="success"
                )
            except Exception as log_error:
                print(f"[AI Log Error] Failed to log Groq call: {log_error}")
            
            # Parse JSON response
            try:
                if "{" in result_text:
                    json_str = result_text[result_text.find("{"):result_text.rfind("}")+1]
                    parsed = json.loads(json_str)
                    
                    return {
                        "relevance_score": float(parsed.get("relevance_score", 5)),
                        "is_off_topic": bool(parsed.get("is_off_topic", False)),
                        "is_too_short": bool(parsed.get("is_too_short", len(answer_text.split()) < 15)),
                        "feedback": str(parsed.get("feedback", "Answer received."))[:200],
                        "source": "groq",
                    }
            except json.JSONDecodeError:
                pass
            
            # Fallback to mock if parsing fails
            return self._generate_mock_quick_evaluation(question_text, answer_text)
            
        except Exception as e:
            error_msg = str(e)
            print(f"[Groq Evaluation Error] Model: llama-3.1-8b-instant, Error: {error_msg}")
            
            # Log failed Groq API call
            try:
                AIAPILogService.log_ai_call(
                    db=self.db,
                    provider="groq",
                    operation="quick_answer_evaluation",
                    model="llama-3.1-8b-instant",
                    status="error",
                    error_message=error_msg[:500]
                )
            except Exception as log_error:
                print(f"[AI Log Error] Failed to log Groq error: {log_error}")
            
            return self._generate_mock_quick_evaluation(question_text, answer_text)
    
    # ===========================================
    # GEMINI DEEP EVALUATION
    # ===========================================
    
    async def _evaluate_with_gemini(
        self,
        question_text: str,
        answer_text: str,
        question_type: Optional[str] = None,
        resume_context: Optional[str] = None,
        expected_topics: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Perform deep evaluation using Gemini."""
        client = self._get_gemini_client()
        
        if not client:
            return self._generate_mock_deep_evaluation(question_text, answer_text, question_type)
        
        try:
            context = ""
            if resume_context:
                context += f"\nCandidate's Resume Context:\n{resume_context[:1000]}\n"
            if expected_topics:
                context += f"\nExpected Topics: {', '.join(expected_topics[:10])}\n"
            
            prompt = f"""You are an expert interview evaluator. Perform a detailed evaluation of this interview answer.

Question Type: {question_type or 'general'}
Question: {question_text}

Candidate's Answer: {answer_text}
{context}

Evaluate the answer on these dimensions (score 0-10):

1. RELEVANCE: How directly does the answer address the question?
2. DEPTH: How thorough and detailed is the response?
3. CLARITY: How well-structured and clear is the communication?
4. CONFIDENCE: How confidently does the candidate express their ideas?

Provide your evaluation in this JSON format:
{{
    "relevance_score": <0-10>,
    "depth_score": <0-10>,
    "clarity_score": <0-10>,
    "confidence_score": <0-10>,
    "explanations": {{
        "relevance": "<explanation>",
        "depth": "<explanation>",
        "clarity": "<explanation>",
        "confidence": "<explanation>"
    }},
    "strengths": ["<strength1>", "<strength2>"],
    "improvements": ["<improvement1>", "<improvement2>"],
    "key_points_covered": ["<point1>", "<point2>"],
    "missing_points": ["<missing1>"],
    "feedback": "<2-3 sentence overall feedback>"
}}

Be constructive and professional. Provide actionable feedback."""

            start_time = time.time()
            response = client.generate_content(prompt)
            result_text = response.text
            response_time_ms = int((time.time() - start_time) * 1000)
            
            # Log successful Gemini API call
            try:
                AIAPILogService.log_ai_call(
                    db=self.db,
                    provider="gemini",
                    operation="deep_answer_evaluation",
                    model="gemini-pro",
                    response_time_ms=response_time_ms,
                    status="success"
                )
            except Exception as log_error:
                print(f"[AI Log Error] Failed to log Gemini call: {log_error}")
            
            # Parse JSON response
            try:
                if "{" in result_text:
                    json_str = result_text[result_text.find("{"):result_text.rfind("}")+1]
                    parsed = json.loads(json_str)
                    
                    # Calculate overall score
                    relevance = float(parsed.get("relevance_score", 5))
                    depth = float(parsed.get("depth_score", 5))
                    clarity = float(parsed.get("clarity_score", 5))
                    confidence = float(parsed.get("confidence_score", 5))
                    overall = relevance * 0.3 + depth * 0.3 + clarity * 0.2 + confidence * 0.2
                    
                    explanations = parsed.get("explanations", {})
                    
                    return {
                        "relevance_score": relevance,
                        "depth_score": depth,
                        "clarity_score": clarity,
                        "confidence_score": confidence,
                        "overall_score": round(overall, 1),
                        "explanations": {
                            "relevance": explanations.get("relevance", ""),
                            "depth": explanations.get("depth", ""),
                            "clarity": explanations.get("clarity", ""),
                            "confidence": explanations.get("confidence", ""),
                        },
                        "strengths": parsed.get("strengths", [])[:5],
                        "improvements": parsed.get("improvements", [])[:5],
                        "key_points_covered": parsed.get("key_points_covered", [])[:5],
                        "missing_points": parsed.get("missing_points", [])[:5],
                        "feedback": str(parsed.get("feedback", ""))[:500],
                        "source": "gemini",
                    }
            except json.JSONDecodeError:
                pass
            
            # Fallback to mock
            return self._generate_mock_deep_evaluation(question_text, answer_text, question_type)
            
        except Exception as e:
            error_msg = str(e)
            print(f"Gemini evaluation error: {error_msg}")
            
            # Log failed Gemini API call
            try:
                AIAPILogService.log_ai_call(
                    db=self.db,
                    provider="gemini",
                    operation="deep_answer_evaluation",
                    model="gemini-pro",
                    status="error",
                    error_message=error_msg[:500]
                )
            except Exception as log_error:
                print(f"[AI Log Error] Failed to log Gemini error: {log_error}")
            
            return self._generate_mock_deep_evaluation(question_text, answer_text, question_type)
    
    # ===========================================
    # PUBLIC API
    # ===========================================
    
    async def quick_evaluate(
        self,
        user_id: str,
        session_id: str,
        question_id: str,
        question_text: str,
        answer_text: str,
        question_type: Optional[str] = None,
        answer_id: Optional[str] = None,
    ) -> AnswerEvaluation:
        """
        Perform quick evaluation (Layer 1) on an answer.
        
        Uses Groq for fast, real-time evaluation.
        """
        # Check for existing evaluation
        existing = self.db.query(AnswerEvaluation).filter(
            AnswerEvaluation.session_id == session_id,
            AnswerEvaluation.question_id == question_id,
            AnswerEvaluation.user_id == user_id,
        ).first()
        
        if existing and existing.is_finalized:
            raise ValueError("Evaluation is finalized and cannot be updated")
        
        # Perform quick evaluation
        result = await self._evaluate_with_groq(question_text, answer_text)
        
        if existing:
            # Update existing
            evaluation = existing
            evaluation.quick_relevance_score = result["relevance_score"]
            evaluation.quick_is_off_topic = result["is_off_topic"]
            evaluation.quick_is_too_short = result["is_too_short"]
            evaluation.quick_feedback = result["feedback"]
            evaluation.quick_evaluated_at = datetime.utcnow()
            evaluation.quick_evaluation_source = result["source"]
            evaluation.is_quick_complete = True
            evaluation.evaluation_status = "partial" if not evaluation.is_deep_complete else "complete"
        else:
            # Create new
            evaluation = AnswerEvaluation(
                user_id=user_id,
                session_id=session_id,
                question_id=question_id,
                answer_id=answer_id,
                question_text=question_text,
                question_type=question_type,
                answer_text=answer_text,
                answer_word_count=len(answer_text.split()),
                quick_relevance_score=result["relevance_score"],
                quick_is_off_topic=result["is_off_topic"],
                quick_is_too_short=result["is_too_short"],
                quick_feedback=result["feedback"],
                quick_evaluated_at=datetime.utcnow(),
                quick_evaluation_source=result["source"],
                is_quick_complete=True,
                evaluation_status="partial",
            )
            self.db.add(evaluation)
        
        self.db.commit()
        self.db.refresh(evaluation)
        
        return evaluation
    
    async def deep_evaluate(
        self,
        user_id: str,
        session_id: str,
        question_id: str,
        question_text: str,
        answer_text: str,
        question_type: Optional[str] = None,
        resume_context: Optional[str] = None,
        expected_topics: Optional[List[str]] = None,
    ) -> AnswerEvaluation:
        """
        Perform deep evaluation (Layer 2) on an answer.
        
        Uses Gemini for detailed, multi-dimensional evaluation.
        """
        # Check for existing evaluation
        existing = self.db.query(AnswerEvaluation).filter(
            AnswerEvaluation.session_id == session_id,
            AnswerEvaluation.question_id == question_id,
            AnswerEvaluation.user_id == user_id,
        ).first()
        
        if existing and existing.is_finalized:
            raise ValueError("Evaluation is finalized and cannot be updated")
        
        # Perform deep evaluation
        result = await self._evaluate_with_gemini(
            question_text, answer_text, question_type,
            resume_context, expected_topics
        )
        
        if existing:
            evaluation = existing
        else:
            evaluation = AnswerEvaluation(
                user_id=user_id,
                session_id=session_id,
                question_id=question_id,
                question_text=question_text,
                question_type=question_type,
                answer_text=answer_text,
                answer_word_count=len(answer_text.split()),
            )
            self.db.add(evaluation)
        
        # Update deep evaluation fields
        evaluation.deep_relevance_score = result["relevance_score"]
        evaluation.deep_depth_score = result["depth_score"]
        evaluation.deep_clarity_score = result["clarity_score"]
        evaluation.deep_confidence_score = result["confidence_score"]
        evaluation.deep_overall_score = result["overall_score"]
        
        explanations = result.get("explanations", {})
        evaluation.deep_relevance_explanation = explanations.get("relevance")
        evaluation.deep_depth_explanation = explanations.get("depth")
        evaluation.deep_clarity_explanation = explanations.get("clarity")
        evaluation.deep_confidence_explanation = explanations.get("confidence")
        
        evaluation.deep_strengths = result.get("strengths", [])
        evaluation.deep_improvements = result.get("improvements", [])
        evaluation.deep_key_points_covered = result.get("key_points_covered", [])
        evaluation.deep_missing_points = result.get("missing_points", [])
        evaluation.deep_feedback = result.get("feedback")
        
        evaluation.deep_evaluated_at = datetime.utcnow()
        evaluation.deep_evaluation_source = result["source"]
        evaluation.is_deep_complete = True
        evaluation.evaluation_status = "complete" if evaluation.is_quick_complete else "partial"
        
        self.db.commit()
        self.db.refresh(evaluation)
        
        return evaluation
    
    async def batch_deep_evaluate(
        self,
        session_id: str,
        user_id: str,
        resume_context: Optional[str] = None,
    ) -> List[AnswerEvaluation]:
        """
        Perform deep evaluation on all pending answers in a session.
        """
        # Get all evaluations for session that need deep evaluation
        evaluations = self.db.query(AnswerEvaluation).filter(
            AnswerEvaluation.session_id == session_id,
            AnswerEvaluation.user_id == user_id,
            AnswerEvaluation.is_deep_complete == False,
        ).all()
        
        results = []
        for eval in evaluations:
            try:
                updated = await self.deep_evaluate(
                    user_id=user_id,
                    session_id=session_id,
                    question_id=eval.question_id,
                    question_text=eval.question_text or "",
                    answer_text=eval.answer_text,
                    question_type=eval.question_type,
                    resume_context=resume_context,
                )
                results.append(updated)
            except Exception as e:
                print(f"Failed to deep evaluate {eval.id}: {e}")
        
        return results
    
    def get_evaluation(
        self,
        evaluation_id: str,
        user_id: str,
    ) -> Optional[AnswerEvaluation]:
        """Get evaluation by ID (user-scoped)."""
        return self.db.query(AnswerEvaluation).filter(
            AnswerEvaluation.id == evaluation_id,
            AnswerEvaluation.user_id == user_id,
        ).first()
    
    def get_session_evaluations(
        self,
        session_id: str,
        user_id: str,
    ) -> List[AnswerEvaluation]:
        """Get all evaluations for a session."""
        return self.db.query(AnswerEvaluation).filter(
            AnswerEvaluation.session_id == session_id,
            AnswerEvaluation.user_id == user_id,
        ).order_by(AnswerEvaluation.created_at).all()
    
    def finalize_evaluations(
        self,
        session_id: str,
        user_id: str,
    ) -> int:
        """Finalize all evaluations for a session (make immutable)."""
        count = self.db.query(AnswerEvaluation).filter(
            AnswerEvaluation.session_id == session_id,
            AnswerEvaluation.user_id == user_id,
            AnswerEvaluation.is_finalized == False,
        ).update({
            AnswerEvaluation.is_finalized: True,
            AnswerEvaluation.updated_at: datetime.utcnow(),
        })
        
        self.db.commit()
        return count


def get_evaluation_service(db: Session) -> EvaluationService:
    """Get evaluation service instance."""
    return EvaluationService(db)
