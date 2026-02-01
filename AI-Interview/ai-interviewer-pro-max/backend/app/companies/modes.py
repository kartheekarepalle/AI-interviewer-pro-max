"""
Company Interview Modes

Defines company-specific interview profiles that influence:
- Question types and difficulty
- Interview focus areas
- Behavioral vs technical weight
- System design emphasis

These are SIMULATED patterns based on general industry knowledge.
No real company data or secrets are used.
"""

from typing import Dict, List, Optional
from dataclasses import dataclass, field, asdict
from enum import Enum


class CompanyType(str, Enum):
    """Company type enumeration."""
    FAANG = "faang"
    STARTUP = "startup"
    SERVICE = "service"
    PRODUCT = "product"
    CUSTOM = "custom"


@dataclass
class DifficultyBias:
    """Difficulty level distribution bias."""
    easy: float = 0.2
    medium: float = 0.5
    hard: float = 0.3
    
    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class QuestionMix:
    """Question type mix percentages."""
    technical: float = 0.40
    behavioral: float = 0.20
    situational: float = 0.15
    system_design: float = 0.15
    coding: float = 0.10
    
    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class InterviewPhase:
    """Interview phase configuration."""
    name: str
    duration_minutes: int
    focus: List[str]
    question_count: int
    
    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "duration_minutes": self.duration_minutes,
            "focus": self.focus,
            "question_count": self.question_count,
        }


@dataclass
class CompanyProfile:
    """
    Company interview profile.
    
    Defines how interviews are structured for this company type.
    These are SIMULATED patterns, not real company data.
    """
    
    id: str
    name: str
    type: CompanyType
    description: str
    
    # Interview characteristics
    focus_areas: List[str]
    key_traits: List[str]
    interview_style: str
    
    # Question configuration
    difficulty_bias: DifficultyBias
    question_mix: QuestionMix
    
    # Phases
    phases: List[InterviewPhase]
    total_questions: int
    estimated_duration_minutes: int
    
    # Behavioral emphasis
    behavioral_weight: float  # 0-1, how much behavioral matters
    technical_depth: str  # shallow, medium, deep
    
    # Special focus
    system_design_required: bool
    coding_round_required: bool
    culture_fit_emphasis: bool
    
    # Persona hints
    interviewer_style: str  # friendly, neutral, challenging
    follow_up_likelihood: float  # 0-1, likelihood of follow-ups
    
    # Disclaimer
    disclaimer: str = "This is a simulated interview pattern based on general industry knowledge. It does not represent actual company interview processes."
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type.value,
            "description": self.description,
            "focus_areas": self.focus_areas,
            "key_traits": self.key_traits,
            "interview_style": self.interview_style,
            "difficulty_bias": self.difficulty_bias.to_dict(),
            "question_mix": self.question_mix.to_dict(),
            "phases": [p.to_dict() for p in self.phases],
            "total_questions": self.total_questions,
            "estimated_duration_minutes": self.estimated_duration_minutes,
            "behavioral_weight": self.behavioral_weight,
            "technical_depth": self.technical_depth,
            "system_design_required": self.system_design_required,
            "coding_round_required": self.coding_round_required,
            "culture_fit_emphasis": self.culture_fit_emphasis,
            "interviewer_style": self.interviewer_style,
            "follow_up_likelihood": self.follow_up_likelihood,
            "disclaimer": self.disclaimer,
        }


# ===========================================
# PREDEFINED COMPANY PROFILES
# ===========================================


