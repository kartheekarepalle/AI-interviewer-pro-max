"""
AI Prompts Module

Contains all prompt templates for Gemini and Groq API calls.
Prompts are separated from client logic for maintainability.

IMPORTANT:
- Gemini prompts are for DEEP, NON-REAL-TIME operations
- Groq prompts are for FAST, REAL-TIME operations
- Do NOT mix responsibilities
"""

# ===========================================
# GEMINI PROMPTS (Deep Reasoning)
# ===========================================


class GeminiPrompts:
    """Prompt templates for Gemini API operations."""
    
    # G01: Resume Parsing
    RESUME_PARSING = """
    Analyze the following resume and extract structured information.
    
    Resume Text:
    {resume_text}
    
    Extract and return JSON with the following structure:
    {{
        "personal_info": {{
            "name": "string or null",
            "email": "string or null",
            "phone": "string or null",
            "location": "string or null"
        }},
        "summary": "professional summary string",
        "skills": [
            {{
                "name": "skill name",
                "category": "technical|soft|tool|language",
                "proficiency": "beginner|intermediate|advanced|expert"
            }}
        ],
        "experience": [
            {{
                "company": "company name",
                "role": "job title",
                "duration_months": number,
                "highlights": ["achievement 1", "achievement 2"]
            }}
        ],
        "education": [
            {{
                "institution": "school name",
                "degree": "degree type",
                "field": "field of study",
                "year": number or null
            }}
        ],
        "certifications": ["cert 1", "cert 2"],
        "total_experience_years": number
    }}
    
    Be thorough but concise. Return valid JSON only.
    """
    
    # G03: ATS Scoring
    ATS_SCORING = """
    Evaluate the resume against the job requirements and provide an ATS compatibility score.
    
    Resume Analysis:
    {resume_analysis}
    
    Target Role:
    {target_role}
    
    Evaluate and return JSON:
    {{
        "overall_score": number (0-100),
        "breakdown": {{
            "keyword_match": number (0-100),
            "skills_coverage": number (0-100),
            "experience_alignment": number (0-100),
            "education_fit": number (0-100),
            "format_quality": number (0-100)
        }},
        "matched_keywords": ["keyword1", "keyword2"],
        "missing_keywords": ["keyword1", "keyword2"],
        "recommendations": [
            {{
                "area": "area name",
                "suggestion": "specific suggestion",
                "impact": "high|medium|low"
            }}
        ],
        "summary": "brief summary of fit"
    }}
    """
    
    # G06: Question Generation
    QUESTION_GENERATION = """
    Generate interview questions based on the candidate profile and role.
    
    Interview Plan:
    {plan}
    
    Resume Analysis:
    {resume_analysis}
    
    Settings:
    - Question Count: {question_count}
    - Difficulty: {difficulty}
    - Interview Type: {interview_type}
    
    Generate questions and return JSON array:
    [
        {{
            "text": "question text",
            "type": "technical|behavioral|situational|system_design",
            "category": "topic category",
            "difficulty": "easy|medium|hard",
            "expected_topics": ["topic1", "topic2"],
            "time_limit_seconds": number,
            "scoring_rubric": {{
                "key_points": ["point1", "point2"],
                "red_flags": ["flag1", "flag2"]
            }}
        }}
    ]
    
    Ensure questions are:
    - Relevant to the role and resume
    - Progressive in difficulty
    - Covering different competency areas
    """
    
    # G07: Answer Evaluation
    ANSWER_EVALUATION = """
    Evaluate the candidate's answer against the question and expected criteria.
    
    Question:
    {question_text}
    Type: {question_type}
    Expected Topics: {expected_topics}
    
    Answer:
    {answer_text}
    Word Count: {word_count}
    Response Time: {response_time} seconds
    
    Context:
    Role: {role}
    Seniority: {seniority}
    
    Evaluate and return JSON:
    {{
        "scores": {{
            "relevance": number (0-10),
            "depth": number (0-10),
            "clarity": number (0-10),
            "confidence": number (0-10),
            "technical_accuracy": number (0-10) or null,
            "problem_solving": number (0-10) or null
        }},
        "total_score": number (0-100),
        "topics_covered": ["topic1", "topic2"],
        "topics_missed": ["topic1", "topic2"],
        "strengths": ["strength1", "strength2"],
        "weaknesses": ["weakness1", "weakness2"],
        "feedback": "constructive feedback text",
        "improvement_tip": "specific actionable tip"
    }}
    """
    
    # G08/G09/G10: Signal Analysis
    SIGNAL_ANALYSIS = """
    Analyze the candidate's textual responses to infer communication signals.
    
    This is a TEXT-BASED SIMULATION of speech, emotion, and body language analysis.
    
    Answers to analyze:
    {answers_json}
    
    Analyze and return JSON:
    {{
        "speech_clarity": {{
            "vocabulary_level": "basic|moderate|advanced",
            "grammar_score": number (0-10),
            "filler_word_count": number,
            "articulation_score": number (0-10),
            "overall": number (0-10)
        }},
        "emotion_signals": {{
            "dominant_sentiment": "positive|neutral|negative",
            "emotional_tone": "confident|nervous|enthusiastic|uncertain|calm",
            "enthusiasm_level": number (0-10),
            "stress_indicators": ["indicator1", "indicator2"],
            "overall": number (0-10)
        }},
        "body_language_inference": {{
            "engagement_level": number (0-10),
            "hesitation_patterns": ["pattern1", "pattern2"],
            "assertiveness_score": number (0-10),
            "presence_score": number (0-10),
            "overall": number (0-10)
        }},
        "combined_presence_score": number (0-100)
    }}
    
    Base analysis on:
    - Vocabulary and grammar patterns
    - Sentiment and word choice
    - Response timing and length patterns
    - Filler words and hedging language
    """
    
    # G13: Report Generation
    REPORT_GENERATION = """
    Generate a comprehensive interview report.
    
    Session Data:
    {session_data}
    
    Answer Evaluations:
    {evaluations}
    
    Signal Analysis:
    {signals}
    
    Aggregate Scores:
    {scores}
    
    Generate and return JSON:
    {{
        "report_title": "Interview Performance Report",
        "executive_summary": "2-3 sentence summary",
        "overall_score": number (0-100),
        "grade": "A+|A|A-|B+|B|B-|C+|C|C-|D|F",
        "performance_breakdown": {{
            "technical": {{"score": number, "feedback": "text"}},
            "behavioral": {{"score": number, "feedback": "text"}},
            "communication": {{"score": number, "feedback": "text"}},
            "problem_solving": {{"score": number, "feedback": "text"}},
            "presence": {{"score": number, "feedback": "text"}}
        }},
        "top_strengths": ["strength1", "strength2", "strength3"],
        "improvement_areas": ["area1", "area2", "area3"],
        "hiring_recommendation": "strong_hire|hire|maybe|no_hire|strong_no_hire",
        "recommendation_rationale": "explanation",
        "next_steps": ["step1", "step2"],
        "recommended_resources": [
            {{"type": "course|book|practice", "title": "name", "url": "optional"}}
        ]
    }}
    """


