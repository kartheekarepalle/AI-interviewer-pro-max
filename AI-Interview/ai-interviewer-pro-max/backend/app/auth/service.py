"""
Authentication Service

Business logic for user authentication, registration, and session management.
Clean separation from routes for testability and maintainability.
"""

from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password, create_access_token
from app.users.models import User, UserSession
from app.auth.schemas import SignupRequest, LoginRequest


class AuthService:
    """
    Service class for authentication operations.
    
    Handles:
    - User registration (signup)
    - User authentication (login)
    - Session management (logout)
    """
    
    def __init__(self, db: Session):
        """
        Initialize auth service with database session.
        
        Args:
            db: SQLAlchemy database session
        """
        self.db = db
    
    # ===========================================
    # SIGNUP
    # ===========================================
    
    def signup(self, request: SignupRequest) -> Dict[str, Any]:
        """
        Register a new user.
        
        Args:
            request: SignupRequest with name, email, password
            
        Returns:
            Dict with user data and access token
            
        Raises:
            ValueError: If email already exists
        """
        # Check if email already exists
        existing_user = self.db.query(User).filter(
            User.email == request.email.lower()
        ).first()
        
        if existing_user:
            raise ValueError("Email already registered")
        
        # Hash password (NEVER store plain passwords)
        password_hash = hash_password(request.password)
        
        # Create user
        user = User(
            name=request.name.strip(),
            email=request.email.lower().strip(),
            password_hash=password_hash,
            is_active=True,
            is_verified=False,
        )
        
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        
        # Generate access token
        token_data = create_access_token(
            user_id=user.id,
            email=user.email
        )
        
        # Create session record
        self._create_session(user.id, token_data["jti"], token_data["expires_at"])
        
        return {
            "user": user.to_dict(),
            "token": {
                "access_token": token_data["access_token"],
                "token_type": token_data["token_type"],
                "expires_in": token_data["expires_in"],
            }
        }
    
    # ===========================================
    # LOGIN
    # ===========================================
    
    def login(self, request: LoginRequest) -> Dict[str, Any]:
        """
        Authenticate user and return access token.
        
        Args:
            request: LoginRequest with email and password
            
        Returns:
            Dict with user data and access token
            
        Raises:
            ValueError: If credentials are invalid
        """
        # Find user by email
        user = self.db.query(User).filter(
            User.email == request.email.lower()
        ).first()
        
        if not user:
            raise ValueError("Invalid email or password")
        
        # Verify password
        if not verify_password(request.password, user.password_hash):
            raise ValueError("Invalid email or password")
        
        # Check if user is active
        if not user.is_active:
            raise ValueError("Account is disabled")
        
        # Update last login timestamp
        user.last_login_at = datetime.utcnow()
        self.db.commit()
        
        # Generate access token
        token_data = create_access_token(
            user_id=user.id,
            email=user.email
        )
        
        # Create session record
        self._create_session(user.id, token_data["jti"], token_data["expires_at"])
        
        return {
            "user": user.to_dict(),
            "token": {
                "access_token": token_data["access_token"],
                "token_type": token_data["token_type"],
                "expires_in": token_data["expires_in"],
            }
        }
    
    # ===========================================
    # LOGOUT
    # ===========================================
    
    def logout(self, user_id: str, token_jti: Optional[str] = None) -> bool:
        """
        Logout user by revoking session.
        
        Args:
            user_id: User ID
            token_jti: JWT ID to specifically revoke
            
        Returns:
            True if logout successful
        """
        if token_jti:
            # Revoke specific session
            session = self.db.query(UserSession).filter(
                UserSession.token_jti == token_jti,
                UserSession.user_id == user_id
            ).first()
            
            if session:
                session.is_active = False
                session.revoked_at = datetime.utcnow()
                self.db.commit()
        else:
            # Revoke all active sessions for user
            self.db.query(UserSession).filter(
                UserSession.user_id == user_id,
                UserSession.is_active == True
            ).update({
                "is_active": False,
                "revoked_at": datetime.utcnow()
            })
            self.db.commit()
        
        return True
    
    # ===========================================
    # GET USER
    # ===========================================
    
    def get_user_by_id(self, user_id: str) -> Optional[User]:
        """
        Get user by ID.
        
        Args:
            user_id: User ID
            
        Returns:
            User object or None
        """
        return self.db.query(User).filter(User.id == user_id).first()
    
    def get_user_by_email(self, email: str) -> Optional[User]:
        """
        Get user by email.
        
        Args:
            email: User email
            
        Returns:
            User object or None
        """
        return self.db.query(User).filter(
            User.email == email.lower()
        ).first()
    
    # ===========================================
    # SESSION MANAGEMENT
    # ===========================================
    
    def _create_session(
        self, 
        user_id: str, 
        token_jti: str, 
        expires_at: datetime
    ) -> UserSession:
        """
        Create a new session record.
        
        Args:
            user_id: User ID
            token_jti: JWT ID
            expires_at: Token expiration datetime
            
        Returns:
            Created UserSession object
        """
        session = UserSession(
            user_id=user_id,
            token_jti=token_jti,
            is_active=True,
            expires_at=expires_at,
        )
        
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        
        return session
    
    def is_session_valid(self, token_jti: str) -> bool:
        """
        Check if a session is still valid.
        
        Args:
            token_jti: JWT ID
            
        Returns:
            True if session is valid
        """
        session = self.db.query(UserSession).filter(
            UserSession.token_jti == token_jti,
            UserSession.is_active == True
        ).first()
        
        if not session:
            return False
        
        if session.expires_at < datetime.utcnow():
            return False
        
        return True