FAANG_PROFILE = CompanyProfile(
    id="faang",
    name="FAANG-Style",
    type=CompanyType.FAANG,
    description="High-intensity technical interviews with emphasis on algorithms, system design, and leadership principles. Simulates interviews at major tech companies.",
    
    focus_areas=[
        "Data Structures & Algorithms",
        "System Design",
        "Scalability",
        "Leadership Principles",
        "Problem Solving",
    ],
    
    key_traits=[
        "Strong analytical thinking",
        "Ability to optimize solutions",
        "Clear communication under pressure",
        "Ownership and initiative",
    ],
    
    interview_style="structured_rigorous",
    
    difficulty_bias=DifficultyBias(
        easy=0.10,
        medium=0.40,
        hard=0.50,
    ),
    
    question_mix=QuestionMix(
        technical=0.35,
        behavioral=0.20,
        situational=0.10,
        system_design=0.20,
        coding=0.15,
    ),
    
    phases=[
        InterviewPhase("Initial Screening", 15, ["Basic technical", "Resume walkthrough"], 3),
        InterviewPhase("Coding Round", 25, ["Algorithms", "Problem solving", "Code quality"], 4),
        InterviewPhase("System Design", 20, ["Architecture", "Scalability", "Trade-offs"], 3),
        InterviewPhase("Behavioral", 15, ["Leadership", "Conflict resolution", "Achievements"], 4),
    ],
    
    total_questions=14,
    estimated_duration_minutes=75,
    
    behavioral_weight=0.30,
    technical_depth="deep",
    
    system_design_required=True,
    coding_round_required=True,
    culture_fit_emphasis=True,
    
    interviewer_style="challenging",
    follow_up_likelihood=0.80,
)


STARTUP_PROFILE = CompanyProfile(
    id="startup",
    name="Startup-Style",
    type=CompanyType.STARTUP,
    description="Fast-paced, practical interviews focused on versatility, ownership, and ability to ship products quickly. Simulates interviews at fast-growing startups.",
    
    focus_areas=[
        "Full-stack capabilities",
        "Product thinking",
        "Adaptability",
        "Speed of execution",
        "Ownership mindset",
    ],
    
    key_traits=[
        "Comfortable with ambiguity",
        "Quick learner",
        "End-to-end ownership",
        "Scrappy problem solver",
    ],
    
    interview_style="practical_conversational",
    
    difficulty_bias=DifficultyBias(
        easy=0.20,
        medium=0.50,
        hard=0.30,
    ),
    
    question_mix=QuestionMix(
        technical=0.35,
        behavioral=0.25,
        situational=0.20,
        system_design=0.10,
        coding=0.10,
    ),
    
    phases=[
        InterviewPhase("Culture Fit", 15, ["Motivation", "Startup mindset", "Ownership"], 4),
        InterviewPhase("Technical Discussion", 25, ["Past projects", "Problem solving", "Tech choices"], 5),
        InterviewPhase("Hands-On", 15, ["Practical coding", "Debugging", "Quick thinking"], 3),
    ],
    
    total_questions=12,
    estimated_duration_minutes=55,
    
    behavioral_weight=0.40,
    technical_depth="medium",
    
    system_design_required=False,
    coding_round_required=True,
    culture_fit_emphasis=True,
    
    interviewer_style="friendly",
    follow_up_likelihood=0.70,
)


SERVICE_PROFILE = CompanyProfile(
    id="service",
    name="Service Company-Style",
    type=CompanyType.SERVICE,
    description="Standardized interviews focusing on fundamentals, communication skills, and client-facing abilities. Simulates interviews at IT consulting and service companies.",
    
    focus_areas=[
        "Core fundamentals",
        "Communication skills",
        "Client handling",
        "Process adherence",
        "Team collaboration",
    ],
    
    key_traits=[
        "Strong fundamentals",
        "Good communication",
        "Process oriented",
        "Team player",
    ],
    
    interview_style="structured_standard",
    
    difficulty_bias=DifficultyBias(
        easy=0.30,
        medium=0.50,
        hard=0.20,
    ),
    
    question_mix=QuestionMix(
        technical=0.40,
        behavioral=0.25,
        situational=0.20,
        system_design=0.05,
        coding=0.10,
    ),
    
    phases=[
        InterviewPhase("HR Screening", 10, ["Background", "Communication", "Expectations"], 3),
        InterviewPhase("Technical Round", 30, ["Core concepts", "Language fundamentals", "Projects"], 6),
        InterviewPhase("Manager Round", 15, ["Team fit", "Client scenarios", "Goal alignment"], 4),
    ],
    
    total_questions=13,
    estimated_duration_minutes=55,
    
    behavioral_weight=0.35,
    technical_depth="medium",
    
    system_design_required=False,
    coding_round_required=True,
    culture_fit_emphasis=False,
    
    interviewer_style="neutral",
    follow_up_likelihood=0.50,
)