# ===========================================
# GROQ PROMPTS (Fast Interaction)
# ===========================================


class GroqPrompts:
    """Prompt templates for Groq API operations."""
    
    # Q02: Follow-up Generation
    FOLLOW_UP_GENERATION = """
    Generate a brief follow-up question based on the candidate's answer.
    
    Original Question: {original_question}
    Candidate's Answer: {user_answer}
    Identified Gap: {identified_gap}
    Interviewer Persona: {persona}
    
    Generate a concise follow-up question (max 50 words) that:
    - Probes deeper into the gap
    - Matches the {persona} persona
    - Is direct and clear
    
    Return only the follow-up question text.
    """
    
    # Q03: Quick Relevance Check
    QUICK_RELEVANCE = """
    Quickly evaluate if this answer is relevant to the question.
    
    Question: {question}
    Answer: {answer}
    
    Return JSON:
    {{
        "relevance_score": number (1-10),
        "is_on_topic": boolean,
        "is_complete": boolean,
        "flags": ["too_short"|"off_topic"|"unclear"|"evasive"]
    }}
    
    Be fast and decisive. Return valid JSON only.
    """
    
    # Q06: Acknowledgment
    ACKNOWLEDGMENT = """
    Generate a brief acknowledgment for the candidate's answer.
    
    Answer Quality: {answer_quality}
    Persona: {persona}
    
    Requirements:
    - Max 15 words
    - Match {persona} tone (professional/friendly/stress)
    - Natural and conversational
    
    Return only the acknowledgment text.
    """


# ===========================================
# PROMPT HELPERS
# ===========================================


def format_prompt(template: str, **kwargs) -> str:
    """
    Format a prompt template with provided values.
    
    Args:
        template: Prompt template string
        **kwargs: Values to substitute
        
    Returns:
        Formatted prompt string
    """
    try:
        return template.format(**kwargs)
    except KeyError as e:
        raise ValueError(f"Missing prompt parameter: {e}")


# Instances for import
gemini_prompts = GeminiPrompts()
groq_prompts = GroqPrompts()
