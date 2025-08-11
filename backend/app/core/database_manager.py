"""
Database connection manager that handles both direct PostgreSQL and RDS connections.
Automatically configures connection based on environment settings.
"""

import asyncio
import logging
from typing import Optional
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.core.config import settings

logger = logging.getLogger(__name__)


class DatabaseConnectionManager:
    """
    Manages database connections for both direct PostgreSQL and RDS.
    Automatically detects configuration and sets up appropriate connections.
    """
    
    def __init__(self):
        self.engine = None
        self.async_session_local = None
        self._connection_url = None
        self._use_rds = False
        
    async def initialize(self):
        """Initialize database connection based on configuration."""
        try:
            if settings.USE_RDS:
                await self._setup_rds_connection()
            else:
                await self._setup_direct_connection()
                
            logger.info(f"Database connection initialized: {'RDS' if self._use_rds else 'Direct PostgreSQL'}")
            
        except Exception as e:
            logger.error(f"Failed to initialize database connection: {e}")
            raise
    
    async def _setup_rds_connection(self):
        """Set up RDS connection using dynamic endpoint resolution."""
        try:
            from app.services.database_service import rds_database_service
            
            # Get RDS connection info
            connection_info = await rds_database_service.get_connection_info()
            
            if not connection_info.get('available'):
                raise Exception(f"RDS instance not available: {connection_info.get('error', 'Unknown error')}")
            
            self._connection_url = connection_info['connection_string']
            self._use_rds = True
            
            # Create async engine for RDS
            self.engine = create_async_engine(
                self._connection_url,
                echo=settings.DEBUG,
                pool_pre_ping=True,  # Important for RDS connections
                pool_recycle=3600,   # Recycle connections every hour
                pool_size=5,         # Smaller pool for RDS
                max_overflow=10
            )
            
            self.async_session_local = async_sessionmaker(
                bind=self.engine,
                class_=AsyncSession,
                expire_on_commit=False
            )
            
            logger.info(f"RDS connection established: {connection_info['host']}:{connection_info['port']}")
            
        except Exception as e:
            logger.error(f"Failed to setup RDS connection: {e}")
            # Fallback to direct connection
            await self._setup_direct_connection()
    
    async def _setup_direct_connection(self):
        """Set up direct PostgreSQL connection."""
        try:
            self._connection_url = settings.DATABASE_URL
            self._use_rds = False
            
            # Create async engine for direct PostgreSQL
            self.engine = create_async_engine(
                self._connection_url,
                echo=settings.DEBUG,
                pool_size=10,
                max_overflow=20
            )
            
            self.async_session_local = async_sessionmaker(
                bind=self.engine,
                class_=AsyncSession,
                expire_on_commit=False
            )
            
            logger.info("Direct PostgreSQL connection established")
            
        except Exception as e:
            logger.error(f"Failed to setup direct PostgreSQL connection: {e}")
            raise
    
    def get_session(self) -> AsyncSession:
        """Get database session."""
        if not self.async_session_local:
            raise RuntimeError("Database not initialized. Call initialize() first.")
        
        return self.async_session_local()
    
    async def close(self):
        """Close database connections."""
        if self.engine:
            await self.engine.dispose()
            logger.info("Database connections closed")
    
    def get_connection_info(self) -> dict:
        """Get current connection information."""
        return {
            'url': self._connection_url,
            'use_rds': self._use_rds,
            'engine_initialized': self.engine is not None
        }
    
    async def health_check(self) -> dict:
        """Perform database health check."""
        try:
            if not self.engine:
                return {'status': 'not_initialized', 'error': 'Database engine not initialized'}
            
            # Test connection
            session = self.get_session()
            try:
                from sqlalchemy import text
                result = await session.execute(text("SELECT 1"))
                result.fetchone()
            finally:
                await session.close()
            
            return {
                'status': 'healthy',
                'connection_type': 'RDS' if self._use_rds else 'Direct PostgreSQL',
                'url_pattern': self._connection_url.split('@')[1] if '@' in self._connection_url else 'N/A'
            }
            
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'connection_type': 'RDS' if self._use_rds else 'Direct PostgreSQL'
            }
    
    async def ensure_initialized(self, auto_seed: bool = False):
        """
        Ensure database is initialized with tables and optionally seed data.
        This is called automatically on app startup.
        """
        try:
            # Initialize connection if not done
            if not self.engine:
                await self.initialize()
            
            # Create tables if they don't exist
            await self._ensure_tables()
            
            # Optionally seed with initial data
            if auto_seed:
                await self._auto_seed_database()
                
            logger.info("Database initialization complete")
            
        except Exception as e:
            logger.error(f"Database initialization failed: {e}")
            raise
    
    async def _ensure_tables(self):
        """Ensure all database tables exist."""
        try:
            # Import Base and models - the old engine in database.py won't interfere 
            # since we're using our own engine for table creation
            from app.core.database import Base
            
            # Import all models to register them with Base metadata
            from app.models.user import User  # noqa: F401
            from app.models.content import ContentItem  # noqa: F401
            from app.models.workflow import ContentVersion, ApprovalWorkflow  # noqa: F401
            from app.models.generation_session import GenerationSession  # noqa: F401
            from app.models.activity_source import ActivitySource  # noqa: F401
            from app.models.source_document import SourceDocument  # noqa: F401
            from app.models.shared_token import SharedToken  # noqa: F401
            from app.models.media import MediaItem  # noqa: F401
            from app.models.training_program import TrainingProgram, TrainingSession  # noqa: F401
            
            async with self.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                
            logger.info("Database tables verified/created")
            
        except Exception as e:
            logger.error(f"Failed to create database tables: {e}")
            raise
    
    async def _auto_seed_database(self):
        """Automatically seed the database with essential data if empty."""
        try:
            from app.models.user import User
            from sqlalchemy import select, func
            
            # Check if we already have users
            session = self.get_session()
            try:
                result = await session.execute(select(func.count(User.id)))
                user_count = result.scalar()
                
                if user_count == 0:
                    logger.info("Database is empty, seeding with initial data...")
                    await self._seed_essential_data(session)
                    await session.commit()
                    logger.info("Database seeded with essential data")
                else:
                    logger.info(f"Database already contains {user_count} users, skipping auto-seed")
            finally:
                await session.close()
                    
        except Exception as e:
            logger.error(f"Auto-seeding failed: {e}")
            # Don't raise - seeding failure shouldn't prevent app startup
    
    async def _seed_essential_data(self, session):
        """Seed essential data (users, basic content)."""
        import uuid
        from datetime import datetime
        from passlib.context import CryptContext
        from app.models.user import User, UserRole
        
        # Password hashing
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        
        # Create basic users
        essential_users = [
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
                "full_name": "Test Player",
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
        
        for user_data in essential_users:
            user = User(
                id=uuid.uuid4(),
                username=user_data["username"],
                email=user_data["email"],
                hashed_password=pwd_context.hash(user_data["password"]),
                full_name=user_data["full_name"],
                role=user_data["role"],
                is_active=True,
                is_verified=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            session.add(user)
        
        logger.info(f"Created {len(essential_users)} essential users")


# Global database connection manager
db_manager = DatabaseConnectionManager()


# Dependency for getting database sessions
async def get_db() -> AsyncSession:
    """Database session dependency for FastAPI."""
    if not db_manager.async_session_local:
        await db_manager.initialize()
    
    session = db_manager.get_session()
    try:
        yield session
    finally:
        await session.close()


# Initialize database tables
async def create_tables():
    """Create database tables (legacy function for backward compatibility)."""
    await db_manager._ensure_tables()