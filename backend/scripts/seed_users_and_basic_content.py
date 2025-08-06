#!/usr/bin/env python3
"""
Simple database seeding script for basic users and minimal content.
"""

import asyncio
import json
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext

# Import models
from app.models.user import User, UserRole
from app.models.content import ContentItem, ContentType, ContentState

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Database URL from environment or default
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql+asyncpg://nlj_user:nlj_pass@localhost:5432/nlj_platform"
)

async def create_users(session: AsyncSession) -> dict[str, User]:
    """Create basic users for all roles."""
    print("Creating users...")
    
    users = {}
    
    # Admin user
    admin_user = User(
        id=uuid.uuid4(),
        username="admin",
        email="admin@nlj-platform.com",
        hashed_password=pwd_context.hash("admin123456"),
        full_name="Administrator",
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True
    )
    users["admin"] = admin_user
    session.add(admin_user)
    
    # Creator user
    creator_user = User(
        id=uuid.uuid4(),
        username="creator",
        email="creator@nlj-platform.com",
        hashed_password=pwd_context.hash("creator123"),
        full_name="Content Creator",
        role=UserRole.CREATOR,
        is_active=True,
        is_verified=True
    )
    users["creator"] = creator_user
    session.add(creator_user)
    
    # Reviewer user
    reviewer_user = User(
        id=uuid.uuid4(),
        username="reviewer",
        email="reviewer@nlj-platform.com",
        hashed_password=pwd_context.hash("reviewer123"),
        full_name="Content Reviewer",
        role=UserRole.REVIEWER,
        is_active=True,
        is_verified=True
    )
    users["reviewer"] = reviewer_user
    session.add(reviewer_user)
    
    # Player user
    player_user = User(
        id=uuid.uuid4(),
        username="player",
        email="player@nlj-platform.com",
        hashed_password=pwd_context.hash("player123"),
        full_name="Player/Learner",
        role=UserRole.PLAYER,
        is_active=True,
        is_verified=True
    )
    users["player"] = player_user
    session.add(player_user)
    
    # Learner user (for training)
    learner_user = User(
        id=uuid.uuid4(),
        username="learner",
        email="learner@nlj-platform.com",
        hashed_password=pwd_context.hash("learner123"),
        full_name="Training Learner",
        role=UserRole.PLAYER,
        is_active=True,
        is_verified=True
    )
    users["learner"] = learner_user
    session.add(learner_user)
    
    await session.commit()
    print(f"Created {len(users)} users")
    return users

async def create_basic_content(session: AsyncSession, users: dict[str, User]) -> list[ContentItem]:
    """Create some basic content items."""
    print("Creating basic content...")
    
    content_items = []
    
    # Simple training scenario
    training_nlj = {
        "id": str(uuid.uuid4()),
        "name": "Basic Training Example",
        "description": "A simple training scenario for testing",
        "nodes": [
            {
                "id": "start",
                "type": "panel",
                "title": "Welcome",
                "content": "Welcome to this basic training scenario.",
                "isStartNode": True
            },
            {
                "id": "question1",
                "type": "trueFalse",
                "title": "Knowledge Check",
                "content": "This is a sample question.",
                "question": "Is this a test question?",
                "correctAnswer": True,
                "feedback": {
                    "correct": "Correct! This is indeed a test question.",
                    "incorrect": "Incorrect. This is a test question for demonstration."
                }
            }
        ],
        "links": [
            {
                "id": "link1",
                "sourceId": "start",
                "targetId": "question1"
            }
        ]
    }
    
    training_content = ContentItem(
        id=uuid.uuid4(),
        title="Basic Training Example",
        description="A simple training scenario for testing the platform",
        nlj_data=training_nlj,
        content_type=ContentType.TRAINING,
        state=ContentState.PUBLISHED,
        created_by=users["creator"].id
    )
    content_items.append(training_content)
    session.add(training_content)
    
    # Simple survey
    survey_nlj = {
        "id": str(uuid.uuid4()),
        "name": "Basic Survey Example",
        "description": "A simple survey for testing",
        "nodes": [
            {
                "id": "start",
                "type": "panel",
                "title": "Survey Introduction",
                "content": "Thank you for participating in this survey.",
                "isStartNode": True
            },
            {
                "id": "rating1",
                "type": "likertScale", 
                "title": "Satisfaction Rating",
                "content": "How satisfied are you with this platform?",
                "question": "Rate your satisfaction level:",
                "scale": "1-5",
                "labels": ["Very Unsatisfied", "Unsatisfied", "Neutral", "Satisfied", "Very Satisfied"]
            }
        ],
        "links": [
            {
                "id": "link1",
                "sourceId": "start",
                "targetId": "rating1"
            }
        ]
    }
    
    survey_content = ContentItem(
        id=uuid.uuid4(),
        title="Basic Survey Example",
        description="A simple survey for testing the platform",
        nlj_data=survey_nlj,
        content_type=ContentType.SURVEY,
        state=ContentState.PUBLISHED,
        created_by=users["creator"].id
    )
    content_items.append(survey_content)
    session.add(survey_content)
    
    await session.commit()
    print(f"Created {len(content_items)} content items")
    return content_items

async def seed_database():
    """Main seeding function."""
    print("Starting database seeding...")
    
    # Create async engine and session
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    try:
        async with async_session() as session:
            # Create users
            users = await create_users(session)
            
            # Create basic content
            content_items = await create_basic_content(session, users)
            
            print("\n🎉 Database seeding completed successfully!")
            print("=" * 50)
            print("\n👥 User Accounts Created:")
            print("  • admin / admin123456 (Administrator)")
            print("  • creator / creator123 (Content Creator)")  
            print("  • reviewer / reviewer123 (Content Reviewer)")
            print("  • player / player123 (Player/Learner)")
            print("  • learner / learner123 (Training Learner)")
            print(f"\n📚 Content Items Created: {len(content_items)}")
            print("  • Basic Training Example")
            print("  • Basic Survey Example")
            print("\n✨ Ready for development!")
            
    except Exception as e:
        print(f"❌ Error seeding database: {e}")
        raise
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed_database())