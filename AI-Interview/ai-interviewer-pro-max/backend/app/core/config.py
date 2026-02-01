"""
Application Configuration

Centralized configuration management using Pydantic Settings.
Loads from environment variables with sensible defaults for development.

⚠️ SECURITY: For production, ensure all secrets are set via environment variables!
"""

from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List
from functools import lru_cache
import os
import secrets
import warnings


# Generate a random default for development only
# This ensures each dev instance has a unique key, but warns if not explicitly set
_DEV_SECRET = secrets.token_hex(32)


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    
    For production, set all required values in .env file.
    For development, sensible defaults are provided.
    
    ⚠️ SECURITY WARNING: Never use default values in production!
    """
    
    # ===========================================
    # APP SETTINGS
    # ===========================================
    
    APP_NAME: str = Field(default="AI Interviewer Pro Max")
    DEBUG: bool = Field(default=True)
    ENVIRONMENT: str = Field(default="development")
    
    # ===========================================
    # DATABASE
    # ===========================================
    
    # Default to SQLite for easy development
    DATABASE_URL: str = Field(
        default="sqlite:///./ai_interviewer.db",
        description="Database connection URL"
    )
    
    # ===========================================
    # AUTHENTICATION
    # ===========================================
    
    JWT_SECRET_KEY: str = Field(
        default=_DEV_SECRET,
        description="Secret key for JWT token signing. MUST be set in production!"
    )
    JWT_ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=60 * 24,  # 24 hours for development
        description="Token expiration time in minutes"
    )
    
    # ===========================================
    # AI APIS
    # ===========================================
    
    GEMINI_API_KEY: str = Field(
        default="",
        description="Google Gemini API key"
    )
    GROQ_API_KEY: str = Field(
        default="",
        description="Groq API key"
    )
    
    # ===========================================
    # CORS
    # ===========================================
    
    CORS_ORIGINS: List[str] = Field(
        default=[
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
        ],
        description="Allowed CORS origins"
    )
    
    # ===========================================
    # FILE UPLOADS
    # ===========================================
    
    UPLOAD_DIR: str = Field(default="./uploads")
    MAX_UPLOAD_SIZE_MB: int = Field(default=10)
    ALLOWED_EXTENSIONS: List[str] = Field(default=["pdf", "docx"])
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "allow"
    
    # ===========================================
    # HELPER METHODS
    # ===========================================
    
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.ENVIRONMENT.lower() == "production"
    
    def is_ai_configured(self) -> bool:
        """Check if AI APIs are configured."""
        return bool(self.GEMINI_API_KEY and self.GROQ_API_KEY)
    
    def is_gemini_configured(self) -> bool:
        """Check if Gemini API is configured."""
        return bool(self.GEMINI_API_KEY)
    
    def is_groq_configured(self) -> bool:
        """Check if Groq API is configured."""
        return bool(self.GROQ_API_KEY)
    
    def validate_production_settings(self) -> list:
        """
        Validate settings for production environment.
        Returns list of security warnings.
        """
        warnings_list = []
        
        if self.is_production():
            # Check for default/weak JWT secret
            if self.JWT_SECRET_KEY == _DEV_SECRET or len(self.JWT_SECRET_KEY) < 32:
                warnings_list.append(
                    "⚠️  CRITICAL: JWT_SECRET_KEY is not set or too weak! "
                    "Generate a strong key with: python -c \"import secrets; print(secrets.token_hex(32))\""
                )
            
            # Check for SQLite in production
            if "sqlite" in self.DATABASE_URL.lower():
                warnings_list.append(
                    "⚠️  WARNING: Using SQLite in production is not recommended. "
                    "Consider using PostgreSQL."
                )
            
            # Check for debug mode in production
            if self.DEBUG:
                warnings_list.append(
                    "⚠️  WARNING: DEBUG mode is enabled in production!"
                )
        
        return warnings_list


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance.
    
    Uses LRU cache to ensure settings are loaded only once.
    """
    settings_instance = Settings()
    
    # Log security warnings on startup
    security_warnings = settings_instance.validate_production_settings()
    for warning in security_warnings:
        warnings.warn(warning, RuntimeWarning)
    
    return settings_instance


# Singleton settings instance for easy imports
settings = get_settings()
