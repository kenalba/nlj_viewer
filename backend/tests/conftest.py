import asyncio
import os
import uuid
from datetime import datetime
from typing import AsyncGenerator, Generator

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.user import User, UserRole


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def test_engine():
    """Create test database engine with SQLite in-memory for fast tests."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        poolclass=StaticPool,
        connect_args={
            "check_same_thread": False,
        },
    )
    
    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    await engine.dispose()


@pytest_asyncio.fixture
async def test_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session."""
    async_session_local = async_sessionmaker(
        bind=test_engine, 
        class_=AsyncSession, 
        expire_on_commit=False
    )
    
    async with async_session_local() as session:
        yield session


@pytest_asyncio.fixture
async def test_user(test_session: AsyncSession) -> User:
    """Create a test user for authentication tests."""
    user = User(
        id=uuid.uuid4(),
        username="testuser",
        email="test@example.com",
        hashed_password="hashed_password_123",
        full_name="Test User",
        role=UserRole.CREATOR,
        is_active=True,
        is_verified=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)
    
    return user


@pytest_asyncio.fixture
async def admin_user(test_session: AsyncSession) -> User:
    """Create an admin user for testing admin-only functionality."""
    user = User(
        id=uuid.uuid4(),
        username="admin",
        email="admin@example.com", 
        hashed_password="hashed_password_admin",
        full_name="Admin User",
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)
    
    return user


@pytest.fixture
def mock_settings():
    """Mock settings for testing."""
    class MockSettings:
        SECRET_KEY = "test-secret-key"
        ACCESS_TOKEN_EXPIRE_MINUTES = 30
        DATABASE_URL = "sqlite+aiosqlite:///:memory:"
        ENABLE_REGISTRATION = True
        USE_RDS = False
        
    return MockSettings()