"""
Authentication Routes

API endpoints for user authentication, registration, and session management.
All endpoints follow REST conventions and return consistent response formats.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_user
from app.auth.schemas import (
    SignupRequest,
    LoginRequest,
    AuthResponse,
    LogoutResponse,
    ErrorResponse,
    UserData,
    TokenData,
)
from app.auth.service import AuthService

# HTTP Bearer token security scheme (auto_error=False to handle missing tokens gracefully)
security = HTTPBearer(auto_error=False)

router = APIRouter()


# ===========================================
# PUBLIC ENDPOINTS (No auth required)
# ===========================================


@router.post(
    "/signup",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register new user",
    description="Create a new user account and return access token for immediate login.",
    responses={
        201: {"description": "User created successfully"},
        400: {"model": ErrorResponse, "description": "Validation error or email exists"},
    }
)
async def signup(request: SignupRequest, db: Session = Depends(get_db)):
    """
    Register a new user.
    
    - Validates email format and password strength
    - Creates user account with hashed password
    - Returns access token for immediate authentication
    
    **Password Requirements:**
    - Minimum 8 characters
    - At least one letter
    - At least one number
    """
    try:
        auth_service = AuthService(db)
        result = auth_service.signup(request)
        
        return AuthResponse(
            success=True,
            message="Account created successfully",
            user=UserData(**result["user"]),
            token=TokenData(**result["token"]),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during registration"
        )


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="User login",
    description="Authenticate user with email and password, return access token.",
    responses={
        200: {"description": "Login successful"},
        401: {"model": ErrorResponse, "description": "Invalid credentials"},
    }
)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user with email and password.
    
    - Verifies credentials against stored hash
    - Returns JWT access token on success
    - Updates last login timestamp
    """
    try:
        auth_service = AuthService(db)
        result = auth_service.login(request)
        
        return AuthResponse(
            success=True,
            message="Login successful",
            user=UserData(**result["user"]),
            token=TokenData(**result["token"]),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during login"
        )


# ===========================================
# PROTECTED ENDPOINTS (Auth required)
# ===========================================


@router.post(
    "/logout",
    response_model=LogoutResponse,
    summary="User logout",
    description="Invalidate current access token and end session.",
    responses={
        200: {"description": "Logout successful"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def logout(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Logout current user.
    
    - Revokes the current session
    - Token will no longer be valid for authentication
    """
    try:
        auth_service = AuthService(db)
        auth_service.logout(user_id=current_user["id"])
        
        return LogoutResponse(
            success=True,
            message="Logged out successfully"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during logout"
        )


@router.get(
    "/me",
    response_model=UserData,
    summary="Get current user",
    description="Get the currently authenticated user's profile.",
    responses={
        200: {"description": "User profile returned"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    }
)
async def get_me(current_user: dict = Depends(get_current_user)):
    """
    Get current user's profile.
    
    Returns the authenticated user's information.
    Requires valid JWT token in Authorization header.
    """
    return UserData(**current_user)


@router.post(
    "/verify-token",
    summary="Verify token validity",
    description="Check if the current token is valid.",
    responses={
        200: {"description": "Token is valid"},
        401: {"model": ErrorResponse, "description": "Token invalid or expired"},
    }
)
async def verify_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
):
    """
    Verify current token is valid.
    
    Returns success if token is valid.
    Use this endpoint to check token status without fetching full user data.
    
    SAFETY: This endpoint NEVER crashes. Always returns 401 on any error.
    """
    try:
        # Check if credentials provided
        if credentials is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        token = credentials.credentials
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Decode token
        from app.core.security import decode_access_token
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Verify user exists (optional - for extra security)
        from app.users.models import User
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is disabled",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return {
            "valid": True,
            "user_id": user_id,
            "email": payload.get("email"),
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Catch ANY other exception and return 401
        # Never let this endpoint crash
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token verification failed",
            headers={"WWW-Authenticate": "Bearer"},
        )