PRODUCT_PROFILE = CompanyProfile(
    id="product",
    name="Product Company-Style",
    type=CompanyType.PRODUCT,
    description="Balanced interviews with emphasis on product thinking, user empathy, and technical excellence. Simulates interviews at mid-size product companies.",
    
    focus_areas=[
        "Product thinking",
        "User empathy",
        "Technical depth",
        "Collaboration",
        "Impact orientation",
    ],
    
    key_traits=[
        "User-centric mindset",
        "Strong technical skills",
        "Data-driven decisions",
        "Impact focused",
    ],
    
    interview_style="balanced_thoughtful",
    
    difficulty_bias=DifficultyBias(
        easy=0.15,
        medium=0.55,
        hard=0.30,
    ),
    
    question_mix=QuestionMix(
        technical=0.35,
        behavioral=0.20,
        situational=0.20,
        system_design=0.15,
        coding=0.10,
    ),
    
    phases=[
        InterviewPhase("Initial Chat", 10, ["Background", "Motivation", "Product interest"], 3),
        InterviewPhase("Technical Deep Dive", 25, ["Past work", "Technical decisions", "Problem solving"], 5),
        InterviewPhase("Product Thinking", 15, ["Feature design", "User scenarios", "Trade-offs"], 3),
        InterviewPhase("Culture", 10, ["Values", "Collaboration", "Learning mindset"], 3),
    ],
    
    total_questions=14,
    estimated_duration_minutes=60,
    
    behavioral_weight=0.30,
    technical_depth="medium",
    
    system_design_required=True,
    coding_round_required=True,
    culture_fit_emphasis=True,
    
    interviewer_style="friendly",
    follow_up_likelihood=0.65,
)


CUSTOM_PROFILE = CompanyProfile(
    id="custom",
    name="Custom Mode",
    type=CompanyType.CUSTOM,
    description="Balanced interview format that you can customize. Suitable for general interview preparation.",
    
    focus_areas=[
        "General technical skills",
        "Problem solving",
        "Communication",
        "Team collaboration",
    ],
    
    key_traits=[
        "Well-rounded candidate",
        "Good communicator",
        "Solid fundamentals",
        "Eager to learn",
    ],
    
    interview_style="balanced",
    
    difficulty_bias=DifficultyBias(
        easy=0.25,
        medium=0.50,
        hard=0.25,
    ),
    
    question_mix=QuestionMix(
        technical=0.35,
        behavioral=0.25,
        situational=0.20,
        system_design=0.10,
        coding=0.10,
    ),
    
    phases=[
        InterviewPhase("Introduction", 10, ["Background", "Goals"], 2),
        InterviewPhase("Technical", 25, ["Skills", "Experience", "Problem solving"], 5),
        InterviewPhase("Behavioral", 15, ["Situations", "Achievements"], 4),
        InterviewPhase("Wrap-up", 5, ["Questions", "Next steps"], 1),
    ],
    
    total_questions=12,
    estimated_duration_minutes=55,
    
    behavioral_weight=0.30,
    technical_depth="medium",
    
    system_design_required=False,
    coding_round_required=False,
    culture_fit_emphasis=False,
    
    interviewer_style="neutral",
    follow_up_likelihood=0.50,
)


# ===========================================
# PROFILE REGISTRY
# ===========================================


COMPANY_PROFILES: Dict[str, CompanyProfile] = {
    "faang": FAANG_PROFILE,
    "startup": STARTUP_PROFILE,
    "service": SERVICE_PROFILE,
    "product": PRODUCT_PROFILE,
    "custom": CUSTOM_PROFILE,
}


def get_company_profile(company_id: str) -> Optional[CompanyProfile]:
    """Get company profile by ID."""
    return COMPANY_PROFILES.get(company_id.lower())


def get_all_profiles() -> List[CompanyProfile]:
    """Get all available company profiles."""
    return list(COMPANY_PROFILES.values())


def get_profile_summary(profile: CompanyProfile) -> dict:
    """Get summary of a profile for list display."""
    return {
        "id": profile.id,
        "name": profile.name,
        "type": profile.type.value,
        "description": profile.description,
        "focus_areas": profile.focus_areas[:3],
        "difficulty": "high" if profile.difficulty_bias.hard >= 0.4 else ("medium" if profile.difficulty_bias.medium >= 0.4 else "low"),
        "total_questions": profile.total_questions,
        "duration_minutes": profile.estimated_duration_minutes,
        "interview_style": profile.interview_style,
    }
