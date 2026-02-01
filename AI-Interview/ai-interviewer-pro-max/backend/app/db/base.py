"""
Database Base

SQLAlchemy declarative base and model utilities.
"""

from sqlalchemy.ext.declarative import declarative_base

# Create declarative base for all models
Base = declarative_base()


def get_model_dict(model_instance) -> dict:
    """
    Convert SQLAlchemy model instance to dictionary.
    
    Args:
        model_instance: SQLAlchemy model instance
        
    Returns:
        Dictionary representation of the model
    """
    return {
        column.name: getattr(model_instance, column.name)
        for column in model_instance.__table__.columns
    }
