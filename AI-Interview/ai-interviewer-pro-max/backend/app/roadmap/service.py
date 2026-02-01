"""
Career Roadmap Service

Generates personalized career roadmaps using Gemini AI.
Based on resume, ATS analysis, and interview performance.
"""

import json
import time
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.roadmap.models import CareerRoadmap
from app.reports.models import InterviewReport
from app.evaluations.models import AnswerEvaluation
from app.resumes.models import Resume
from app.ats.models import ATSAnalysis
from app.interviews.live_models import LiveInterviewSession
from app.admin.service import AIAPILogService


class RoadmapService:
    """
    Service for generating personalized career roadmaps.
    
    Uses Gemini AI to create actionable learning paths
    based on interview performance and career goals.
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
    
    def _get_context_data(
        self,
        user_id: str,
        session_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Collect all relevant context for roadmap generation."""
        data = {
            "session": None,
            "report": None,
            "evaluations": [],
            "resume": None,
            "ats_analysis": None,
        }
        
        # Get interview session
        if session_id:
            session = self.db.query(LiveInterviewSession).filter(
                LiveInterviewSession.id == session_id,
                LiveInterviewSession.user_id == user_id,
            ).first()
            data["session"] = session
            
            # Get report
            report = self.db.query(InterviewReport).filter(
                InterviewReport.session_id == session_id,
                InterviewReport.user_id == user_id,
            ).first()
            data["report"] = report
            
            # Get evaluations
            evaluations = self.db.query(AnswerEvaluation).filter(
                AnswerEvaluation.session_id == session_id,
                AnswerEvaluation.user_id == user_id,
            ).all()
            data["evaluations"] = evaluations
        
        # Get latest resume
        resume = self.db.query(Resume).filter(
            Resume.user_id == user_id,
        ).order_by(Resume.uploaded_at.desc()).first()
        data["resume"] = resume
        
        # Get latest ATS analysis
        if resume:
            ats = self.db.query(ATSAnalysis).filter(
                ATSAnalysis.resume_id == resume.id,
                ATSAnalysis.user_id == user_id,
            ).order_by(ATSAnalysis.created_at.desc()).first()
            data["ats_analysis"] = ats
        
        return data
    
    # ===========================================
    # SKILL GAP ANALYSIS
    # ===========================================
    
    def _analyze_skill_gaps(
        self,
        report: Optional[InterviewReport],
        evaluations: List[AnswerEvaluation],
        ats: Optional[ATSAnalysis],
    ) -> Dict[str, Any]:
        """Analyze skill gaps from interview and ATS data."""
        gaps = []
        missing = []
        to_improve = []
        
        # From report weaknesses
        if report and report.weaknesses:
            for weakness in report.weaknesses:
                area = weakness.get("area", "")
                if area:
                    gaps.append({
                        "skill": area,
                        "current_level": "needs_work",
                        "target_level": "proficient",
                        "priority": "high",
                    })
                    to_improve.append(area)
        
        # From low evaluation scores
        low_scores = [e for e in evaluations if (e.deep_overall_score or 5) < 5]
        question_types = set()
        for e in low_scores:
            if e.question_type:
                question_types.add(e.question_type)
        
        for qtype in question_types:
            gaps.append({
                "skill": f"{qtype.replace('_', ' ').title()} Questions",
                "current_level": "basic",
                "target_level": "advanced",
                "priority": "medium",
            })
        
        # From ATS analysis
        if ats and ats.missing_keywords:
            for keyword in ats.missing_keywords[:5]:
                if keyword not in [g["skill"] for g in gaps]:
                    missing.append(keyword)
        
        return {
            "gaps": gaps[:7],  # Limit to 7
            "missing": missing[:5],
            "to_improve": to_improve[:5],
        }
    
    # ===========================================
    # MOCK ROADMAP GENERATION
    # ===========================================
    
    def _generate_mock_roadmap(
        self,
        target_role: str,
        skill_gaps: Dict[str, Any],
        readiness_score: int,
    ) -> Dict[str, Any]:
        """Generate mock roadmap without Gemini."""
        # Determine timeline based on readiness
        if readiness_score >= 80:
            total_weeks = 4
            level = "polishing"
        elif readiness_score >= 60:
            total_weeks = 8
            level = "improvement"
        elif readiness_score >= 40:
            total_weeks = 12
            level = "development"
        else:
            total_weeks = 16
            level = "foundation"
        
        # Generate learning topics
        topics = []
        order = 1
        
        gap_skills = [g["skill"] for g in skill_gaps.get("gaps", [])]
        for skill in gap_skills[:5]:
            topics.append({
                "topic": skill,
                "description": f"Master {skill} concepts and practical applications",
                "duration_weeks": 2,
                "resources": [
                    f"Online courses on {skill}",
                    f"Documentation and tutorials",
                    f"Practice projects",
                ],
                "order": order,
            })
            order += 1
        
        # Add default topics if needed
        if len(topics) < 3:
            default_topics = [
                ("Data Structures & Algorithms", "Core problem-solving skills"),
                ("System Design Basics", "Architecture and scalability"),
                ("Behavioral Interview Skills", "STAR method and communication"),
            ]
            for name, desc in default_topics:
                if name not in [t["topic"] for t in topics]:
                    topics.append({
                        "topic": name,
                        "description": desc,
                        "duration_weeks": 2,
                        "resources": ["Online courses", "Practice problems"],
                        "order": order,
                    })
                    order += 1
                    if len(topics) >= 5:
                        break
        
        # Generate projects
        projects = [
            {
                "title": f"{target_role} Portfolio Project",
                "description": f"Build a comprehensive project demonstrating your skills for {target_role}",
                "skills_covered": gap_skills[:3] or ["Programming", "Problem Solving"],
                "difficulty": "medium",
                "duration_weeks": 3,
            },
            {
                "title": "Open Source Contribution",
                "description": "Contribute to an open-source project related to your target role",
                "skills_covered": ["Collaboration", "Code Review", "Git"],
                "difficulty": "medium",
                "duration_weeks": 2,
            },
        ]
        
        # Generate phases
        phases = []
        if total_weeks >= 12:
            phases = [
                {"phase": 1, "name": "Foundation", "weeks": "1-4", "focus": ["Core concepts", "Basic practice"]},
                {"phase": 2, "name": "Development", "weeks": "5-8", "focus": ["Advanced topics", "Projects"]},
                {"phase": 3, "name": "Polishing", "weeks": "9-12", "focus": ["Mock interviews", "Portfolio"]},
            ]
        elif total_weeks >= 8:
            phases = [
                {"phase": 1, "name": "Strengthen", "weeks": "1-4", "focus": ["Fill gaps", "Practice"]},
                {"phase": 2, "name": "Polish", "weeks": "5-8", "focus": ["Mock interviews", "Refinement"]},
            ]
        else:
            phases = [
                {"phase": 1, "name": "Final Prep", "weeks": f"1-{total_weeks}", "focus": ["Mock interviews", "Review"]},
            ]
        
        # Generate milestones
        milestones = []
        for i, phase in enumerate(phases):
            week = int(phase["weeks"].split("-")[-1])
            milestones.append({
                "week": week,
                "milestone": f"Complete {phase['name']} phase",
                "deliverables": phase["focus"],
            })
        
        # Practice strategy
        practice = {
            "strategy": {
                "daily_routine": "1-2 hours of focused practice on weak areas",
                "weekly_goals": [
                    "Solve 5-10 practice problems",
                    "Complete one learning module",
                    "Review and reflect on progress",
                ],
                "mock_interview_frequency": "Weekly",
            },
            "interview_tips": [
                "Practice thinking out loud during problem-solving",
                "Prepare 3-4 strong examples for behavioral questions",
                "Research the company before each interview",
            ],
            "behavioral": [
                "Prepare STAR format stories for common scenarios",
                "Practice explaining your past projects clearly",
                "Work on concise, structured responses",
            ],
        }
        
        # Summary
        summary = {
            "executive": f"Based on your interview performance (score: {readiness_score}/100), "
                        f"you are at the {level} stage for {target_role}. "
                        f"This {total_weeks}-week roadmap focuses on addressing your skill gaps and "
                        f"building practical experience through targeted learning and projects.",
            "key_actions": [
                f"Focus on your top skill gap: {gap_skills[0] if gap_skills else 'core skills'}",
                "Complete at least one portfolio project",
                "Do weekly mock interviews",
                "Review and iterate based on feedback",
            ],
            "success_metrics": [
                "Pass 2 out of 3 mock interviews",
                "Complete the recommended projects",
                "Improve readiness score by 20+ points",
            ],
        }
        
        return {
            "learning_topics": topics,
            "recommended_courses": [
                "Online platform courses for your target skills",
                "Interview preparation bootcamp",
                "System design fundamentals",
            ],
            "books": [
                "Cracking the Coding Interview",
                "Role-specific technical books",
            ],
            "projects": projects,
            "portfolio": [
                "GitHub repository with clean, documented code",
                "Personal website or portfolio",
                "Technical blog posts",
            ],
            "practice": practice,
            "timeline": {
                "total_weeks": total_weeks,
                "phases": phases,
                "milestones": milestones,
            },
            "summary": summary,
            "source": "mock",
        }
    
    # ===========================================
    # GEMINI ROADMAP GENERATION
    # ===========================================
    
    async def _generate_with_gemini(
        self,
        target_role: str,
        current_level: str,
        skill_gaps: Dict[str, Any],
        report: Optional[InterviewReport],
        resume_skills: Optional[List[str]],
        readiness_score: int,
    ) -> Dict[str, Any]:
        """Generate roadmap using Gemini AI."""
        client = self._get_gemini_client()
        
        if not client:
            return self._generate_mock_roadmap(target_role, skill_gaps, readiness_score)
        
        try:
            # Build context
            strengths = []
            weaknesses = []
            
            if report:
                if report.strengths:
                    strengths = [s.get("area", "") for s in report.strengths]
                if report.weaknesses:
                    weaknesses = [w.get("area", "") for w in report.weaknesses]
            
            prompt = f"""Generate a personalized career roadmap for someone preparing for:
Target Role: {target_role}
Current Level: {current_level or "Not specified"}
Interview Readiness Score: {readiness_score}/100

Skill Gaps Identified:
{json.dumps(skill_gaps.get("gaps", []), indent=2)}

Known Strengths: {', '.join(strengths) if strengths else 'None identified'}
Known Weaknesses: {', '.join(weaknesses) if weaknesses else 'None identified'}
Existing Skills: {', '.join(resume_skills[:10]) if resume_skills else 'Not provided'}

Generate a structured, actionable roadmap in JSON format:
{{
    "total_weeks": <realistic number based on gap size>,
    "learning_topics": [
        {{"topic": "...", "description": "...", "duration_weeks": 2, "order": 1}}
    ],
    "recommended_projects": [
        {{"title": "...", "description": "...", "skills_covered": [...], "difficulty": "medium", "duration_weeks": 3}}
    ],
    "phases": [
        {{"phase": 1, "name": "...", "weeks": "1-4", "focus": [...]}}
    ],
    "milestones": [
        {{"week": 4, "milestone": "...", "deliverables": [...]}}
    ],
    "practice_strategy": {{
        "daily_routine": "...",
        "weekly_goals": [...],
        "mock_interview_frequency": "..."
    }},
    "interview_tips": ["..."],
    "executive_summary": "<2-3 sentence personalized summary>",
    "key_actions": ["<top 3-4 immediate actions>"],
    "success_metrics": ["<measurable success criteria>"]
}}

Make it:
1. Personalized based on the skill gaps
2. Actionable with clear steps
3. Realistic timeline
4. No external URLs required
5. Professional and encouraging tone"""

            start_time = time.time()
            response = client.generate_content(prompt)
            result_text = response.text
            response_time_ms = int((time.time() - start_time) * 1000)
            
            # Log successful Gemini API call
            try:
                AIAPILogService.log_ai_call(
                    db=self.db,
                    provider="gemini",
                    operation="generate_career_roadmap",
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
                    "learning_topics": parsed.get("learning_topics", []),
                    "recommended_courses": [
                        "Platform courses for target skills",
                        "Interview preparation courses",
                    ],
                    "books": ["Domain-specific technical books"],
                    "projects": parsed.get("recommended_projects", []),
                    "portfolio": ["GitHub portfolio", "Personal website"],
                    "practice": {
                        "strategy": parsed.get("practice_strategy", {}),
                        "interview_tips": parsed.get("interview_tips", []),
                        "behavioral": ["STAR method practice", "Common scenarios prep"],
                    },
                    "timeline": {
                        "total_weeks": parsed.get("total_weeks", 8),
                        "phases": parsed.get("phases", []),
                        "milestones": parsed.get("milestones", []),
                    },
                    "summary": {
                        "executive": parsed.get("executive_summary", ""),
                        "key_actions": parsed.get("key_actions", []),
                        "success_metrics": parsed.get("success_metrics", []),
                    },
                    "source": "gemini",
                }
                
        except Exception as e:
            print(f"Gemini roadmap generation error: {e}")
        
        return self._generate_mock_roadmap(target_role, skill_gaps, readiness_score)
    
    # ===========================================
    # PUBLIC API
    # ===========================================
    
    async def generate_roadmap(
        self,
        user_id: str,
        session_id: Optional[str] = None,
        target_role: Optional[str] = None,
        current_level: Optional[str] = None,
        target_level: Optional[str] = None,
    ) -> CareerRoadmap:
        """
        Generate personalized career roadmap.
        
        Based on interview performance, resume, and ATS analysis.
        """
        # Collect context
        context = self._get_context_data(user_id, session_id)
        
        session = context["session"]
        report = context["report"]
        evaluations = context["evaluations"]
        resume = context["resume"]
        ats = context["ats_analysis"]
        
        # Determine target role
        final_target_role = target_role or (session.target_role if session else None) or "Software Developer"
        
        # Get readiness score
        readiness_score = report.readiness_score if report else 50
        
        # Analyze skill gaps
        skill_gaps = self._analyze_skill_gaps(report, evaluations, ats)
        
        # Get resume skills
        resume_skills = []
        if resume and resume.parsed_data:
            resume_skills = resume.parsed_data.get("skills", [])
        
        # Generate roadmap content
        roadmap_data = await self._generate_with_gemini(
            target_role=final_target_role,
            current_level=current_level or "mid-level",
            skill_gaps=skill_gaps,
            report=report,
            resume_skills=resume_skills,
            readiness_score=readiness_score,
        )
        
        # Deactivate previous roadmaps for this session
        if session_id:
            self.db.query(CareerRoadmap).filter(
                CareerRoadmap.session_id == session_id,
                CareerRoadmap.user_id == user_id,
                CareerRoadmap.is_active == True,
            ).update({"is_active": False})
        
        # Get next version number
        version = 1
        if session_id:
            max_version = self.db.query(CareerRoadmap).filter(
                CareerRoadmap.session_id == session_id,
                CareerRoadmap.user_id == user_id,
            ).count()
            version = max_version + 1
        
        # Create roadmap
        roadmap = CareerRoadmap(
            user_id=user_id,
            session_id=session_id,
            report_id=report.id if report else None,
            version=version,
            is_active=True,
            target_role=final_target_role,
            current_level=current_level,
            target_level=target_level,
            readiness_score=readiness_score,
            skill_gaps=skill_gaps.get("gaps", []),
            missing_skills=skill_gaps.get("missing", []),
            skills_to_improve=skill_gaps.get("to_improve", []),
            learning_topics=roadmap_data.get("learning_topics", []),
            recommended_courses=roadmap_data.get("recommended_courses", []),
            books_to_read=roadmap_data.get("books", []),
            recommended_projects=roadmap_data.get("projects", []),
            portfolio_suggestions=roadmap_data.get("portfolio", []),
            practice_strategy=roadmap_data.get("practice", {}).get("strategy", {}),
            interview_tips=roadmap_data.get("practice", {}).get("interview_tips", []),
            behavioral_practice=roadmap_data.get("practice", {}).get("behavioral", []),
            total_duration_weeks=roadmap_data.get("timeline", {}).get("total_weeks"),
            phases=roadmap_data.get("timeline", {}).get("phases", []),
            milestones=roadmap_data.get("timeline", {}).get("milestones", []),
            executive_summary=roadmap_data.get("summary", {}).get("executive"),
            key_actions=roadmap_data.get("summary", {}).get("key_actions", []),
            success_metrics=roadmap_data.get("summary", {}).get("success_metrics", []),
            generation_source=roadmap_data.get("source", "mock"),
        )
        
        self.db.add(roadmap)
        self.db.commit()
        self.db.refresh(roadmap)
        
        return roadmap
    
    def get_roadmap(
        self,
        session_id: str,
        user_id: str,
    ) -> Optional[CareerRoadmap]:
        """Get active roadmap for session."""
        return self.db.query(CareerRoadmap).filter(
            CareerRoadmap.session_id == session_id,
            CareerRoadmap.user_id == user_id,
            CareerRoadmap.is_active == True,
        ).first()
    
    def get_roadmap_by_id(
        self,
        roadmap_id: str,
        user_id: str,
    ) -> Optional[CareerRoadmap]:
        """Get roadmap by ID."""
        return self.db.query(CareerRoadmap).filter(
            CareerRoadmap.id == roadmap_id,
            CareerRoadmap.user_id == user_id,
        ).first()
    
    def get_user_roadmaps(
        self,
        user_id: str,
        limit: int = 10,
    ) -> List[CareerRoadmap]:
        """Get user's roadmaps."""
        return self.db.query(CareerRoadmap).filter(
            CareerRoadmap.user_id == user_id,
        ).order_by(CareerRoadmap.generated_at.desc()).limit(limit).all()


def get_roadmap_service(db: Session) -> RoadmapService:
    """Get roadmap service instance."""
    return RoadmapService(db)
