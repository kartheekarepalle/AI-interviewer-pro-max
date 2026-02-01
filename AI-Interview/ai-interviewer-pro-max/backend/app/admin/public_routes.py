"""
Public Admin Routes

These routes are accessible to authenticated users (not just admins).
Includes bug report submission and maintenance status check.
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.core.security import get_current_active_user, decode_access_token
from app.admin.models import BugReport, Broadcast
from app.admin.service import SettingsService, BugReportService


router = APIRouter()


# Helper to get optional user (doesn't fail if not authenticated)
async def get_optional_user(authorization: Optional[str] = Header(None)):
    """Get user if authenticated, None otherwise."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        token = authorization.replace("Bearer ", "")
        payload = decode_access_token(token)
        if payload:
            return {"id": payload.get("sub"), "email": payload.get("email")}
    except Exception:
        pass
    return None


# ===========================================
# MAINTENANCE STATUS (Public)
# ===========================================


@router.get(
    "/maintenance-status",
    summary="Check maintenance status",
    description="Check if the system is in maintenance mode."
)
async def check_maintenance_status(db: Session = Depends(get_db)):
    """Check if maintenance mode is active."""
    is_maintenance = SettingsService.is_maintenance_mode(db)
    message = SettingsService.get_setting(db, "maintenance_message", "")
    
    return {
        "maintenance_mode": is_maintenance,
        "message": message if is_maintenance else None
    }


# ===========================================
# BUG REPORT SUBMISSION
# ===========================================


class BugReportSubmission(BaseModel):
    title: str
    description: str
    category: str = "general"
    severity: str = "medium"
    page_url: Optional[str] = None
    browser_info: Optional[str] = None


@router.post(
    "/bug-report",
    summary="Submit bug report",
    description="Submit a bug report from the user interface."
)
async def submit_bug_report(
    report: BugReportSubmission,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """Submit a bug report. Works for both authenticated and anonymous users."""
    try:
        # Get user info safely
        user_id = None
        user_email = None
        user_name = None
        
        if current_user:
            user_id = current_user.get("id")
            user_email = current_user.get("email")
            # Try to get user name from database
            from app.users.models import User
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user_name = user.name
        
        bug_report = BugReportService.create_report(
            db,
            user_id=user_id,
            user_email=user_email,
            user_name=user_name,
            title=report.title,
            description=report.description,
            category=report.category,
            severity=report.severity,
            page_url=report.page_url,
            browser_info=report.browser_info
        )
        
        return {
            "success": True,
            "message": "Bug report submitted successfully",
            "report_id": bug_report.id
        }
    except Exception as e:
        # Log the error and return a friendly message
        import traceback
        print(f"Bug report submission error: {e}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Failed to submit bug report: {str(e)}"
        )


@router.get(
    "/my-bug-reports",
    summary="Get my bug reports",
    description="Get bug reports submitted by the current user."
)
async def get_my_bug_reports(
    current_user: dict = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get user's own bug reports."""
    reports = db.query(BugReport).filter(
        BugReport.user_id == current_user["id"]
    ).order_by(BugReport.created_at.desc()).limit(20).all()
    
    return {
        "success": True,
        "reports": [r.to_dict() for r in reports]
    }


# ===========================================
# BROADCASTS (Public - For users to see announcements)
# ===========================================

# ===========================================
# BROADCASTS / ANNOUNCEMENTS (Public)
# ===========================================

from datetime import datetime

@router.get(
    "/broadcasts",
    summary="Get active broadcasts",
    description="Get all active broadcast announcements for display to users."
)
async def get_active_broadcasts(db: Session = Depends(get_db)):
    """Get active broadcasts that haven't expired."""
    # Get active broadcasts that haven't expired
    broadcasts = db.query(Broadcast).filter(
        Broadcast.is_active == True
    ).order_by(Broadcast.created_at.desc()).all()
    
    # Filter out expired broadcasts
    now = datetime.utcnow()
    active_broadcasts = []
    for b in broadcasts:
        if b.expires_at is None or b.expires_at > now:
            active_broadcasts.append(b.to_dict())
    
    return {
        "success": True,
        "broadcasts": active_broadcasts
    }


@router.post(
    "/broadcasts/{broadcast_id}/view",
    summary="Track broadcast view",
    description="Increment the view count for a broadcast when a user sees it."
)
async def track_broadcast_view(
    broadcast_id: str,
    db: Session = Depends(get_db)
):
    """Increment view count when user sees a broadcast."""
    broadcast = db.query(Broadcast).filter(Broadcast.id == broadcast_id).first()
    
    if not broadcast:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    
    # Increment view count
    broadcast.view_count = (broadcast.view_count or 0) + 1
    db.commit()
    
    return {
        "success": True,
        "view_count": broadcast.view_count
    }
