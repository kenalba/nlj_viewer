import asyncio
import os
import uuid
from datetime import datetime
from typing import AsyncGenerator, Generator

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base
from app.models.user import User, UserRole


# Remove custom event_loop fixture - let pytest-asyncio handle it


@pytest_asyncio.fixture
async def test_engine():
    """Create test database engine with PostgreSQL for each test function."""
    # Use PostgreSQL test database instead of SQLite
    database_url = os.getenv(
        "TEST_DATABASE_URL", 
        "postgresql+asyncpg://test_user:test_pass@localhost:5433/nlj_test"
    )
    
    # Configure asyncpg to handle connections properly  
    engine = create_async_engine(
        database_url,
        echo=False,
        pool_size=1,  # Single connection per test
        max_overflow=0,
        connect_args={
            "command_timeout": 30,
            "server_settings": {
                "jit": "off",  # Disable JIT for tests
            }
        },
        pool_pre_ping=False,  # Disable pre-ping to avoid event loop issues
        pool_recycle=-1,      # Don't recycle connections in tests
    )
    
    yield engine
    
    # Proper cleanup
    await engine.dispose()


@pytest_asyncio.fixture
async def test_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session with tables created."""
    # Ensure all tables exist
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
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