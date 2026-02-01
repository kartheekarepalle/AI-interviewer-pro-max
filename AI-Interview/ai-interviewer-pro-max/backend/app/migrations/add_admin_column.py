"""
Database Migration: Add is_admin column to users table

Run this script to add the is_admin column to existing database.

Usage:
    python -m app.migrations.add_admin_column
"""

import sys
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from app.db.session import engine, SessionLocal


def run_migration():
    """Add is_admin column to users table."""
    print("=" * 50)
    print("Running migration: Add is_admin column to users")
    print("=" * 50)
    
    with engine.connect() as conn:
        # Check if column already exists
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'is_admin'
        """))
        
        if result.fetchone():
            print("✅ Column 'is_admin' already exists. Skipping.")
            return
        
        # Add the column
        print("Adding 'is_admin' column...")
        conn.execute(text("""
            ALTER TABLE users 
            ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE
        """))
        conn.commit()
        print("✅ Column 'is_admin' added successfully!")
        
        # Optional: Make first user admin
        print("\nDo you want to make an existing user an admin? (y/n)")
        choice = input().strip().lower()
        
        if choice == 'y':
            print("Enter the email of the user to make admin:")
            email = input().strip()
            
            if email:
                result = conn.execute(
                    text("UPDATE users SET is_admin = TRUE WHERE email = :email"),
                    {"email": email}
                )
                conn.commit()
                
                if result.rowcount > 0:
                    print(f"✅ User '{email}' is now an admin!")
                else:
                    print(f"❌ User '{email}' not found.")
    
    print("\n" + "=" * 50)
    print("Migration completed successfully!")
    print("=" * 50)


if __name__ == "__main__":
    run_migration()
