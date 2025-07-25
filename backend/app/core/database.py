"""
Database configuration and utilities using SQLAlchemy 2.0 with async support.
"""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


# Create async engine with modern SQLAlchemy 2.0 syntax
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,  # Disable verbose SQL logging
    pool_pre_ping=True,
    pool_recycle=300,
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all database models using modern SQLAlchemy syntax."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for getting database session.
    Modern async generator pattern.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables() -> None:
    """Create database tables. Called during application startup."""
    async with engine.begin() as conn:
        # Import all models here to ensure they're registered
        from app.models.user import User  # noqa: F401
        from app.models.content import ContentItem  # noqa: F401
        # TODO: Uncomment when approval workflow is implemented
        # from app.models.workflow import ApprovalWorkflow, ApprovalStep  # noqa: F401
        
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)