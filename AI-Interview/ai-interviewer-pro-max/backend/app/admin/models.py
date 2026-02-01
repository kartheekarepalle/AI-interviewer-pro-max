"""
Admin Models

Database models for admin panel features:
- Error logs
- API request logs
- System settings (maintenance mode, API keys)
- Bug reports from users
- API usage tracking
"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, Float, JSON
from datetime import datetime
import uuid

from app.db.base import Base


class ErrorLog(Base):
    """
    Error Log model - Tracks application errors in real-time.
    """
    
    __tablename__ = "error_logs"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Error details
    error_type = Column(String(100), nullable=False, index=True)  # Exception type
    error_message = Column(Text, nullable=False)
    stack_trace = Column(Text, nullable=True)
    
    # Context
    endpoint = Column(String(255), nullable=True)
    method = Column(String(10), nullable=True)
    user_id = Column(String(36), nullable=True, index=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    request_data = Column(JSON, nullable=True)
    
    # Severity: critical, error, warning, info
    severity = Column(String(20), default="error", nullable=False, index=True)
    
    # Status: new, acknowledged, resolved, ignored
    status = Column(String(20), default="new", nullable=False, index=True)
    resolved_by = Column(String(36), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    def to_dict(self):
        return {
            "id": self.id,
            "error_type": self.error_type,
            "error_message": self.error_message,
            "stack_trace": self.stack_trace,
            "endpoint": self.endpoint,
            "method": self.method,
            "user_id": self.user_id,
            "ip_address": self.ip_address,
            "severity": self.severity,
            "status": self.status,
            "resolved_by": self.resolved_by,
            "resolved_at": self.resolved_at.isoformat() + 'Z' if self.resolved_at else None,
            "created_at": self.created_at.isoformat() + 'Z' if self.created_at else None,
        }


class APIRequestLog(Base):
    """
    API Request Log model - Tracks all API requests for analytics.
    """
    
    __tablename__ = "api_request_logs"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Request details
    endpoint = Column(String(255), nullable=False, index=True)
    method = Column(String(10), nullable=False, index=True)
    status_code = Column(Integer, nullable=False, index=True)
    query_params = Column(Text, nullable=True)  # Query parameters
    
    # Performance
    response_time_ms = Column(Float, nullable=False)  # Response time in milliseconds
    request_size = Column(Integer, nullable=True)  # Request body size in bytes
    response_size = Column(Integer, nullable=True)  # Response body size in bytes
    
    # User context
    user_id = Column(String(36), nullable=True, index=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    def to_dict(self):
        return {
            "id": self.id,
            "endpoint": self.endpoint,
            "method": self.method,
            "status_code": self.status_code,
            "response_time_ms": self.response_time_ms,
            "request_size": self.request_size,
            "response_size": self.response_size,
            "user_id": self.user_id,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "query_params": self.query_params,
            "created_at": self.created_at.isoformat() + 'Z' if self.created_at else None,
        }


class SystemSettings(Base):
    """
    System Settings model - Global application configuration.
    """
    
    __tablename__ = "system_settings"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Setting key-value
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    value_type = Column(String(20), default="string")  # string, boolean, integer, json
    
    # Metadata
    description = Column(Text, nullable=True)
    category = Column(String(50), default="general", index=True)  # general, api, maintenance, limits
    is_sensitive = Column(Boolean, default=False)  # Hide value in UI if true (for API keys)
    
    # Timestamps
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = Column(String(36), nullable=True)
    
    def to_dict(self, hide_sensitive=True):
        return {
            "id": self.id,
            "key": self.key,
            "value": "***" if (self.is_sensitive and hide_sensitive) else self.value,
            "value_type": self.value_type,
            "description": self.description,
            "category": self.category,
            "is_sensitive": self.is_sensitive,
            "updated_at": self.updated_at.isoformat() + 'Z' if self.updated_at else None,
        }


class BugReport(Base):
    """
    Bug Report model - User-submitted bug reports.
    """
    
    __tablename__ = "bug_reports"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Reporter info
    user_id = Column(String(36), nullable=True, index=True)
    user_email = Column(String(255), nullable=True)
    user_name = Column(String(100), nullable=True)
    
    # Bug details
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(50), default="general")  # ui, functionality, performance, other
    severity = Column(String(20), default="medium")  # low, medium, high, critical
    
    # Context
    page_url = Column(String(500), nullable=True)
    browser_info = Column(Text, nullable=True)
    screenshot_url = Column(String(500), nullable=True)
    
    # Status: new, in_progress, resolved, closed, wont_fix
    status = Column(String(20), default="new", nullable=False, index=True)
    
    # Admin response
    admin_notes = Column(Text, nullable=True)
    assigned_to = Column(String(36), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_email": self.user_email,
            "user_name": self.user_name,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "severity": self.severity,
            "page_url": self.page_url,
            "browser_info": self.browser_info,
            "status": self.status,
            "admin_notes": self.admin_notes,
            "assigned_to": self.assigned_to,
            "resolved_at": self.resolved_at.isoformat() + 'Z' if self.resolved_at else None,
            "created_at": self.created_at.isoformat() + 'Z' if self.created_at else None,
            "updated_at": self.updated_at.isoformat() + 'Z' if self.updated_at else None,
        }


class APIUsage(Base):
    """
    API Usage model - Tracks API usage per user for rate limiting.
    """
    
    __tablename__ = "api_usage"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # User or API key
    user_id = Column(String(36), nullable=True, index=True)
    api_key_id = Column(String(36), nullable=True, index=True)
    
    # Usage tracking
    endpoint_group = Column(String(100), nullable=False, index=True)  # interviews, resumes, ai, etc.
    request_count = Column(Integer, default=0)
    
    # Time period (hourly tracking)
    period_start = Column(DateTime, nullable=False, index=True)
    period_end = Column(DateTime, nullable=False)
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "api_key_id": self.api_key_id,
            "endpoint_group": self.endpoint_group,
            "request_count": self.request_count,
            "period_start": self.period_start.isoformat() + 'Z' if self.period_start else None,
            "period_end": self.period_end.isoformat() + 'Z' if self.period_end else None,
        }


class ThirdPartyIntegration(Base):
    """
    Third Party Integration model - External service configurations.
    """
    
    __tablename__ = "third_party_integrations"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Integration info
    name = Column(String(100), nullable=False, unique=True)
    display_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(50), nullable=True)  # Icon name for frontend
    
    # Configuration
    api_key = Column(Text, nullable=True)  # Encrypted in production
    api_secret = Column(Text, nullable=True)  # Encrypted in production
    config = Column(JSON, nullable=True)  # Additional configuration
    
    # Status
    is_enabled = Column(Boolean, default=False)
    is_configured = Column(Boolean, default=False)
    last_health_check = Column(DateTime, nullable=True)
    health_status = Column(String(20), default="unknown")  # healthy, degraded, down, unknown
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self, hide_secrets=True):
        return {
            "id": self.id,
            "name": self.name,
            "display_name": self.display_name,
            "description": self.description,
            "icon": self.icon,
            "api_key": "***" if (self.api_key and hide_secrets) else self.api_key,
            "api_secret": "***" if (self.api_secret and hide_secrets) else None,
            "config": self.config,
            "is_enabled": self.is_enabled,
            "is_configured": self.is_configured,
            "last_health_check": self.last_health_check.isoformat() + 'Z' if self.last_health_check else None,
            "health_status": self.health_status,
            "updated_at": self.updated_at.isoformat() + 'Z' if self.updated_at else None,
        }


class Broadcast(Base):
    """
    Broadcast model - Admin announcements to all users.
    """
    
    __tablename__ = "broadcasts"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Content
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(20), default="info")  # info, warning, success, urgent
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # View tracking
    view_count = Column(Integer, default=0)
    
    # Expiration
    expires_at = Column(DateTime, nullable=True)
    
    # Admin who created it
    created_by = Column(String(36), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "message": self.message,
            "type": self.type,
            "is_active": self.is_active,
            "view_count": self.view_count or 0,
            "expires_at": self.expires_at.isoformat() + 'Z' if self.expires_at else None,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() + 'Z' if self.created_at else None,
            "updated_at": self.updated_at.isoformat() + 'Z' if self.updated_at else None,
        }


class AIAPILog(Base):
    """
    AI API Log model - Tracks Gemini and Groq API calls.
    """
    
    __tablename__ = "ai_api_logs"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Provider info
    provider = Column(String(20), nullable=False, index=True)  # gemini, groq
    model = Column(String(100), nullable=True)  # gemini-pro, llama-3.1-8b-instant, etc.
    
    # Request info
    operation = Column(String(100), nullable=False)  # evaluate_answer, generate_plan, parse_resume, etc.
    prompt_tokens = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)
    total_tokens = Column(Integer, nullable=True)
    
    # Response info
    status = Column(String(20), default="success")  # success, error, timeout
    response_time_ms = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Context
    user_id = Column(String(36), nullable=True, index=True)
    session_id = Column(String(36), nullable=True)  # interview session if applicable
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        return {
            "id": self.id,
            "provider": self.provider,
            "model": self.model,
            "operation": self.operation,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.total_tokens,
            "status": self.status,
            "response_time_ms": self.response_time_ms,
            "error_message": self.error_message,
            "user_id": self.user_id,
            "session_id": self.session_id,
            "created_at": self.created_at.isoformat() + 'Z' if self.created_at else None,
        }
