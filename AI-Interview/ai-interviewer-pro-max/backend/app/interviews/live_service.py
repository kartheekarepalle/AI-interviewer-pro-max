"""
Live Interview Service

Business logic for real-time interview session management.
Uses Groq API for fast, conversational interactions.

Per requirements:
- Groq is the PRIMARY engine for live interviews
- Low latency responses
- No deep analysis (that's for Gemini later)
- Personality modes affect tone, not scoring
"""

import time
import uuid
import random
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.interviews.live_models import LiveInterviewSession, InterviewMessage, InterviewAnswer
from app.interviews.plan_models import InterviewPlan
from app.personalities.modes import get_personality, get_default_personality, PersonalityProfile
from app.reports.service import ReportService
from app.admin.service import AIAPILogService

# TOON (Token-Oriented Object Notation) for 30-60% token savings on LLM calls
from app.utils.toon_encoder import encode_for_llm, wrap_data_for_prompt, get_toon_instruction, get_toon_stats


class LiveInterviewService:
    """
    Service class for live interview operations.
    
    Manages:
    - Session creation and state
    - Question delivery
    - Answer reception
    - Conversational flow with Groq
    """
    
    def __init__(self, db: Session):
        """Initialize service with database session."""
        self.db = db
        self._groq_client = None
    
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
    
    def _get_personality_profile(self, persona: str) -> PersonalityProfile:
        """Get personality profile from persona ID."""
        # Map legacy persona names to personality IDs
        persona_map = {
            "professional": "neutral",
            "friendly": "friendly",
            "stress": "stress",
        }
        personality_id = persona_map.get(persona, persona)
        return get_personality(personality_id) or get_default_personality()
    
    def _get_persona_greeting(self, persona: str, target_role: str) -> str:
        """Get greeting based on personality profile."""
        profile = self._get_personality_profile(persona)
        
        # Build greeting based on profile
        if profile.id == "strict":
            return f"Welcome to your {target_role} interview. I'll be conducting this session. Let's begin without delay."
        elif profile.id == "friendly":
            return f"Hi there! Welcome to your {target_role} interview! I'm excited to learn more about you today. Don't worry, just be yourself and take your time with each question. 😊"
        elif profile.id == "stress":
            return f"Welcome. This is your {target_role} interview. I'll be asking you a series of questions. Be concise and specific. Time is limited. Let's begin."
        else:  # neutral
            return f"Hello and welcome to your {target_role} interview. I'll be conducting this session today. Let's begin with some questions to learn more about your background and skills."
    
    def _get_acknowledgment(self, persona: str, word_count: int, session_id: str = None) -> str:
        """Get varied acknowledgment based on personality profile and answer quality.
        
        Tracks used acknowledgments per session to prevent repetition.
        """
        profile = self._get_personality_profile(persona)
        
        # Get or create session acknowledgment tracker
        if not hasattr(self, '_used_acks'):
            self._used_acks = {}
        
        used = self._used_acks.get(session_id, set()) if session_id else set()
        
        # Define varied acknowledgments for each scenario
        if word_count < 15:
            # Brief answer - move on without asking for elaboration (to avoid repetitive prompts)
            if profile.id == "strict":
                options = [
                    "Understood. Let's proceed.",
                    "Concise. Moving on.",
                    "Noted.",
                    "Acknowledged.",
                    "Very well.",
                ]
            elif profile.id == "friendly":
                options = [
                    "Thanks for that!",
                    "Got it, appreciate the response!",
                    "Okay, thank you!",
                    "Alright, thanks for sharing!",
                    "Good, I appreciate you answering.",
                ]
            elif profile.id == "stress":
                options = [
                    "Noted. Continue.",
                    "Okay.",
                    "Fine.",
                    "Moving on.",
                    "Next.",
                ]
            else:
                options = [
                    "Thank you.",
                    "I understand.",
                    "Noted, thank you.",
                    "Alright, thank you for that.",
                    "Understood.",
                ]
        elif word_count < 50:
            # Medium answer
            if profile.id == "strict":
                options = [
                    "Understood. Proceeding.",
                    "That's sufficient.",
                    "Noted. Let's continue.",
                    "Very well.",
                    "Acceptable. Moving forward.",
                ]
            elif profile.id == "friendly":
                options = [
                    "Great answer, thank you!",
                    "That's helpful, thanks!",
                    "Good point, I appreciate that!",
                    "Nice, that gives me a clear picture!",
                    "Excellent, thank you for sharing!",
                ]
            elif profile.id == "stress":
                options = [
                    "Okay. Next.",
                    "Moving on.",
                    "Noted.",
                    "Proceed.",
                    "Good. Continue.",
                ]
            else:
                options = [
                    "Thank you for your response.",
                    "That's helpful, thank you.",
                    "I appreciate that answer.",
                    "Good, thank you for that.",
                    "Noted, thank you.",
                ]
        else:
            # Comprehensive answer
            if profile.id == "strict":
                options = [
                    "Comprehensive. Let's proceed.",
                    "Thorough response. Moving on.",
                    "Noted. Continue.",
                    "Clear. Next question.",
                    "Well articulated. Proceeding.",
                ]
            elif profile.id == "friendly":
                options = [
                    "Wonderful answer, thank you!",
                    "That was really insightful!",
                    "Great detail there, I appreciate it!",
                    "Excellent response, thank you for being so thorough!",
                    "That paints a great picture, thanks!",
                ]
            elif profile.id == "stress":
                options = [
                    "Sufficient. Next.",
                    "Okay. Proceed.",
                    "Moving on now.",
                    "Good. Continue.",
                    "That works. Next.",
                ]
            else:
                options = [
                    "Thank you for that comprehensive answer.",
                    "Excellent, that was very thorough.",
                    "Great response, thank you.",
                    "I appreciate the detailed answer.",
                    "Very helpful, thank you.",
                ]
        
        # Filter out already used acknowledgments
        available = [o for o in options if o not in used]
        
        # If all used, reset and use any
        if not available:
            available = options
            if session_id:
                self._used_acks[session_id] = set()
                used = set()
        
        # Pick one and track it
        choice = random.choice(available)
        if session_id:
            self._used_acks.setdefault(session_id, set()).add(choice)
        
        return choice
    
    def _get_transition(self, persona: str, question_number: int, total: int) -> str:
        """Get transition phrase based on personality profile."""
        profile = self._get_personality_profile(persona)
        transitions = profile.response_style.transition_phrases
        
        # Add progress context for stress mode
        if profile.id == "stress":
            progress = f"Question {question_number} of {total}."
            return f"{progress} {random.choice(transitions)}"
        
        # Random transition from profile
        return random.choice(transitions) if transitions else "Next question."
    
    def _format_question(self, question: dict, persona: str) -> str:
        """Format question with personality style."""
        profile = self._get_personality_profile(persona)
        question_text = question.get("text", "")
        prefix = profile.response_style.question_prefix
        
        # Don't add prefix if question already includes it
        if prefix and not question_text.lower().startswith(prefix.split()[0].lower()):
            return f"{prefix} {question_text}"
        return question_text
    
    # ===========================================
    # GROQ API CALLS
    # ===========================================
    
    async def _ask_groq(
        self, 
        messages: List[Dict], 
        max_tokens: int = 150,
        operation: str = "groq_chat",
        user_id: str = None,
        session_id: str = None
    ) -> str:
        """Make a Groq API call with robust error handling and logging."""
        client = self._get_groq_client()
        
        if not client:
            # Return mock response if Groq not configured
            return None
        
        # Use currently supported model (mixtral-8x7b-32768 is decommissioned)
        model = "llama-3.1-8b-instant"
        start_time = time.time()
        
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=0.7,
            )
            
            result = response.choices[0].message.content.strip()
            response_time_ms = int((time.time() - start_time) * 1000)
            
            # Log successful AI API call
            try:
                # Get token usage if available
                prompt_tokens = getattr(response.usage, 'prompt_tokens', None) if hasattr(response, 'usage') else None
                completion_tokens = getattr(response.usage, 'completion_tokens', None) if hasattr(response, 'usage') else None
                total_tokens = getattr(response.usage, 'total_tokens', None) if hasattr(response, 'usage') else None
                
                AIAPILogService.log_ai_call(
                    db=self.db,
                    provider="groq",
                    operation=operation,
                    model=model,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                    response_time_ms=response_time_ms,
                    status="success",
                    user_id=user_id,
                    session_id=session_id
                )
            except Exception as log_error:
                print(f"[AI Log Error] Failed to log Groq call: {log_error}")
            
            return result
        except Exception as e:
            error_msg = str(e)
            response_time_ms = int((time.time() - start_time) * 1000)
            print(f"[Groq API Error] Model: {model}, Error: {error_msg}")
            
            # Log failed AI API call
            try:
                AIAPILogService.log_ai_call(
                    db=self.db,
                    provider="groq",
                    operation=operation,
                    model=model,
                    response_time_ms=response_time_ms,
                    status="error",
                    error_message=error_msg[:500],  # Truncate error message
                    user_id=user_id,
                    session_id=session_id
                )
            except Exception as log_error:
                print(f"[AI Log Error] Failed to log Groq error: {log_error}")
            
            # Return None instead of crashing - caller will use fallback
            return None
    
    async def _generate_groq_greeting(self, persona: str, target_role: str) -> str:
        """Generate greeting using Groq with personality profile."""
        profile = self._get_personality_profile(persona)
        
        messages = [
            {
                "role": "system",
                "content": f"""You are an interviewer conducting a {target_role} interview.

{profile.get_prompt_modifier()}

Generate a brief, natural greeting (2-3 sentences) to start the interview.
Keep it conversational and match the personality style exactly.
Do NOT include any evaluation or scoring language."""
            },
            {
                "role": "user",
                "content": "Generate the opening greeting."
            }
        ]
        
        result = await self._ask_groq(messages, max_tokens=100, operation="generate_greeting")
        return result or self._get_persona_greeting(persona, target_role)
    
    async def _generate_groq_acknowledgment(
        self,
        persona: str,
        question: str,
        answer: str,
        session_id: str = None
    ) -> str:
        """
        Generate acknowledgment using Groq.
        
        RULES:
        - Brief (1 sentence max)
        - Contextual (reference something from the answer)
        - Professional (no filler phrases)
        - NO repetitive probes like "tell me more", "please elaborate"
        """
        word_count = len(answer.split())
        profile = self._get_personality_profile(persona)
        
        # Determine answer quality
        if word_count < 15:
            quality = "brief"
        elif word_count < 50:
            quality = "adequate"
        else:
            quality = "comprehensive"
        
        messages = [
            {
                "role": "system",
                "content": f"""You are a {profile.name} interviewer providing a brief acknowledgment.

CRITICAL RULES:
1. ONE sentence only - a simple acknowledgment
2. Reference something SPECIFIC from their answer (a concept, example, or point they made)
3. Match the personality: {profile.description}
4. NEVER ASK ANY QUESTIONS - no follow-ups, no probes, no "what about...", no "how did you..."
5. NEVER use these phrases:
   - "Tell me more"
   - "Please elaborate" 
   - "Can you expand"
   - "What about"
   - "How did you"
   - "Could you explain"
   - "That's interesting"
   - "I see"
   - Any question at all
6. Simply acknowledge their answer - the next question will come from a pre-defined list
7. The answer quality is: {quality}
8. DO NOT end with a question mark (?)

Examples of GOOD acknowledgments:
- "Your experience with the migration project sounds valuable."
- "Noted, the caching approach you mentioned makes sense."
- "Thank you for explaining your role in that architecture decision."
- "That's a solid approach to handling scalability."

Examples of BAD acknowledgments (NEVER use):
- "Interesting, tell me more about that."
- "Please elaborate on your experience."
- "Can you expand on that point?"
- "What was the outcome of that project?"
- "How did you handle the challenges?"""
            },
            {
                "role": "user",
                "content": f"[DATA:TOON]\n{encode_for_llm({'q': question[:200], 'a': answer[:600]})}\n[/DATA]\n\nGenerate ONE acknowledgment sentence (NO QUESTIONS):"
            }
        ]
        
        result = await self._ask_groq(messages, max_tokens=60, operation="generate_acknowledgment", session_id=session_id)
        
        # Filter out any accidental questions or generic phrases
        if result:
            bad_phrases = [
                "tell me more", "please elaborate", "can you expand", "elaborate on",
                "what about", "how did you", "could you", "would you", "can you tell",
                "what was", "how was", "why did", "what made", "how would"
            ]
            result_lower = result.lower()
            
            # Check for bad phrases
            for phrase in bad_phrases:
                if phrase in result_lower:
                    return self._get_acknowledgment(persona, word_count, session_id)
            
            # Reject any response containing a question mark (asking a question)
            if "?" in result:
                return self._get_acknowledgment(persona, word_count, session_id)
            
            return result
        
        return self._get_acknowledgment(persona, word_count, session_id)
    
    async def _check_answer_relevance(self, question: str, answer: str) -> Dict[str, Any]:
        """Quick relevance check using Groq with TOON-encoded data."""
        
        # TOON: Encode the data payload for 30-60% token savings
        data_payload = {
            "q": question[:300],  # Shortened key for more savings
            "a": answer[:500],
        }
        toon_data = encode_for_llm(data_payload)
        
        messages = [
            {
                "role": "system",
                "content": f"""Evaluate if the answer is relevant to the question.
{get_toon_instruction()}
Return ONLY a JSON object with: relevance (1-10), complete (true/false), flags (array of issues like 'too_short', 'off_topic', 'unclear')"""
            },
            {
                "role": "user",
                "content": f"[DATA:TOON]\n{toon_data}\n[/DATA]\n\nEvaluate:"
            }
        ]
        
        result = await self._ask_groq(messages, max_tokens=100, operation="check_answer_relevance")
        
        # Parse result or use fallback
        word_count = len(answer.split())
        
        if result:
            try:
                import json
                # Try to parse JSON
                if "{" in result:
                    json_str = result[result.find("{"):result.rfind("}")+1]
                    parsed = json.loads(json_str)
                    return {
                        "relevance": parsed.get("relevance", 7),
                        "is_complete": parsed.get("complete", word_count >= 20),
                        "flags": parsed.get("flags", []),
                    }
            except:
                pass
        
        # Fallback mock evaluation
        flags = []
        if word_count < 10:
            flags.append("too_short")
        
        return {
            "relevance": 7 if word_count >= 10 else 4,
            "is_complete": word_count >= 20,
            "flags": flags,
        }
    
    # ===========================================
    # STRICT/STRESS MODE: PRESSURE FOLLOW-UPS
    # ===========================================
    
    async def _generate_pressure_follow_up(
        self,
        persona: str,
        question: str,
        answer: str,
        question_type: str,
        quick_eval: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """
        Generate a challenging follow-up question for strict/stress modes.
        
        Uses Groq API to create dynamic, probing follow-ups that:
        - Challenge vague or incomplete answers
        - Probe deeper into technical claims
        - Test candidate's ability to think under pressure
        - Maintain professional but intense tone
        
        Returns:
            Dict with follow_up_text, probe_type, and intensity
        """
        profile = self._get_personality_profile(persona)
        
        # Determine probe type based on answer quality
        relevance = quick_eval.get("relevance", 7)
        flags = quick_eval.get("flags", [])
        
        if relevance < 5 or "off_topic" in flags:
            probe_type = "redirect"
            probe_instruction = "The answer was off-topic or unclear. Redirect firmly but professionally."
        elif relevance < 7 or "too_short" in flags:
            probe_type = "depth"
            probe_instruction = "The answer lacked depth. Probe for specific details, numbers, or examples."
        else:
            probe_type = "challenge"
            probe_instruction = "The answer was decent. Challenge their reasoning or ask about edge cases."
        
        # Build persona-specific instructions
        if profile.id == "stress":
            tone_instruction = """
Tone: HIGH PRESSURE
- Be concise and rapid
- Add subtle time pressure ("Quickly now...")
- Challenge their assumptions directly
- Ask for specific metrics/numbers
- Don't accept vague answers
- Example: "That's one approach, but what happens when scale is 10x? Be specific."
"""
        else:  # strict
            tone_instruction = """
Tone: STRICT PROFESSIONAL
- Be direct and no-nonsense
- Probe for concrete evidence
- Question any claims without backing
- Expect precision in answers
- Example: "You mentioned X. Walk me through the exact steps you took."
"""
        
        # Build type-specific probing
        type_instructions = {
            "technical": "Focus on implementation details, trade-offs, and edge cases.",
            "behavioral": "Probe for specific STAR details - what exactly did YOU do, what was the measurable outcome?",
            "dsa": "Ask about time/space complexity, alternative approaches, or what happens with different inputs.",
            "system_design": "Challenge scalability, ask about failure modes, or probe specific technology choices.",
            "hr": "Probe for alignment with company values, ask about priorities and trade-offs.",
        }
        type_instruction = type_instructions.get(question_type, "Probe for more specific details.")
        
        messages = [
            {
                "role": "system",
                "content": f"""You are a {profile.name} conducting a high-stakes interview.

TASK: Generate ONE challenging follow-up question based on the candidate's answer.

{tone_instruction}

PROBE TYPE: {probe_type.upper()}
{probe_instruction}

QUESTION TYPE: {question_type}
{type_instruction}

RULES:
1. ONE sentence only - concise and direct
2. Reference something SPECIFIC from their answer
3. Do NOT accept vague responses - demand specifics
4. Do NOT be rude or unprofessional
5. The question should test their depth of knowledge
6. For technical questions, ask about edge cases or trade-offs
7. For behavioral, ask about specific actions THEY took

FORBIDDEN:
- "That's interesting" or similar filler
- Generic "can you elaborate" without specifics
- Multiple questions in one
- Overly long follow-ups"""
            },
            {
                "role": "user",
                "content": f"""Original Question: {question[:300]}

Candidate's Answer: {answer[:600]}

Generate ONE challenging follow-up question:"""
            }
        ]
        
        result = await self._ask_groq(messages, max_tokens=80, operation="pressure_follow_up")
        
        if result:
            # Clean up the result
            result = result.strip()
            # Remove any quotation marks if present
            if result.startswith('"') and result.endswith('"'):
                result = result[1:-1]
            
            return {
                "follow_up_text": result,
                "probe_type": probe_type,
                "intensity": "high" if profile.id == "stress" else "medium",
            }
        
        # Fallback follow-ups
        fallback_follow_ups = {
            "strict": [
                "Be more specific - what exactly did you do?",
                "Walk me through the technical details.",
                "What metrics can you cite to back that up?",
            ],
            "stress": [
                "Quickly - what was the exact outcome?",
                "Be specific. What numbers can you give me?",
                "That's vague. What specifically did YOU do?",
            ],
        }
        
        import random
        fallback_list = fallback_follow_ups.get(profile.id, fallback_follow_ups["strict"])
        
        return {
            "follow_up_text": random.choice(fallback_list),
            "probe_type": probe_type,
            "intensity": "high" if profile.id == "stress" else "medium",
        }
    
    async def _generate_stress_mode_question_variant(
        self,
        original_question: str,
        question_type: str,
        difficulty: str,
    ) -> str:
        """
        Generate a more challenging variant of a question for stress mode.
        
        Uses API to add:
        - Time constraints
        - Edge cases
        - Multi-part challenges
        """
        messages = [
            {
                "role": "system",
                "content": """You are creating a HIGH-PRESSURE interview question.

Take the given question and make it more challenging by:
1. Adding a time/resource constraint
2. Adding an edge case or complication
3. Asking for trade-offs or multiple approaches

Keep it to 2-3 sentences max. Be direct and professional.

Example transformations:
- "Design a cache" → "Design a distributed cache that handles 1M requests/sec with <10ms latency. You have 5 minutes to outline your approach."
- "Tell me about teamwork" → "Describe a conflict with a senior colleague where you disagreed on technical direction. What was the outcome and what would you do differently?"
"""
            },
            {
                "role": "user",
                "content": f"""Original question: {original_question}
Type: {question_type}
Difficulty: {difficulty}

Generate the challenging variant:"""
            }
        ]
        
        result = await self._ask_groq(messages, max_tokens=150, operation="stress_mode_question")
        return result if result else original_question
    
    # ===========================================
    # SESSION MANAGEMENT
    # ===========================================
    
    async def start_interview(
        self,
        plan_id: str,
        user_id: str,
        persona: str = "professional",
    ) -> Dict[str, Any]:
        """
        Start a new interview session from a plan.
        
        SAFETY:
        - Validates plan exists and belongs to user
        - Validates plan status
        - Handles is_used being None
        - ALLOWS RESUME if session exists but not completed
        - Wraps DB operations with rollback on failure
        
        Returns:
            Session details with first question
            
        Raises:
            ValueError: For 404 (plan not found) or 400 (invalid state)
        """
        # ===========================================
        # STEP 1: Validate plan exists
        # ===========================================
        plan = self.db.query(InterviewPlan).filter(
            InterviewPlan.id == plan_id,
            InterviewPlan.user_id == user_id,
        ).first()
        
        if not plan:
            raise ValueError("PLAN_NOT_FOUND: Interview plan not found or does not belong to you")
        
        # ===========================================
        # STEP 2: Check if plan is already used
        # ===========================================
        
        # Treat is_used as False if None (SQLite compatibility)
        plan_is_used = bool(plan.is_used) if plan.is_used is not None else False
        
        if plan_is_used or plan.status == "used":
            # Check if there's an existing session for this plan
            existing_session = self.db.query(LiveInterviewSession).filter(
                LiveInterviewSession.plan_id == plan_id,
                LiveInterviewSession.user_id == user_id,
            ).first()
            
            if existing_session:
                # If session is completed, block new starts
                if existing_session.status == "completed":
                    raise ValueError("This interview has already been completed. Please generate a new plan.")
                
                # If session is in_progress or paused, allow resume (return existing session info)
                if existing_session.status in ["in_progress", "paused"]:
                    print(f"[LiveInterview] Resuming existing session: {existing_session.id}")
                    
                    # Get questions from plan
                    questions = plan.questions or []
                    current_idx = existing_session.current_question_index
                    
                    if current_idx < len(questions):
                        current_q = questions[current_idx]
                        question_text = self._format_question(current_q, existing_session.interviewer_persona or persona)
                    else:
                        current_q = questions[-1] if questions else {"id": "q-1", "text": "No questions"}
                        question_text = current_q.get("text", "")
                    
                    progress_pct = (existing_session.questions_answered / existing_session.total_questions * 100) if existing_session.total_questions > 0 else 0
                    
                    return {
                        "session_id": existing_session.id,
                        "status": existing_session.status,
                        "interviewer_message": "Welcome back! Let's continue where we left off.",
                        "first_question": {
                            "id": current_q.get("id"),
                            "text": question_text,
                            "type": current_q.get("type", "general"),
                            "category": current_q.get("category", "General"),
                            "index": current_idx,
                        },
                        "progress": {
                            "current_question": current_idx + 1,
                            "total_questions": existing_session.total_questions,
                            "questions_answered": existing_session.questions_answered or 0,
                            "questions_skipped": existing_session.questions_skipped or 0,
                            "progress_percent": round(progress_pct, 1),
                        },
                        "persona": existing_session.interviewer_persona or persona,
                        "target_role": plan.target_role,
                        "resumed": True,  # Flag to indicate this is a resume
                    }
            
            # No valid session found - plan is truly used
            raise ValueError("This plan has already been used for a completed interview. Please generate a new plan.")
        
        # ===========================================
        # STEP 3: Validate questions exist (CRITICAL)
        # ===========================================
        questions = plan.questions or []
        if not questions:
            raise ValueError("Interview plan has no questions. Please regenerate the plan.")
        
        # CRITICAL: Log plan structure for debugging
        print(f"[PLAN_INTEGRITY] Plan ID: {plan_id}")
        print(f"[PLAN_INTEGRITY] Total questions: {len(questions)}")
        print(f"[PLAN_INTEGRITY] First question ID: {questions[0].get('id', 'N/A')}")
        print(f"[PLAN_INTEGRITY] Question types: {[q.get('type', 'unknown') for q in questions[:5]]}...")
        
        # Validate each question has required fields
        for idx, q in enumerate(questions):
            if not q.get('id') or not q.get('text'):
                print(f"[PLAN_INTEGRITY] WARNING: Question {idx} missing id or text: {q}")
        
        
        # ===========================================
        # STEP 4: Create session (with rollback protection)
        # ===========================================
        try:
            session = LiveInterviewSession(
                user_id=user_id,
                plan_id=plan_id,
                resume_id=plan.resume_id,
                target_role=plan.target_role,
                session_type=plan.session_type,
                difficulty_level=plan.difficulty_level,
                interviewer_persona=persona,
                total_questions=len(questions),
                current_question_index=0,
                status="in_progress",
                questions_answered=0,
                questions_skipped=0,
                started_at=datetime.utcnow(),
                last_activity_at=datetime.utcnow(),
            )
            
            self.db.add(session)
            self.db.flush()  # Get session ID without committing
            
            # ===========================================
            # STEP 5: Mark plan as used
            # ===========================================
            plan.is_used = True
            plan.used_for_session_id = session.id
            plan.status = "used"
            
            # ===========================================
            # STEP 6: Generate greeting ONLY
            # CRITICAL: Do NOT send first question yet
            # Frontend will request first question after consent
            # ===========================================
            if settings.is_groq_configured():
                greeting = await self._generate_groq_greeting(persona, plan.target_role)
            else:
                greeting = self._get_persona_greeting(persona, plan.target_role)
            
            # Add greeting message (ONLY greeting, not question)
            greeting_msg = InterviewMessage(
                session_id=session.id,
                user_id=user_id,
                role="interviewer",
                content=greeting,
                message_type="greeting",  # Changed from "transition" to "greeting"
            )
            self.db.add(greeting_msg)
            
            # ===========================================
            # STEP 7: Prepare first question (DO NOT add to messages)
            # This will be sent to frontend but NOT spoken until consent
            # ===========================================
            first_question = questions[0]
            question_text = self._format_question(first_question, persona)
            
            # Extract round information
            rounds = getattr(plan, 'rounds', None) or plan.questions  # Fallback if no rounds
            current_round_name = first_question.get("round_name", first_question.get("category", "Technical Round"))
            
            # ===========================================
            # STEP 8: Commit all changes
            # ===========================================
            self.db.commit()
            self.db.refresh(session)
            
            return {
                "session_id": session.id,
                "status": session.status,
                "interviewer_message": greeting,
                "awaiting_consent": True,  # NEW: Indicate frontend should wait for consent
                "first_question": {
                    "id": first_question.get("id"),
                    "text": question_text,
                    "type": first_question.get("type", "general"),
                    "category": first_question.get("category", "General"),
                    "round_name": current_round_name,  # NEW: Round name for UI
                    "difficulty": first_question.get("difficulty", plan.difficulty_level),  # NEW
                    "company_style": first_question.get("company_style", plan.company_mode),  # NEW
                    "index": 0,
                },
                "progress": {
                    "current_question": 1,
                    "total_questions": len(questions),
                    "questions_answered": 0,
                    "questions_skipped": 0,
                    "progress_percent": 0,
                },
                "persona": persona,
                "target_role": plan.target_role,
            }
            
        except ValueError:
            # Re-raise validation errors as-is
            self.db.rollback()
            raise
        except Exception as e:
            # Rollback on any other error
            self.db.rollback()
            print(f"[LiveInterview] Failed to create session: {e}")
            raise ValueError(f"Failed to start interview session: {str(e)}")
    
    async def confirm_consent(
        self,
        session_id: str,
        user_id: str,
    ) -> Dict[str, Any]:
        """
        Confirm user consent and officially start the interview.
        
        CRITICAL: This is called AFTER user says "yes" to consent.
        - Records first question message in database
        - Returns the first question for display
        
        This completes the greeting -> consent -> interview flow.
        """
        # Get session
        session = self.db.query(LiveInterviewSession).filter(
            LiveInterviewSession.id == session_id,
            LiveInterviewSession.user_id == user_id,
        ).first()
        
        if not session:
            raise ValueError("Session not found")
        
        if session.status != "in_progress":
            raise ValueError(f"Cannot confirm consent: session is {session.status}")
        
        # Get plan
        plan = self.db.query(InterviewPlan).filter(
            InterviewPlan.id == session.plan_id,
        ).first()
        
        if not plan:
            raise ValueError("Interview plan not found")
        
        questions = plan.questions or []
        if not questions:
            raise ValueError("No questions in plan")
        
        # Get first question
        first_question = questions[0]
        persona = session.interviewer_persona or "professional"
        question_text = self._format_question(first_question, persona)
        
        # NOW add the first question message to database
        question_msg = InterviewMessage(
            session_id=session.id,
            user_id=user_id,
            role="interviewer",
            content=question_text,
            message_type="question",
            question_id=first_question.get("id"),
            question_index=0,
        )
        self.db.add(question_msg)
        
        # Update session last activity
        session.last_activity_at = datetime.utcnow()
        
        self.db.commit()
        
        return {
            "success": True,
            "first_question": {
                "id": first_question.get("id"),
                "text": question_text,
                "type": first_question.get("type", "general"),
                "category": first_question.get("category", "General"),
                "round_name": first_question.get("round_name", first_question.get("category", "Technical Round")),
                "difficulty": first_question.get("difficulty", plan.difficulty_level),
                "company_style": first_question.get("company_style", plan.company_mode),
                "index": 0,
            },
            "progress": {
                "current_question": 1,
                "total_questions": len(questions),
                "questions_answered": 0,
                "questions_skipped": 0,
                "progress_percent": 0,
            },
        }
    
    async def get_session_state(
        self,
        session_id: str,
        user_id: str,
    ) -> Dict[str, Any]:
        """
        Get current session state.
        
        Used for resuming after refresh.
        """
        # Get session
        session = self.db.query(LiveInterviewSession).filter(
            LiveInterviewSession.id == session_id,
            LiveInterviewSession.user_id == user_id,
        ).first()
        
        if not session:
            raise ValueError("Session not found")
        
        # Get plan
        plan = self.db.query(InterviewPlan).filter(
            InterviewPlan.id == session.plan_id,
        ).first()
        
        if not plan:
            raise ValueError("Interview plan not found")
        
        questions = plan.questions or []
        
        # Get messages
        messages = self.db.query(InterviewMessage).filter(
            InterviewMessage.session_id == session_id,
        ).order_by(InterviewMessage.created_at).all()
        
        # Get current question
        current_question = None
        if session.status == "in_progress" and session.current_question_index < len(questions):
            q = questions[session.current_question_index]
            current_question = {
                "id": q.get("id"),
                "text": self._format_question(q, session.interviewer_persona),
                "type": q.get("type", "general"),
                "category": q.get("category", "General"),
                "index": session.current_question_index,
            }
        
        progress_percent = (session.questions_answered / session.total_questions * 100) if session.total_questions > 0 else 0
        
        return {
            "session_id": session.id,
            "status": session.status,
            "target_role": session.target_role,
            "interviewer_persona": session.interviewer_persona,
            "progress": {
                "current_question": session.current_question_index + 1,
                "total_questions": session.total_questions,
                "questions_answered": session.questions_answered,
                "questions_skipped": session.questions_skipped,
                "progress_percent": round(progress_percent, 1),
            },
            "current_question": current_question,
            "messages": [m.to_dict() for m in messages],
        }
    
    async def submit_answer(
        self,
        session_id: str,
        user_id: str,
        answer_text: str,
        response_time_seconds: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Submit an answer to the current question.
        
        Returns:
            Acknowledgment and next action
        """
        # Get session
        session = self.db.query(LiveInterviewSession).filter(
            LiveInterviewSession.id == session_id,
            LiveInterviewSession.user_id == user_id,
        ).first()
        
        if not session:
            raise ValueError("Session not found")
        
        if session.status != "in_progress":
            raise ValueError(f"Cannot submit answer: session is {session.status}")
        
        # Get plan
        plan = self.db.query(InterviewPlan).filter(
            InterviewPlan.id == session.plan_id,
        ).first()
        
        questions = plan.questions or []
        
        if session.current_question_index >= len(questions):
            raise ValueError("No more questions to answer")
        
        current_question = questions[session.current_question_index]
        
        # CRITICAL: Log question serving for debugging
        print(f"[QUESTION_SERVE] Session: {session_id}")
        print(f"[QUESTION_SERVE] Current index: {session.current_question_index}/{len(questions)}")
        print(f"[QUESTION_SERVE] Question ID: {current_question.get('id', 'N/A')}")
        print(f"[QUESTION_SERVE] Question type: {current_question.get('type', 'unknown')}")
        
        # Validate answer
        if not answer_text or len(answer_text.strip()) == 0:
            raise ValueError("Answer cannot be empty")
        
        word_count = len(answer_text.split())
        
        # Save answer message
        answer_msg = InterviewMessage(
            session_id=session.id,
            user_id=user_id,
            role="candidate",
            content=answer_text,
            message_type="answer",
            question_id=current_question.get("id"),
            question_index=session.current_question_index,
        )
        self.db.add(answer_msg)
        
        # Save answer record
        answer = InterviewAnswer(
            session_id=session.id,
            user_id=user_id,
            question_id=current_question.get("id"),
            message_id=answer_msg.id,
            answer_text=answer_text,
            word_count=word_count,
            response_time_seconds=response_time_seconds,
        )
        
        # Quick evaluation
        if settings.is_groq_configured():
            quick_eval = await self._check_answer_relevance(
                current_question.get("text", ""),
                answer_text
            )
        else:
            # Mock evaluation
            flags = []
            if word_count < 10:
                flags.append("too_short")
            quick_eval = {
                "relevance": 7 if word_count >= 10 else 4,
                "is_complete": word_count >= 20,
                "flags": flags,
            }
        
        answer.quick_eval_relevance = quick_eval.get("relevance", 7)
        answer.quick_eval_complete = quick_eval.get("is_complete", True)
        answer.quick_eval_flags = quick_eval.get("flags", [])
        
        self.db.add(answer)
        
        # ===========================================
        # ACKNOWLEDGMENT ONLY - NO FOLLOW-UP QUESTIONS
        # The next question comes from the pre-defined list
        # This prevents "biased" continuation questions
        # ===========================================
        
        # Generate acknowledgment (summarizes user's answer only)
        if settings.is_groq_configured():
            acknowledgment = await self._generate_groq_acknowledgment(
                session.interviewer_persona,
                current_question.get("text", ""),
                answer_text,
                session.id
            )
        else:
            acknowledgment = self._get_acknowledgment(session.interviewer_persona, word_count, session.id)
        
        # Add acknowledgment message
        ack_msg = InterviewMessage(
            session_id=session.id,
            user_id=user_id,
            role="interviewer",
            content=acknowledgment,
            message_type="acknowledgment",
        )
        self.db.add(ack_msg)
        
        # Update session state
        session.questions_answered += 1
        session.current_question_index += 1
        session.last_activity_at = datetime.utcnow()
        
        # Check if interview is complete
        is_complete = session.current_question_index >= len(questions)
        next_question = None
        
        if is_complete:
            session.status = "completed"  # FIXED: Was "completing", caused analytics to show 0 interviews
            session.completed_at = datetime.utcnow()
            
            # Add completion message
            completion_msg = InterviewMessage(
                session_id=session.id,
                user_id=user_id,
                role="interviewer",
                content="That concludes our interview. Thank you for your time and thoughtful responses. We'll have your results ready shortly.",
                message_type="transition",
            )
            self.db.add(completion_msg)
            
            # CRITICAL: Trigger automatic report finalization
            # This ensures report is ALWAYS saved, not relying on frontend
            try:
                report_service = ReportService(self.db)
                await report_service.finalize_interview(
                    session_id=session.id,
                    user_id=user_id,
                )
                print(f"[SUBMIT_ANSWER] Report finalized automatically for session: {session.id}")
            except Exception as e:
                # Log but don't fail the answer submission
                print(f"[SUBMIT_ANSWER] Warning: Auto-finalization failed: {e}")
                # Report will still be generated later when user views results
        else:
            # Get next question
            next_q = questions[session.current_question_index]
            transition = self._get_transition(
                session.interviewer_persona,
                session.current_question_index + 1,
                len(questions)
            )
            question_text = self._format_question(next_q, session.interviewer_persona)
            
            # Add next question message
            next_msg = InterviewMessage(
                session_id=session.id,
                user_id=user_id,
                role="interviewer",
                content=f"{transition} {question_text}",
                message_type="question",
                question_id=next_q.get("id"),
                question_index=session.current_question_index,
            )
            self.db.add(next_msg)
            
            next_question = {
                "id": next_q.get("id"),
                "text": question_text,
                "type": next_q.get("type", "general"),
                "category": next_q.get("category", "General"),
                "round_name": next_q.get("round_name", next_q.get("category", "Technical Round")),  # NEW
                "difficulty": next_q.get("difficulty", plan.difficulty_level if plan else "medium"),  # NEW
                "company_style": next_q.get("company_style"),  # NEW
                "index": session.current_question_index,
            }
        
        self.db.commit()
        
        progress_percent = (session.questions_answered / session.total_questions * 100) if session.total_questions > 0 else 0
        
        return {
            "success": True,
            "acknowledgment": acknowledgment,
            "quick_eval": quick_eval,
            "next_action": "complete" if is_complete else "next_question",
            "next_question": next_question,
            "progress": {
                "current_question": session.current_question_index + 1,
                "total_questions": session.total_questions,
                "questions_answered": session.questions_answered,
                "questions_skipped": session.questions_skipped,
                "progress_percent": round(progress_percent, 1),
            },
            "is_complete": is_complete,
        }
    
    async def skip_question(
        self,
        session_id: str,
        user_id: str,
    ) -> Dict[str, Any]:
        """Skip the current question."""
        # Get session
        session = self.db.query(LiveInterviewSession).filter(
            LiveInterviewSession.id == session_id,
            LiveInterviewSession.user_id == user_id,
        ).first()
        
        if not session:
            raise ValueError("Session not found")
        
        if session.status != "in_progress":
            raise ValueError(f"Cannot skip: session is {session.status}")
        
        # Get plan
        plan = self.db.query(InterviewPlan).filter(
            InterviewPlan.id == session.plan_id,
        ).first()
        
        questions = plan.questions or []
        
        if session.current_question_index >= len(questions):
            raise ValueError("No more questions")
        
        current_question = questions[session.current_question_index]
        
        # Record skipped answer
        answer = InterviewAnswer(
            session_id=session.id,
            user_id=user_id,
            question_id=current_question.get("id"),
            answer_text="[SKIPPED]",
            word_count=0,
            is_skipped=True,
        )
        self.db.add(answer)
        
        # Add skip message
        skip_msg = InterviewMessage(
            session_id=session.id,
            user_id=user_id,
            role="system",
            content="Question skipped",
            message_type="system",
            question_id=current_question.get("id"),
            question_index=session.current_question_index,
        )
        self.db.add(skip_msg)
        
        # Update session
        session.questions_skipped += 1
        session.current_question_index += 1
        session.last_activity_at = datetime.utcnow()
        
        # Check if complete
        is_complete = session.current_question_index >= len(questions)
        next_question = None
        
        if is_complete:
            session.status = "completed"  # FIXED: Was "completing", caused analytics to show 0 interviews
            session.completed_at = datetime.utcnow()
            
            # CRITICAL: Trigger automatic report finalization
            try:
                report_service = ReportService(self.db)
                await report_service.finalize_interview(
                    session_id=session.id,
                    user_id=user_id,
                )
                print(f"[SKIP_QUESTION] Report finalized automatically for session: {session.id}")
            except Exception as e:
                print(f"[SKIP_QUESTION] Warning: Auto-finalization failed: {e}")
        else:
            next_q = questions[session.current_question_index]
            question_text = self._format_question(next_q, session.interviewer_persona)
            
            # Add next question message
            next_msg = InterviewMessage(
                session_id=session.id,
                user_id=user_id,
                role="interviewer",
                content=f"Understood. {question_text}",
                message_type="question",
                question_id=next_q.get("id"),
                question_index=session.current_question_index,
            )
            self.db.add(next_msg)
            
            next_question = {
                "id": next_q.get("id"),
                "text": question_text,
                "type": next_q.get("type", "general"),
                "category": next_q.get("category", "General"),
                "round_name": next_q.get("round_name", next_q.get("category", "Technical Round")),  # Added for multi-round
                "difficulty": next_q.get("difficulty", "medium"),  # Added for multi-round
                "index": session.current_question_index,
            }
        
        self.db.commit()
        
        progress_percent = ((session.questions_answered + session.questions_skipped) / session.total_questions * 100) if session.total_questions > 0 else 0
        
        return {
            "success": True,
            "message": "Question skipped",
            "next_question": next_question,
            "progress": {
                "current_question": session.current_question_index + 1,
                "total_questions": session.total_questions,
                "questions_answered": session.questions_answered,
                "questions_skipped": session.questions_skipped,
                "progress_percent": round(progress_percent, 1),
            },
            "is_complete": is_complete,
        }
    
    async def pause_interview(
        self,
        session_id: str,
        user_id: str,
    ) -> Dict[str, Any]:
        """Pause the interview."""
        session = self.db.query(LiveInterviewSession).filter(
            LiveInterviewSession.id == session_id,
            LiveInterviewSession.user_id == user_id,
        ).first()
        
        if not session:
            raise ValueError("Session not found")
        
        if session.status != "in_progress":
            raise ValueError(f"Cannot pause: session is {session.status}")
        
        session.status = "paused"
        session.pause_start_at = datetime.utcnow()
        session.last_activity_at = datetime.utcnow()
        
        # Add pause message
        pause_msg = InterviewMessage(
            session_id=session.id,
            user_id=user_id,
            role="system",
            content="Interview paused",
            message_type="system",
        )
        self.db.add(pause_msg)
        self.db.commit()
        
        return {
            "success": True,
            "message": "Interview paused",
            "status": "paused",
            "session_id": session.id,
        }
    
    async def resume_interview(
        self,
        session_id: str,
        user_id: str,
    ) -> Dict[str, Any]:
        """Resume a paused interview."""
        session = self.db.query(LiveInterviewSession).filter(
            LiveInterviewSession.id == session_id,
            LiveInterviewSession.user_id == user_id,
        ).first()
        
        if not session:
            raise ValueError("Session not found")
        
        if session.status != "paused":
            raise ValueError(f"Cannot resume: session is {session.status}")
        
        # Calculate pause duration
        if session.pause_start_at:
            pause_duration = (datetime.utcnow() - session.pause_start_at).seconds
            session.total_duration_seconds = (session.total_duration_seconds or 0) + pause_duration
        
        session.status = "in_progress"
        session.pause_start_at = None
        session.last_activity_at = datetime.utcnow()
        
        # Add resume message
        resume_msg = InterviewMessage(
            session_id=session.id,
            user_id=user_id,
            role="interviewer",
            content="Welcome back. Let's continue where we left off.",
            message_type="transition",
        )
        self.db.add(resume_msg)
        self.db.commit()
        
        return {
            "success": True,
            "message": "Interview resumed",
            "status": "in_progress",
            "session_id": session.id,
        }
    
    async def end_interview(
        self,
        session_id: str,
        user_id: str,
    ) -> Dict[str, Any]:
        """End the interview early."""
        session = self.db.query(LiveInterviewSession).filter(
            LiveInterviewSession.id == session_id,
            LiveInterviewSession.user_id == user_id,
        ).first()
        
        if not session:
            raise ValueError("Session not found")
        
        if session.status not in ["in_progress", "paused"]:
            raise ValueError(f"Cannot end: session is {session.status}")
        
        session.status = "completed"  # FIXED: Was "completing", caused analytics to show 0 interviews
        session.completed_at = datetime.utcnow()
        session.last_activity_at = datetime.utcnow()
        
        # Add end message
        end_msg = InterviewMessage(
            session_id=session.id,
            user_id=user_id,
            role="interviewer",
            content="Interview ended. Thank you for your time. Your results will be available shortly.",
            message_type="transition",
        )
        self.db.add(end_msg)
        self.db.commit()
        
        # CRITICAL: Trigger automatic report finalization
        try:
            report_service = ReportService(self.db)
            await report_service.finalize_interview(
                session_id=session.id,
                user_id=user_id,
            )
            print(f"[END_INTERVIEW] Report finalized automatically for session: {session.id}")
        except Exception as e:
            print(f"[END_INTERVIEW] Warning: Auto-finalization failed: {e}")
        
        return {
            "success": True,
            "message": "Interview ended",
            "session_id": session.id,
            "status": "completed",
            "summary": {
                "questions_answered": session.questions_answered,
                "questions_skipped": session.questions_skipped,
                "total_questions": session.total_questions,
            },
        }
    
    def get_user_sessions(
        self,
        user_id: str,
        limit: int = 10,
    ) -> List[LiveInterviewSession]:
        """Get user's interview sessions."""
        return self.db.query(LiveInterviewSession).filter(
            LiveInterviewSession.user_id == user_id,
        ).order_by(LiveInterviewSession.created_at.desc()).limit(limit).all()


def get_live_interview_service(db: Session) -> LiveInterviewService:
    """Get live interview service instance."""
    return LiveInterviewService(db)
