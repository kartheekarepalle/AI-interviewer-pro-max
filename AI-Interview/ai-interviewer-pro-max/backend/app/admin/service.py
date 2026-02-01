"""
Admin Service

Business logic for admin panel features including:
- System health monitoring
- Error log management
- API usage tracking
- Maintenance mode
- Third-party integrations
"""

import os
import psutil
import platform
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_
import asyncio

from app.admin.models import (
    ErrorLog, APIRequestLog, SystemSettings, 
    BugReport, APIUsage, ThirdPartyIntegration, AIAPILog
)
from app.users.models import User
from app.interviews.models import InterviewSession
from app.resumes.models import Resume
from app.core.config import settings


# ===========================================
# SYSTEM HEALTH MONITORING
# ===========================================

class SystemMonitor:
    """Real-time system health monitoring."""
    
    @staticmethod
    def get_cpu_usage() -> Dict[str, Any]:
        """Get CPU usage statistics."""
        try:
            cpu_percent = psutil.cpu_percent(interval=0.1)
            cpu_count = psutil.cpu_count()
            cpu_freq = psutil.cpu_freq()
            
            return {
                "usage_percent": cpu_percent,
                "core_count": cpu_count,
                "frequency_mhz": cpu_freq.current if cpu_freq else None,
                "status": "healthy" if cpu_percent < 80 else "warning" if cpu_percent < 95 else "critical"
            }
        except Exception as e:
            return {"error": str(e), "status": "unknown"}
    
    @staticmethod
    def get_memory_usage() -> Dict[str, Any]:
        """Get memory usage statistics."""
        try:
            memory = psutil.virtual_memory()
            
            return {
                "total_gb": round(memory.total / (1024**3), 2),
                "available_gb": round(memory.available / (1024**3), 2),
                "used_gb": round(memory.used / (1024**3), 2),
                "usage_percent": memory.percent,
                "status": "healthy" if memory.percent < 80 else "warning" if memory.percent < 95 else "critical"
            }
        except Exception as e:
            return {"error": str(e), "status": "unknown"}
    
    @staticmethod
    def get_disk_usage() -> Dict[str, Any]:
        """Get disk usage statistics."""
        try:
            disk = psutil.disk_usage('/')
            
            return {
                "total_gb": round(disk.total / (1024**3), 2),
                "used_gb": round(disk.used / (1024**3), 2),
                "free_gb": round(disk.free / (1024**3), 2),
                "usage_percent": disk.percent,
                "status": "healthy" if disk.percent < 80 else "warning" if disk.percent < 95 else "critical"
            }
        except Exception as e:
            return {"error": str(e), "status": "unknown"}
    
    @staticmethod
    def get_system_info() -> Dict[str, Any]:
        """Get general system information."""
        try:
            boot_time = datetime.fromtimestamp(psutil.boot_time())
            uptime = datetime.now() - boot_time
            
            return {
                "platform": platform.system(),
                "platform_version": platform.version(),
                "python_version": platform.python_version(),
                "hostname": platform.node(),
                "uptime_hours": round(uptime.total_seconds() / 3600, 2),
                "uptime_formatted": str(uptime).split('.')[0],
                "boot_time": boot_time.isoformat(),
            }
        except Exception as e:
            return {"error": str(e)}
    
    @staticmethod
    def get_process_info() -> Dict[str, Any]:
        """Get current process information."""
        try:
            process = psutil.Process()
            
            return {
                "pid": process.pid,
                "memory_mb": round(process.memory_info().rss / (1024**2), 2),
                "cpu_percent": process.cpu_percent(),
                "threads": process.num_threads(),
                "status": process.status(),
            }
        except Exception as e:
            return {"error": str(e)}
    
    @classmethod
    def get_full_health_report(cls) -> Dict[str, Any]:
        """Get complete system health report."""
        return {
            "timestamp": datetime.utcnow().isoformat() + 'Z',
            "cpu": cls.get_cpu_usage(),
            "memory": cls.get_memory_usage(),
            "disk": cls.get_disk_usage(),
            "system": cls.get_system_info(),
            "process": cls.get_process_info(),
            "overall_status": cls._calculate_overall_status()
        }
    
    @classmethod
    def _calculate_overall_status(cls) -> str:
        """Calculate overall system health status."""
        cpu = cls.get_cpu_usage()
        memory = cls.get_memory_usage()
        disk = cls.get_disk_usage()
        
        statuses = [
            cpu.get("status", "unknown"),
            memory.get("status", "unknown"),
            disk.get("status", "unknown")
        ]
        
        if "critical" in statuses:
            return "critical"
        elif "warning" in statuses:
            return "warning"
        elif "unknown" in statuses:
            return "unknown"
        return "healthy"


