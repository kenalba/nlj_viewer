"""
NLJ Platform FastAPI Backend
Modern FastAPI application with async support and comprehensive API for content management.
"""

import logging
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings

# Configure logging for Docker container output
def configure_logging():
    """Configure application-wide logging for Docker container visibility."""
    
    # Create formatter that includes timestamp, level, module, and message
    formatter = logging.Formatter(
        fmt='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    
    # Remove default handlers to avoid duplication
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Create console handler that outputs to stdout (visible in Docker logs)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    # Set specific loggers to appropriate levels
    logging.getLogger('app.services.event_consumers').setLevel(logging.INFO)
    logging.getLogger('app.services.kafka_service').setLevel(logging.INFO)
    logging.getLogger('app.core.database_manager').setLevel(logging.INFO)
    
    # Quiet down some noisy third-party loggers
    logging.getLogger('aiokafka').setLevel(logging.WARNING)
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
    logging.getLogger('anthropic').setLevel(logging.INFO)
    
    print("✅ Logging configured for Docker container visibility")  # Keep as print since this runs before logger setup

# Configure logging on module import
configure_logging()

# Get logger for main module after logging is configured
logger = logging.getLogger(__name__)

from app.core.database_manager import db_manager, create_tables
from app.services.kafka_service import kafka_service
from app.services.kafka_ralph_consumer import start_kafka_ralph_consumer, stop_kafka_ralph_consumer
from app.services.event_consumers import start_content_generation_consumer, stop_content_generation_consumer


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup - automatically initialize database with tables and optional seeding
    auto_seed = settings.AUTO_SEED_DATABASE if hasattr(settings, 'AUTO_SEED_DATABASE') else False
    await db_manager.ensure_initialized(auto_seed=auto_seed)
    
    # Initialize Kafka producer for event publishing
    try:
        await kafka_service.start_producer()
    except Exception as e:
        # Log error but don't fail startup - Kafka may not be available in all environments
        logger.warning(f"Failed to initialize Kafka producer: {e}")
    
    # Start Kafka Ralph LRS consumer for analytics
    try:
        logger.info("🚀 Starting Kafka Ralph LRS consumer for analytics...")
        await start_kafka_ralph_consumer()
        logger.info("✅ Kafka Ralph LRS consumer started successfully")
    except Exception as e:
        # Log error but don't fail startup - Ralph LRS may not be available in all environments
        logger.warning(f"⚠️  Failed to start Kafka Ralph consumer: {e}")
    
    # Start Content Generation event consumer
    try:
        logger.info("🚀 Starting Content Generation event consumer...")
        await start_content_generation_consumer()
        logger.info("✅ Content Generation event consumer started successfully")
    except Exception as e:
        # Log error but don't fail startup - Kafka may not be available in all environments
        logger.warning(f"⚠️  Failed to start Content Generation consumer: {e}")
    
    logger.info("🎉 All event consumers initialized!")
    
    yield
    
    # Shutdown
    try:
        logger.info("🔌 Shutting down Content Generation consumer...")
        await stop_content_generation_consumer()
        logger.info("✅ Content Generation consumer stopped")
    except Exception as e:
        logger.warning(f"⚠️  Error shutting down Content Generation consumer: {e}")
    
    try:
        logger.info("🔌 Shutting down Kafka Ralph consumer...")
        await stop_kafka_ralph_consumer()
        logger.info("✅ Kafka Ralph consumer stopped")
    except Exception as e:
        logger.warning(f"⚠️  Error shutting down Kafka Ralph consumer: {e}")
    
    try:
        logger.info("🔌 Shutting down Kafka connections...")
        await kafka_service.stop()
        logger.info("✅ Kafka connections closed")
    except Exception as e:
        logger.warning(f"⚠️  Error shutting down Kafka connections: {e}")
    
    try:
        logger.info("🔌 Shutting down database connections...")
        await db_manager.close()
        logger.info("✅ Database connections closed")
    except Exception as e:
        logger.warning(f"⚠️  Error shutting down database connections: {e}")
    
    logger.info("👋 Graceful shutdown complete!")


# Create FastAPI application with modern configuration
app = FastAPI(
    title="NLJ Platform API",
    description="FastAPI backend for Non-Linear Journey content platform with approval workflows",
    version="0.1.0",
    openapi_url="/api/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_HOSTS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint for health check."""
    return {
        "message": "NLJ Platform API",
        "version": "0.1.0",
        "status": "running"
    }


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy"}


# Include API routers
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.content import router as content_router
from app.api.workflow import router as workflow_router
from app.api.sources import router as sources_router
from app.api.generation import router as generation_router
from app.api.media import router as media_router
from app.api.shared_tokens import auth_router as sharing_router, public_router as public_sharing_router
# Cal.com integration removed - migrating to our own system
from app.api.training_programs import router as training_programs_router
from app.api.training_sessions import router as training_sessions_router
from app.api.training_registrations import router as training_registrations_router
from app.api.registrations import router as registrations_router
from app.api.analytics import router as analytics_router
from app.api.survey_analytics import router as survey_analytics_router
from app.api.notifications import router as notifications_router
from app.api.database import router as database_router

app.include_router(auth_router, prefix="/api/auth", tags=["authentication"])
app.include_router(users_router, prefix="/api/users", tags=["users"])
app.include_router(content_router, prefix="/api", tags=["content"])
app.include_router(workflow_router, tags=["workflow"])
app.include_router(sources_router, prefix="/api", tags=["sources"])
app.include_router(generation_router, prefix="/api", tags=["generation"])
app.include_router(media_router, prefix="/api", tags=["media"])
app.include_router(sharing_router, prefix="/api", tags=["sharing"])
app.include_router(public_sharing_router, tags=["public"])
# Cal.com router removed - migrating to our own training session system
app.include_router(training_programs_router, prefix="/api/training-programs", tags=["training-programs"])
app.include_router(training_sessions_router, prefix="/api/training-sessions", tags=["training-sessions"])
app.include_router(training_registrations_router, prefix="/api/training-registrations", tags=["training-registrations"])
app.include_router(registrations_router, prefix="/api/my-registrations", tags=["registrations"])
app.include_router(analytics_router, prefix="/api/analytics", tags=["analytics"])
app.include_router(survey_analytics_router, prefix="/api/surveys", tags=["surveys"])
app.include_router(notifications_router, prefix="/api", tags=["notifications"])
app.include_router(database_router, prefix="/api", tags=["database"])



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )