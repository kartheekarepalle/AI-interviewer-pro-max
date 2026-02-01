"""
Companies Module

Company-specific interview modes.
"""

from app.companies.modes import (
    CompanyType,
    CompanyProfile,
    get_company_profile,
    get_all_profiles,
    get_profile_summary,
    COMPANY_PROFILES,
    FAANG_PROFILE,
    STARTUP_PROFILE,
    SERVICE_PROFILE,
    PRODUCT_PROFILE,
    CUSTOM_PROFILE,
)
from app.companies.routes import router as companies_router

__all__ = [
    "CompanyType",
    "CompanyProfile",
    "get_company_profile",
    "get_all_profiles",
    "get_profile_summary",
    "COMPANY_PROFILES",
    "FAANG_PROFILE",
    "STARTUP_PROFILE",
    "SERVICE_PROFILE",
    "PRODUCT_PROFILE",
    "CUSTOM_PROFILE",
    "companies_router",
]