# ===========================================
# DATABASE HEALTH CHECK
# ===========================================

class DatabaseMonitor:
    """Database health monitoring."""
    
    @staticmethod
    def check_connection(db: Session) -> Dict[str, Any]:
        """Check database connection health."""
        try:
            from sqlalchemy import text
            start = datetime.now()
            db.execute(text("SELECT 1"))
            latency = (datetime.now() - start).total_seconds() * 1000
            
            return {
                "connected": True,
                "latency_ms": round(latency, 2),
                "response_time_ms": round(latency, 2),
                "status": "healthy" if latency < 100 else "warning" if latency < 500 else "degraded"
            }
        except Exception as e:
            return {
                "connected": False,
                "error": str(e),
                "status": "down"
            }
    
    @staticmethod
    def get_table_stats(db: Session) -> Dict[str, int]:
        """Get row counts for main tables."""
        try:
            return {
                "users": db.query(func.count(User.id)).scalar() or 0,
                "interviews": db.query(func.count(InterviewSession.id)).scalar() or 0,
                "resumes": db.query(func.count(Resume.id)).scalar() or 0,
                "error_logs": db.query(func.count(ErrorLog.id)).scalar() or 0,
                "api_logs": db.query(func.count(APIRequestLog.id)).scalar() or 0,
                "bug_reports": db.query(func.count(BugReport.id)).scalar() or 0,
            }
        except Exception as e:
            return {"error": str(e)}


# ===========================================
# SETTINGS SERVICE
# ===========================================

class SettingsService:
    """Manage system settings."""
    
    # Default settings with their configurations
    DEFAULT_SETTINGS = {
        # Maintenance
        "maintenance_mode": {"value": "false", "type": "boolean", "category": "maintenance", "description": "Enable maintenance mode to block user access"},
        "maintenance_message": {"value": "System is under maintenance. Please try again later.", "type": "string", "category": "maintenance", "description": "Message shown during maintenance"},
        
        # API Keys
        "gemini_api_key": {"value": "", "type": "string", "category": "api", "description": "Google Gemini API Key", "sensitive": True},
        "groq_api_key": {"value": "", "type": "string", "category": "api", "description": "Groq API Key", "sensitive": True},
        "openai_api_key": {"value": "", "type": "string", "category": "api", "description": "OpenAI API Key (optional)", "sensitive": True},
        
        # Rate Limits
        "rate_limit_requests_per_minute": {"value": "60", "type": "integer", "category": "limits", "description": "Maximum API requests per minute per user"},
        "rate_limit_interviews_per_day": {"value": "10", "type": "integer", "category": "limits", "description": "Maximum interviews per day per user"},
        "rate_limit_ai_calls_per_hour": {"value": "100", "type": "integer", "category": "limits", "description": "Maximum AI API calls per hour per user"},
        
        # General
        "app_name": {"value": "AI Interviewer Pro Max", "type": "string", "category": "general", "description": "Application display name"},
        "support_email": {"value": "support@aiinterviewer.com", "type": "string", "category": "general", "description": "Support email address"},
        "max_upload_size_mb": {"value": "10", "type": "integer", "category": "general", "description": "Maximum file upload size in MB"},
    }
    
    @classmethod
    def initialize_settings(cls, db: Session):
        """Initialize default settings if not exists."""
        for key, config in cls.DEFAULT_SETTINGS.items():
            existing = db.query(SystemSettings).filter(SystemSettings.key == key).first()
            if not existing:
                setting = SystemSettings(
                    key=key,
                    value=config.get("value", ""),
                    value_type=config.get("type", "string"),
                    category=config.get("category", "general"),
                    description=config.get("description", ""),
                    is_sensitive=config.get("sensitive", False)
                )
                db.add(setting)
        db.commit()
    
    @staticmethod
    def get_setting(db: Session, key: str, default: Any = None) -> Any:
        """Get a setting value by key."""
        setting = db.query(SystemSettings).filter(SystemSettings.key == key).first()
        if not setting:
            return default
        
        # Convert based on type
        if setting.value_type == "boolean":
            return setting.value.lower() == "true"
        elif setting.value_type == "integer":
            return int(setting.value) if setting.value else 0
        elif setting.value_type == "json":
            import json
            return json.loads(setting.value) if setting.value else {}
        return setting.value
    
    @staticmethod
    def set_setting(db: Session, key: str, value: Any, updated_by: str = None) -> SystemSettings:
        """Set a setting value."""
        setting = db.query(SystemSettings).filter(SystemSettings.key == key).first()
        if setting:
            setting.value = str(value)
            setting.updated_by = updated_by
            setting.updated_at = datetime.utcnow()
        else:
            setting = SystemSettings(key=key, value=str(value), updated_by=updated_by)
            db.add(setting)
        db.commit()
        db.refresh(setting)
        return setting
    
    @staticmethod
    def get_all_settings(db: Session, category: str = None) -> List[SystemSettings]:
        """Get all settings, optionally filtered by category."""
        query = db.query(SystemSettings)
        if category:
            query = query.filter(SystemSettings.category == category)
        return query.order_by(SystemSettings.category, SystemSettings.key).all()
    
    @staticmethod
    def is_maintenance_mode(db: Session) -> bool:
        """Check if maintenance mode is enabled."""
        return SettingsService.get_setting(db, "maintenance_mode", False)


