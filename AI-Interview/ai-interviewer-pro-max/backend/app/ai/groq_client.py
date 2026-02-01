"""
Groq API Client

Client for Groq API - used for fast, real-time interactions:
- Question presentation
- Follow-up question generation
- Quick relevance checks
- Conversational flow control
- Interviewer persona enforcement

Per AI Responsibility Contract (Step 4):
- Groq handles FAST, FREQUENT, REAL-TIME operations
- Groq calls must complete in < 2 seconds
- Outputs must be concise and predictable
"""

from typing import Dict, Any, Optional

from app.core.config import settings


class GroqClient:
    """
    Client for Groq API interactions.
    
    Responsibilities (LOCKED per Step 4):
        Q01: Question Presentation Formatting
        Q02: Follow-up Question Generation
        Q03: Quick Relevance Check
        Q04: Conversational Flow Control
        Q05: Interviewer Persona Enforcement
        Q06: Answer Acknowledgment
        Q07: Time Warning Delivery
        Q08: Interview Transition Messages
    
    FORBIDDEN operations (per Step 4):
        - Resume parsing/analysis
        - ATS scoring
        - Deep answer evaluation
        - Report generation
        - Career planning
        - Any operation requiring > 5s response
    """
    
    def __init__(self):
        """Initialize Groq client."""
        self.api_key = settings.GROQ_API_KEY
        self.model = "llama-3.1-8b-instant"  # Updated: mixtral-8x7b-32768 is decommissioned
        self._client = None
    
    def _get_client(self):
        """
        Get or create Groq client instance.
        
        TODO:
            - Initialize groq client
            - Configure with API key
        """
        if not self.api_key:
            raise ValueError("GROQ_API_KEY not configured")
        
        # TODO: Initialize actual client
        # from groq import Groq
        # self._client = Groq(api_key=self.api_key)
        
        return self._client
    
    def is_configured(self) -> bool:
        """Check if Groq API is configured."""
        return bool(self.api_key)
    
    # ===========================================
    # Q01: QUESTION PRESENTATION FORMATTING
    # ===========================================
    
    async def format_question(
        self,
        question_text: str,
        question_number: int,
        total_questions: int,
        persona: str = "professional",
        time_limit_seconds: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Format question for presentation with intro and persona.
        
        Input:
            question_text: Raw question text
            question_number: Current question number
            total_questions: Total questions in session
            persona: professional, friendly, or stress
            time_limit_seconds: Optional time limit
            
        Output:
            Formatted question with intro
            
        Latency: < 1 second
        
        TODO:
            - Build persona-aware prompt
            - Call Groq API
            - Return formatted question
        """
        # TODO: Implement with actual Groq call
        return {
            "intro": f"Question {question_number} of {total_questions}.",
            "formatted_question": question_text,
            "time_note": f"You have {time_limit_seconds} seconds." if time_limit_seconds else None,
        }
    
    # ===========================================
    # Q02: FOLLOW-UP QUESTION GENERATION
    # ===========================================
    
    async def generate_follow_up(
        self,
        original_question: str,
        user_answer: str,
        identified_gap: str,
        persona: str = "professional"
    ) -> Dict[str, Any]:
        """
        Generate contextual follow-up question.
        
        Latency: < 2 seconds
        
        TODO:
            - Analyze answer gap
            - Generate probing question
            - Return with probe type
        """
        # TODO: Implement
        return {
            "follow_up_question": "Could you elaborate on that?",
            "probe_type": "deeper",
        }
    
    # ===========================================
    # Q03: QUICK RELEVANCE CHECK
    # ===========================================
    
    async def check_relevance(
        self,
        question: str,
        answer: str
    ) -> Dict[str, Any]:
        """
        Quick check if answer is relevant to question.
        
        Latency: < 1 second
        
        TODO:
            - Build quick evaluation prompt
            - Call Groq API
            - Return relevance signals
        """
        # TODO: Implement
        word_count = len(answer.split())
        
        return {
            "relevance_score": 7,
            "is_on_topic": True,
            "is_complete": word_count > 20,
            "flags": ["too_short"] if word_count < 10 else [],
        }
    
    # ===========================================
    # Q04: CONVERSATIONAL FLOW CONTROL
    # ===========================================
    
    async def decide_flow(
        self,
        quick_eval: Dict[str, Any],
        answer_word_count: int,
        current_follow_up_count: int,
        max_follow_ups: int = 2
    ) -> Dict[str, Any]:
        """
        Decide next action in conversational flow.
        
        Latency: < 1 second
        
        TODO:
            - Analyze quick eval
            - Decide follow-up vs next question
            - Return action
        """
        # TODO: Implement
        needs_follow_up = (
            quick_eval.get("relevance_score", 10) < 5 or
            not quick_eval.get("is_complete", True)
        ) and current_follow_up_count < max_follow_ups
        
        return {
            "action": "follow_up" if needs_follow_up else "next_question",
            "reason": "Answer needs elaboration" if needs_follow_up else "Answer complete",
            "transition_type": "acknowledge",
        }
    
    # ===========================================
    # Q05: INTERVIEWER PERSONA ENFORCEMENT
    # ===========================================
    
    async def apply_persona(
        self,
        persona: str,
        message_type: str
    ) -> Dict[str, Any]:
        """
        Get persona-appropriate message framing.
        
        Personas:
            - professional: Formal, business-like
            - friendly: Warm, encouraging
            - stress: Challenging, probing
            
        Latency: < 0.5 seconds
        
        TODO:
            - Return persona-specific prefixes/suffixes
        """
        personas = {
            "professional": {
                "prefix": "",
                "suffix": "",
            },
            "friendly": {
                "prefix": "Great! ",
                "suffix": " Take your time.",
            },
            "stress": {
                "prefix": "Interesting. ",
                "suffix": " Be specific.",
            },
        }
        
        return personas.get(persona, personas["professional"])
    
    # ===========================================
    # Q06: ANSWER ACKNOWLEDGMENT
    # ===========================================
    
    async def acknowledge_answer(
        self,
        answer_quality: str,
        persona: str = "professional"
    ) -> Dict[str, Any]:
        """
        Generate acknowledgment for user's answer.
        
        Latency: < 0.5 seconds
        
        TODO:
            - Generate persona-appropriate acknowledgment
        """
        acknowledgments = {
            "excellent": {
                "professional": "Thank you for that comprehensive response.",
                "friendly": "Excellent answer! That was very thorough.",
                "stress": "Noted. Let's move on.",
            },
            "good": {
                "professional": "Thank you.",
                "friendly": "Good response!",
                "stress": "I see.",
            },
            "adequate": {
                "professional": "Understood.",
                "friendly": "Thanks for sharing that.",
                "stress": "Okay.",
            },
            "weak": {
                "professional": "I see. Let's continue.",
                "friendly": "Thanks. Let's try another one.",
                "stress": "That's all you have?",
            },
        }
        
        quality_acks = acknowledgments.get(answer_quality, acknowledgments["adequate"])
        
        return {
            "acknowledgment": quality_acks.get(persona, quality_acks["professional"]),
        }
    
    # ===========================================
    # Q07: TIME WARNING DELIVERY
    # ===========================================
    
    async def time_warning(
        self,
        seconds_remaining: int,
        persona: str = "professional"
    ) -> Dict[str, Any]:
        """
        Generate time warning message.
        
        Latency: < 0.5 seconds
        """
        warnings = {
            60: "One minute remaining.",
            30: "30 seconds remaining.",
            10: "10 seconds remaining. Please wrap up.",
        }
        
        return {
            "warning": warnings.get(seconds_remaining, f"{seconds_remaining} seconds remaining."),
        }
    
    # ===========================================
    # Q08: INTERVIEW TRANSITION MESSAGES
    # ===========================================
    
    async def transition_message(
        self,
        transition_type: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate transition message between sections.
        
        Latency: < 1 second
        
        TODO:
            - Generate contextual transitions
        """
        transitions = {
            "start": "Let's begin the interview. I'll ask you a series of questions.",
            "section_change": "Now let's move on to the next section.",
            "last_question": "This is the final question.",
            "end": "That concludes the interview. Thank you for your time.",
            "pause": "The interview has been paused.",
            "resume": "Welcome back. Let's continue where we left off.",
        }
        
        return {
            "message": transitions.get(transition_type, ""),
        }


# ===========================================
# CLIENT INSTANCE
# ===========================================

groq_client = GroqClient()
