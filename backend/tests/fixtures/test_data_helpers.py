from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import ContentItem
from app.models.user import User
from .factories import TestDataBuilder


async def seed_test_data(session: AsyncSession, scenario: str = "basic") -> Dict[str, Any]:
    """Seed test database with common test scenarios."""
    
    if scenario == "basic":
        builder = (TestDataBuilder()
                  .with_users(count=2)
                  .with_content(count=3, creator_index=0))
        
    elif scenario == "multi_role":
        builder = TestDataBuilder()
        # Add users with different roles
        builder.with_users(count=1, role="ADMIN")
        builder.with_users(count=1, role="CREATOR") 
        builder.with_users(count=1, role="REVIEWER")
        builder.with_content(count=5, creator_index=1)  # Creator creates content
        
    elif scenario == "empty":
        builder = TestDataBuilder()
        
    else:
        raise ValueError(f"Unknown test scenario: {scenario}")
    
    test_data = builder.build()
    
    # Add all users and content to session
    for user in test_data["users"]:
        session.add(user)
    
    for content in test_data["content_items"]:
        session.add(content)
    
    await session.commit()
    
    # Refresh objects to get generated IDs
    for user in test_data["users"]:
        await session.refresh(user)
    
    for content in test_data["content_items"]:
        await session.refresh(content)
    
    return test_data


async def clean_test_data(session: AsyncSession) -> None:
    """Clean up test data from database."""
    # Delete content items first (foreign key dependency)
    await session.execute("DELETE FROM content_items")
    await session.execute("DELETE FROM users")
    await session.commit()