# ===========================================
# ERROR LOG SERVICE
# ===========================================

class ErrorLogService:
    """Manage error logs."""
    
    @staticmethod
    def log_error(
        db: Session,
        error_type: str,
        error_message: str,
        stack_trace: str = None,
        endpoint: str = None,
        method: str = None,
        user_id: str = None,
        ip_address: str = None,
        user_agent: str = None,
        request_data: dict = None,
        severity: str = "error"
    ) -> ErrorLog:
        """Log an error to the database."""
        error_log = ErrorLog(
            error_type=error_type,
            error_message=error_message,
            stack_trace=stack_trace,
            endpoint=endpoint,
            method=method,
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            request_data=request_data,
            severity=severity
        )
        db.add(error_log)
        db.commit()
        db.refresh(error_log)
        return error_log
    
    @staticmethod
    def get_recent_errors(
        db: Session,
        limit: int = 50,
        severity: str = None,
        status: str = None,
        hours: int = 24
    ) -> List[ErrorLog]:
        """Get recent error logs."""
        since = datetime.utcnow() - timedelta(hours=hours)
        query = db.query(ErrorLog).filter(ErrorLog.created_at >= since)
        
        if severity:
            query = query.filter(ErrorLog.severity == severity)
        if status:
            query = query.filter(ErrorLog.status == status)
        
        return query.order_by(desc(ErrorLog.created_at)).limit(limit).all()
    
    @staticmethod
    def get_error_stats(db: Session, hours: int = 24) -> Dict[str, Any]:
        """Get error statistics."""
        since = datetime.utcnow() - timedelta(hours=hours)
        
        total = db.query(func.count(ErrorLog.id)).filter(
            ErrorLog.created_at >= since
        ).scalar() or 0
        
        by_severity = db.query(
            ErrorLog.severity,
            func.count(ErrorLog.id)
        ).filter(
            ErrorLog.created_at >= since
        ).group_by(ErrorLog.severity).all()
        
        by_status = db.query(
            ErrorLog.status,
            func.count(ErrorLog.id)
        ).filter(
            ErrorLog.created_at >= since
        ).group_by(ErrorLog.status).all()
        
        return {
            "total": total,
            "by_severity": {s: c for s, c in by_severity},
            "by_status": {s: c for s, c in by_status},
            "period_hours": hours
        }


# ===========================================
# API REQUEST LOG SERVICE
# ===========================================

