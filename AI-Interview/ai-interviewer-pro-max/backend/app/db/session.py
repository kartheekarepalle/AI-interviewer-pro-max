"""
Database Session

Database engine creation and session management.
Supports both PostgreSQL and SQLite for development.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from app.core.config import settings
from app.db.base import Base


# Determine if using SQLite (for development)
is_sqlite = settings.DATABASE_URL.startswith("sqlite")

# Create database engine with appropriate settings
if is_sqlite:
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},  # Required for SQLite
        echo=False,  # Disabled to reduce console noise
    )
else:
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        echo=False,  # Disabled to reduce console noise
    )

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db() -> Generator[Session, None, None]:
    """
    Database session dependency.
    
    Yields a database session and ensures it's closed after use.
    Use with FastAPI's Depends().
    
    Example:
        @app.get("/items")
        def get_items(db: Session = Depends(get_db)):
            return db.query(Item).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """
    Initialize database tables.
    
    Creates all tables defined in models.
    Should be called on application startup.
    """
    # Import all models to register them with Base
    from app.users.models import User, UserSession
    from app.resumes.models import Resume
    from app.ats.models import ATSAnalysis
    from app.interviews.plan_models import InterviewPlan
    from app.interviews.live_models import LiveInterviewSession, InterviewMessage, InterviewAnswer
    from app.evaluations.models import AnswerEvaluation
    from app.simulation.models import AnswerBehavioralInsight, SessionBehavioralSummary
    from app.reports.models import InterviewReport
    from app.roadmap.models import CareerRoadmap
    # Admin models
    from app.admin.models import ErrorLog, APIRequestLog, SystemSettings, BugReport, APIUsage, ThirdPartyIntegration, Broadcast, AIAPILog
    
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created")
    
    # Run migrations for new columns on existing tables
    _run_migrations()


