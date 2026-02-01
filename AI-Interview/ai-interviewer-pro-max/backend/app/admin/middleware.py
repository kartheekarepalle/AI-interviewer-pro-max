"""
Admin Middleware

Middleware components for:
- API request logging
- Error logging
- Maintenance mode check
"""

import time
import traceback
import logging
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.admin.models import APIRequestLog, ErrorLog
from app.admin.service import SettingsService

# Configure logger
logger = logging.getLogger("admin_middleware")


class APILoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log all API requests.
    Records: method, endpoint, status code, response time, user info.
    """
    
    # Endpoints to skip logging (high-frequency or internal)
    SKIP_ENDPOINTS = {
        "/health",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/api/admin/health/realtime",  # Don't log real-time polling
        "/favicon.ico",
    }
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip logging for certain endpoints
        if request.url.path in self.SKIP_ENDPOINTS:
            return await call_next(request)
        
        # Skip OPTIONS requests
        if request.method == "OPTIONS":
            return await call_next(request)
        
        start_time = time.time()
        
        # Get user ID from auth header if possible
        user_id = None
        try:
            # Try to extract user from request state (set by auth middleware)
            if hasattr(request.state, "user"):
                user_id = request.state.user.get("id")
        except Exception:
            pass
        
        # Process request
        response = await call_next(request)
        
        # Calculate response time
        response_time_ms = (time.time() - start_time) * 1000
        
        # Get client IP
        client_ip = request.client.host if request.client else "unknown"
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        
        # Log to database (async-safe using new session)
        try:
            db = SessionLocal()
            try:
                log_entry = APIRequestLog(
                    method=request.method,
                    endpoint=request.url.path,
                    status_code=response.status_code,
                    response_time_ms=response_time_ms,
                    ip_address=client_ip,
                    user_agent=request.headers.get("User-Agent", "")[:500],
                    user_id=user_id,
                    query_params=str(dict(request.query_params))[:1000] if request.query_params else None
                )
                db.add(log_entry)
                db.commit()
            finally:
                db.close()
        except Exception as e:
            # Don't let logging errors affect the request
            logger.warning(f"API logging error: {e}")
        
        return response


class ErrorLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to catch and log unhandled exceptions.
    Also logs errors from failed responses (4xx/5xx).
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        try:
            response = await call_next(request)
            
            # Log server errors (5xx)
            if response.status_code >= 500:
                self._log_error(
                    request=request,
                    error_type="HTTPServerError",
                    error_message=f"Server error {response.status_code} on {request.method} {request.url.path}",
                    severity="error" if response.status_code < 503 else "critical"
                )
            
            return response
            
        except Exception as exc:
            # Log the error
            self._log_error(
                request=request,
                error_type=type(exc).__name__,
                error_message=str(exc)[:2000],
                stack_trace=traceback.format_exc()[:5000],
                severity="error"
            )
            
            # Re-raise to let FastAPI handle it
            raise
    
    def _log_error(
        self, 
        request: Request, 
        error_type: str, 
        error_message: str, 
        stack_trace: str = None,
        severity: str = "error"
    ):
        """Log error to database."""
        try:
            db = SessionLocal()
            try:
                # Get user ID if available
                user_id = None
                if hasattr(request.state, "user"):
                    user_id = request.state.user.get("id")
                
                # Get client IP
                client_ip = request.client.host if request.client else "unknown"
                forwarded = request.headers.get("X-Forwarded-For")
                if forwarded:
                    client_ip = forwarded.split(",")[0].strip()
                
                error_entry = ErrorLog(
                    error_type=error_type,
                    error_message=error_message,
                    stack_trace=stack_trace,
                    endpoint=request.url.path,
                    method=request.method,
                    severity=severity,
                    status="new",
                    user_id=user_id,
                    ip_address=client_ip,
                    user_agent=request.headers.get("User-Agent", "")[:500]
                )
                
                db.add(error_entry)
                db.commit()
                logger.info(f"Error logged: {error_type} - {error_message[:100]}")
            finally:
                db.close()
        except Exception as log_error:
            logger.error(f"Error logging failed: {log_error}")


class MaintenanceModeMiddleware(BaseHTTPMiddleware):
    """
    Middleware to check maintenance mode and block non-admin requests.
    Admins can always access the system even during maintenance.
    """
    
    # Endpoints that should work even in maintenance mode for ALL users
    ALLOWED_ENDPOINTS = {
        "/api/auth/login",
        "/api/auth/logout", 
        "/api/auth/verify-token",
        "/api/auth/me",
        "/api/public/maintenance-status",
        "/health",
        "/docs",
        "/openapi.json",
    }
    
    # Endpoint prefixes that are always allowed
    ALWAYS_ALLOWED_PREFIXES = {
        "/api/admin/",  # Admin routes
        "/api/auth/",   # All auth routes (so admins can login)
        "/api/public/", # Public routes (maintenance check, etc.)
    }
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip check for OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)
        
        path = request.url.path
        
        # Skip check for explicitly allowed endpoints
        if path in self.ALLOWED_ENDPOINTS:
            return await call_next(request)
        
        # Skip check for allowed prefixes (admin, auth, public routes)
        for prefix in self.ALWAYS_ALLOWED_PREFIXES:
            if path.startswith(prefix):
                return await call_next(request)
        
        # Check maintenance mode for other routes
        try:
            db = SessionLocal()
            try:
                if SettingsService.is_maintenance_mode(db):
                    # Check if user is an admin (via Authorization header)
                    auth_header = request.headers.get("Authorization")
                    if auth_header and auth_header.startswith("Bearer "):
                        token = auth_header.replace("Bearer ", "")
                        try:
                            from app.core.security import decode_access_token
                            from app.users.models import User
                            
                            payload = decode_access_token(token)
                            if payload:
                                user_id = payload.get("sub")
                                user = db.query(User).filter(User.id == user_id).first()
                                if user and user.is_admin:
                                    # Admin user - allow access
                                    return await call_next(request)
                        except Exception:
                            pass  # Token validation failed, continue with maintenance check
                    
                    # Non-admin user or no valid token - block access
                    message = SettingsService.get_setting(
                        db, "maintenance_message", 
                        "System is under maintenance. Please try again later."
                    )
                    from fastapi.responses import JSONResponse
                    return JSONResponse(
                        status_code=503,
                        content={
                            "detail": message,
                            "maintenance_mode": True
                        }
                    )
            finally:
                db.close()
        except Exception as e:
            # Don't block if check fails
            print(f"Maintenance check error: {e}")
        
        return await call_next(request)


def log_error_manually(
    db: Session,
    error_type: str,
    error_message: str,
    stack_trace: str = None,
    severity: str = "error",
    endpoint: str = None,
    user_id: str = None,
    additional_data: dict = None
) -> ErrorLog:
    """
    Manually log an error to the database.
    Use this for caught exceptions that should still be logged.
    """
    error = ErrorLog(
        error_type=error_type,
        error_message=error_message[:2000],
        stack_trace=stack_trace[:5000] if stack_trace else None,
        endpoint=endpoint,
        severity=severity,
        status="new",
        user_id=user_id,
        additional_data=additional_data
    )
    db.add(error)
    db.commit()
    db.refresh(error)
    return error