class APILogService:
    """Manage API request logs."""
    
    @staticmethod
    def log_request(
        db: Session,
        endpoint: str,
        method: str,
        status_code: int,
        response_time_ms: float,
        user_id: str = None,
        ip_address: str = None,
        user_agent: str = None,
        request_size: int = None,
        response_size: int = None
    ) -> APIRequestLog:
        """Log an API request."""
        log = APIRequestLog(
            endpoint=endpoint,
            method=method,
            status_code=status_code,
            response_time_ms=response_time_ms,
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            request_size=request_size,
            response_size=response_size
        )
        db.add(log)
        db.commit()
        return log
    
    @staticmethod
    def get_recent_requests(
        db: Session,
        limit: int = 100,
        endpoint: str = None,
        method: str = None,
        status_code: int = None
    ) -> List[APIRequestLog]:
        """Get recent API request logs."""
        query = db.query(APIRequestLog)
        
        if endpoint:
            query = query.filter(APIRequestLog.endpoint.contains(endpoint))
        if method:
            query = query.filter(APIRequestLog.method == method)
        if status_code:
            query = query.filter(APIRequestLog.status_code == status_code)
        
        return query.order_by(desc(APIRequestLog.created_at)).limit(limit).all()
    
    @staticmethod
    def get_request_stats(db: Session, hours: int = 24) -> Dict[str, Any]:
        """Get API request statistics."""
        since = datetime.utcnow() - timedelta(hours=hours)
        
        total = db.query(func.count(APIRequestLog.id)).filter(
            APIRequestLog.created_at >= since
        ).scalar() or 0
        
        avg_response_time = db.query(func.avg(APIRequestLog.response_time_ms)).filter(
            APIRequestLog.created_at >= since
        ).scalar() or 0
        
        by_status = db.query(
            APIRequestLog.status_code,
            func.count(APIRequestLog.id)
        ).filter(
            APIRequestLog.created_at >= since
        ).group_by(APIRequestLog.status_code).all()
        
        by_endpoint = db.query(
            APIRequestLog.endpoint,
            func.count(APIRequestLog.id)
        ).filter(
            APIRequestLog.created_at >= since
        ).group_by(APIRequestLog.endpoint).order_by(
            desc(func.count(APIRequestLog.id))
        ).limit(10).all()
        
        error_count = db.query(func.count(APIRequestLog.id)).filter(
            and_(
                APIRequestLog.created_at >= since,
                APIRequestLog.status_code >= 400
            )
        ).scalar() or 0
        
        return {
            "total_requests": total,
            "avg_response_time_ms": round(avg_response_time, 2),
            "error_count": error_count,
            "error_rate": round(error_count / total * 100, 2) if total > 0 else 0,
            "by_status": {str(s): c for s, c in by_status},
            "top_endpoints": [{"endpoint": e, "count": c} for e, c in by_endpoint],
            "period_hours": hours
        }


# ===========================================
# BUG REPORT SERVICE
# ===========================================

