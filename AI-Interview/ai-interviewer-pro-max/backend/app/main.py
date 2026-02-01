"""
AI Interviewer Pro Max - Main Application Entry Point

This module initializes the FastAPI application and configures:
- CORS middleware
- Router registration
- Database initialization
- Startup/shutdown events
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.db.session import init_db, close_db

# Import routers
from app.auth.routes import router as auth_router
from app.users.routes import router as users_router
from app.interviews.routes import router as interviews_router
from app.interviews.plan_routes import router as plan_router
from app.interviews.live_routes import router as live_router
from app.resumes.routes import router as resumes_router
from app.ats.routes import router as ats_router
from app.evaluations.routes import router as evaluations_router
from app.simulation.routes import router as simulation_router
from app.reports.routes import router as reports_router
from app.roadmap.routes import router as roadmap_router
from app.companies.routes import router as companies_router
from app.personalities.routes import router as personalities_router
from app.analytics.routes import router as analytics_router
from app.admin.routes import router as admin_router
from app.admin.public_routes import router as admin_public_router

# Import admin middleware
from app.admin.middleware import (
    APILoggingMiddleware,
    ErrorLoggingMiddleware,
    MaintenanceModeMiddleware
)


# ===========================================
# LIFESPAN HANDLER
# ===========================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler for startup and shutdown events.
    """
    # Startup
    print("=" * 50)
    print("🚀 AI Interviewer Pro Max is starting up...")
    print("=" * 50)
    
    # Initialize database
    init_db()
    print("✅ Database initialized")
    
    # Load API keys from database (overrides .env if set)
    try:
        from app.db.session import SessionLocal
        from app.admin.service import SettingsService
        db = SessionLocal()
        try:
            # Initialize settings
            SettingsService.initialize_settings(db)
            
            # Check for database overrides
            db_gemini = SettingsService.get_setting(db, "gemini_api_key", "")
            db_groq = SettingsService.get_setting(db, "groq_api_key", "")
            
            if db_gemini:
                settings.GEMINI_API_KEY = db_gemini
                print("✅ Gemini API configured (from database)")
            elif settings.GEMINI_API_KEY:
                print("✅ Gemini API configured (from .env)")
            else:
                print("⚠️  Gemini API NOT configured - AI features will use mock data")
            
            if db_groq:
                settings.GROQ_API_KEY = db_groq
                print("✅ Groq API configured (from database)")
            elif settings.GROQ_API_KEY:
                print("✅ Groq API configured (from .env)")
            else:
                print("⚠️  Groq API NOT configured - Real-time features will use mock data")
        finally:
            db.close()
    except Exception as e:
        print(f"⚠️  Could not load API keys from database: {e}")
        # Fall back to .env settings
        if settings.GEMINI_API_KEY:
            print("✅ Gemini API configured")
        else:
            print("⚠️  Gemini API NOT configured - AI features will use mock data")
        
        if settings.GROQ_API_KEY:
            print("✅ Groq API configured")
        else:
            print("⚠️  Groq API NOT configured - Real-time features will use mock data")
    
    # Environment info
    print(f"📌 Environment: {settings.ENVIRONMENT}")
    print(f"📌 Debug Mode: {'ON' if settings.DEBUG else 'OFF'}")
    print("=" * 50)
    print("🔐 Auth routes registered:")
    print("   POST /api/auth/signup")
    print("   POST /api/auth/login")
    print("   POST /api/auth/logout")
    print("   GET  /api/auth/me")
    print("   POST /api/auth/verify-token")
    print("=" * 50)
    print("✅ Application started successfully")
    print("🌐 Server is READY to accept connections")
    print("=" * 50)
    
    yield
    
    # Shutdown
    print("👋 AI Interviewer Pro Max is shutting down...")
    close_db()
    print("✅ Application shutdown complete")


# ===========================================
# APPLICATION INITIALIZATION
# ===========================================

app = FastAPI(
    title="AI Interviewer Pro Max",
    description="""
    Production-ready AI-powered interview preparation platform.
    
    ## Features
    - 🔐 JWT-based authentication
    - 📄 Resume upload and analysis
    - 🎯 AI-generated interview questions
    - 💬 Real-time mock interviews
    - 📊 Multi-dimensional scoring
    - 📈 Comprehensive performance reports
    
    ## Authentication
    All endpoints except `/api/auth/signup` and `/api/auth/login` require authentication.
    Include the JWT token in the Authorization header: `Bearer <token>`
    """,
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)


