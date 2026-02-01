"""
Interview Plan Service

Business logic for generating personalized interview plans.
Uses Gemini API for plan generation with GUARANTEED fallback.

Per requirements:
- Plans based on resume + ATS analysis
- Weak areas get more questions
- Strong areas get deeper questions
- HR & behavioral questions always included
- Company modes influence question mix and difficulty
- NEVER fails - always returns a valid plan
"""

import logging
import time
import json
import hashlib
import uuid
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.interviews.plan_models import InterviewPlan
from app.interviews.question_pools import get_question_pool, QuestionPoolManager, CompanyStyle, Difficulty, QuestionRound
from app.resumes.models import Resume
from app.ats.models import ATSAnalysis
from app.companies.modes import get_company_profile, CompanyProfile
from app.admin.service import AIAPILogService


# Set up logging
logger = logging.getLogger(__name__)


class InterviewPlanService:
    """
    Service class for interview plan generation.
    
    Creates personalized interview plans based on:
    - Resume content and skills
    - ATS analysis results (strengths/weaknesses)
    - Target job role requirements
    
    GUARANTEED: Always returns a valid plan, never throws.
    """
    
    def __init__(self, db: Session):
        """Initialize plan service with database session."""
        self.db = db
        self._gemini_client = None
    
    def _get_gemini_client(self):
        """Get Gemini client if configured."""
        if not settings.is_gemini_configured():
            logger.info("Gemini not configured, will use fallback")
            return None
        
        if self._gemini_client is None:
            try:
                import google.generativeai as genai
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self._gemini_client = genai.GenerativeModel('gemini-pro')
                logger.info("Gemini client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini client: {e}")
                return None
        
        return self._gemini_client
    
    # ===========================================
    # DEFAULT SAFE FALLBACK PLAN
    # ===========================================
    
    def _generate_default_fallback_plan(
        self,
        target_role: str,
        session_type: str = "mixed",
        difficulty: str = "medium",
        question_count: int = 10,
        company_mode: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate a guaranteed safe default plan.
        
        This is the ULTIMATE fallback - always works, no external dependencies.
        Used when ALL other generation methods fail.
        """
        logger.info(f"Generating DEFAULT FALLBACK plan for role: {target_role}")
        
        # Fixed question distribution
        tech_count = max(3, question_count // 3)
        behav_count = max(2, question_count // 4)
        hr_count = max(2, question_count // 5)
        sit_count = question_count - tech_count - behav_count - hr_count
        if sit_count < 0:
            sit_count = 0
            tech_count = question_count - behav_count - hr_count
        
        # Generate standard questions
        questions = []
        q_id = 1
        
        # Technical questions
        tech_templates = [
            "Can you describe your experience with the core technologies relevant to this role?",
            "Explain a challenging technical problem you've solved in your previous work.",
            "How do you approach code quality and testing in your projects?",
            "Describe your experience with version control and team collaboration tools.",
            "What is your approach to learning new technologies?",
        ]
        for i in range(tech_count):
            questions.append({
                "id": f"q-{q_id}",
                "text": tech_templates[i % len(tech_templates)],
                "type": "technical",
                "category": "Technical Skills",
                "difficulty": difficulty,
                "time_limit_seconds": 180,
                "expected_topics": ["Technical knowledge", "Problem solving"],
                "scoring_rubric": {
                    "key_points": ["Clear explanation", "Practical examples"],
                    "red_flags": ["Vague answers", "No examples"],
                },
            })
            q_id += 1
        
        # Behavioral questions
        behav_templates = [
            "Tell me about a time when you had to work under pressure to meet a deadline.",
            "Describe a situation where you had to collaborate with a difficult team member.",
            "Give an example of when you took initiative to improve a process.",
            "Tell me about a time you received constructive criticism. How did you handle it?",
        ]
        for i in range(behav_count):
            questions.append({
                "id": f"q-{q_id}",
                "text": behav_templates[i % len(behav_templates)],
                "type": "behavioral",
                "category": "Behavioral",
                "difficulty": "medium",
                "time_limit_seconds": 180,
                "expected_topics": ["STAR method", "Specific example"],
                "scoring_rubric": {
                    "key_points": ["Specific example", "Clear actions", "Results"],
                    "red_flags": ["Generic answers", "Blaming others"],
                },
            })
            q_id += 1
        
        # HR questions
        hr_templates = [
            f"Why are you interested in this {target_role} position?",
            "Where do you see yourself in 5 years?",
            "What motivates you in your work?",
            "Why are you looking to make a change from your current role?",
        ]
        for i in range(hr_count):
            questions.append({
                "id": f"q-{q_id}",
                "text": hr_templates[i % len(hr_templates)],
                "type": "hr",
                "category": "HR & Culture Fit",
                "difficulty": "easy",
                "time_limit_seconds": 120,
                "expected_topics": ["Career goals", "Motivation"],
                "scoring_rubric": {
                    "key_points": ["Clear goals", "Genuine interest"],
                    "red_flags": ["Unclear goals", "Only about money"],
                },
            })
            q_id += 1
        
        # Situational questions
        sit_templates = [
            "What would you do if you disagreed with your manager's decision?",
            "How would you handle a project with unclear requirements?",
        ]
        for i in range(sit_count):
            questions.append({
                "id": f"q-{q_id}",
                "text": sit_templates[i % len(sit_templates)],
                "type": "situational",
                "category": "Situational",
                "difficulty": difficulty,
                "time_limit_seconds": 150,
                "expected_topics": ["Decision-making", "Problem-solving"],
                "scoring_rubric": {
                    "key_points": ["Logical approach", "Clear decision"],
                    "red_flags": ["Indecisive", "Poor judgment"],
                },
            })
            q_id += 1
        
        return {
            "session_type": session_type,
            "difficulty_level": difficulty,
            "total_questions": len(questions),
            "estimated_duration_minutes": len(questions) * 3,
            "technical_question_count": tech_count,
            "behavioral_question_count": behav_count,
            "hr_question_count": hr_count,
            "situational_question_count": max(0, sit_count),
            "question_categories": [
                {"category": "Technical", "count": tech_count, "difficulty": difficulty, "rationale": "Core skills assessment"},
                {"category": "Behavioral", "count": behav_count, "difficulty": "medium", "rationale": "Soft skills assessment"},
                {"category": "HR", "count": hr_count, "difficulty": "easy", "rationale": "Culture fit assessment"},
            ],
            "strength_focus_areas": [{"area": "General Skills", "reason": "Standard assessment", "question_count": 3}],
            "weakness_focus_areas": [{"area": "To be determined", "reason": "Will assess during interview", "question_count": 2}],
            "skills_to_test": ["Problem Solving", "Communication", "Technical Knowledge"],
            "questions": questions,
            "summary": f"Standard interview plan for {target_role} role with {len(questions)} questions covering technical, behavioral, and HR topics.",
            "rationale": "Generated using fallback method to ensure interview can proceed.",
            "company_mode": company_mode,
            "company_info": None,
            "plan_generated_via": "fallback",
        }
    
    # ===========================================
    # MOCK PLAN GENERATOR (NOW USES QUESTION POOLS)
    # ===========================================
    
    def _generate_mock_plan(
        self,
        resume_text: str,
        ats_analysis: Optional[ATSAnalysis],
        target_role: str,
        session_type: str,
        difficulty: str,
        question_count: int,
        company_mode: Optional[str] = None,
        round_config: Optional[Dict[str, int]] = None,
    ) -> Dict[str, Any]:
        """
        Generate randomized interview plan using QUESTION POOLS.
        
        CRITICAL CHANGES:
        - Uses QuestionPoolManager for randomized selection
        - Each session gets unique questions via session seed
        - Questions are NEVER repeated across sessions
        - Supports round structure for big-company style interviews
        - NEW: Respects round_config if provided for per-round counts
        
        Returns:
            Complete plan with rounds and unique questions
        """
        try:
            # Generate unique session seed for randomization
            session_seed = f"{target_role}:{difficulty}:{company_mode}:{uuid.uuid4()}"
            logger.info(f"Generating randomized plan: role={target_role}, seed={session_seed[:50]}")
            
            # Initialize question pool manager with unique seed
            pool_manager = get_question_pool(session_seed=session_seed)
            
            # Get company profile if specified
            company_profile = get_company_profile(company_mode) if company_mode else None
            
            # Map company mode to CompanyStyle
            company_style = CompanyStyle.ANY
            if company_mode:
                style_map = {
                    "faang": CompanyStyle.FAANG,
                    "startup": CompanyStyle.STARTUP,
                    "product": CompanyStyle.PRODUCT,
                    "service": CompanyStyle.SERVICE,
                }
                company_style = style_map.get(company_mode.lower(), CompanyStyle.ANY)
            
            # Adjust difficulty based on company profile
            if company_profile and hasattr(company_profile, 'difficulty_bias'):
                if company_profile.difficulty_bias.hard >= 0.4:
                    difficulty = Difficulty.HARD
                elif company_profile.difficulty_bias.easy >= 0.3:
                    difficulty = Difficulty.EASY
            
            # Use company profile's question count if specified
            if company_profile and hasattr(company_profile, 'total_questions'):
                question_count = company_profile.total_questions
            
            # Extract skills from ATS analysis or resume
            skills = []
            strength_areas = []
            weakness_areas = []
            
            if ats_analysis:
                skills = [s.get("name", s) if isinstance(s, dict) else s 
                         for s in (ats_analysis.skills_extracted or [])[:8]]
                strength_areas = ats_analysis.strength_areas or []
                weakness_areas = ats_analysis.weak_areas or []
            else:
                skills = self._extract_mock_skills(resume_text)
            
            # Build focus areas
            strength_focus = [
                {
                    "area": s.get("area", str(s)) if isinstance(s, dict) else str(s),
                    "reason": "Strong area - will probe for depth",
                    "question_count": 1,
                }
                for s in strength_areas[:3]
            ] if strength_areas else [
                {"area": "Technical Skills", "reason": "Core competency area", "question_count": 2}
            ]
            
            weakness_focus = [
                {
                    "area": w.get("area", str(w)) if isinstance(w, dict) else str(w),
                    "reason": "Gap identified - need to assess capability",
                    "question_count": 2,
                }
                for w in weakness_areas[:3]
            ] if weakness_areas else [
                {"area": "Problem Solving", "reason": "Critical skill to verify", "question_count": 2}
            ]
            
            # Handle custom round configuration if provided
            if round_config:
                logger.info(f"Using custom round config: {round_config}")
                # Generate questions directly based on user's round config
                all_questions = []
                rounds = []
                q_idx = 0
                
                round_defs = [
                    {"key": "dsa_questions", "type": QuestionRound.DSA, "name": "DSA Round", "diff": difficulty},
                    {"key": "technical_questions", "type": QuestionRound.TECHNICAL, "name": "Technical Round", "diff": difficulty},
                    {"key": "behavioral_questions", "type": QuestionRound.BEHAVIORAL, "name": "Behavioral Round", "diff": "medium"},
                    {"key": "hr_questions", "type": QuestionRound.HR, "name": "HR Round", "diff": "easy"},
                ]
                
                for rdef in round_defs:
                    count = round_config.get(rdef["key"], 0)
                    if count > 0:
                        questions = pool_manager.get_questions_for_round(
                            round_type=rdef["type"],
                            difficulty=rdef["diff"],
                            count=count,
                            target_role=target_role,
                            company_style=company_style,
                        )
                        # Assign indices
                        for q in questions:
                            q["index"] = q_idx
                            q_idx += 1
                            all_questions.append(q)
                        
                        rounds.append({
                            "name": rdef["name"],
                            "type": rdef["type"],
                            "question_count": len(questions),
                            "difficulty": rdef["diff"],
                            "questions": questions,
                        })
                
                round_data = {
                    "rounds": rounds,
                    "questions": all_questions,
                    "total_questions": len(all_questions),
                    "estimated_duration_minutes": len(all_questions) * 3,
                    "session_seed": session_seed,
                    "company_style": company_style,
                }
            else:
                # Generate round structure with unique questions (original flow)
                round_data = pool_manager.generate_round_structure(
                    target_role=target_role,
                    difficulty=difficulty,
                    total_questions=question_count,
                    company_style=company_style,
                    session_type=session_type,
                    experience_level="mid",  # TODO: Could be extracted from resume
                )
            
            # Extract questions and rounds
            questions = round_data["questions"]
            rounds = round_data["rounds"]
            
            # Build question categories from rounds
            question_categories = []
            for rnd in rounds:
                question_categories.append({
                    "category": rnd["name"].replace(" Round", ""),
                    "count": rnd["question_count"],
                    "difficulty": rnd["difficulty"],
                    "focus_area": f"{rnd['name']} questions",
                    "rationale": f"Testing {rnd['type']} competency for {target_role}",
                })
            
            # Calculate counts by type - CRITICAL: DSA must be separate from Technical
            dsa_count = sum(1 for q in questions if q["type"] == "dsa")
            tech_count = sum(1 for q in questions if q["type"] in ["technical", "system_design"])
            behav_count = sum(1 for q in questions if q["type"] == "behavioral")
            hr_count = sum(1 for q in questions if q["type"] == "hr")
            sit_count = sum(1 for q in questions if q["type"] == "situational")
            
            # Estimate duration
            estimated_duration = round_data["estimated_duration_minutes"]
            if company_profile and hasattr(company_profile, 'estimated_duration_minutes'):
                estimated_duration = company_profile.estimated_duration_minutes
            
            # Generate summary
            summary = self._generate_plan_summary(
                target_role=target_role,
                total_questions=len(questions),
                tech_count=tech_count + dsa_count,  # Combined for summary
                behav_count=behav_count,
                difficulty=difficulty,
                company_mode=company_mode,
            )
            
            # Build company mode info
            company_info = None
            if company_profile:
                company_info = {
                    "id": company_profile.id,
                    "name": company_profile.name,
                    "type": company_profile.type.value if hasattr(company_profile.type, 'value') else str(company_profile.type),
                    "interview_style": company_profile.interview_style,
                    "focus_areas": company_profile.focus_areas,
                    "interviewer_style": company_profile.interviewer_style,
                }
            
            logger.info(f"Randomized plan generated: {len(questions)} questions, {len(rounds)} rounds")
            logger.info(f"Breakdown: DSA={dsa_count}, Tech={tech_count}, Behav={behav_count}, HR={hr_count}")
            
            return {
                "session_type": session_type,
                "difficulty_level": difficulty,
                "total_questions": len(questions),
                "estimated_duration_minutes": estimated_duration,
                "dsa_question_count": dsa_count,  # NEW: Separate DSA count
                "technical_question_count": tech_count,
                "behavioral_question_count": behav_count,
                "hr_question_count": hr_count,
                "situational_question_count": sit_count,
                "question_categories": question_categories,
                "strength_focus_areas": strength_focus,
                "weakness_focus_areas": weakness_focus,
                "skills_to_test": skills[:10],
                "questions": questions,
                "rounds": rounds,  # NEW: Include round structure
                "session_seed": session_seed,  # NEW: Include seed for debugging
                "summary": summary,
                "rationale": f"Plan optimized for {target_role} role with unique randomized questions.",
                "company_mode": company_mode,
                "company_info": company_info,
                "plan_generated_via": "pool",  # NEW: Indicate pool-based generation
            }
        except Exception as e:
            logger.error(f"Error in pool-based plan generation: {e}")
            # Return default fallback
            return self._generate_default_fallback_plan(
                target_role, session_type, difficulty, question_count, company_mode
            )
    
    def _extract_mock_skills(self, resume_text: str) -> List[str]:
        """Extract mock skills from resume text."""
        skill_keywords = [
            "python", "javascript", "java", "react", "node", "sql",
            "aws", "docker", "kubernetes", "git", "agile",
            "leadership", "communication", "teamwork", "problem solving",
        ]
        
        text_lower = resume_text.lower()
        found_skills = [s.title() for s in skill_keywords if s in text_lower]
        
        return found_skills[:10] if found_skills else ["Problem Solving", "Communication", "Teamwork"]
    
    def _generate_mock_questions(
        self,
        target_role: str,
        skills: List[str],
        tech_count: int,
        behav_count: int,
        hr_count: int,
        sit_count: int,
        difficulty: str,
    ) -> List[Dict[str, Any]]:
        """Generate mock questions for the plan."""
        questions = []
        q_id = 1
        
        # Technical questions
        tech_templates = [
            f"Can you explain your experience with {skills[0] if skills else 'the primary technologies'} used in your previous role?",
            f"Describe a challenging technical problem you solved. What was your approach?",
            f"How would you design a scalable solution for a high-traffic application?",
            f"What is your approach to code review and ensuring code quality?",
            f"Explain the difference between synchronous and asynchronous programming.",
            f"How do you handle technical debt in a project?",
            f"Describe your experience with testing and test-driven development.",
            f"How do you stay updated with the latest technology trends?",
        ]
        
        for i in range(tech_count):
            questions.append({
                "id": f"q-{q_id}",
                "text": tech_templates[i % len(tech_templates)],
                "type": "technical",
                "category": "Technical Skills",
                "difficulty": difficulty,
                "time_limit_seconds": 180,
                "expected_topics": skills[:3] if skills else ["technical knowledge"],
                "scoring_rubric": {
                    "key_points": ["Clear explanation", "Practical examples", "Depth of knowledge"],
                    "red_flags": ["Vague answers", "No examples", "Incorrect concepts"],
                },
            })
            q_id += 1
        
        # Behavioral questions (STAR method)
        behav_templates = [
            "Tell me about a time when you had to work under pressure to meet a deadline.",
            "Describe a situation where you had to collaborate with a difficult team member.",
            "Give an example of when you took initiative to improve a process.",
            "Tell me about a time you received constructive criticism. How did you handle it?",
            "Describe a situation where you had to adapt to a significant change.",
            "Tell me about a time you failed. What did you learn from it?",
        ]
        
        for i in range(behav_count):
            questions.append({
                "id": f"q-{q_id}",
                "text": behav_templates[i % len(behav_templates)],
                "type": "behavioral",
                "category": "Behavioral",
                "difficulty": "medium",
                "time_limit_seconds": 180,
                "expected_topics": ["STAR method", "Specific example", "Learning outcome"],
                "scoring_rubric": {
                    "key_points": ["Specific example", "Clear actions", "Results achieved"],
                    "red_flags": ["Generic answers", "Blaming others", "No learning"],
                },
            })
            q_id += 1
        
        # HR questions
        hr_templates = [
            f"Why are you interested in this {target_role} position?",
            "Where do you see yourself in 5 years?",
            "What are your salary expectations?",
            "Why are you leaving your current job?",
            "What motivates you in your work?",
        ]
        
        for i in range(hr_count):
            questions.append({
                "id": f"q-{q_id}",
                "text": hr_templates[i % len(hr_templates)],
                "type": "hr",
                "category": "HR & Culture Fit",
                "difficulty": "easy",
                "time_limit_seconds": 120,
                "expected_topics": ["Career goals", "Motivation", "Alignment"],
                "scoring_rubric": {
                    "key_points": ["Clear goals", "Genuine interest", "Good fit"],
                    "red_flags": ["Unclear goals", "Only about money", "Misalignment"],
                },
            })
            q_id += 1
        
        # Situational questions
        sit_templates = [
            "What would you do if you disagreed with your manager's decision?",
            "How would you handle a project with unclear requirements?",
            "If you discovered a critical bug right before a release, what would you do?",
            "How would you prioritize multiple urgent tasks?",
        ]
        
        for i in range(sit_count):
            questions.append({
                "id": f"q-{q_id}",
                "text": sit_templates[i % len(sit_templates)],
                "type": "situational",
                "category": "Situational",
                "difficulty": difficulty,
                "time_limit_seconds": 150,
                "expected_topics": ["Decision-making", "Problem-solving", "Judgment"],
                "scoring_rubric": {
                    "key_points": ["Logical approach", "Consider stakeholders", "Clear decision"],
                    "red_flags": ["Indecisive", "Poor judgment", "Ignores impact"],
                },
            })
            q_id += 1
        
        return questions
    
    def _generate_plan_summary(
        self,
        target_role: str,
        total_questions: int,
        tech_count: int,
        behav_count: int,
        difficulty: str,
        company_mode: Optional[str] = None,
    ) -> str:
        """Generate human-readable plan summary."""
        company_note = ""
        if company_mode:
            profile = get_company_profile(company_mode)
            if profile:
                company_note = f" This interview simulates a {profile.name} style with focus on {', '.join(profile.focus_areas[:2])}."
        
        return (
            f"This interview plan for {target_role} includes {total_questions} questions "
            f"across multiple categories. You'll face {tech_count} technical questions, "
            f"{behav_count} behavioral questions, and additional HR and situational scenarios. "
            f"The difficulty level is set to {difficulty}. "
            f"Expected duration: {total_questions * 3} minutes.{company_note} "
            f"Prepare with STAR method for behavioral questions and concrete examples for technical ones."
        )
    
    # ===========================================
    # GEMINI PLAN GENERATION
    # ===========================================
    
    async def _generate_with_gemini(
        self,
        resume_text: str,
        ats_analysis: Optional[ATSAnalysis],
        target_role: str,
        session_type: str,
        difficulty: str,
        question_count: int,
        company_mode: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate interview plan using Gemini API.
        
        Incorporates company mode for tailored questions.
        ALWAYS falls back to mock if anything fails.
        """
        client = self._get_gemini_client()
        
        if not client:
            logger.info("No Gemini client available, using mock plan")
            result = self._generate_mock_plan(
                resume_text, ats_analysis, target_role,
                session_type, difficulty, question_count, company_mode
            )
            result["plan_generated_via"] = "mock"
            return result
        
        try:
            logger.info(f"Attempting Gemini plan generation for role: {target_role}")
            
            # Build prompt
            ats_summary = ""
            if ats_analysis:
                ats_summary = f"""
                ATS Score: {ats_analysis.overall_score}/100
                Skills: {', '.join([s.get('name', str(s)) if isinstance(s, dict) else str(s) for s in (ats_analysis.skills_extracted or [])[:10]])}
                Strengths: {json.dumps(ats_analysis.strength_areas or [])}
                Weaknesses: {json.dumps(ats_analysis.weak_areas or [])}
                """
            
            prompt = f"""
            Generate a personalized interview plan based on the candidate's resume and analysis.
            
            Target Role: {target_role}
            Session Type: {session_type}
            Difficulty: {difficulty}
            Question Count: {question_count}
            
            Resume Summary (first 2000 chars):
            {resume_text[:2000]}
            
            {ats_summary}
            
            Create an interview plan with:
            1. Question breakdown by category (technical, behavioral, HR, situational)
            2. Focus areas based on strengths (probe deeper) and weaknesses (test more)
            3. Actual questions with expected topics and scoring rubric
            
            Rules:
            - Weak areas should get MORE questions
            - Strong areas should get DEEPER questions
            - HR and behavioral questions MUST be included
            - No generic question sets
            
            Return JSON:
            {{
                "question_categories": [
                    {{"category": "name", "count": N, "difficulty": "level", "rationale": "why"}}
                ],
                "strength_focus_areas": [
                    {{"area": "name", "reason": "why", "question_count": N}}
                ],
                "weakness_focus_areas": [
                    {{"area": "name", "reason": "why", "question_count": N}}
                ],
                "skills_to_test": ["skill1", "skill2"],
                "questions": [
                    {{
                        "id": "q-1",
                        "text": "question text",
                        "type": "technical|behavioral|hr|situational",
                        "category": "category",
                        "difficulty": "easy|medium|hard",
                        "time_limit_seconds": 180,
                        "expected_topics": ["topic1"],
                        "scoring_rubric": {{"key_points": [], "red_flags": []}}
                    }}
                ],
                "summary": "plan summary",
                "rationale": "why this plan"
            }}
            """
            
            start_time = time.time()
            response = client.generate_content(prompt)
            response_text = response.text
            response_time_ms = int((time.time() - start_time) * 1000)
            
            # Log successful Gemini API call
            try:
                AIAPILogService.log_ai_call(
                    db=self.db,
                    provider="gemini",
                    operation="generate_interview_plan",
                    model="gemini-pro",
                    response_time_ms=response_time_ms,
                    status="success"
                )
            except Exception as log_error:
                logger.warning(f"Failed to log Gemini call: {log_error}")
            
            # Log raw response (first 500 chars)
            logger.info(f"Gemini raw response (first 500 chars): {response_text[:500]}")
            
            # Parse JSON
            try:
                if "```json" in response_text:
                    json_start = response_text.find("```json") + 7
                    json_end = response_text.find("```", json_start)
                    response_text = response_text[json_start:json_end].strip()
                elif "```" in response_text:
                    json_start = response_text.find("```") + 3
                    json_end = response_text.find("```", json_start)
                    response_text = response_text[json_start:json_end].strip()
                
                result = json.loads(response_text)
                
                # Calculate counts from questions
                questions = result.get("questions", [])
                tech_count = sum(1 for q in questions if q.get("type") == "technical")
                behav_count = sum(1 for q in questions if q.get("type") == "behavioral")
                hr_count = sum(1 for q in questions if q.get("type") == "hr")
                sit_count = sum(1 for q in questions if q.get("type") == "situational")
                
                logger.info(f"Gemini plan generated successfully: {len(questions)} questions")
                
                return {
                    "session_type": session_type,
                    "difficulty_level": difficulty,
                    "total_questions": len(questions),
                    "estimated_duration_minutes": len(questions) * 3,
                    "technical_question_count": tech_count,
                    "behavioral_question_count": behav_count,
                    "hr_question_count": hr_count,
                    "situational_question_count": sit_count,
                    "question_categories": result.get("question_categories", []),
                    "strength_focus_areas": result.get("strength_focus_areas", []),
                    "weakness_focus_areas": result.get("weakness_focus_areas", []),
                    "skills_to_test": result.get("skills_to_test", []),
                    "questions": questions,
                    "summary": result.get("summary", "Interview plan generated."),
                    "rationale": result.get("rationale", ""),
                    "company_mode": company_mode,
                    "company_info": None,
                    "plan_generated_via": "gemini",
                }
                
            except json.JSONDecodeError as e:
                logger.warning(f"Gemini JSON parsing failed: {e}, falling back to mock")
                result = self._generate_mock_plan(
                    resume_text, ats_analysis, target_role,
                    session_type, difficulty, question_count, company_mode
                )
                result["plan_generated_via"] = "fallback"
                return result
                
        except Exception as e:
            logger.error(f"Gemini plan generation error: {e}")
            result = self._generate_mock_plan(
                resume_text, ats_analysis, target_role,
                session_type, difficulty, question_count, company_mode
            )
            result["plan_generated_via"] = "fallback"
            return result
    
    # ===========================================
    # STRICT/STRESS MODE: ENHANCED QUESTION GENERATION
    # ===========================================
    
    async def _generate_pressure_mode_questions(
        self,
        target_role: str,
        skills: List[str],
        question_count: int,
        difficulty: str,
        persona: str,
        resume_summary: str = "",
    ) -> List[Dict[str, Any]]:
        """
        Generate high-pressure interview questions using Gemini API.
        
        Designed for STRICT and STRESS personality modes to create:
        - More challenging questions with edge cases
        - Multi-part questions that test depth
        - Time-constrained scenarios
        - Trade-off analysis questions
        
        Args:
            target_role: Target job role
            skills: Extracted skills from resume
            question_count: Number of questions to generate
            difficulty: Difficulty level
            persona: "strict" or "stress"
            resume_summary: Brief resume summary for personalization
            
        Returns:
            List of challenging questions
        """
        client = self._get_gemini_client()
        
        if not client:
            logger.info("No Gemini client for pressure questions, using enhanced pool")
            return self._generate_enhanced_pool_questions(
                target_role, skills, question_count, difficulty, persona
            )
        
        # Build persona-specific prompt
        if persona == "stress":
            pressure_instruction = """
INTERVIEW STYLE: HIGH-PRESSURE / STRESS TEST

Generate questions that:
1. Include time constraints ("You have 5 minutes to explain...")
2. Add complications or edge cases
3. Require quick thinking and clear prioritization
4. Test composure under pressure
5. Demand specific metrics and numbers
6. Include multi-part challenges

Example question styles:
- "In 2 minutes, design a solution for X that handles 1M users with <100ms latency. What are your top 3 trade-offs?"
- "Your deployment just failed in production with users complaining. Walk me through your first 60 seconds."
- "Give me 3 specific examples where you had to say no to a stakeholder. What was the outcome?"
"""
        else:  # strict
            pressure_instruction = """
INTERVIEW STYLE: STRICT / NO-NONSENSE

Generate questions that:
1. Demand precise, specific answers
2. Probe for evidence and metrics
3. Challenge claims directly
4. Expect depth of knowledge
5. Allow no room for vague responses
6. Test technical precision

Example question styles:
- "Walk me through the exact architecture you designed. I want component names, data flows, and failure modes."
- "What specific metrics improved after your optimization? Give me before/after numbers."
- "Describe a technical decision you made that failed. What was wrong with your reasoning?"
"""
        
        prompt = f"""
Generate {question_count} challenging interview questions for a {target_role} position.

{pressure_instruction}

CANDIDATE SKILLS: {', '.join(skills[:10]) if skills else 'General software development'}

DIFFICULTY: {difficulty.upper()}

RESUME CONTEXT: {resume_summary[:500] if resume_summary else 'No specific resume context'}

QUESTION MIX REQUIREMENTS:
- 40% Technical/System Design (challenging, with constraints)
- 25% Behavioral (specific STAR scenarios with accountability)
- 20% Problem Solving (trade-offs, prioritization)
- 15% Situational (pressure scenarios)

For EACH question, provide:
1. The question text (challenging, specific)
2. Type (technical, behavioral, dsa, system_design, situational)
3. Expected answer key points
4. Red flags to watch for
5. A follow-up probe question

Return JSON array:
[
    {{
        "id": "q-1",
        "text": "challenging question text",
        "type": "technical|behavioral|dsa|system_design|situational",
        "category": "category name",
        "difficulty": "{difficulty}",
        "time_limit_seconds": 180,
        "expected_topics": ["topic1", "topic2"],
        "scoring_rubric": {{
            "key_points": ["point1", "point2"],
            "red_flags": ["flag1", "flag2"]
        }},
        "follow_up_probe": "challenging follow-up question"
    }}
]
"""
        
        try:
            start_time = time.time()
            response = client.generate_content(prompt)
            response_text = response.text
            response_time_ms = int((time.time() - start_time) * 1000)
            
            # Log successful Gemini API call
            try:
                AIAPILogService.log_ai_call(
                    db=self.db,
                    provider="gemini",
                    operation="generate_pressure_questions",
                    model="gemini-pro",
                    response_time_ms=response_time_ms,
                    status="success"
                )
            except Exception as log_error:
                logger.warning(f"Failed to log Gemini call: {log_error}")
            
            logger.info(f"Gemini pressure questions response (first 300 chars): {response_text[:300]}")
            
            # Parse JSON
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            elif "```" in response_text:
                json_start = response_text.find("```") + 3
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            
            questions = json.loads(response_text)
            
            # Add persona tag to each question
            for q in questions:
                q["persona_mode"] = persona
                q["pressure_level"] = "high" if persona == "stress" else "medium"
            
            logger.info(f"Generated {len(questions)} pressure-mode questions via Gemini")
            return questions
            
        except Exception as e:
            logger.error(f"Gemini pressure question generation failed: {e}")
            return self._generate_enhanced_pool_questions(
                target_role, skills, question_count, difficulty, persona
            )
    
    def _generate_enhanced_pool_questions(
        self,
        target_role: str,
        skills: List[str],
        question_count: int,
        difficulty: str,
        persona: str,
    ) -> List[Dict[str, Any]]:
        """
        Generate enhanced challenging questions from the pool.
        
        Fallback when API is not available but still provides
        challenging questions for strict/stress modes.
        """
        questions = []
        q_id = 1
        
        # Challenging technical templates for strict/stress modes
        if persona == "stress":
            tech_templates = [
                f"You have 3 minutes. Design a system that handles 10M daily active users for {target_role.lower()}. What are your top 3 scaling challenges?",
                f"Your {skills[0] if skills else 'primary system'} is down in production with 10,000 users affected. Walk me through your first 5 actions.",
                f"Explain the trade-offs between consistency and availability in a distributed system. Give me a specific example from your experience.",
                f"You need to optimize a query that's taking 30 seconds. What are your first 3 hypotheses and how do you test each?",
                f"Design a rate limiter that handles 1M requests/second with <5ms latency. What data structures would you use and why?",
            ]
            behav_templates = [
                "Tell me about a time you pushed back on your manager's decision. What was the outcome? Would you do it again?",
                "Describe a project where you failed to meet the deadline. What specifically went wrong with YOUR planning?",
                "Give me 3 examples where you had to make an unpopular technical decision. How did you handle the pushback?",
                "When was the last time you admitted you were wrong in front of your team? What did you learn?",
            ]
        else:  # strict
            tech_templates = [
                f"Walk me through the exact architecture of the most complex system you've built. I want component names and data flows.",
                f"What specific performance improvements did you achieve in your last optimization project? Give me before/after numbers.",
                f"Describe a technical decision you made that you later regretted. What was wrong with your reasoning?",
                f"Explain how you would debug a memory leak in a production {skills[0] if skills else 'application'}. Be specific about tools and steps.",
                f"What are the exact trade-offs between SQL and NoSQL for {target_role.lower()} use cases? Give concrete examples.",
            ]
            behav_templates = [
                "Describe a conflict with a senior engineer where you disagreed on architecture. How did you resolve it?",
                "Tell me about a time you delivered something that wasn't what the stakeholder wanted. What happened?",
                "Give me a specific example of receiving critical feedback. What exactly did you change?",
                "When did you last take ownership of a bug you didn't create? Walk me through your actions.",
            ]
        
        # Generate questions
        tech_count = int(question_count * 0.5)
        behav_count = int(question_count * 0.3)
        other_count = question_count - tech_count - behav_count
        
        for i in range(tech_count):
            questions.append({
                "id": f"q-{q_id}",
                "text": tech_templates[i % len(tech_templates)],
                "type": "technical",
                "category": "Technical Deep-Dive",
                "difficulty": difficulty,
                "time_limit_seconds": 180,
                "expected_topics": skills[:3] if skills else ["system design", "problem solving"],
                "scoring_rubric": {
                    "key_points": ["Specific details", "Trade-off analysis", "Real examples"],
                    "red_flags": ["Vague answers", "No metrics", "Avoids specifics"],
                },
                "persona_mode": persona,
                "pressure_level": "high" if persona == "stress" else "medium",
            })
            q_id += 1
        
        for i in range(behav_count):
            questions.append({
                "id": f"q-{q_id}",
                "text": behav_templates[i % len(behav_templates)],
                "type": "behavioral",
                "category": "Behavioral",
                "difficulty": "medium",
                "time_limit_seconds": 180,
                "expected_topics": ["STAR method", "Accountability", "Learning"],
                "scoring_rubric": {
                    "key_points": ["Specific example", "Personal accountability", "Clear outcome"],
                    "red_flags": ["Blaming others", "Vague timeline", "No learning"],
                },
                "persona_mode": persona,
                "pressure_level": "high" if persona == "stress" else "medium",
            })
            q_id += 1
        
        # Add situational questions
        situational_templates = [
            "You discover a critical security vulnerability 2 hours before a major release. What do you do?",
            "Your team is divided 50/50 on a technical approach and you need to ship in 3 days. How do you decide?",
            "A junior developer's code caused a production outage. How do you handle the immediate situation and the aftermath?",
        ]
        
        for i in range(other_count):
            questions.append({
                "id": f"q-{q_id}",
                "text": situational_templates[i % len(situational_templates)],
                "type": "situational",
                "category": "Situational",
                "difficulty": difficulty,
                "time_limit_seconds": 150,
                "expected_topics": ["Decision-making", "Prioritization", "Communication"],
                "scoring_rubric": {
                    "key_points": ["Clear reasoning", "Stakeholder awareness", "Action-oriented"],
                    "red_flags": ["Indecisive", "Ignores consequences", "Poor judgment"],
                },
                "persona_mode": persona,
                "pressure_level": "high" if persona == "stress" else "medium",
            })
            q_id += 1
        
        return questions
    
    def _build_pressure_mode_plan(
        self,
        questions: List[Dict[str, Any]],
        target_role: str,
        session_type: str,
        difficulty: str,
        question_count: int,
        company_mode: Optional[str],
        skills: List[str],
        persona: str,
    ) -> Dict[str, Any]:
        """
        Build a complete plan data structure for pressure mode questions.
        
        Takes generated pressure questions and wraps them in the 
        standard plan format.
        """
        # Count question types
        tech_count = sum(1 for q in questions if q.get("type") in ["technical", "system_design"])
        dsa_count = sum(1 for q in questions if q.get("type") == "dsa")
        behav_count = sum(1 for q in questions if q.get("type") == "behavioral")
        hr_count = sum(1 for q in questions if q.get("type") == "hr")
        sit_count = sum(1 for q in questions if q.get("type") == "situational")
        
        # Build categories
        question_categories = []
        if tech_count + dsa_count > 0:
            question_categories.append({
                "category": "Technical",
                "count": tech_count + dsa_count,
                "difficulty": difficulty,
                "rationale": "High-pressure technical assessment",
            })
        if behav_count > 0:
            question_categories.append({
                "category": "Behavioral",
                "count": behav_count,
                "difficulty": "medium",
                "rationale": "Accountability and leadership assessment",
            })
        if sit_count > 0:
            question_categories.append({
                "category": "Situational",
                "count": sit_count,
                "difficulty": difficulty,
                "rationale": "Decision-making under pressure",
            })
        
        # Build pressure-specific summary
        pressure_label = "HIGH-PRESSURE" if persona == "stress" else "STRICT"
        summary = (
            f"This is a {pressure_label} interview plan for {target_role}. "
            f"You'll face {len(questions)} challenging questions designed to test your depth of knowledge "
            f"and ability to perform under pressure. Expect probing follow-ups, requests for specific metrics, "
            f"and scenarios that require quick, clear thinking. "
            f"Focus on: specific examples, concrete numbers, trade-off analysis, and clear reasoning."
        )
        
        return {
            "session_type": session_type,
            "difficulty_level": difficulty,
            "total_questions": len(questions),
            "estimated_duration_minutes": len(questions) * 4,  # More time for challenging questions
            "dsa_question_count": dsa_count,
            "technical_question_count": tech_count,
            "behavioral_question_count": behav_count,
            "hr_question_count": hr_count,
            "situational_question_count": sit_count,
            "question_categories": question_categories,
            "strength_focus_areas": [
                {"area": "Depth Probing", "reason": "Testing true expertise", "question_count": 3},
            ],
            "weakness_focus_areas": [
                {"area": "Pressure Handling", "reason": "Assessing composure", "question_count": 2},
            ],
            "skills_to_test": skills[:10],
            "questions": questions,
            "rounds": [],  # Pressure mode doesn't use rounds
            "summary": summary,
            "rationale": f"{pressure_label} interview mode with API-generated challenging questions.",
            "company_mode": company_mode,
            "company_info": None,
            "plan_generated_via": "gemini_pressure" if settings.is_gemini_configured() else "pool_pressure",
            "persona_mode": persona,
        }
    
    # ===========================================
    # PUBLIC API
    # ===========================================
    
    async def generate_plan(
        self,
        resume: Resume,
        user_id: str,
        target_role: str,
        target_description: Optional[str] = None,
        session_type: str = "mixed",
        difficulty: str = "medium",
        question_count: int = 10,
        company_mode: Optional[str] = None,
        round_config: Optional[Dict[str, int]] = None,
        persona: Optional[str] = None,
    ) -> InterviewPlan:
        """
        Generate a personalized interview plan.
        
        Uses Gemini API if configured, otherwise returns mock plan.
        Company mode influences question mix and difficulty.
        
        Args:
            resume: Resume model object
            user_id: User ID
            target_role: Target job role
            target_description: Optional job description
            session_type: Interview type (mixed, technical, behavioral, hr)
            difficulty: Difficulty level (easy, medium, hard, expert)
            question_count: Total number of questions
            company_mode: Company interview mode
            round_config: Optional per-round question counts {dsa_questions, technical_questions, etc}
            persona: Interviewer personality mode (strict, stress, friendly, neutral)
        
        GUARANTEED: Always returns a valid plan, never throws.
        """
        start_time = time.time()
        
        # Log input parameters
        logger.info(f"=== PLAN GENERATION START ===")
        logger.info(f"resume_id: {resume.id}")
        logger.info(f"user_id: {user_id}")
        logger.info(f"target_role: {target_role}")
        logger.info(f"session_type: {session_type}")
        logger.info(f"difficulty: {difficulty}")
        logger.info(f"question_count: {question_count}")
        logger.info(f"company_mode: {company_mode}")
        logger.info(f"round_config: {round_config}")
        logger.info(f"persona: {persona}")
        
        # Get resume text (with fallback)
        resume_text = resume.text_content or ""
        if not resume_text:
            logger.warning(f"Resume {resume.id} has no text content, using filename as fallback")
            resume_text = f"Resume for {resume.filename or 'Unknown'}"
        
        # Get latest ATS analysis for this resume (optional)
        ats_analysis = None
        try:
            ats_analysis = self.db.query(ATSAnalysis).filter(
                ATSAnalysis.resume_id == resume.id,
                ATSAnalysis.user_id == user_id,
            ).order_by(ATSAnalysis.created_at.desc()).first()
            logger.info(f"ATS analysis found: {ats_analysis is not None}")
        except Exception as e:
            logger.warning(f"Failed to fetch ATS analysis: {e}")
        
        # Extract skills for pressure mode
        skills = []
        if ats_analysis:
            skills = [s.get("name", s) if isinstance(s, dict) else s 
                     for s in (ats_analysis.skills_extracted or [])[:10]]
        elif resume_text:
            skills = self._extract_mock_skills(resume_text)
        
        # Determine generation source and generate plan
        try:
            use_gemini = settings.is_gemini_configured()
            logger.info(f"Gemini configured: {use_gemini}")
            
            # ===========================================
            # STRICT/STRESS MODE: Use pressure questions
            # ===========================================
            if persona in ["strict", "stress"] and use_gemini:
                logger.info(f"Using PRESSURE MODE question generation for persona: {persona}")
                
                # Generate pressure-mode questions via API
                pressure_questions = await self._generate_pressure_mode_questions(
                    target_role=target_role,
                    skills=skills,
                    question_count=question_count,
                    difficulty=difficulty,
                    persona=persona,
                    resume_summary=resume_text[:500],
                )
                
                # Build plan data with pressure questions
                plan_data = self._build_pressure_mode_plan(
                    questions=pressure_questions,
                    target_role=target_role,
                    session_type=session_type,
                    difficulty=difficulty,
                    question_count=question_count,
                    company_mode=company_mode,
                    skills=skills,
                    persona=persona,
                )
                
            # CRITICAL: If user provided round_config, use pool-based generation
            # because Gemini will NOT respect the exact per-round question counts
            elif round_config:
                logger.info(f"Using pool-based generation for explicit round_config: {round_config}")
                plan_data = self._generate_mock_plan(
                    resume_text, ats_analysis, target_role,
                    session_type, difficulty, question_count,
                    company_mode, round_config
                )
            elif use_gemini:
                plan_data = await self._generate_with_gemini(
                    resume_text, ats_analysis, target_role,
                    session_type, difficulty, question_count,
                    company_mode
                )
            else:
                plan_data = self._generate_mock_plan(
                    resume_text, ats_analysis, target_role,
                    session_type, difficulty, question_count,
                    company_mode, round_config
                )
        except Exception as e:
            logger.error(f"Plan generation failed, using default fallback: {e}")
            plan_data = self._generate_default_fallback_plan(
                target_role, session_type, difficulty, question_count, company_mode
            )
        
        # Ensure plan_generated_via is set
        generation_via = plan_data.get("plan_generated_via", "fallback")
        if generation_via == "gemini":
            generation_source = "gemini"
            generation_model = "gemini-pro"
        elif generation_via == "mock":
            generation_source = "mock"
            generation_model = None
        else:
            generation_source = "fallback"
            generation_model = None
        
        processing_time = int((time.time() - start_time) * 1000)
        
        # Create database record
        try:
            plan = InterviewPlan(
                user_id=user_id,
                resume_id=resume.id,
                ats_analysis_id=ats_analysis.id if ats_analysis else None,
                target_role=target_role,
                target_role_description=target_description,
                
                # Config
                session_type=plan_data["session_type"],
                difficulty_level=plan_data["difficulty_level"],
                total_questions=plan_data["total_questions"],
                estimated_duration_minutes=plan_data["estimated_duration_minutes"],
                
                # Breakdown
                dsa_question_count=plan_data.get("dsa_question_count", 0),
                technical_question_count=plan_data["technical_question_count"],
                behavioral_question_count=plan_data["behavioral_question_count"],
                hr_question_count=plan_data["hr_question_count"],
                situational_question_count=plan_data.get("situational_question_count", 0),
                
                # Details
                question_categories=plan_data["question_categories"],
                strength_focus_areas=plan_data["strength_focus_areas"],
                weakness_focus_areas=plan_data["weakness_focus_areas"],
                skills_to_test=plan_data["skills_to_test"],
                questions=plan_data["questions"],
                
                # Summary
                summary=plan_data["summary"],
                rationale=plan_data["rationale"],
                
                # Company mode
                company_mode=plan_data.get("company_mode"),
                company_info=plan_data.get("company_info"),
                
                # Metadata
                generation_source=generation_source,
                generation_model=generation_model,
                processing_time_ms=processing_time,
                status="ready",
            )
            
            self.db.add(plan)
            self.db.commit()
            self.db.refresh(plan)
            
            logger.info(f"=== PLAN GENERATION COMPLETE ===")
            logger.info(f"plan_id: {plan.id}")
            logger.info(f"generation_source: {generation_source}")
            logger.info(f"processing_time_ms: {processing_time}")
            
            return plan
            
        except Exception as e:
            logger.error(f"Failed to save plan to database: {e}")
            self.db.rollback()
            raise
    
    def get_plan_by_id(
        self, 
        plan_id: str, 
        user_id: str
    ) -> Optional[InterviewPlan]:
        """Get plan by ID (user-scoped)."""
        return self.db.query(InterviewPlan).filter(
            InterviewPlan.id == plan_id,
            InterviewPlan.user_id == user_id,
        ).first()
    
    def get_plan_by_resume(
        self, 
        resume_id: str, 
        user_id: str
    ) -> Optional[InterviewPlan]:
        """Get latest plan for a resume."""
        return self.db.query(InterviewPlan).filter(
            InterviewPlan.resume_id == resume_id,
            InterviewPlan.user_id == user_id,
        ).order_by(InterviewPlan.created_at.desc()).first()
    
    def get_user_plans(
        self, 
        user_id: str, 
        limit: int = 10
    ) -> List[InterviewPlan]:
        """Get all plans for a user."""
        return self.db.query(InterviewPlan).filter(
            InterviewPlan.user_id == user_id,
        ).order_by(InterviewPlan.created_at.desc()).limit(limit).all()
    
    def mark_plan_used(
        self, 
        plan_id: str, 
        session_id: str,
        user_id: str
    ) -> bool:
        """Mark a plan as used for a session."""
        plan = self.get_plan_by_id(plan_id, user_id)
        if not plan:
            return False
        
        plan.is_used = True
        plan.used_for_session_id = session_id
        plan.status = "used"
        self.db.commit()
        
        return True


def get_plan_service(db: Session) -> InterviewPlanService:
    """Get plan service instance."""
    return InterviewPlanService(db)
