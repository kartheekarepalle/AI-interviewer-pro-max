"""
Admin Routes

API endpoints for admin functionality including:
- User management
- System health monitoring
- Error logs
- API request logs
- Maintenance mode
- Settings management
- Bug reports
- Third-party integrations
- Usage statistics

All routes require admin authentication.
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_
from typing import Optional, List, Any
from datetime import datetime, timedelta
from pydantic import BaseModel, Field

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.users.models import User
from app.interviews.models import InterviewSession
from app.resumes.models import Resume
from app.admin.models import (
    ErrorLog, APIRequestLog, SystemSettings,
    BugReport, APIUsage, ThirdPartyIntegration, AIAPILog
)
from app.admin.service import (
    SystemMonitor, DatabaseMonitor, SettingsService,
    ErrorLogService, APILogService, BugReportService,
    IntegrationService
)


router = APIRouter()


# ===========================================
# ADMIN DEPENDENCY
# ===========================================


def get_current_admin(
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> dict:
    """
    Verify current user is an admin.
    Raises 403 if not admin.
    """
    user = db.query(User).filter(User.id == current_user["id"]).first()
    if not user or not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


# ===========================================
# PYDANTIC SCHEMAS
# ===========================================


class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None


class UserStatsResponse(BaseModel):
    total_users: int
    active_users: int
    new_users_this_week: int
    total_interviews: int
    total_resumes: int


# ===========================================
# ADMIN ENDPOINTS
# ===========================================


@router.get(
    "/stats",
    summary="Get admin dashboard stats",
    description="Get overall platform statistics for admin dashboard."
)
async def get_admin_stats(
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get platform-wide statistics."""
    # Total users
    total_users = db.query(func.count(User.id)).scalar() or 0
    
    # Active users
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar() or 0
    
    # New users this week
    week_ago = datetime.utcnow() - timedelta(days=7)
    new_users_this_week = db.query(func.count(User.id)).filter(
        User.created_at >= week_ago
    ).scalar() or 0
    
    # Total interviews
    total_interviews = db.query(func.count(InterviewSession.id)).scalar() or 0
    
    # Total resumes
    total_resumes = db.query(func.count(Resume.id)).scalar() or 0
    
    return {
        "success": True,
        "stats": {
            "total_users": total_users,
            "active_users": active_users,
            "new_users_this_week": new_users_this_week,
            "total_interviews": total_interviews,
            "total_resumes": total_resumes,
        }
    }


@router.get(
    "/users",
    summary="List all users",
    description="Get paginated list of all users with filtering options."
)
async def list_users(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name or email"),
    status: Optional[str] = Query(None, description="Filter by status: active, inactive, all"),
    sort_by: Optional[str] = Query("created_at", description="Sort field"),
    sort_order: Optional[str] = Query("desc", description="Sort order: asc, desc"),
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get paginated list of all users."""
    # Base query
    query = db.query(User)
    
    # Search filter
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (User.name.ilike(search_pattern)) | 
            (User.email.ilike(search_pattern))
        )
    
    # Status filter
    if status == "active":
        query = query.filter(User.is_active == True)
    elif status == "inactive":
        query = query.filter(User.is_active == False)
    
    # Get total count before pagination
    total = query.count()
    
    # Sorting
    sort_column = getattr(User, sort_by, User.created_at)
    if sort_order == "desc":
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(sort_column)
    
    # Pagination
    offset = (page - 1) * limit
    users = query.offset(offset).limit(limit).all()
    
    # Get interview counts for each user
    user_ids = [u.id for u in users]
    interview_counts = {}
    if user_ids:
        counts = db.query(
            InterviewSession.user_id,
            func.count(InterviewSession.id)
        ).filter(
            InterviewSession.user_id.in_(user_ids)
        ).group_by(InterviewSession.user_id).all()
        interview_counts = {uid: count for uid, count in counts}
    
    # Format response
    users_data = []
    for user in users:
        user_dict = user.to_dict()
        user_dict["interview_count"] = interview_counts.get(user.id, 0)
        users_data.append(user_dict)
    
    return {
        "success": True,
        "users": users_data,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit
        }
    }


@router.get(
    "/users/{user_id}",
    summary="Get user details",
    description="Get detailed information about a specific user."
)
async def get_user_details(
    user_id: str,
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get detailed user information including activity stats."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get interview count
    interview_count = db.query(func.count(InterviewSession.id)).filter(
        InterviewSession.user_id == user_id
    ).scalar() or 0
    
    # Get resume count
    resume_count = db.query(func.count(Resume.id)).filter(
        Resume.user_id == user_id
    ).scalar() or 0
    
    # Get recent interviews
    recent_interviews = db.query(InterviewSession).filter(
        InterviewSession.user_id == user_id
    ).order_by(desc(InterviewSession.created_at)).limit(5).all()
    
    return {
        "success": True,
        "user": {
            **user.to_dict(),
            "interview_count": interview_count,
            "resume_count": resume_count,
            "recent_interviews": [
                {
                    "id": i.id,
                    "status": i.status,
                    "target_role": i.target_role,
                    "overall_score": i.overall_score,
                    "created_at": i.created_at.isoformat() if i.created_at else None
                }
                for i in recent_interviews
            ]
        }
    }


@router.put(
    "/users/{user_id}",
    summary="Update user",
    description="Update user details (admin only)."
)
async def update_user(
    user_id: str,
    request: UserUpdateRequest,
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Update user information."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent admin from deactivating themselves
    if user_id == current_admin["id"]:
        if request.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate your own account"
            )
        if request.is_admin is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove your own admin privileges"
            )
    
    # Update fields
    if request.name is not None:
        user.name = request.name.strip()
    if request.is_active is not None:
        user.is_active = request.is_active
    if request.is_admin is not None:
        user.is_admin = request.is_admin
    
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    
    return {
        "success": True,
        "message": "User updated successfully",
        "user": user.to_dict()
    }


@router.delete(
    "/users/{user_id}",
    summary="Delete user",
    description="Permanently delete a user account (admin only)."
)
async def delete_user(
    user_id: str,
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Delete a user account permanently."""
    if user_id == current_admin["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Delete user
    db.delete(user)
    db.commit()
    
    return {
        "success": True,
        "message": f"User {user.email} deleted successfully"
    }


@router.post(
    "/users/{user_id}/toggle-admin",
    summary="Toggle admin status",
    description="Toggle admin privileges for a user."
)
async def toggle_admin_status(
    user_id: str,
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Toggle admin status for a user."""
    if user_id == current_admin["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify your own admin status"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.is_admin = not user.is_admin
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    
    action = "granted" if user.is_admin else "revoked"
    return {
        "success": True,
        "message": f"Admin privileges {action} for {user.email}",
        "user": user.to_dict()
    }


@router.post(
    "/users/{user_id}/toggle-status",
    summary="Toggle user active status",
    description="Enable or disable a user account."
)
async def toggle_user_status(
    user_id: str,
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Toggle active status for a user."""
    if user_id == current_admin["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify your own account status"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.is_active = not user.is_active
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    
    action = "activated" if user.is_active else "deactivated"
    return {
        "success": True,
        "message": f"User {user.email} {action}",
        "user": user.to_dict()
    }


# ===========================================
# SYSTEM HEALTH & MONITORING
# ===========================================


@router.get(
    "/health",
    summary="Get system health",
    description="Get real-time system health metrics including CPU, memory, disk, and database."
)
async def get_system_health(
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get comprehensive system health report."""
    # System metrics
    health = SystemMonitor.get_full_health_report()
    
    # Database health
    db_health = DatabaseMonitor.check_connection(db)
    db_stats = DatabaseMonitor.get_table_stats(db)
    
    return {
        "success": True,
        "health": {
            **health,
            "database": {
                **db_health,
                "table_stats": db_stats
            }
        }
    }


@router.get(
    "/health/realtime",
    summary="Get real-time metrics",
    description="Get lightweight real-time metrics for live dashboard updates."
)
async def get_realtime_metrics(
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get lightweight real-time metrics."""
    cpu = SystemMonitor.get_cpu_usage()
    memory = SystemMonitor.get_memory_usage()
    
    # Recent activity counts
    now = datetime.utcnow()
    hour_ago = now - timedelta(hours=1)
    
    recent_requests = db.query(func.count(APIRequestLog.id)).filter(
        APIRequestLog.created_at >= hour_ago
    ).scalar() or 0
    
    recent_errors = db.query(func.count(ErrorLog.id)).filter(
        ErrorLog.created_at >= hour_ago
    ).scalar() or 0
    
    active_users = db.query(func.count(User.id)).filter(
        User.last_login_at >= hour_ago
    ).scalar() or 0
    
    return {
        "success": True,
        "timestamp": now.isoformat(),
        "metrics": {
            "cpu_percent": cpu.get("usage_percent", 0),
            "memory_percent": memory.get("usage_percent", 0),
            "requests_per_hour": recent_requests,
            "errors_per_hour": recent_errors,
            "active_users": active_users,
            "overall_status": SystemMonitor._calculate_overall_status()
        }
    }


# ===========================================
# ERROR LOGS
# ===========================================


class ErrorLogFilterRequest(BaseModel):
    severity: Optional[str] = None
    status: Optional[str] = None
    hours: int = Field(default=24, ge=1, le=168)
    limit: int = Field(default=50, ge=1, le=500)


@router.get(
    "/errors",
    summary="Get error logs",
    description="Get recent error logs with filtering options."
)
async def get_error_logs(
    severity: Optional[str] = Query(None, description="Filter by severity: critical, error, warning, info"),
    status: Optional[str] = Query(None, description="Filter by status: new, acknowledged, resolved, ignored"),
    hours: int = Query(24, ge=1, le=168, description="Time range in hours"),
    limit: int = Query(50, ge=1, le=500, description="Maximum number of logs"),
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get recent error logs."""
    errors = ErrorLogService.get_recent_errors(
        db, limit=limit, severity=severity, status=status, hours=hours
    )
    stats = ErrorLogService.get_error_stats(db, hours=hours)
    
    return {
        "success": True,
        "errors": [e.to_dict() for e in errors],
        "stats": stats
    }


@router.post(
    "/errors/{error_id}/acknowledge",
    summary="Acknowledge error",
    description="Mark an error as acknowledged."
)
async def acknowledge_error(
    error_id: str,
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Acknowledge an error log."""
    error = db.query(ErrorLog).filter(ErrorLog.id == error_id).first()
    if not error:
        raise HTTPException(status_code=404, detail="Error log not found")
    
    error.status = "acknowledged"
    db.commit()
    
    return {"success": True, "message": "Error acknowledged"}


@router.post(
    "/errors/{error_id}/resolve",
    summary="Resolve error",
    description="Mark an error as resolved."
)
async def resolve_error(
    error_id: str,
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Resolve an error log."""
    error = db.query(ErrorLog).filter(ErrorLog.id == error_id).first()
    if not error:
        raise HTTPException(status_code=404, detail="Error log not found")
    
    error.status = "resolved"
    error.resolved_by = current_admin["id"]
    error.resolved_at = datetime.utcnow()
    db.commit()
    
    return {"success": True, "message": "Error resolved"}


# ===========================================
# API REQUEST LOGS
# ===========================================


@router.get(
    "/api-logs",
    summary="Get API request logs",
    description="Get recent API request logs with statistics."
)
async def get_api_logs(
    endpoint: Optional[str] = Query(None, description="Filter by endpoint"),
    method: Optional[str] = Query(None, description="Filter by HTTP method"),
    status_code: Optional[int] = Query(None, description="Filter by status code"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of logs"),
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get recent API request logs."""
    logs = APILogService.get_recent_requests(
        db, limit=limit, endpoint=endpoint, method=method, status_code=status_code
    )
    stats = APILogService.get_request_stats(db, hours=24)
    
    return {
        "success": True,
        "logs": [log.to_dict() for log in logs],
        "stats": stats
    }


# ===========================================
# AI API LOGS (Gemini & Groq)
# ===========================================


@router.get(
    "/ai-logs",
    summary="Get AI API logs",
    description="Get recent Gemini and Groq API call logs with statistics."
)
async def get_ai_api_logs(
    provider: Optional[str] = Query(None, description="Filter by provider: gemini, groq"),
    operation: Optional[str] = Query(None, description="Filter by operation type"),
    status: Optional[str] = Query(None, description="Filter by status: success, error"),
    hours: int = Query(24, ge=1, le=168, description="Time range in hours"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of logs"),
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get AI API call logs (Gemini & Groq)."""
    since = datetime.utcnow() - timedelta(hours=hours)
    
    query = db.query(AIAPILog).filter(AIAPILog.created_at >= since)
    
    if provider:
        query = query.filter(AIAPILog.provider == provider)
    if operation:
        query = query.filter(AIAPILog.operation.ilike(f"%{operation}%"))
    if status:
        query = query.filter(AIAPILog.status == status)
    
    logs = query.order_by(desc(AIAPILog.created_at)).limit(limit).all()
    
    # Calculate stats
    total_calls = db.query(func.count(AIAPILog.id)).filter(AIAPILog.created_at >= since).scalar() or 0
    gemini_calls = db.query(func.count(AIAPILog.id)).filter(
        AIAPILog.created_at >= since, AIAPILog.provider == "gemini"
    ).scalar() or 0
    groq_calls = db.query(func.count(AIAPILog.id)).filter(
        AIAPILog.created_at >= since, AIAPILog.provider == "groq"
    ).scalar() or 0
    error_calls = db.query(func.count(AIAPILog.id)).filter(
        AIAPILog.created_at >= since, AIAPILog.status == "error"
    ).scalar() or 0
    
    # Token usage
    total_tokens = db.query(func.sum(AIAPILog.total_tokens)).filter(
        AIAPILog.created_at >= since
    ).scalar() or 0
    
    # Average response time
    avg_response_time = db.query(func.avg(AIAPILog.response_time_ms)).filter(
        AIAPILog.created_at >= since, AIAPILog.response_time_ms.isnot(None)
    ).scalar() or 0
    
    return {
        "success": True,
        "logs": [log.to_dict() for log in logs],
        "stats": {
            "total_calls": total_calls,
            "gemini_calls": gemini_calls,
            "groq_calls": groq_calls,
            "error_calls": error_calls,
            "success_rate": round((total_calls - error_calls) / total_calls * 100, 1) if total_calls > 0 else 100,
            "total_tokens": total_tokens,
            "avg_response_time_ms": round(avg_response_time, 1),
            "hours": hours
        }
    }


@router.get(
    "/ai-logs/stats",
    summary="Get AI API usage statistics",
    description="Get detailed AI API usage statistics by provider and operation."
)
async def get_ai_api_stats(
    days: int = Query(7, ge=1, le=30, description="Time range in days"),
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get AI API usage statistics."""
    since = datetime.utcnow() - timedelta(days=days)
    
    # Usage by provider
    provider_stats = db.query(
        AIAPILog.provider,
        func.count(AIAPILog.id).label("calls"),
        func.sum(AIAPILog.total_tokens).label("tokens"),
        func.avg(AIAPILog.response_time_ms).label("avg_time")
    ).filter(
        AIAPILog.created_at >= since
    ).group_by(AIAPILog.provider).all()
    
    # Usage by operation
    operation_stats = db.query(
        AIAPILog.operation,
        func.count(AIAPILog.id).label("calls")
    ).filter(
        AIAPILog.created_at >= since
    ).group_by(AIAPILog.operation).order_by(desc("calls")).limit(10).all()
    
    # Daily breakdown
    daily_stats = []
    for i in range(days):
        day_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        
        day_calls = db.query(func.count(AIAPILog.id)).filter(
            and_(AIAPILog.created_at >= day_start, AIAPILog.created_at < day_end)
        ).scalar() or 0
        
        day_tokens = db.query(func.sum(AIAPILog.total_tokens)).filter(
            and_(AIAPILog.created_at >= day_start, AIAPILog.created_at < day_end)
        ).scalar() or 0
        
        daily_stats.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "calls": day_calls,
            "tokens": day_tokens or 0
        })
    
    daily_stats.reverse()
    
    return {
        "success": True,
        "stats": {
            "by_provider": [
                {
                    "provider": p.provider,
                    "calls": p.calls,
                    "tokens": p.tokens or 0,
                    "avg_response_time_ms": round(p.avg_time or 0, 1)
                }
                for p in provider_stats
            ],
            "by_operation": [
                {"operation": o.operation, "calls": o.calls}
                for o in operation_stats
            ],
            "daily": daily_stats,
            "period_days": days
        }
    }


# ===========================================
# USAGE STATISTICS
# ===========================================


@router.get(
    "/usage-stats",
    summary="Get usage statistics",
    description="Get comprehensive platform usage statistics."
)
async def get_usage_stats(
    days: int = Query(7, ge=1, le=30, description="Time range in days"),
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get detailed usage statistics."""
    since = datetime.utcnow() - timedelta(days=days)
    
    # User stats
    total_users = db.query(func.count(User.id)).scalar() or 0
    new_users = db.query(func.count(User.id)).filter(User.created_at >= since).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.last_login_at >= since).scalar() or 0
    
    # Interview stats
    total_interviews = db.query(func.count(InterviewSession.id)).scalar() or 0
    recent_interviews = db.query(func.count(InterviewSession.id)).filter(
        InterviewSession.created_at >= since
    ).scalar() or 0
    
    # Daily breakdown
    daily_stats = []
    for i in range(days):
        day_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        
        interviews = db.query(func.count(InterviewSession.id)).filter(
            and_(InterviewSession.created_at >= day_start, InterviewSession.created_at < day_end)
        ).scalar() or 0
        
        signups = db.query(func.count(User.id)).filter(
            and_(User.created_at >= day_start, User.created_at < day_end)
        ).scalar() or 0
        
        api_requests = db.query(func.count(APIRequestLog.id)).filter(
            and_(APIRequestLog.created_at >= day_start, APIRequestLog.created_at < day_end)
        ).scalar() or 0
        
        daily_stats.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "interviews": interviews,
            "signups": signups,
            "api_requests": api_requests
        })
    
    daily_stats.reverse()
    
    # Resume stats
    total_resumes = db.query(func.count(Resume.id)).scalar() or 0
    
    return {
        "success": True,
        "stats": {
            "users": {
                "total": total_users,
                "new": new_users,
                "active": active_users
            },
            "interviews": {
                "total": total_interviews,
                "recent": recent_interviews
            },
            "resumes": {
                "total": total_resumes
            },
            "daily": daily_stats,
            "period_days": days
        }
    }


# ===========================================
# SETTINGS & MAINTENANCE MODE
# ===========================================


class SettingUpdateRequest(BaseModel):
    value: str


@router.get(
    "/settings",
    summary="Get all settings",
    description="Get all system settings grouped by category."
)
async def get_settings(
    category: Optional[str] = Query(None, description="Filter by category"),
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get all system settings."""
    # Initialize default settings if needed
    SettingsService.initialize_settings(db)
    
    settings_list = SettingsService.get_all_settings(db, category=category)
    
    # Group by category
    grouped = {}
    for setting in settings_list:
        cat = setting.category or "general"
        if cat not in grouped:
            grouped[cat] = []
        grouped[cat].append(setting.to_dict(hide_sensitive=True))
    
    return {
        "success": True,
        "settings": grouped
    }


@router.put(
    "/settings/{key}",
    summary="Update setting",
    description="Update a system setting value."
)
async def update_setting(
    key: str,
    request: SettingUpdateRequest,
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Update a system setting."""
    setting = SettingsService.set_setting(
        db, key, request.value, updated_by=current_admin["id"]
    )
    
    return {
        "success": True,
        "message": f"Setting '{key}' updated",
        "setting": setting.to_dict(hide_sensitive=True)
    }


@router.get(
    "/maintenance",
    summary="Get maintenance status",
    description="Check if maintenance mode is enabled."
)
async def get_maintenance_status(
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get maintenance mode status."""
    is_maintenance = SettingsService.is_maintenance_mode(db)
    message = SettingsService.get_setting(db, "maintenance_message", "")
    
    return {
        "success": True,
        "maintenance_mode": is_maintenance,
        "message": message
    }


@router.post(
    "/maintenance/toggle",
    summary="Toggle maintenance mode",
    description="Enable or disable maintenance mode."
)
async def toggle_maintenance(
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Toggle maintenance mode."""
    current = SettingsService.is_maintenance_mode(db)
    SettingsService.set_setting(db, "maintenance_mode", str(not current).lower(), current_admin["id"])
    
    status = "enabled" if not current else "disabled"
    return {
        "success": True,
        "message": f"Maintenance mode {status}",
        "maintenance_mode": not current
    }


class MaintenanceMessageRequest(BaseModel):
    message: str


@router.put(
    "/maintenance/message",
    summary="Update maintenance message",
    description="Set the message shown during maintenance mode."
)
async def update_maintenance_message(
    request: MaintenanceMessageRequest,
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Update maintenance message."""
    SettingsService.set_setting(db, "maintenance_message", request.message, current_admin["id"])
    
    return {
        "success": True,
        "message": "Maintenance message updated"
    }


# ===========================================
# BUG REPORTS
# ===========================================


class BugReportCreateRequest(BaseModel):
    title: str
    description: str
    category: str = "general"
    severity: str = "medium"
    page_url: Optional[str] = None
    browser_info: Optional[str] = None


class BugReportUpdateRequest(BaseModel):
    status: Optional[str] = None
    admin_notes: Optional[str] = None
    assigned_to: Optional[str] = None


@router.get(
    "/bug-reports",
    summary="Get bug reports",
    description="Get all bug reports with filtering options."
)
async def get_bug_reports(
    status: Optional[str] = Query(None, description="Filter by status"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    limit: int = Query(50, ge=1, le=200),
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get bug reports."""
    reports = BugReportService.get_reports(db, status=status, severity=severity, limit=limit)
    
    # Stats
    total = db.query(func.count(BugReport.id)).scalar() or 0
    open_count = db.query(func.count(BugReport.id)).filter(
        BugReport.status.in_(["new", "in_progress"])
    ).scalar() or 0
    
    return {
        "success": True,
        "reports": [r.to_dict() for r in reports],
        "stats": {
            "total": total,
            "open": open_count
        }
    }


@router.put(
    "/bug-reports/{report_id}",
    summary="Update bug report",
    description="Update a bug report's status or notes."
)
async def update_bug_report(
    report_id: str,
    request: BugReportUpdateRequest,
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Update a bug report."""
    report = BugReportService.update_report(
        db, report_id,
        status=request.status,
        admin_notes=request.admin_notes,
        assigned_to=request.assigned_to
    )
    
    if not report:
        raise HTTPException(status_code=404, detail="Bug report not found")
    
    return {
        "success": True,
        "message": "Bug report updated",
        "report": report.to_dict()
    }


# ===========================================
# THIRD-PARTY INTEGRATIONS
# ===========================================


class IntegrationUpdateRequest(BaseModel):
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    config: Optional[dict] = None
    is_enabled: Optional[bool] = None


@router.get(
    "/integrations",
    summary="Get all integrations",
    description="Get all third-party integration configurations."
)
async def get_integrations(
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get all integrations."""
    # Initialize default integrations if needed
    IntegrationService.initialize_integrations(db)
    
    integrations = IntegrationService.get_all_integrations(db)
    
    return {
        "success": True,
        "integrations": [i.to_dict(hide_secrets=True) for i in integrations]
    }


@router.put(
    "/integrations/{integration_id}",
    summary="Update integration",
    description="Update a third-party integration configuration."
)
async def update_integration(
    integration_id: str,
    request: IntegrationUpdateRequest,
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Update an integration."""
    integration = IntegrationService.update_integration(
        db, integration_id,
        api_key=request.api_key,
        api_secret=request.api_secret,
        config=request.config,
        is_enabled=request.is_enabled
    )
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    return {
        "success": True,
        "message": f"Integration '{integration.display_name}' updated",
        "integration": integration.to_dict(hide_secrets=True)
    }


@router.post(
    "/integrations/{integration_name}/health-check",
    summary="Check integration health",
    description="Run a health check on a specific integration."
)
async def check_integration_health(
    integration_name: str,
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Check health of an integration."""
    result = await IntegrationService.check_integration_health(db, integration_name)
    
    return {
        "success": True,
        "integration": integration_name,
        "health": result
    }


# ===========================================
# API USAGE & LIMITS
# ===========================================


@router.get(
    "/api-limits",
    summary="Get API rate limits",
    description="Get current API rate limit configurations."
)
async def get_api_limits(
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get API rate limit settings."""
    limits = {
        "requests_per_minute": SettingsService.get_setting(db, "rate_limit_requests_per_minute", 60),
        "interviews_per_day": SettingsService.get_setting(db, "rate_limit_interviews_per_day", 10),
        "ai_calls_per_hour": SettingsService.get_setting(db, "rate_limit_ai_calls_per_hour", 100),
    }
    
    return {
        "success": True,
        "limits": limits
    }


class APILimitUpdateRequest(BaseModel):
    requests_per_minute: Optional[int] = None
    interviews_per_day: Optional[int] = None
    ai_calls_per_hour: Optional[int] = None


@router.put(
    "/api-limits",
    summary="Update API rate limits",
    description="Update API rate limit configurations."
)
async def update_api_limits(
    request: APILimitUpdateRequest,
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Update API rate limits."""
    if request.requests_per_minute is not None:
        SettingsService.set_setting(db, "rate_limit_requests_per_minute", request.requests_per_minute, current_admin["id"])
    if request.interviews_per_day is not None:
        SettingsService.set_setting(db, "rate_limit_interviews_per_day", request.interviews_per_day, current_admin["id"])
    if request.ai_calls_per_hour is not None:
        SettingsService.set_setting(db, "rate_limit_ai_calls_per_hour", request.ai_calls_per_hour, current_admin["id"])
    
    return {
        "success": True,
        "message": "API limits updated"
    }


# ===========================================
# API KEY MANAGEMENT
# ===========================================

class APIKeyUpdateRequest(BaseModel):
    gemini_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None


@router.get(
    "/api-keys",
    summary="Get API keys status",
    description="Get current API key configuration status (masked for security)."
)
async def get_api_keys(
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get API keys configuration status."""
    from app.core.config import settings
    
    # Get from database (overrides) or fall back to .env
    db_gemini = SettingsService.get_setting(db, "gemini_api_key", "")
    db_groq = SettingsService.get_setting(db, "groq_api_key", "")
    
    # Active keys (DB override or .env)
    active_gemini = db_gemini if db_gemini else settings.GEMINI_API_KEY
    active_groq = db_groq if db_groq else settings.GROQ_API_KEY
    
    def mask_key(key: str) -> str:
        if not key:
            return ""
        if len(key) <= 8:
            return "*" * len(key)
        return key[:4] + "*" * (len(key) - 8) + key[-4:]
    
    return {
        "success": True,
        "api_keys": {
            "gemini": {
                "configured": bool(active_gemini),
                "source": "database" if db_gemini else ("env" if settings.GEMINI_API_KEY else "none"),
                "masked_key": mask_key(active_gemini),
                "key_length": len(active_gemini) if active_gemini else 0
            },
            "groq": {
                "configured": bool(active_groq),
                "source": "database" if db_groq else ("env" if settings.GROQ_API_KEY else "none"),
                "masked_key": mask_key(active_groq),
                "key_length": len(active_groq) if active_groq else 0
            }
        }
    }


@router.put(
    "/api-keys",
    summary="Update API keys",
    description="Update API keys. Keys are stored in database and override .env values."
)
async def update_api_keys(
    request: APIKeyUpdateRequest,
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Update API keys."""
    updated = []
    
    if request.gemini_api_key is not None:
        SettingsService.set_setting(db, "gemini_api_key", request.gemini_api_key, current_admin["id"])
        # Update runtime config
        from app.core.config import settings
        settings.GEMINI_API_KEY = request.gemini_api_key
        # Reconfigure Gemini
        try:
            import google.generativeai as genai  # type: ignore
            if request.gemini_api_key:
                genai.configure(api_key=request.gemini_api_key)
        except Exception:
            pass
        updated.append("gemini")
    
    if request.groq_api_key is not None:
        SettingsService.set_setting(db, "groq_api_key", request.groq_api_key, current_admin["id"])
        # Update runtime config
        from app.core.config import settings
        settings.GROQ_API_KEY = request.groq_api_key
        updated.append("groq")
    
    return {
        "success": True,
        "message": f"API keys updated: {', '.join(updated)}",
        "updated_keys": updated
    }


@router.post(
    "/api-keys/test",
    summary="Test API keys",
    description="Test if API keys are valid by making test requests."
)
async def test_api_keys(
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Test API key validity."""
    from app.core.config import settings
    import asyncio
    
    results = {}
    
    # Get active keys
    db_gemini = SettingsService.get_setting(db, "gemini_api_key", "")
    db_groq = SettingsService.get_setting(db, "groq_api_key", "")
    
    active_gemini = db_gemini if db_gemini else settings.GEMINI_API_KEY
    active_groq = db_groq if db_groq else settings.GROQ_API_KEY
    
    # Test Gemini
    if active_gemini:
        try:
            import google.generativeai as genai  # type: ignore
            genai.configure(api_key=active_gemini)
            model = genai.GenerativeModel('gemini-1.5-flash')
            response = model.generate_content("Say 'API key is valid' in exactly 5 words")
            results["gemini"] = {
                "valid": True,
                "message": "Gemini API key is valid and working",
                "test_response": str(response.text)[:100] if response.text else "OK"
            }
        except Exception as e:
            results["gemini"] = {
                "valid": False,
                "message": f"Gemini API key test failed: {str(e)}"
            }
    else:
        results["gemini"] = {
            "valid": False,
            "message": "No Gemini API key configured"
        }
    
    # Test Groq
    if active_groq:
        try:
            from groq import Groq  # type: ignore
            client = Groq(api_key=active_groq)
            response = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": "Say 'API key valid' in 3 words"}],
                max_tokens=20
            )
            results["groq"] = {
                "valid": True,
                "message": "Groq API key is valid and working",
                "test_response": response.choices[0].message.content[:100] if response.choices else "OK"
            }
        except Exception as e:
            results["groq"] = {
                "valid": False,
                "message": f"Groq API key test failed: {str(e)}"
            }
    else:
        results["groq"] = {
            "valid": False,
            "message": "No Groq API key configured"
        }
    
    return {
        "success": True,
        "results": results
    }


@router.delete(
    "/api-keys/{provider}",
    summary="Remove API key override",
    description="Remove database override for an API key, reverting to .env value."
)
async def remove_api_key_override(
    provider: str,
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Remove API key database override."""
    key_map = {
        "gemini": "gemini_api_key",
        "groq": "groq_api_key"
    }
    
    if provider not in key_map:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")
    
    # Remove from database
    setting = db.query(SystemSettings).filter(SystemSettings.key == key_map[provider]).first()
    if setting:
        setting.value = ""
        db.commit()
    
    return {
        "success": True,
        "message": f"API key override for {provider} removed. Now using .env value if available."
    }


# ===========================================
# BROADCAST / ANNOUNCEMENTS
# ===========================================

from app.admin.models import Broadcast


class BroadcastCreateRequest(BaseModel):
    title: str
    message: str
    type: str = "info"  # info, warning, success, urgent
    expiresInHours: Optional[int] = 24


@router.get(
    "/broadcasts",
    summary="Get all broadcasts",
    description="Get all broadcast messages."
)
async def get_broadcasts(
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get all broadcast messages."""
    broadcasts = db.query(Broadcast).order_by(Broadcast.created_at.desc()).all()
    
    return {
        "success": True,
        "broadcasts": [b.to_dict() for b in broadcasts]
    }


@router.post(
    "/broadcasts",
    summary="Create broadcast",
    description="Create a new broadcast message for all users."
)
async def create_broadcast(
    request: BroadcastCreateRequest,
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Create a new broadcast."""
    from datetime import timedelta
    
    expires_at = None
    if request.expiresInHours and request.expiresInHours > 0:
        expires_at = datetime.utcnow() + timedelta(hours=request.expiresInHours)
    
    broadcast = Broadcast(
        title=request.title,
        message=request.message,
        type=request.type,
        expires_at=expires_at,
        created_by=current_admin.get("id"),
        is_active=True
    )
    
    db.add(broadcast)
    db.commit()
    db.refresh(broadcast)
    
    return {
        "success": True,
        "message": "Broadcast created successfully",
        "broadcast": broadcast.to_dict()
    }


@router.delete(
    "/broadcasts/{broadcast_id}",
    summary="Delete broadcast",
    description="Delete a broadcast message."
)
async def delete_broadcast(
    broadcast_id: str,
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Delete a broadcast."""
    broadcast = db.query(Broadcast).filter(Broadcast.id == broadcast_id).first()
    
    if not broadcast:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    
    db.delete(broadcast)
    db.commit()
    
    return {
        "success": True,
        "message": "Broadcast deleted"
    }


@router.post(
    "/broadcasts/{broadcast_id}/toggle",
    summary="Toggle broadcast visibility",
    description="Toggle a broadcast's active status."
)
async def toggle_broadcast(
    broadcast_id: str,
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Toggle broadcast active status."""
    broadcast = db.query(Broadcast).filter(Broadcast.id == broadcast_id).first()
    
    if not broadcast:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    
    broadcast.is_active = not broadcast.is_active
    db.commit()
    db.refresh(broadcast)
    
    return {
        "success": True,
        "message": f"Broadcast {'activated' if broadcast.is_active else 'deactivated'}",
        "broadcast": broadcast.to_dict()
    }


# ===========================================
# TOON (Token-Oriented Object Notation) STATUS
# ===========================================

@router.get(
    "/toon-status",
    summary="Get TOON encoding status",
    description="Get TOON format status and token savings statistics."
)
async def get_toon_status(
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get TOON encoding status and statistics."""
    from app.utils.toon_encoder import check_toon_status, get_toon_stats
    
    status = check_toon_status()
    stats = get_toon_stats()
    
    return {
        "success": True,
        "toon": {
            "available": status["available"],
            "version": status["version"],
            "message": status["message"],
            "stats": {
                "encoding_calls": stats["calls"],
                "json_characters_original": stats["json_chars"],
                "toon_characters_encoded": stats["toon_chars"],
                "savings_percent": stats["savings_percent"],
                "tokens_saved_estimate": int((stats["json_chars"] - stats["toon_chars"]) / 4)  # ~4 chars per token
            }
        }
    }


@router.post(
    "/toon-status/reset",
    summary="Reset TOON statistics",
    description="Reset TOON encoding statistics counters."
)
async def reset_toon_stats_endpoint(
    current_admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Reset TOON statistics."""
    from app.utils.toon_encoder import reset_toon_stats
    
    reset_toon_stats()
    
    return {
        "success": True,
        "message": "TOON statistics reset"
    }