# ===========================================
# MIDDLEWARE
# ===========================================

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Admin middleware - Order matters: last added = first executed
# 1. Error logging (catch unhandled exceptions)
app.add_middleware(ErrorLoggingMiddleware)

# 2. Maintenance mode check
app.add_middleware(MaintenanceModeMiddleware)

# 3. API request logging
app.add_middleware(APILoggingMiddleware)


# ===========================================
# EXCEPTION HANDLERS (PRODUCTION SECURITY)
# ===========================================

from fastapi import Request
from fastapi.responses import JSONResponse
import logging

# Configure logging
logger = logging.getLogger("ai_interviewer")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler to prevent stack traces in production.
    
    - Logs full error details server-side
    - Returns sanitized error to client
    - Never exposes internal details
    """
    # Log the full error for debugging
    logger.error(
        f"Unhandled exception: {type(exc).__name__}: {str(exc)}",
        exc_info=True if settings.DEBUG else False
    )
    
    # Return sanitized error response
    if settings.DEBUG:
        # In development, show more detail
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Internal Server Error",
                "detail": str(exc),
                "type": type(exc).__name__,
            }
        )
    else:
        # In production, hide internal details
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "An unexpected error occurred. Please try again.",
            }
        )


# ===========================================
# ROUTER REGISTRATION
# ===========================================

# Auth routes (public: signup, login)
app.include_router(
    auth_router, 
    prefix="/api/auth", 
    tags=["Authentication"]
)

# User routes (protected)
app.include_router(
    users_router, 
    prefix="/api/users", 
    tags=["Users"]
)

# Interview routes (protected)
app.include_router(
    interviews_router, 
    prefix="/api/interviews", 
    tags=["Interviews"]
)

# Resume routes (protected)
app.include_router(
    resumes_router, 
    prefix="/api/resumes", 
    tags=["Resumes"]
)

# ATS routes (protected)
app.include_router(
    ats_router, 
    prefix="/api/ats", 
    tags=["ATS Analysis"]
)

# Interview Plan routes (protected)
app.include_router(
    plan_router, 
    prefix="/api/interviews", 
    tags=["Interview Plans"]
)

# Live Interview routes (protected)
app.include_router(
    live_router, 
    prefix="/api/interviews", 
    tags=["Live Interviews"]
)

# Evaluation routes (protected)
app.include_router(
    evaluations_router, 
    prefix="/api/evaluations", 
    tags=["Evaluations"]
)

# Simulation routes (protected)
app.include_router(
    simulation_router, 
    prefix="/api/simulation", 
    tags=["Behavioral Simulation"]
)

# Reports routes (protected)
app.include_router(
    reports_router, 
    prefix="/api/reports", 
    tags=["Interview Reports"]
)

# Roadmap routes (protected)
app.include_router(
    roadmap_router, 
    prefix="/api/roadmap", 
    tags=["Career Roadmap"]
)

# Companies routes (protected)
app.include_router(
    companies_router, 
    prefix="/api/companies", 
    tags=["Company Modes"]
)

# Personalities routes (protected)
app.include_router(
    personalities_router, 
    prefix="/api/personalities", 
    tags=["Interviewer Personalities"]
)

# Analytics routes (protected)
app.include_router(
    analytics_router, 
    prefix="/api/analytics", 
    tags=["Analytics"]
)

# Admin routes (admin only)
app.include_router(
    admin_router, 
    prefix="/api/admin", 
    tags=["Admin"]
)

# Admin public routes (authenticated users)
app.include_router(
    admin_public_router, 
    prefix="/api/public", 
    tags=["Public"]
)

@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint - API health check and welcome message.
    """
    return {
        "name": "AI Interviewer Pro Max",
        "version": "1.0.0",
        "status": "operational",
        "message": "Welcome to AI Interviewer Pro Max API",
        "docs": "/api/docs",
        "health": "/api/health",
    }


@app.get("/api/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint for monitoring and load balancers.
    
    Returns current status of the application and its dependencies.
    """
    return {
        "status": "ok",
        "version": "1.0.0",
        "database": "connected",
        "gemini_api": "configured" if settings.GEMINI_API_KEY else "not_configured",
        "groq_api": "configured" if settings.GROQ_API_KEY else "not_configured",
    }
