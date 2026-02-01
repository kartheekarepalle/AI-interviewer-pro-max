"""
Resume Models

SQLAlchemy models for resume storage and management.
Resumes are user-scoped and linked to interview sessions.
"""

from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.base import Base


class Resume(Base):
    """
    Resume model - Stores uploaded resume metadata and extracted text.
    
    Per MASTER CONSTRAINTS:
    - Each resume belongs to exactly one user
    - Users can only access their own resumes
    - Binary files stored on filesystem, not in DB
    """
    
    __tablename__ = "resumes"
    
    # Primary key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # User relationship (user-scoped data)
    user_id = Column(String(36), nullable=False, index=True)
    
    # File metadata
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)  # pdf, docx
    file_size = Column(Integer, nullable=False)  # bytes
    file_path = Column(String(500), nullable=False)  # filesystem path
    
    # Extracted content
    text_content = Column(Text, nullable=True)  # Extracted plain text
    
    # Parsing status
    is_parsed = Column(String(20), default="pending")  # pending, success, failed
    parse_error = Column(Text, nullable=True)
    
    # TODO: Gemini analysis fields (to be added later)
    # analysis_status = Column(String(20), default="pending")
    # skills_extracted = Column(JSON, nullable=True)
    # experience_summary = Column(Text, nullable=True)
    # ats_score = Column(Integer, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f"<Resume(id={self.id}, filename={self.original_filename}, user_id={self.user_id})>"
    
    def to_dict(self):
        """Convert resume to dictionary (safe for API response)."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "filename": self.original_filename,
            "file_type": self.file_type,
            "file_size": self.file_size,
            "is_parsed": self.is_parsed,
            "has_content": bool(self.text_content),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
    
    def to_dict_with_content(self):
        """Convert resume to dictionary including text content."""
        data = self.to_dict()
        data["text_content"] = self.text_content
        data["parse_error"] = self.parse_error
        return data
