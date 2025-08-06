#!/usr/bin/env python3
"""
Simple user seeding script for NLJ Platform development environment.
Creates only basic users for testing.
"""

import asyncio
import os
import sys
import uuid
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext

# Import only what we need
from app.models.user import User, UserRole

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Database URL from environment or default
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql+asyncpg://nlj_user:nlj_pass@localhost:5432/nlj_platform"
)

async def create_users(session: AsyncSession):
    """Create basic users for all roles."""
    print("Creating users...")
    
    users_data = [
        {
            "username": "admin",
            "email": "admin@nlj-platform.com",
            "password": "admin123456",
            "full_name": "Administrator",
            "role": UserRole.ADMIN
        },
        {
            "username": "creator",
            "email": "creator@nlj-platform.com", 
            "password": "creator123",
            "full_name": "Content Creator",
            "role": UserRole.CREATOR
        },
        {
            "username": "reviewer",
            "email": "reviewer@nlj-platform.com",
            "password": "reviewer123", 
            "full_name": "Content Reviewer",
            "role": UserRole.REVIEWER
        },
        {
            "username": "player",
            "email": "player@nlj-platform.com",
            "password": "player123",
            "full_name": "Player User", 
            "role": UserRole.PLAYER
        },
        {
            "username": "learner",
            "email": "learner@nlj-platform.com",
            "password": "learner123",
            "full_name": "Training Learner",
            "role": UserRole.LEARNER
        }
    ]
    
    for user_data in users_data:
        user = User(
            id=uuid.uuid4(),
            username=user_data["username"],
            email=user_data["email"],
            hashed_password=pwd_context.hash(user_data["password"]),
            full_name=user_data["full_name"],
            role=user_data["role"],
            is_active=True,
            is_verified=True,
        )
        session.add(user)
    
    await session.commit()
    print(f"Created {len(users_data)} users")

async def seed_users_only():
    """Main seeding function - users only."""
    print("Starting minimal database seeding (users only)...")
    
    # Create async engine
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    # Create session factory
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    try:
        async with async_session() as session:
            await create_users(session)
            
        print("\n🎉 Database seeding complete!")
        print("========================================")
        print("\n👥 Test Users Created:")
        print("  • admin / admin123456 (Administrator)")
        print("  • creator / creator123 (Content Creator)")
        print("  • reviewer / reviewer123 (Content Reviewer)")
        print("  • player / player123 (Player/Learner)")
        print("  • learner / learner123 (Training Learner)")
        
    except Exception as e:
        print(f"Error seeding database: {e}")
        raise
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed_users_only())