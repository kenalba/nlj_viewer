"""
Alembic environment configuration for async database migrations.
Uses modern SQLAlchemy 2.0 async patterns.
"""

import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context

# Import your models' Base for autogenerate support
from app.core.database import Base
from app.core.config import settings

# Import all models to ensure they're registered with Base.metadata
from app.models.user import User  # noqa: F401
from app.models.content import ContentItem  # noqa: F401
from app.models.workflow import ContentVersion, ApprovalWorkflow, WorkflowReview  # noqa: F401
from app.models.source_document import SourceDocument  # noqa: F401
from app.models.generation_session import GenerationSession  # noqa: F401
from app.models.activity_source import ActivitySource  # noqa: F401
# Import new node models
from app.models.node import Node, ActivityNode, NodeInteraction  # noqa: F401
from app.models.learning_objective import (  # noqa: F401
    LearningObjective, 
    Keyword, 
    NodeLearningObjective, 
    NodeKeyword, 
    ObjectivePrerequisite
)

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set the target metadata for autogenerate support
target_metadata = Base.metadata

# Override the database URL from environment
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Run migrations with established connection."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
        transaction_per_migration=True,  # Use single transaction per migration
        transactional_ddl=True,  # Use transactional DDL for PostgreSQL
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode with async support."""
    # Use direct database URL from settings - avoid database manager complexity
    url = config.get_main_option("sqlalchemy.url")
    
    # Create async engine with single connection pool to avoid conflicts
    connectable = create_async_engine(
        url,
        poolclass=pool.NullPool,  # Use NullPool to avoid connection pooling issues
        echo=False,  # Disable SQL echo to reduce overhead
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()