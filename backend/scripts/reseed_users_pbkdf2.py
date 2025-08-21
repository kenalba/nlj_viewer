#!/usr/bin/env python3
"""
Re-seed users with PBKDF2 hashes instead of bcrypt.
This script clears existing users and creates new ones with our security module.
"""

import asyncio
import sys
import uuid
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete

from app.core.database_manager import db_manager
from app.core.security import get_password_hash

# Import only what we need
from app.models.user import User, UserRole


async def clear_and_create_users(session: AsyncSession):
    """Clear existing users and create new ones with PBKDF2 hashes."""
    print("Clearing existing users...")
    
    # Delete all existing users
    await session.execute(delete(User))
    await session.commit()
    print("Existing users cleared")
    
    print("Creating users with PBKDF2 hashes...")

    users_data = [
        {
            "username": "admin",
            "email": "admin@nlj-platform.com",
            "password": "admin123456",
            "full_name": "Administrator",
            "role": UserRole.ADMIN,
        },
        {
            "username": "creator",
            "email": "creator@nlj-platform.com",
            "password": "creator123",
            "full_name": "Content Creator",
            "role": UserRole.CREATOR,
        },
        {
            "username": "reviewer",
            "email": "reviewer@nlj-platform.com",
            "password": "reviewer123",
            "full_name": "Content Reviewer",
            "role": UserRole.REVIEWER,
        },
        {
            "username": "player",
            "email": "player@nlj-platform.com",
            "password": "player123",
            "full_name": "Player User",
            "role": UserRole.PLAYER,
        },
        {
            "username": "learner",
            "email": "learner@nlj-platform.com",
            "password": "learner123",
            "full_name": "Training Learner",
            "role": UserRole.LEARNER,
        },
    ]

    for user_data in users_data:
        user = User(
            id=uuid.uuid4(),
            username=user_data["username"],
            email=user_data["email"],
            hashed_password=get_password_hash(user_data["password"]),
            full_name=user_data["full_name"],
            role=user_data["role"],
            is_active=True,
            is_verified=True,
        )
        session.add(user)

    await session.commit()
    print(f"Created {len(users_data)} users with PBKDF2 hashes")


async def reseed_users():
    """Main reseeding function."""
    print("Starting user reseeding with PBKDF2 hashes...")
    print("🔍 Detecting database configuration...")

    # Initialize database manager (handles both RDS and direct PostgreSQL)
    await db_manager.initialize()

    connection_info = db_manager.get_connection_info()
    print(f"📊 Connected to: {'RDS' if connection_info.get('use_rds') else 'Direct PostgreSQL'}")

    try:
        async with db_manager.get_session() as session:
            await clear_and_create_users(session)

        print("\n🎉 Database reseeding complete!")
        print("========================================")
        print("\n👥 Test Users Created (PBKDF2 Hashes):")
        print("  • admin@nlj-platform.com / admin123456 (Administrator)")
        print("  • creator@nlj-platform.com / creator123 (Content Creator)")
        print("  • reviewer@nlj-platform.com / reviewer123 (Content Reviewer)")
        print("  • player@nlj-platform.com / player123 (Player/Learner)")
        print("  • learner@nlj-platform.com / learner123 (Training Learner)")

    except Exception as e:
        print(f"Error reseeding database: {e}")
        raise
    finally:
        await db_manager.close()


if __name__ == "__main__":
    asyncio.run(reseed_users())