"""
Report Generator

Orchestrates comprehensive interview report generation.
Uses Gemini for narrative generation, combines all evaluation data.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime


class ReportGenerator:
    """
    Generates comprehensive interview reports.
    
    Report includes:
    - Executive summary
    - Overall score and grade
    - Performance breakdown by category
    - Question-by-question feedback
    - Strengths and improvements
    - Hiring recommendation
    - Next steps and resources
    """
    
    def __init__(self):
        """Initialize report generator."""
        # TODO: Accept Gemini client dependency
        pass
    
    async def generate_report(
        self,
        session_id: str,
        session_data: Dict[str, Any],
        answer_evaluations: List[Dict[str, Any]],
        signal_analysis: Dict[str, Any],
        aggregate_scores: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate comprehensive interview report.
        
        Args:
            session_id: Interview session ID
            session_data: Session metadata
            answer_evaluations: Per-answer evaluation results
            signal_analysis: Simulated signal analysis results
            aggregate_scores: Aggregated scoring results
            
        Returns:
            Complete report structure
            
        TODO:
            - Call Gemini for narrative generation
            - Generate PDF version
        """
        # Build report structure
        report = {
            "report_id": f"report-{session_id}",
            "session_id": session_id,
            "generated_at": datetime.utcnow().isoformat(),
            "report_version": "1.0",
            
            # Summary
            "report_title": self._generate_title(session_data),
            "executive_summary": self._generate_summary(aggregate_scores),
            
            # Scores
            "overall_score": aggregate_scores.get("overall_score", 0),
            "grade": aggregate_scores.get("grade", "N/A"),
            "pass_status": aggregate_scores.get("pass_status", False),
            
            # Breakdown
            "performance_breakdown": self._build_breakdown(aggregate_scores),
            "question_wise_feedback": self._build_question_feedback(answer_evaluations),
            
            # Insights
            "top_strengths": self._identify_strengths(answer_evaluations),
            "improvement_areas": self._identify_improvements(answer_evaluations),
            
            # Recommendation
            "hiring_recommendation": self._determine_recommendation(aggregate_scores),
            "recommendation_rationale": "Based on overall performance analysis.",
            
            # Next steps
            "next_steps": self._generate_next_steps(aggregate_scores),
            "recommended_resources": [],
            
            # Metadata
            "interview_duration_minutes": session_data.get("duration_minutes", 0),
            "questions_answered": len(answer_evaluations),
            "generated_by": "gemini",
        }
        
        return report
    
    def _generate_title(self, session_data: Dict) -> str:
        """Generate report title."""
        role = session_data.get("job_role", "Interview")
        return f"{role} Performance Report"
    
    def _generate_summary(self, scores: Dict) -> str:
        """Generate executive summary."""
        score = scores.get("overall_score", 0)
        grade = scores.get("grade", "N/A")
        
        if score >= 80:
            return f"Excellent performance with an overall score of {score} ({grade}). Demonstrated strong capabilities across evaluated areas."
        elif score >= 65:
            return f"Good performance with an overall score of {score} ({grade}). Shows competency with room for improvement in some areas."
        else:
            return f"Performance score of {score} ({grade}) indicates areas requiring development before meeting role requirements."
    
    def _build_breakdown(self, scores: Dict) -> Dict[str, Any]:
        """Build performance category breakdown."""
        categories = scores.get("category_scores", {})
        breakdown = {}
        
        for category, score in categories.items():
            breakdown[category] = {
                "score": score,
                "feedback": f"Score of {score}/10 in {category}."
            }
        
        return breakdown
    
    def _build_question_feedback(self, evaluations: List[Dict]) -> List[Dict]:
        """Build per-question feedback list."""
        feedback = []
        for i, eval_data in enumerate(evaluations, 1):
            feedback.append({
                "question_number": i,
                "score": eval_data.get("total_score", 0),
                "brief_feedback": eval_data.get("feedback", "No feedback available."),
            })
        return feedback
    
    def _identify_strengths(self, evaluations: List[Dict]) -> List[str]:
        """Identify top strengths from evaluations."""
        strengths = []
        for eval_data in evaluations:
            strengths.extend(eval_data.get("strengths", []))
        # Return unique top 5
        return list(set(strengths))[:5] or ["Performance analysis pending"]
    
    def _identify_improvements(self, evaluations: List[Dict]) -> List[str]:
        """Identify improvement areas from evaluations."""
        improvements = []
        for eval_data in evaluations:
            improvements.extend(eval_data.get("weaknesses", []))
        return list(set(improvements))[:5] or ["Review detailed feedback"]
    
    def _determine_recommendation(self, scores: Dict) -> str:
        """Determine hiring recommendation."""
        score = scores.get("overall_score", 0)
        if score >= 85:
            return "strong_hire"
        elif score >= 75:
            return "hire"
        elif score >= 65:
            return "maybe"
        elif score >= 50:
            return "no_hire"
        return "strong_no_hire"
    
    def _generate_next_steps(self, scores: Dict) -> List[str]:
        """Generate recommended next steps."""
        score = scores.get("overall_score", 0)
        steps = []
        
        if score >= 80:
            steps.append("Schedule follow-up or final round interview")
        elif score >= 65:
            steps.append("Focus on improvement areas identified in this report")
            steps.append("Practice with additional mock interviews")
        else:
            steps.append("Review fundamentals in weak areas")
            steps.append("Complete recommended learning resources")
            steps.append("Retry interview after preparation")
        
        return steps


# Module instance
report_generator = ReportGenerator()
