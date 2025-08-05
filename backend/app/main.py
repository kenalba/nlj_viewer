"""
NLJ Platform FastAPI Backend
Modern FastAPI application with async support and comprehensive API for content management.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import create_tables
from app.services.kafka_service import kafka_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    await create_tables()
    
    # Initialize Kafka producer for event publishing
    try:
        await kafka_service.start_producer()
    except Exception as e:
        # Log error but don't fail startup - Kafka may not be available in all environments
        print(f"Warning: Failed to initialize Kafka producer: {e}")
    
    yield
    
    # Shutdown
    try:
        await kafka_service.stop()
    except Exception as e:
        print(f"Warning: Error shutting down Kafka connections: {e}")


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
from app.api.calcom_integration import router as calcom_router

app.include_router(auth_router, prefix="/api/auth", tags=["authentication"])
app.include_router(users_router, prefix="/api/users", tags=["users"])
app.include_router(content_router, prefix="/api", tags=["content"])
app.include_router(workflow_router, tags=["workflow"])
app.include_router(sources_router, prefix="/api", tags=["sources"])
app.include_router(generation_router, prefix="/api", tags=["generation"])
app.include_router(media_router, prefix="/api", tags=["media"])
app.include_router(sharing_router, prefix="/api", tags=["sharing"])
app.include_router(public_sharing_router, tags=["public"])
app.include_router(calcom_router, prefix="/api", tags=["calcom-integration"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )