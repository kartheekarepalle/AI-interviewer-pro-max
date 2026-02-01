"""
ATS Analysis Service - Role-Conditioned Scoring

Business logic for ATS scoring and resume analysis.
Uses Gemini API when configured, falls back to mock responses otherwise.

CRITICAL: All scoring is STRICTLY conditioned on target_role.
- Skills not relevant to target_role do NOT boost score
- Each role has its own skill taxonomy
- Scores are computed ONLY from role-relevant signals
"""

import time
import json
import hashlib
import re
from typing import Dict, Any, List, Optional, Set
from sqlalchemy.orm import Session

from app.core.config import settings
from app.ats.models import ATSAnalysis
from app.resumes.models import Resume
from app.admin.service import AIAPILogService


# ===========================================
# ROLE-SPECIFIC SKILL TAXONOMY
# ===========================================
# Each role has primary skills (high weight), secondary skills (medium weight),
# and explicitly excluded skills (for irrelevant domains)

ROLE_SKILL_TAXONOMY: Dict[str, Dict] = {
    "frontend engineer": {
        "primary": [
            "html", "css", "javascript", "typescript", "react", "vue", "angular",
            "next.js", "nextjs", "redux", "webpack", "vite", "sass", "tailwind",
            "responsive design", "accessibility", "a11y", "wcag", "ui/ux",
            "browser apis", "dom", "web performance", "css grid", "flexbox",
            "figma", "design systems", "component", "storybook", "jest", "cypress",
        ],
        "secondary": [
            "node.js", "nodejs", "graphql", "rest api", "git", "npm", "yarn",
            "agile", "scrum", "testing", "unit test", "integration test",
            "performance", "seo", "pwa", "web components", "babel",
        ],
        "exclude": [
            "pytorch", "tensorflow", "keras", "machine learning", "deep learning",
            "nlp", "computer vision", "neural network", "data science", "spark",
            "hadoop", "cuda", "ml ops", "model training", "embeddings",
        ],
        "keywords": [
            "frontend", "front-end", "front end", "ui", "user interface",
            "web application", "spa", "single page application", "responsive",
        ],
    },
    "frontend developer": {
        # Alias for frontend engineer
        "primary": [
            "html", "css", "javascript", "typescript", "react", "vue", "angular",
            "next.js", "nextjs", "redux", "webpack", "vite", "sass", "tailwind",
            "responsive design", "accessibility", "a11y", "wcag", "ui/ux",
            "browser apis", "dom", "web performance", "css grid", "flexbox",
            "figma", "design systems", "component", "storybook", "jest", "cypress",
        ],
        "secondary": [
            "node.js", "nodejs", "graphql", "rest api", "git", "npm", "yarn",
            "agile", "scrum", "testing", "unit test", "integration test",
        ],
        "exclude": [
            "pytorch", "tensorflow", "keras", "machine learning", "deep learning",
            "nlp", "computer vision", "neural network", "data science",
        ],
        "keywords": [
            "frontend", "front-end", "front end", "ui", "user interface",
            "web application", "spa", "single page application", "responsive",
        ],
    },
    "backend engineer": {
        "primary": [
            "python", "java", "golang", "go", "rust", "c#", "node.js", "nodejs",
            "sql", "postgresql", "mysql", "mongodb", "redis", "database",
            "api", "rest", "graphql", "microservices", "system design",
            "authentication", "auth", "oauth", "jwt", "security",
            "docker", "kubernetes", "k8s", "aws", "gcp", "azure", "cloud",
            "scalability", "distributed systems", "message queue", "kafka", "rabbitmq",
        ],
        "secondary": [
            "linux", "bash", "devops", "ci/cd", "jenkins", "terraform",
            "git", "agile", "testing", "unit test", "integration test",
            "caching", "load balancing", "nginx", "elasticsearch",
        ],
        "exclude": [
            "react", "vue", "angular", "css", "html", "frontend", "ui/ux",
            "figma", "design", "responsive design", "accessibility",
        ],
        "keywords": [
            "backend", "back-end", "back end", "server", "api", "microservice",
            "database", "scalability", "distributed", "infrastructure",
        ],
    },
    "backend developer": {
        # Alias for backend engineer
        "primary": [
            "python", "java", "golang", "go", "rust", "c#", "node.js", "nodejs",
            "sql", "postgresql", "mysql", "mongodb", "redis", "database",
            "api", "rest", "graphql", "microservices", "system design",
            "authentication", "auth", "oauth", "jwt", "security",
            "docker", "kubernetes", "k8s", "aws", "gcp", "azure", "cloud",
        ],
        "secondary": [
            "linux", "bash", "devops", "ci/cd", "jenkins", "terraform",
            "git", "agile", "testing", "caching", "load balancing",
        ],
        "exclude": [
            "react", "vue", "angular", "css", "html", "frontend", "ui/ux",
        ],
        "keywords": [
            "backend", "back-end", "back end", "server", "api", "microservice",
        ],
    },
    "full stack developer": {
        "primary": [
            "javascript", "typescript", "react", "vue", "angular", "node.js", "nodejs",
            "python", "java", "sql", "postgresql", "mongodb", "html", "css",
            "api", "rest", "graphql", "docker", "aws", "cloud",
        ],
        "secondary": [
            "git", "agile", "scrum", "testing", "ci/cd", "devops",
            "responsive design", "database", "caching", "security",
        ],
        "exclude": [
            "pytorch", "tensorflow", "machine learning", "deep learning",
            "data science", "ml ops",
        ],
        "keywords": [
            "full stack", "fullstack", "full-stack", "web development",
            "frontend", "backend", "end-to-end",
        ],
    },
    "full stack engineer": {
        # Alias for full stack developer
        "primary": [
            "javascript", "typescript", "react", "vue", "angular", "node.js", "nodejs",
            "python", "java", "sql", "postgresql", "mongodb", "html", "css",
            "api", "rest", "graphql", "docker", "aws", "cloud",
        ],
        "secondary": [
            "git", "agile", "scrum", "testing", "ci/cd", "devops",
            "responsive design", "database", "caching", "security",
        ],
        "exclude": [
            "pytorch", "tensorflow", "machine learning", "deep learning",
        ],
        "keywords": [
            "full stack", "fullstack", "full-stack", "web development",
        ],
    },
    "ai engineer": {
        "primary": [
            "python", "machine learning", "deep learning", "pytorch", "tensorflow",
            "keras", "nlp", "natural language processing", "computer vision",
            "neural network", "transformers", "hugging face", "llm", "gpt",
            "model training", "fine-tuning", "prompt engineering", "rag",
            "embeddings", "vector database", "langchain", "openai",
        ],
        "secondary": [
            "data science", "pandas", "numpy", "scikit-learn", "jupyter",
            "docker", "kubernetes", "aws", "gcp", "ml ops", "mlflow",
            "cuda", "gpu", "distributed training", "model optimization",
        ],
        "exclude": [
            "html", "css", "react", "vue", "angular", "frontend", "ui/ux",
            "responsive design", "figma", "design systems",
        ],
        "keywords": [
            "ai", "artificial intelligence", "machine learning", "ml", "deep learning",
            "neural network", "model", "training", "inference",
        ],
    },
    "ml engineer": {
        # Alias for AI engineer
        "primary": [
            "python", "machine learning", "deep learning", "pytorch", "tensorflow",
            "keras", "nlp", "computer vision", "neural network", "transformers",
            "model training", "fine-tuning", "embeddings", "scikit-learn",
            "feature engineering", "model evaluation", "hyperparameter tuning",
        ],
        "secondary": [
            "data science", "pandas", "numpy", "spark", "jupyter",
            "docker", "kubernetes", "aws", "gcp", "ml ops", "mlflow",
            "cuda", "gpu", "a/b testing", "statistics",
        ],
        "exclude": [
            "html", "css", "react", "vue", "angular", "frontend", "ui/ux",
        ],
        "keywords": [
            "machine learning", "ml", "deep learning", "model", "training",
        ],
    },
    "data scientist": {
        "primary": [
            "python", "r", "statistics", "machine learning", "data analysis",
            "pandas", "numpy", "scikit-learn", "sql", "visualization",
            "matplotlib", "seaborn", "tableau", "power bi", "jupyter",
            "hypothesis testing", "regression", "classification", "clustering",
            "feature engineering", "a/b testing", "experimentation",
        ],
        "secondary": [
            "deep learning", "pytorch", "tensorflow", "nlp", "computer vision",
            "spark", "hadoop", "big data", "aws", "gcp", "data engineering",
            "etl", "data pipeline", "data warehouse",
        ],
        "exclude": [
            "html", "css", "react", "vue", "angular", "frontend", "ui/ux",
            "responsive design", "figma",
        ],
        "keywords": [
            "data science", "analytics", "insights", "prediction", "modeling",
            "statistics", "analysis", "visualization",
        ],
    },
    "devops engineer": {
        "primary": [
            "docker", "kubernetes", "k8s", "aws", "azure", "gcp", "cloud",
            "ci/cd", "jenkins", "github actions", "gitlab ci", "terraform",
            "ansible", "linux", "bash", "shell scripting", "infrastructure",
            "monitoring", "prometheus", "grafana", "logging", "elk",
            "infrastructure as code", "iac", "helm", "argocd",
        ],
        "secondary": [
            "python", "golang", "go", "security", "networking", "load balancing",
            "nginx", "haproxy", "dns", "ssl/tls", "microservices",
            "message queue", "kafka", "rabbitmq", "incident response",
        ],
        "exclude": [
            "react", "vue", "angular", "html", "css", "frontend", "ui/ux",
            "figma", "design", "pytorch", "tensorflow", "machine learning",
        ],
        "keywords": [
            "devops", "infrastructure", "deployment", "automation", "cloud",
            "ci/cd", "containerization", "orchestration",
        ],
    },
    "product manager": {
        "primary": [
            "product management", "product strategy", "roadmap", "prioritization",
            "user research", "user stories", "requirements", "stakeholder",
            "agile", "scrum", "jira", "confluence", "sprint planning",
            "a/b testing", "analytics", "metrics", "kpis", "okrs",
            "customer discovery", "market research", "competitive analysis",
        ],
        "secondary": [
            "data analysis", "sql", "excel", "figma", "wireframing",
            "presentation", "communication", "leadership", "cross-functional",
            "go-to-market", "gtm", "pricing", "business model",
        ],
        "exclude": [
            "pytorch", "tensorflow", "machine learning", "deep learning",
            "react", "vue", "angular", "coding", "programming",
        ],
        "keywords": [
            "product", "strategy", "roadmap", "user", "customer", "market",
            "feature", "release", "launch",
        ],
    },
    "software engineer": {
        "primary": [
            "programming", "python", "java", "javascript", "typescript", "c++",
            "golang", "go", "rust", "algorithms", "data structures",
            "software development", "system design", "code review",
            "git", "testing", "debugging", "problem solving",
        ],
        "secondary": [
            "docker", "kubernetes", "aws", "cloud", "database", "sql",
            "api", "rest", "microservices", "agile", "scrum",
            "ci/cd", "linux", "web development",
        ],
        "exclude": [],  # General role - no exclusions
        "keywords": [
            "software", "engineer", "developer", "programming", "code",
            "application", "development",
        ],
    },
    "ui/ux designer": {
        "primary": [
            "figma", "sketch", "adobe xd", "design", "ui design", "ux design",
            "user research", "wireframing", "prototyping", "user testing",
            "usability", "accessibility", "design systems", "typography",
            "color theory", "visual design", "interaction design",
        ],
        "secondary": [
            "html", "css", "responsive design", "animation", "motion design",
            "photoshop", "illustrator", "user journey", "persona",
            "a/b testing", "analytics", "agile",
        ],
        "exclude": [
            "pytorch", "tensorflow", "machine learning", "deep learning",
            "python programming", "java", "backend", "database",
        ],
        "keywords": [
            "design", "ui", "ux", "user experience", "user interface",
            "visual", "prototype", "wireframe",
        ],
    },
}

# Default taxonomy for unrecognized roles
DEFAULT_ROLE_TAXONOMY = {
    "primary": [
        "experience", "skills", "project", "team", "results", "communication",
        "problem solving", "analytical", "leadership",
    ],
    "secondary": [
        "collaboration", "agile", "management", "technical", "professional",
    ],
    "exclude": [],
    "keywords": [],
}


class ATSService:
    """
    Service class for ATS analysis operations.
    
    CRITICAL: All scoring is STRICTLY role-conditioned.
    Skills not relevant to target_role do NOT boost scores.
    """
    
    def __init__(self, db: Session):
        """Initialize ATS service with database session."""
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
    
    def _get_role_taxonomy(self, target_role: str) -> Dict[str, Any]:
        """
        Get the skill taxonomy for a given role.
        Uses fuzzy matching for flexibility.
        """
        role_lower = target_role.lower().strip()
        
        # Direct match
        if role_lower in ROLE_SKILL_TAXONOMY:
            return ROLE_SKILL_TAXONOMY[role_lower]
        
        # Fuzzy match
        for role_name, taxonomy in ROLE_SKILL_TAXONOMY.items():
            if role_name in role_lower or role_lower in role_name:
                return taxonomy
        
        # Check keywords
        for role_name, taxonomy in ROLE_SKILL_TAXONOMY.items():
            for keyword in taxonomy.get("keywords", []):
                if keyword in role_lower:
                    return taxonomy
        
        return DEFAULT_ROLE_TAXONOMY
    
    def _extract_all_skills(self, resume_text: str) -> Set[str]:
        """Extract all possible skills from resume text."""
        text_lower = resume_text.lower()
        
        # Comprehensive skill list
        all_skills = set()
        
        # Technical skills
        technical_skills = [
            "python", "javascript", "typescript", "java", "c++", "c#", "golang", "go",
            "rust", "ruby", "php", "swift", "kotlin", "scala", "r",
            "html", "css", "sass", "less", "tailwind", "bootstrap",
            "react", "vue", "angular", "next.js", "nextjs", "nuxt", "svelte",
            "node.js", "nodejs", "express", "fastapi", "django", "flask", "spring",
            "sql", "postgresql", "mysql", "mongodb", "redis", "elasticsearch",
            "docker", "kubernetes", "k8s", "aws", "azure", "gcp", "cloud",
            "git", "github", "gitlab", "bitbucket", "ci/cd", "jenkins",
            "terraform", "ansible", "helm", "argocd",
            "linux", "bash", "shell", "powershell",
            "api", "rest", "graphql", "grpc", "websocket",
            "microservices", "monolith", "serverless", "lambda",
            "pytorch", "tensorflow", "keras", "scikit-learn", "pandas", "numpy",
            "machine learning", "deep learning", "nlp", "computer vision",
            "neural network", "transformers", "hugging face", "llm",
            "data science", "data analysis", "statistics", "visualization",
            "agile", "scrum", "kanban", "jira", "confluence",
            "figma", "sketch", "adobe xd", "photoshop", "illustrator",
            "responsive design", "accessibility", "wcag", "a11y",
            "webpack", "vite", "babel", "rollup", "parcel",
            "jest", "mocha", "cypress", "selenium", "testing",
            "nginx", "apache", "load balancing", "caching",
            "kafka", "rabbitmq", "redis", "message queue",
            "oauth", "jwt", "authentication", "security",
        ]
        
        for skill in technical_skills:
            if skill in text_lower:
                all_skills.add(skill)
        
        return all_skills
    
    def _categorize_skills_for_role(
        self, 
        all_skills: Set[str], 
        taxonomy: Dict[str, Any]
    ) -> Dict[str, List[str]]:
        """
        Categorize extracted skills based on role taxonomy.
        
        Returns:
            - relevant: Primary + secondary skills (boost score)
            - irrelevant: Skills in exclude list (penalize slightly)
            - neutral: Other skills (no impact)
        """
        primary_set = set(taxonomy.get("primary", []))
        secondary_set = set(taxonomy.get("secondary", []))
        exclude_set = set(taxonomy.get("exclude", []))
        
        relevant_primary = []
        relevant_secondary = []
        irrelevant = []
        neutral = []
        
        for skill in all_skills:
            skill_lower = skill.lower()
            
            if skill_lower in primary_set or any(p in skill_lower for p in primary_set):
                relevant_primary.append(skill)
            elif skill_lower in secondary_set or any(s in skill_lower for s in secondary_set):
                relevant_secondary.append(skill)
            elif skill_lower in exclude_set or any(e in skill_lower for e in exclude_set):
                irrelevant.append(skill)
            else:
                neutral.append(skill)
        
        return {
            "relevant_primary": relevant_primary,
            "relevant_secondary": relevant_secondary,
            "irrelevant": irrelevant,
            "neutral": neutral,
        }
    
    # ===========================================
    # ROLE-CONDITIONED SCORING
    # ===========================================
    
    def _generate_role_conditioned_analysis(
        self, 
        resume_text: str, 
        target_role: str
    ) -> Dict[str, Any]:
        """
        Generate ATS analysis STRICTLY conditioned on target_role.
        
        CRITICAL: Skills NOT relevant to target_role do NOT boost scores.
        Irrelevant domain skills may PENALIZE the score.
        """
        taxonomy = self._get_role_taxonomy(target_role)
        
        # Extract and categorize skills
        all_skills = self._extract_all_skills(resume_text)
        categorized = self._categorize_skills_for_role(all_skills, taxonomy)
        
        relevant_primary = categorized["relevant_primary"]
        relevant_secondary = categorized["relevant_secondary"]
        irrelevant = categorized["irrelevant"]
        
        total_relevant = len(relevant_primary) + len(relevant_secondary)
        total_irrelevant = len(irrelevant)
        
        # ===========================================
        # ROLE-CONDITIONED SCORE CALCULATION
        # ===========================================
        
        # Base scores - computed ONLY from role-relevant signals
        
        # 1. Skills Coverage Score (based on role-relevant skills only)
        primary_coverage = min(1.0, len(relevant_primary) / max(len(taxonomy.get("primary", [])), 1))
        secondary_coverage = min(1.0, len(relevant_secondary) / max(len(taxonomy.get("secondary", [])), 8))
        
        skills_score = int(50 + (primary_coverage * 35) + (secondary_coverage * 15))
        
        # Penalize if too many irrelevant skills dominate
        if total_relevant > 0:
            irrelevance_ratio = total_irrelevant / (total_relevant + total_irrelevant)
            if irrelevance_ratio > 0.5:
                skills_score = int(skills_score * 0.7)  # 30% penalty
            elif irrelevance_ratio > 0.3:
                skills_score = int(skills_score * 0.85)  # 15% penalty
        elif total_irrelevant > 0:
            # No relevant skills but has irrelevant ones
            skills_score = max(30, skills_score - 30)
        
        skills_score = max(20, min(100, skills_score))
        
        # 2. Keyword Match Score (based on role keywords in text)
        role_keywords = taxonomy.get("keywords", [])
        text_lower = resume_text.lower()
        
        matched_keywords = []
        for kw in role_keywords:
            if kw in text_lower:
                matched_keywords.append(kw)
        
        # Also check primary skills as keywords
        for skill in taxonomy.get("primary", [])[:10]:
            if skill in text_lower and skill not in matched_keywords:
                matched_keywords.append(skill)
        
        keyword_match_ratio = min(1.0, len(matched_keywords) / max(8, len(role_keywords)))
        keyword_score = int(40 + (keyword_match_ratio * 60))
        
        # 3. Experience Alignment Score
        # Check for experience indicators relevant to role
        experience_indicators = [
            "years experience", "year experience", "years of experience",
            "senior", "lead", "principal", "manager", "director",
            "project", "developed", "implemented", "designed", "built",
            "managed", "led", "mentored", "architected",
        ]
        
        exp_matches = sum(1 for ind in experience_indicators if ind in text_lower)
        experience_score = int(50 + min(exp_matches * 5, 50))
        
        # Boost if role-specific experience terms found
        role_exp_boost = 0
        for kw in matched_keywords[:5]:
            if kw in text_lower:
                role_exp_boost += 3
        experience_score = min(100, experience_score + role_exp_boost)
        
        # 4. Education Score (role-neutral for now)
        education_keywords = ["degree", "bachelor", "master", "phd", "university", "college", "certification"]
        edu_matches = sum(1 for ed in education_keywords if ed in text_lower)
        education_score = int(50 + min(edu_matches * 10, 50))
        
        # 5. Format Score (role-neutral)
        # Check for structured content
        format_indicators = [
            "•", "-", "*",  # Bullet points
            "\n\n",  # Paragraph breaks
        ]
        format_matches = sum(1 for fi in format_indicators if fi in resume_text)
        format_score = min(100, 60 + format_matches * 5)
        
        # ===========================================
        # OVERALL SCORE (Weighted by role relevance)
        # ===========================================
        
        overall_score = int(
            skills_score * 0.35 +
            keyword_score * 0.25 +
            experience_score * 0.25 +
            education_score * 0.08 +
            format_score * 0.07
        )
        
        overall_score = max(20, min(100, overall_score))
        
        # ===========================================
        # GENERATE ROLE-CONDITIONED INSIGHTS
        # ===========================================
        
        # Skills extracted (all for transparency)
        skills_extracted = [
            {"name": s.title(), "category": "primary", "proficiency": "identified"}
            for s in relevant_primary
        ] + [
            {"name": s.title(), "category": "secondary", "proficiency": "identified"}
            for s in relevant_secondary
        ]
        
        # Matched keywords (role-relevant only)
        matched_kw_list = matched_keywords[:10]
        
        # Missing keywords (role-specific gaps)
        primary_set = set(s.lower() for s in relevant_primary)
        missing_keywords = [
            kw for kw in taxonomy.get("primary", [])[:8]
            if kw not in primary_set and kw not in text_lower
        ][:5]
        
        # Strength areas (role-conditioned)
        strength_areas = []
        if len(relevant_primary) >= 5:
            strength_areas.append({
                "area": f"{target_role} Core Skills",
                "description": f"Strong alignment with {len(relevant_primary)} core skills for {target_role}",
            })
        if len(matched_keywords) >= 3:
            strength_areas.append({
                "area": "Role Keyword Match",
                "description": f"Resume contains key terms expected for {target_role}",
            })
        if experience_score >= 70:
            strength_areas.append({
                "area": "Experience Depth",
                "description": "Demonstrates substantial project and work experience",
            })
        
        # Weak areas (role-conditioned)
        weak_areas = []
        
        # Critical: Flag misalignment explicitly
        if total_irrelevant > total_relevant and total_irrelevant > 3:
            # Determine what domain the resume is oriented towards
            irrelevant_domain = self._detect_domain_from_skills(irrelevant)
            weak_areas.append({
                "area": "⚠️ Role Misalignment",
                "description": f"This resume appears more oriented toward {irrelevant_domain} roles. {target_role} alignment is limited.",
                "suggestion": f"Add more {target_role}-specific skills and experience if targeting this role",
            })
        
        if len(missing_keywords) >= 3:
            weak_areas.append({
                "area": "Missing Core Keywords",
                "description": f"Several key terms for {target_role} are not present",
                "suggestion": f"Add skills like: {', '.join(missing_keywords[:3])}",
            })
        
        if len(relevant_primary) < 3:
            weak_areas.append({
                "area": "Limited Role-Specific Skills",
                "description": f"Few primary skills for {target_role} were detected",
                "suggestion": f"Highlight experience with: {', '.join(taxonomy.get('primary', [])[:4])}",
            })
        
        # Recommendations (role-conditioned)
        recommendations = []
        
        if weak_areas:
            for wa in weak_areas[:3]:
                recommendations.append({
                    "area": wa["area"],
                    "suggestion": wa.get("suggestion", f"Improve {wa['area']}"),
                    "impact": "high" if "misalignment" in wa["area"].lower() else "medium",
                })
        
        if len(missing_keywords) > 0:
            recommendations.append({
                "area": "Add Role Keywords",
                "suggestion": f"Include terms like: {', '.join(missing_keywords[:3])}",
                "impact": "high",
            })
        
        # Summary (role-conditioned)
        summary = self._generate_role_conditioned_summary(
            target_role, overall_score, total_relevant, total_irrelevant
        )
        
        return {
            "overall_score": overall_score,
            "breakdown": {
                "keyword_match": keyword_score,
                "skills_coverage": skills_score,
                "experience_alignment": experience_score,
                "education_fit": education_score,
                "format_quality": format_score,
            },
            "skills_extracted": skills_extracted,
            "matched_keywords": matched_kw_list,
            "missing_keywords": missing_keywords,
            "strength_areas": strength_areas[:3],
            "weak_areas": weak_areas[:3],
            "recommendations": recommendations[:5],
            "summary": summary,
            # Extra metadata for transparency
            "_role_analysis": {
                "relevant_primary_count": len(relevant_primary),
                "relevant_secondary_count": len(relevant_secondary),
                "irrelevant_count": len(irrelevant),
                "irrelevant_skills": irrelevant[:5],  # Show first 5 for transparency
            },
        }
    
    def _detect_domain_from_skills(self, skills: List[str]) -> str:
        """Detect which domain a set of skills belongs to."""
        ai_ml_keywords = {"pytorch", "tensorflow", "machine learning", "deep learning", "nlp", "keras"}
        frontend_keywords = {"react", "vue", "angular", "css", "html", "frontend"}
        backend_keywords = {"api", "database", "sql", "microservices", "backend"}
        devops_keywords = {"docker", "kubernetes", "aws", "terraform", "ci/cd"}
        
        skills_lower = set(s.lower() for s in skills)
        
        if skills_lower & ai_ml_keywords:
            return "AI/ML Engineering"
        elif skills_lower & frontend_keywords:
            return "Frontend Development"
        elif skills_lower & backend_keywords:
            return "Backend Development"
        elif skills_lower & devops_keywords:
            return "DevOps/Infrastructure"
        else:
            return "a different technical domain"
    
    def _generate_role_conditioned_summary(
        self, 
        target_role: str, 
        score: int,
        relevant_count: int,
        irrelevant_count: int
    ) -> str:
        """Generate a role-conditioned summary with explicit alignment indication."""
        
        # Determine alignment level
        if score >= 80:
            alignment = "strong"
            recommendation = "highly recommended"
        elif score >= 65:
            alignment = "good"
            recommendation = "recommended with minor improvements"
        elif score >= 50:
            alignment = "moderate"
            recommendation = "needs improvements for better alignment"
        else:
            alignment = "low"
            recommendation = "requires significant additions of role-specific content"
        
        summary = f"Your resume shows {alignment} compatibility with {target_role} positions. "
        summary += f"ATS Score: {score}/100. "
        
        # Add explicit misalignment warning if needed
        if irrelevant_count > relevant_count and irrelevant_count > 3:
            summary += f"⚠️ NOTE: This resume appears oriented toward a different role. "
            summary += f"{target_role}-specific skills are underrepresented. "
        
        summary += f"This resume is {recommendation}. "
        summary += "Review the recommendations to improve your score for this specific role."
        
        return summary
    
    # ===========================================
    # GEMINI API ANALYSIS (Role-Conditioned)
    # ===========================================
    
    async def _analyze_with_gemini(
        self, 
        resume_text: str, 
        target_role: str,
        target_description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze resume using Gemini API with STRICT role conditioning.
        """
        client = self._get_gemini_client()
        
        if not client:
            # Fallback to role-conditioned mock
            return self._generate_role_conditioned_analysis(resume_text, target_role)
        
        try:
            # Get role taxonomy
            taxonomy = self._get_role_taxonomy(target_role)
            
            # Build role-conditioned prompt
            prompt = f"""You are an ATS (Applicant Tracking System) expert. Analyze this resume STRICTLY for the role: {target_role}

CRITICAL INSTRUCTIONS:
1. Evaluate ONLY skills and experience relevant to {target_role}
2. Do NOT reward skills from unrelated domains (e.g., if role is Frontend, do NOT reward ML/AI skills)
3. Skills not relevant to {target_role} should NOT increase the score
4. Penalize if the resume is clearly oriented toward a different role
5. Be STRICT - only role-relevant signals boost the score

PRIMARY skills expected for {target_role}: {', '.join(taxonomy.get('primary', [])[:10])}
SECONDARY skills for {target_role}: {', '.join(taxonomy.get('secondary', [])[:8])}
Skills to IGNORE/PENALIZE (wrong domain): {', '.join(taxonomy.get('exclude', [])[:8])}

RESUME TEXT:
{resume_text[:4000]}

{f"JOB DESCRIPTION: {target_description[:500]}" if target_description else ""}

Respond with JSON only:
{{
    "overall_score": <0-100, strict role-based scoring>,
    "breakdown": {{
        "keyword_match": <0-100>,
        "skills_coverage": <0-100, based ONLY on role-relevant skills>,
        "experience_alignment": <0-100>,
        "education_fit": <0-100>,
        "format_quality": <0-100>
    }},
    "matched_keywords": [<role-relevant keywords found>],
    "missing_keywords": [<important {target_role} keywords missing>],
    "recommendations": [<specific improvements for {target_role}>],
    "summary": "<include explicit warning if resume is oriented toward different role>"
}}
"""
            
            # Call Gemini API
            start_time = time.time()
            response = client.generate_content(prompt)
            response_text = response.text
            response_time_ms = int((time.time() - start_time) * 1000)
            
            # Log successful Gemini API call
            try:
                AIAPILogService.log_ai_call(
                    db=self.db,
                    provider="gemini",
                    operation="ats_analysis",
                    model="gemini-pro",
                    response_time_ms=response_time_ms,
                    status="success"
                )
            except Exception as log_error:
                print(f"[AI Log Error] Failed to log Gemini call: {log_error}")
            
            # Parse JSON response
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
                
                # Get additional analysis for skills
                all_skills = self._extract_all_skills(resume_text)
                categorized = self._categorize_skills_for_role(all_skills, taxonomy)
                
                skills_extracted = [
                    {"name": s.title(), "category": "primary", "proficiency": "identified"}
                    for s in categorized["relevant_primary"]
                ] + [
                    {"name": s.title(), "category": "secondary", "proficiency": "identified"}
                    for s in categorized["relevant_secondary"]
                ]
                
                return {
                    "overall_score": result.get("overall_score", 70),
                    "breakdown": result.get("breakdown", {
                        "keyword_match": 70,
                        "skills_coverage": 70,
                        "experience_alignment": 70,
                        "education_fit": 70,
                        "format_quality": 70,
                    }),
                    "skills_extracted": skills_extracted,
                    "matched_keywords": result.get("matched_keywords", []),
                    "missing_keywords": result.get("missing_keywords", []),
                    "strength_areas": [
                        {"area": s, "description": s} 
                        for s in result.get("matched_keywords", [])[:3]
                    ],
                    "weak_areas": [
                        {"area": m, "description": f"Missing: {m}", "suggestion": f"Add {m}"}
                        for m in result.get("missing_keywords", [])[:3]
                    ],
                    "recommendations": [
                        {"area": r, "suggestion": r, "impact": "medium"}
                        for r in result.get("recommendations", [])[:5]
                    ] if isinstance(result.get("recommendations", []), list) and \
                       all(isinstance(r, str) for r in result.get("recommendations", [])) else \
                       result.get("recommendations", [])[:5],
                    "summary": result.get("summary", "Analysis completed."),
                }
                
            except json.JSONDecodeError:
                return self._generate_role_conditioned_analysis(resume_text, target_role)
                
        except Exception as e:
            print(f"Gemini API error: {e}")
            return self._generate_role_conditioned_analysis(resume_text, target_role)
    
    # ===========================================
    # PUBLIC API
    # ===========================================
    
    async def analyze_resume(
        self,
        resume: Resume,
        user_id: str,
        target_role: str,
        target_description: Optional[str] = None,
    ) -> ATSAnalysis:
        """
        Analyze a resume against a target role.
        
        CRITICAL: Analysis is UNIQUE per (resume_id + target_role).
        Each role produces INDEPENDENT results - no caching across roles.
        """
        start_time = time.time()
        
        # Get resume text
        resume_text = resume.text_content or ""
        
        if not resume_text:
            raise ValueError("Resume has no extracted text content")
        
        # Determine analysis source
        use_gemini = settings.is_gemini_configured()
        
        # Perform ROLE-CONDITIONED analysis
        if use_gemini:
            analysis_result = await self._analyze_with_gemini(
                resume_text, target_role, target_description
            )
            analysis_source = "gemini"
            analysis_model = "gemini-pro"
        else:
            analysis_result = self._generate_role_conditioned_analysis(resume_text, target_role)
            analysis_source = "mock"
            analysis_model = None
        
        processing_time = int((time.time() - start_time) * 1000)
        
        # Create NEW database record (unique per resume + role combination)
        ats_analysis = ATSAnalysis(
            user_id=user_id,
            resume_id=resume.id,
            target_role=target_role,
            target_role_description=target_description,
            
            # Scores
            overall_score=analysis_result["overall_score"],
            keyword_match_score=analysis_result["breakdown"]["keyword_match"],
            skills_coverage_score=analysis_result["breakdown"]["skills_coverage"],
            experience_alignment_score=analysis_result["breakdown"]["experience_alignment"],
            education_fit_score=analysis_result["breakdown"]["education_fit"],
            format_quality_score=analysis_result["breakdown"]["format_quality"],
            
            # Insights
            skills_extracted=analysis_result["skills_extracted"],
            matched_keywords=analysis_result["matched_keywords"],
            missing_keywords=analysis_result["missing_keywords"],
            strength_areas=analysis_result["strength_areas"],
            weak_areas=analysis_result["weak_areas"],
            recommendations=analysis_result["recommendations"],
            summary=analysis_result["summary"],
            
            # Raw data
            raw_analysis=analysis_result,
            
            # Metadata
            analysis_source=analysis_source,
            analysis_model=analysis_model,
            processing_time_ms=processing_time,
        )
        
        self.db.add(ats_analysis)
        self.db.commit()
        self.db.refresh(ats_analysis)
        
        return ats_analysis
    
    def get_analysis_by_id(
        self, 
        analysis_id: str, 
        user_id: str
    ) -> Optional[ATSAnalysis]:
        """
        Get ATS analysis by ID.
        
        Security: Only returns if user owns the analysis.
        """
        return self.db.query(ATSAnalysis).filter(
            ATSAnalysis.id == analysis_id,
            ATSAnalysis.user_id == user_id,
        ).first()
    
    def get_analysis_by_resume(
        self, 
        resume_id: str, 
        user_id: str
    ) -> Optional[ATSAnalysis]:
        """
        Get latest ATS analysis for a resume.
        
        NOTE: Returns most recent analysis for any role.
        For role-specific, use get_analysis_by_resume_and_role.
        """
        return self.db.query(ATSAnalysis).filter(
            ATSAnalysis.resume_id == resume_id,
            ATSAnalysis.user_id == user_id,
        ).order_by(ATSAnalysis.created_at.desc()).first()
    
    def get_analysis_by_resume_and_role(
        self, 
        resume_id: str, 
        user_id: str,
        target_role: str
    ) -> Optional[ATSAnalysis]:
        """
        Get ATS analysis for a specific resume + role combination.
        """
        return self.db.query(ATSAnalysis).filter(
            ATSAnalysis.resume_id == resume_id,
            ATSAnalysis.user_id == user_id,
            ATSAnalysis.target_role == target_role,
        ).order_by(ATSAnalysis.created_at.desc()).first()
    
    def get_user_analyses(
        self, 
        user_id: str, 
        limit: int = 10
    ) -> List[ATSAnalysis]:
        """Get all ATS analyses for a user."""
        return self.db.query(ATSAnalysis).filter(
            ATSAnalysis.user_id == user_id,
        ).order_by(ATSAnalysis.created_at.desc()).limit(limit).all()


def get_ats_service(db: Session) -> ATSService:
    """Get ATS service instance."""
    return ATSService(db)