def _run_migrations() -> None:
    """
    Run safe migrations for new columns.
    
    This adds missing columns to existing tables without breaking data.
    SQLite doesn't support ADD COLUMN IF NOT EXISTS, so we check first.
    
    IDEMPOTENT: Safe to run multiple times.
    """
    from sqlalchemy import text
    import logging
    
    logger = logging.getLogger(__name__)
    
    def get_existing_columns(conn, table_name: str) -> set:
        """Get existing column names for a table."""
        if is_sqlite:
            result = conn.execute(text(f"PRAGMA table_info({table_name})"))
            return {row[1] for row in result.fetchall()}
        else:
            result = conn.execute(text(f"""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = '{table_name}'
            """))
            return {row[0] for row in result.fetchall()}
    
    def add_column_if_missing(conn, table_name: str, column_name: str, column_def: str):
        """Add a column if it doesn't exist."""
        try:
            columns = get_existing_columns(conn, table_name)
            if column_name not in columns:
                conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_def}"))
                conn.commit()
                print(f"  ✅ Added column: {table_name}.{column_name}")
                return True
        except Exception as e:
            logger.warning(f"  ⚠️ Failed to add {table_name}.{column_name}: {e}")
        return False
    
    try:
        with engine.connect() as conn:
            print("🔄 Running database migrations...")
            
            # =========================================
            # INTERVIEW_PLANS TABLE MIGRATIONS
            # =========================================
            interview_plan_columns = [
                # Company mode columns
                ("company_mode", "VARCHAR(50)"),
                ("company_info", "TEXT"),  # JSON stored as TEXT in SQLite
                
                # Generation metadata
                ("generation_source", "VARCHAR(50) DEFAULT 'mock'"),
                ("generation_model", "VARCHAR(100)"),
                ("processing_time_ms", "INTEGER"),
                
                # Usage tracking
                ("is_used", "BOOLEAN DEFAULT 0"),  # 0 = False in SQLite
                ("used_for_session_id", "VARCHAR(36)"),
                
                # Question breakdown (in case they're missing)
                ("dsa_question_count", "INTEGER DEFAULT 0"),
                ("technical_question_count", "INTEGER DEFAULT 0"),
                ("behavioral_question_count", "INTEGER DEFAULT 0"),
                ("hr_question_count", "INTEGER DEFAULT 0"),
                ("situational_question_count", "INTEGER DEFAULT 0"),
                
                # Focus areas (JSON as TEXT)
                ("question_categories", "TEXT"),
                ("strength_focus_areas", "TEXT"),
                ("weakness_focus_areas", "TEXT"),
                ("skills_to_test", "TEXT"),
                
                # Plan content
                ("summary", "TEXT"),
                ("rationale", "TEXT"),
                ("questions", "TEXT"),  # JSON as TEXT
                
                # ATS link
                ("ats_analysis_id", "VARCHAR(36)"),
                ("target_role_description", "TEXT"),
            ]
            
            for col_name, col_def in interview_plan_columns:
                add_column_if_missing(conn, "interview_plans", col_name, col_def)
            
            # =========================================
            # INTERVIEW_REPORTS TABLE MIGRATIONS
            # =========================================
            if "interview_reports" in get_existing_columns(conn, "sqlite_master"):
                add_column_if_missing(conn, "interview_reports", "created_at", 
                                     "DATETIME DEFAULT CURRENT_TIMESTAMP")
            
            # =========================================
            # LIVE_INTERVIEW_SESSIONS TABLE MIGRATIONS
            # =========================================
            live_session_columns = [
                ("questions_answered", "INTEGER DEFAULT 0"),
                ("questions_skipped", "INTEGER DEFAULT 0"),
                ("total_duration_seconds", "INTEGER DEFAULT 0"),
                ("pause_start_at", "DATETIME"),
            ]
            
            for col_name, col_def in live_session_columns:
                add_column_if_missing(conn, "live_interview_sessions", col_name, col_def)
            
            # =========================================
            # API_REQUEST_LOGS TABLE MIGRATIONS
            # =========================================
            api_log_columns = [
                ("user_agent", "TEXT"),
                ("query_params", "TEXT"),
            ]
            
            for col_name, col_def in api_log_columns:
                add_column_if_missing(conn, "api_request_logs", col_name, col_def)
            
            # =========================================
            # SYSTEM_SETTINGS TABLE MIGRATIONS
            # =========================================
            system_settings_columns = [
                ("is_sensitive", "BOOLEAN DEFAULT 0"),
                ("category", "VARCHAR(50) DEFAULT 'general'"),
                ("value_type", "VARCHAR(20) DEFAULT 'string'"),
                ("description", "TEXT"),
            ]
            
            for col_name, col_def in system_settings_columns:
                add_column_if_missing(conn, "system_settings", col_name, col_def)
            
            # =========================================
            # BROADCASTS TABLE MIGRATIONS
            # =========================================
            broadcasts_columns = [
                ("updated_at", "DATETIME"),
            ]
            
            for col_name, col_def in broadcasts_columns:
                add_column_if_missing(conn, "broadcasts", col_name, col_def)
            
            # =========================================
            # DATA FIXES (Critical for is_used bug)
            # =========================================
            try:
                # Fix NULL is_used values - CRITICAL FOR START INTERVIEW BUG
                conn.execute(text("UPDATE interview_plans SET is_used = 0 WHERE is_used IS NULL"))
                conn.commit()
                print("  ✅ Fixed NULL is_used values in interview_plans")
                
                # Fix NULL status values
                conn.execute(text("UPDATE interview_plans SET status = 'ready' WHERE status IS NULL"))
                conn.commit()
                print("  ✅ Fixed NULL status values in interview_plans")
                
                # Reset plans that were marked as used but have no active session
                # This fixes plans that got stuck in "used" state due to failed session creation
                conn.execute(text("""
                    UPDATE interview_plans 
                    SET is_used = 0, status = 'ready', used_for_session_id = NULL
                    WHERE is_used = 1 
                    AND used_for_session_id IS NOT NULL 
                    AND used_for_session_id NOT IN (
                        SELECT id FROM live_interview_sessions WHERE status = 'in_progress' OR status = 'completed'
                    )
                """))
                conn.commit()
                print("  ✅ Reset orphaned 'used' plans with no active session")
                
            except Exception as fix_error:
                logger.warning(f"  ⚠️ Data fix warning (may be OK): {fix_error}")
            
            print("✅ Database migrations complete")
            
    except Exception as e:
        logger.warning(f"Migration check completed with warnings (OK for new databases): {e}")


def close_db() -> None:
    """
    Close database connections.
    
    Should be called on application shutdown.
    """
    engine.dispose()
    print("✅ Database connections closed")
