"""
Authentication Schemas

Pydantic models for request/response validation in authentication endpoints.
"""

from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime
import re


# ===========================================
# REQUEST SCHEMAS
# ===========================================


class SignupRequest(BaseModel):
    """Schema for user registration request."""
    
    name: str = Field(
        ..., 
        min_length=2, 
        max_length=100, 
        description="User's full name"
    )
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(
        ..., 
        min_length=8, 
        max_length=128,
        description="Password (min 8 characters)"
    )
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if not v.strip():
            raise ValueError('Name cannot be empty')
        return v.strip()
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not re.search(r'[A-Za-z]', v):
            raise ValueError('Password must contain at least one letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one number')
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "John Doe",
                "email": "john@example.com",
                "password": "SecurePass123"
            }
        }


class LoginRequest(BaseModel):
    """Schema for user login request."""
    
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., description="User password")
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "john@example.com",
                "password": "SecurePass123"
            }
        }


# ===========================================
# RESPONSE SCHEMAS
# ===========================================


class TokenData(BaseModel):
    """Schema for token data in response."""
    
    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(..., description="Token expiration time in seconds")


class UserData(BaseModel):
    """Schema for user data in response."""
    
    id: str = Field(..., description="User ID")
    name: str = Field(..., description="User's full name")
    email: EmailStr = Field(..., description="User email")
    is_active: bool = Field(..., description="Account active status")
    is_verified: bool = Field(..., description="Email verified status")
    is_admin: bool = Field(default=False, description="Admin status")
    created_at: Optional[str] = Field(None, description="Account creation timestamp")
    last_login_at: Optional[str] = Field(None, description="Last login timestamp")


class AuthResponse(BaseModel):
    """Schema for authentication response (login/signup)."""
    
    success: bool = Field(default=True)
    message: str = Field(..., description="Response message")
    user: UserData = Field(..., description="User data")
    token: TokenData = Field(..., description="Access token data")
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Login successful",
                "user": {
                    "id": "123e4567-e89b-12d3-a456-426614174000",
                    "name": "John Doe",
                    "email": "john@example.com",
                    "is_active": True,
                    "is_verified": False,
                    "created_at": "2024-01-01T00:00:00",
                    "last_login_at": "2024-01-15T10:30:00"
                },
                "token": {
                    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                    "token_type": "bearer",
                    "expires_in": 3600
                }
            }
        }


class LogoutResponse(BaseModel):
    """Schema for logout response."""
    
    success: bool = Field(default=True)
    message: str = Field(default="Logged out successfully")


class ErrorResponse(BaseModel):
    """Schema for error responses."""
    
    success: bool = Field(default=False)
    message: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Additional error details")
