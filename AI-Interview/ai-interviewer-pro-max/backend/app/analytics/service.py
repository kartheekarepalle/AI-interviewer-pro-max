"""
Analytics Service

Aggregates user interview data for dashboard display.
Uses stored data only - no heavy AI calls.

Provides:
- Overview statistics
- Skill-wise performance
- Progress over time
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.interviews.live_models import LiveInterviewSession, InterviewAnswer
from app.evaluations.models import AnswerEvaluation
from app.reports.models import InterviewReport
from app.ats.models import ATSAnalysis


# Logger for analytics
logger = logging.getLogger(__name__)


class AnalyticsService:
    """
    Service for user analytics aggregation.
    
    All queries are user-scoped for security.
    Uses stored evaluation data - no AI calls.
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def _get_eval_score(self, eval_obj) -> Optional[float]:
        """
        Safely compute a score from an AnswerEvaluation object.
        
        Priority:
        1. deep_overall_score (preferred)
        2. Average of deep_relevance_score, deep_depth_score, deep_clarity_score, deep_confidence_score
        3. Fallback to quick_relevance_score
        4. Return None if nothing available
        """
        try:
            # 1. Try deep_overall_score first (preferred)
            if hasattr(eval_obj, 'deep_overall_score') and eval_obj.deep_overall_score is not None:
                return float(eval_obj.deep_overall_score)
            
            # 2. Try to compute average from deep scores
            deep_scores = []
            for attr in ['deep_relevance_score', 'deep_depth_score', 'deep_clarity_score', 'deep_confidence_score']:
                val = getattr(eval_obj, attr, None)
                if val is not None:
                    deep_scores.append(float(val))
            
            if deep_scores:
                return sum(deep_scores) / len(deep_scores)
            
            # 3. Fallback to quick_relevance_score
            if hasattr(eval_obj, 'quick_relevance_score') and eval_obj.quick_relevance_score is not None:
                return float(eval_obj.quick_relevance_score)
            
            # 4. Nothing available
            return None
        except Exception:
            return None
    
    def get_overview(self, user_id: str, days: int = 30) -> Dict[str, Any]:
        """
        Get analytics overview for user.
        
        Returns:
            - Total interviews
            - Completed interviews
            - Average score
            - Improvement trend
            - Recent activity
        """
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            # Total interviews
            total_sessions = self.db.query(LiveInterviewSession).filter(
                LiveInterviewSession.user_id == user_id,
            ).count()
            
            # Completed interviews (include "completing" for backward compatibility with bug fix)
            completed_sessions = self.db.query(LiveInterviewSession).filter(
                LiveInterviewSession.user_id == user_id,
                LiveInterviewSession.status.in_(["completed", "completing"]),
            ).count()
            
            # Recent completed sessions (for avg score) - include "completing" for backward compat
            recent_sessions = self.db.query(LiveInterviewSession).filter(
                LiveInterviewSession.user_id == user_id,
                LiveInterviewSession.status.in_(["completed", "completing"]),
                LiveInterviewSession.created_at >= cutoff_date,
            ).all()
            
            # Calculate average score from reports (with defensive checks)
            reports = self.db.query(InterviewReport).filter(
                InterviewReport.user_id == user_id,
            ).all()
            
            total_score = 0
            score_count = 0
            for report in reports:
                # Use readiness_score directly for safety
                score = getattr(report, 'readiness_score', None)
                if score is None:
                    score = getattr(report, 'overall_score', None)
                if score is not None:
                    total_score += score
                    score_count += 1
            
            avg_score = round(total_score / score_count, 1) if score_count > 0 else 0
            
            # Calculate trend (compare recent vs older)
            if score_count >= 2:
                recent_half = reports[len(reports)//2:]
                older_half = reports[:len(reports)//2]
                
                def get_score(r):
                    s = getattr(r, 'readiness_score', None)
                    return s if s is not None else getattr(r, 'overall_score', 0) or 0
                
                recent_avg = sum(get_score(r) for r in recent_half) / len(recent_half) if recent_half else 0
                older_avg = sum(get_score(r) for r in older_half) / len(older_half) if older_half else 0
                
                if older_avg > 0:
                    trend_percent = round(((recent_avg - older_avg) / older_avg) * 100, 1)
                else:
                    trend_percent = 0
                
                trend = "improving" if trend_percent > 5 else "declining" if trend_percent < -5 else "stable"
            else:
                trend = "insufficient_data"
                trend_percent = 0
            
            # Recent activity (last 7 days)
            week_ago = datetime.utcnow() - timedelta(days=7)
            recent_activity = self.db.query(LiveInterviewSession).filter(
                LiveInterviewSession.user_id == user_id,
                LiveInterviewSession.created_at >= week_ago,
            ).count()
            
            # Total questions answered
            total_answers = self.db.query(InterviewAnswer).filter(
                InterviewAnswer.user_id == user_id,
            ).count()
            
            # Average questions per session
            avg_questions = round(total_answers / completed_sessions, 1) if completed_sessions > 0 else 0
            
            return {
                "total_interviews": total_sessions,
                "completed_interviews": completed_sessions,
                "completion_rate": round((completed_sessions / total_sessions * 100), 1) if total_sessions > 0 else 0,
                "average_score": avg_score,
                "trend": trend,
                "trend_percent": trend_percent,
                "recent_activity_count": recent_activity,
                "total_questions_answered": total_answers,
                "avg_questions_per_session": avg_questions,
                "days_analyzed": days,
            }
        except Exception as e:
            logger.error(f"Error getting analytics overview for user {user_id}: {str(e)}")
            return {
                "total_interviews": 0,
                "completed_interviews": 0,
                "completion_rate": 0,
                "average_score": 0,
                "trend": "insufficient_data",
                "trend_percent": 0,
                "recent_activity_count": 0,
                "total_questions_answered": 0,
                "avg_questions_per_session": 0,
                "days_analyzed": days,
            }
    
    def get_skill_performance(self, user_id: str) -> Dict[str, Any]:
        """
        Get skill-wise performance breakdown.
        
        Returns:
            - Performance by skill category
            - Strengths (top skills)
            - Weaknesses (bottom skills)
        """
        try:
            # Get all evaluations for user
            evaluations = self.db.query(AnswerEvaluation).filter(
                AnswerEvaluation.user_id == user_id,
            ).all()
            
            # Aggregate by skill/category
            skill_scores: Dict[str, List[float]] = {}
            
            for eval in evaluations:
                # Get question type from the evaluation
                question_type = eval.question_type or "general"
                
                if question_type not in skill_scores:
                    skill_scores[question_type] = []
                
                # Use helper to safely get score (deep_overall_score or computed average, with fallback to quick)
                score = self._get_eval_score(eval)
                if score is not None:
                    skill_scores[question_type].append(score)
            
            # Calculate averages
            skill_performance = []
            for skill, scores in skill_scores.items():
                if scores:
                    avg = round(sum(scores) / len(scores), 1)
                    skill_performance.append({
                        "skill": skill,
                        "average_score": avg,
                        "total_evaluations": len(scores),
                        "max_score": max(scores),
                        "min_score": min(scores),
                    })
            
            # Sort by average score
            skill_performance.sort(key=lambda x: x["average_score"], reverse=True)
            
            # Identify strengths (top 3) and weaknesses (bottom 3)
            strengths = skill_performance[:3] if len(skill_performance) >= 3 else skill_performance
            weaknesses = skill_performance[-3:] if len(skill_performance) >= 3 else []
            
            # Reverse weaknesses to show worst first
            weaknesses = list(reversed(weaknesses))
            
            return {
                "skills": skill_performance,
                "strengths": strengths,
                "weaknesses": weaknesses,
                "total_skills_analyzed": len(skill_performance),
            }
        except Exception as e:
            logger.error(f"Error getting skill performance for user {user_id}: {str(e)}")
            return {
                "skills": [],
                "strengths": [],
                "weaknesses": [],
                "total_skills_analyzed": 0,
            }
    
    def get_progress_over_time(
        self, 
        user_id: str, 
        days: int = 90,
        interval: str = "week"
    ) -> Dict[str, Any]:
        """
        Get progress data over time for charts.
        
        Args:
            days: Number of days to analyze
            interval: Grouping interval (day, week, month)
        
        Returns:
            - Time series data for charts
            - Progress summary
        """
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            # Get all reports in date range - with defensive handling for created_at
            try:
                # Try with created_at first
                reports = self.db.query(InterviewReport).filter(
                    InterviewReport.user_id == user_id,
                    InterviewReport.created_at >= cutoff_date,
                ).order_by(InterviewReport.created_at).all()
            except Exception:
                # Fallback: try with generated_at
                try:
                    reports = self.db.query(InterviewReport).filter(
                        InterviewReport.user_id == user_id,
                        InterviewReport.generated_at >= cutoff_date,
                    ).order_by(InterviewReport.generated_at).all()
                except Exception:
                    # Last resort: get all reports without date filter
                    reports = self.db.query(InterviewReport).filter(
                        InterviewReport.user_id == user_id,
                    ).all()
            
            # Helper to get report date safely
            def get_report_date(report):
                if hasattr(report, 'created_at') and report.created_at:
                    return report.created_at
                if hasattr(report, 'generated_at') and report.generated_at:
                    return report.generated_at
                return datetime.utcnow()
            
            # Helper to get score safely
            def get_score(report):
                score = getattr(report, 'readiness_score', None)
                if score is None:
                    score = getattr(report, 'overall_score', None)
                return score
            
            # Group by interval
            time_series = []
            
            if interval == "day":
                # Daily grouping
                current_date = cutoff_date.date()
                end_date = datetime.utcnow().date()
                
                while current_date <= end_date:
                    day_reports = [r for r in reports if get_report_date(r).date() == current_date]
                    
                    if day_reports:
                        scores = [get_score(r) for r in day_reports if get_score(r) is not None]
                        avg_score = sum(scores) / len(scores) if scores else None
                    else:
                        avg_score = None
                    
                    time_series.append({
                        "date": current_date.isoformat(),
                        "label": current_date.strftime("%b %d"),
                        "score": round(avg_score, 1) if avg_score else None,
                        "count": len(day_reports),
                    })
                    
                    current_date += timedelta(days=1)
                    
            elif interval == "week":
                # Weekly grouping
                week_start = cutoff_date - timedelta(days=cutoff_date.weekday())
                end_date = datetime.utcnow()
                
                while week_start <= end_date:
                    week_end = week_start + timedelta(days=7)
                    week_reports = [
                        r for r in reports 
                        if week_start <= get_report_date(r) < week_end
                    ]
                    
                    if week_reports:
                        scores = [get_score(r) for r in week_reports if get_score(r) is not None]
                        avg_score = sum(scores) / len(scores) if scores else None
                    else:
                        avg_score = None
                    
                    time_series.append({
                        "date": week_start.date().isoformat(),
                        "label": f"Week of {week_start.strftime('%b %d')}",
                        "score": round(avg_score, 1) if avg_score else None,
                        "count": len(week_reports),
                    })
                    
                    week_start = week_end
                    
            else:  # month
                # Monthly grouping
                current_month = cutoff_date.replace(day=1)
                end_date = datetime.utcnow()
                
                while current_month <= end_date:
                    next_month = (current_month + timedelta(days=32)).replace(day=1)
                    month_reports = [
                        r for r in reports 
                        if current_month <= get_report_date(r) < next_month
                    ]
                    
                    if month_reports:
                        scores = [get_score(r) for r in month_reports if get_score(r) is not None]
                        avg_score = sum(scores) / len(scores) if scores else None
                    else:
                        avg_score = None
                    
                    time_series.append({
                        "date": current_month.date().isoformat(),
                        "label": current_month.strftime("%b %Y"),
                        "score": round(avg_score, 1) if avg_score else None,
                        "count": len(month_reports),
                    })
                    
                    current_month = next_month
            
            # Calculate overall progress
            valid_scores = [get_score(r) for r in reports if get_score(r) is not None]
            
            if len(valid_scores) >= 2:
                first_half_avg = sum(valid_scores[:len(valid_scores)//2]) / (len(valid_scores)//2)
                second_half_avg = sum(valid_scores[len(valid_scores)//2:]) / (len(valid_scores) - len(valid_scores)//2)
                improvement = round(second_half_avg - first_half_avg, 1)
            else:
                improvement = 0
            
            return {
                "time_series": time_series,
                "total_interviews_in_period": len(reports),
                "improvement_points": improvement,
                "interval": interval,
                "days_analyzed": days,
            }
        except Exception as e:
            logger.error(f"Error getting progress over time for user {user_id}: {str(e)}")
            return {
                "time_series": [],
                "total_interviews_in_period": 0,
                "improvement_points": 0,
                "interval": interval,
                "days_analyzed": days,
            }
    
    def get_question_type_breakdown(self, user_id: str) -> Dict[str, Any]:
        """
        Get performance breakdown by question type.
        """
        try:
            evaluations = self.db.query(AnswerEvaluation).filter(
                AnswerEvaluation.user_id == user_id,
            ).all()
            
            type_scores: Dict[str, List[float]] = {
                "technical": [],
                "behavioral": [],
                "situational": [],
                "hr": [],
            }
            
            for eval in evaluations:
                q_type = eval.question_type or "general"
                # Use helper to safely get score (deep_overall_score or computed average, with fallback to quick)
                score = self._get_eval_score(eval)
                if q_type in type_scores and score is not None:
                    type_scores[q_type].append(score)
            
            breakdown = []
            for q_type, scores in type_scores.items():
                if scores:
                    breakdown.append({
                        "type": q_type,
                        "label": q_type.replace("_", " ").title(),
                        "average_score": round(sum(scores) / len(scores), 1),
                        "count": len(scores),
                    })
            
            return {
                "breakdown": breakdown,
                "total_evaluated": sum(len(s) for s in type_scores.values()),
            }
        except Exception as e:
            logger.error(f"Error getting question type breakdown for user {user_id}: {str(e)}")
            return {
                "breakdown": [],
                "total_evaluated": 0,
            }
    
    def get_recent_interviews(self, user_id: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Get recent interview summary.
        """
        try:
            # Include "completing" for backward compat with data before bug fix
            sessions = self.db.query(LiveInterviewSession).filter(
                LiveInterviewSession.user_id == user_id,
                LiveInterviewSession.status.in_(["completed", "completing"]),
            ).order_by(desc(LiveInterviewSession.created_at)).limit(limit).all()
            
            results = []
            for session in sessions:
                # Get report if exists
                report = self.db.query(InterviewReport).filter(
                    InterviewReport.session_id == session.id,
                ).first()
                
                # Get score safely
                score = None
                if report:
                    score = getattr(report, 'readiness_score', None)
                    if score is None:
                        score = getattr(report, 'overall_score', None)
                
                results.append({
                    "id": session.id,
                    "target_role": session.target_role,
                    "session_type": session.session_type,
                    "difficulty": session.difficulty_level,
                    "score": score,
                    "date": session.created_at.isoformat() if session.created_at else None,
                    "questions_count": session.total_questions,
                })
            
            return results
        except Exception as e:
            logger.error(f"Error getting recent interviews for user {user_id}: {str(e)}")
            return []


def get_analytics_service(db: Session) -> AnalyticsService:
    """Get analytics service instance."""
    return AnalyticsService(db)