class BugReportService:
    """Manage bug reports from users."""
    
    @staticmethod
    def create_report(
        db: Session,
        title: str,
        description: str,
        user_id: str = None,
        user_email: str = None,
        user_name: str = None,
        category: str = "general",
        severity: str = "medium",
        page_url: str = None,
        browser_info: str = None
    ) -> BugReport:
        """Create a new bug report."""
        report = BugReport(
            title=title,
            description=description,
            user_id=user_id,
            user_email=user_email,
            user_name=user_name,
            category=category,
            severity=severity,
            page_url=page_url,
            browser_info=browser_info
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        return report
    
    @staticmethod
    def get_reports(
        db: Session,
        status: str = None,
        severity: str = None,
        limit: int = 50
    ) -> List[BugReport]:
        """Get bug reports with optional filters."""
        query = db.query(BugReport)
        
        if status:
            query = query.filter(BugReport.status == status)
        if severity:
            query = query.filter(BugReport.severity == severity)
        
        return query.order_by(desc(BugReport.created_at)).limit(limit).all()
    
    @staticmethod
    def update_report(
        db: Session,
        report_id: str,
        status: str = None,
        admin_notes: str = None,
        assigned_to: str = None
    ) -> Optional[BugReport]:
        """Update a bug report."""
        report = db.query(BugReport).filter(BugReport.id == report_id).first()
        if not report:
            return None
        
        if status:
            report.status = status
            if status in ["resolved", "closed"]:
                report.resolved_at = datetime.utcnow()
        if admin_notes is not None:
            report.admin_notes = admin_notes
        if assigned_to is not None:
            report.assigned_to = assigned_to
        
        db.commit()
        db.refresh(report)
        return report


# ===========================================
# INTEGRATION SERVICE
# ===========================================

class IntegrationService:
    """Manage third-party integrations."""
    
    # Default integrations to set up
    DEFAULT_INTEGRATIONS = [
        {
            "name": "gemini",
            "display_name": "Google Gemini AI",
            "description": "Google's advanced AI model for generating interview questions and evaluations",
            "icon": "Sparkles"
        },
        {
            "name": "groq",
            "display_name": "Groq AI",
            "description": "Ultra-fast AI inference for real-time interview conversations",
            "icon": "Zap"
        },
        {
            "name": "openai",
            "display_name": "OpenAI GPT",
            "description": "OpenAI's GPT models for advanced language processing",
            "icon": "Brain"
        },
        {
            "name": "aws_s3",
            "display_name": "AWS S3",
            "description": "Amazon S3 for file storage (resumes, recordings)",
            "icon": "Cloud"
        },
        {
            "name": "sendgrid",
            "display_name": "SendGrid",
            "description": "Email delivery service for notifications",
            "icon": "Mail"
        },
        {
            "name": "stripe",
            "display_name": "Stripe",
            "description": "Payment processing for premium features",
            "icon": "CreditCard"
        },
    ]
    
    @classmethod
    def initialize_integrations(cls, db: Session):
        """Initialize default integrations."""
        for integration in cls.DEFAULT_INTEGRATIONS:
            existing = db.query(ThirdPartyIntegration).filter(
                ThirdPartyIntegration.name == integration["name"]
            ).first()
            
            if not existing:
                new_integration = ThirdPartyIntegration(
                    name=integration["name"],
                    display_name=integration["display_name"],
                    description=integration["description"],
                    icon=integration["icon"]
                )
                db.add(new_integration)
        
        db.commit()
    
    @staticmethod
    def get_all_integrations(db: Session) -> List[ThirdPartyIntegration]:
        """Get all integrations."""
        return db.query(ThirdPartyIntegration).order_by(ThirdPartyIntegration.display_name).all()
    
    @staticmethod
    def update_integration(
        db: Session,
        integration_id: str,
        api_key: str = None,
        api_secret: str = None,
        config: dict = None,
        is_enabled: bool = None
    ) -> Optional[ThirdPartyIntegration]:
        """Update an integration."""
        integration = db.query(ThirdPartyIntegration).filter(
            ThirdPartyIntegration.id == integration_id
        ).first()
        
        if not integration:
            return None
        
        if api_key is not None:
            integration.api_key = api_key
            integration.is_configured = bool(api_key)
        if api_secret is not None:
            integration.api_secret = api_secret
        if config is not None:
            integration.config = config
        if is_enabled is not None:
            integration.is_enabled = is_enabled
        
        db.commit()
        db.refresh(integration)
        return integration
    
    @staticmethod
    async def check_integration_health(db: Session, integration_name: str) -> Dict[str, Any]:
        """Check health of a specific integration."""
        integration = db.query(ThirdPartyIntegration).filter(
            ThirdPartyIntegration.name == integration_name
        ).first()
        
        if not integration:
            return {"status": "not_found"}
        
        if not integration.is_enabled or not integration.is_configured:
            return {"status": "disabled"}
        
        # Perform actual health check based on integration type
        health_status = "healthy"
        error_message = None
        
        try:
            if integration_name == "gemini":
                # Check Gemini API
                if settings.GEMINI_API_KEY:
                    health_status = "healthy"
                else:
                    health_status = "not_configured"
            elif integration_name == "groq":
                # Check Groq API
                if settings.GROQ_API_KEY:
                    health_status = "healthy"
                else:
                    health_status = "not_configured"
            # Add more integration checks as needed
            
        except Exception as e:
            health_status = "error"
            error_message = str(e)
        
        # Update integration health status
        integration.health_status = health_status
        integration.last_health_check = datetime.utcnow()
        db.commit()
        
        return {
            "status": health_status,
            "error": error_message,
            "checked_at": datetime.utcnow().isoformat() + 'Z'
        }


# ===========================================
# AI API LOGGING SERVICE
# ===========================================

class AIAPILogService:
    """Service for logging AI API calls (Gemini & Groq)."""
    
    @staticmethod
    def log_ai_call(
        db: Session,
        provider: str,
        operation: str,
        model: str = None,
        prompt_tokens: int = None,
        completion_tokens: int = None,
        total_tokens: int = None,
        response_time_ms: int = None,
        status: str = "success",
        error_message: str = None,
        user_id: str = None,
        session_id: str = None
    ) -> AIAPILog:
        """
        Log an AI API call.
        
        Args:
            provider: "gemini" or "groq"
            operation: What the AI call was for (e.g., "evaluate_answer", "generate_plan")
            model: Model used (e.g., "gemini-pro", "llama-3.1-8b-instant")
            prompt_tokens: Number of input tokens
            completion_tokens: Number of output tokens
            total_tokens: Total tokens used
            response_time_ms: Response time in milliseconds
            status: "success" or "error"
            error_message: Error message if status is "error"
            user_id: User ID if applicable
            session_id: Interview session ID if applicable
        """
        log = AIAPILog(
            provider=provider,
            model=model,
            operation=operation,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            response_time_ms=response_time_ms,
            status=status,
            error_message=error_message,
            user_id=user_id,
            session_id=session_id
        )
        
        db.add(log)
        db.commit()
        db.refresh(log)
        return log
    
    @staticmethod
    def get_recent_logs(
        db: Session,
        provider: str = None,
        operation: str = None,
        status: str = None,
        hours: int = 24,
        limit: int = 100
    ) -> List[AIAPILog]:
        """Get recent AI API logs with optional filters."""
        since = datetime.utcnow() - timedelta(hours=hours)
        
        query = db.query(AIAPILog).filter(AIAPILog.created_at >= since)
        
        if provider:
            query = query.filter(AIAPILog.provider == provider)
        if operation:
            query = query.filter(AIAPILog.operation.ilike(f"%{operation}%"))
        if status:
            query = query.filter(AIAPILog.status == status)
        
        return query.order_by(desc(AIAPILog.created_at)).limit(limit).all()
    
    @staticmethod
    def get_stats(db: Session, hours: int = 24) -> Dict[str, Any]:
        """Get AI API usage statistics."""
        since = datetime.utcnow() - timedelta(hours=hours)
        
        total = db.query(func.count(AIAPILog.id)).filter(
            AIAPILog.created_at >= since
        ).scalar() or 0
        
        gemini_calls = db.query(func.count(AIAPILog.id)).filter(
            AIAPILog.created_at >= since, AIAPILog.provider == "gemini"
        ).scalar() or 0
        
        groq_calls = db.query(func.count(AIAPILog.id)).filter(
            AIAPILog.created_at >= since, AIAPILog.provider == "groq"
        ).scalar() or 0
        
        errors = db.query(func.count(AIAPILog.id)).filter(
            AIAPILog.created_at >= since, AIAPILog.status == "error"
        ).scalar() or 0
        
        total_tokens = db.query(func.sum(AIAPILog.total_tokens)).filter(
            AIAPILog.created_at >= since
        ).scalar() or 0
        
        avg_response = db.query(func.avg(AIAPILog.response_time_ms)).filter(
            AIAPILog.created_at >= since, AIAPILog.response_time_ms.isnot(None)
        ).scalar() or 0
        
        return {
            "total_calls": total,
            "gemini_calls": gemini_calls,
            "groq_calls": groq_calls,
            "error_calls": errors,
            "success_rate": round((total - errors) / total * 100, 1) if total > 0 else 100,
            "total_tokens": total_tokens,
            "avg_response_time_ms": round(avg_response, 1),
            "hours": hours
        }
