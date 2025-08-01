"""
Application configuration using Pydantic Settings with modern typing.
"""

from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with type hints and validation."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )
    
    # Application settings
    APP_NAME: str = "NLJ Platform API"
    DEBUG: bool = Field(default=False, description="Enable debug mode")
    VERSION: str = "0.1.0"
    
    # Database settings
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://nlj_user:nlj_pass@localhost:5432/nlj_platform",
        description="Async PostgreSQL database URL"
    )
    
    # Security settings
    SECRET_KEY: str = Field(
        default="your-secret-key-change-in-production",
        description="Secret key for JWT token generation"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    EMAIL_RESET_TOKEN_EXPIRE_HOURS: int = 24
    
    # CORS settings
    ALLOWED_HOSTS: list[str] = Field(
        default=["http://localhost:3000", "http://localhost:5173"],
        description="Allowed origins for CORS"
    )
    
    # Frontend URL for public sharing
    FRONTEND_URL: str | None = Field(
        default=None,
        description="Frontend URL for generating public share links. If not set, will be derived from request or default to localhost:5173"
    )
    
    # File upload settings
    MAX_FILE_SIZE: int = Field(
        default=500 * 1024 * 1024,  # 500MB (Claude Files API limit)
        description="Maximum file upload size in bytes"
    )
    UPLOAD_DIR: str = Field(
        default="uploads",
        description="Directory for file uploads"
    )
    
    # Claude API settings
    CLAUDE_API_KEY: str = Field(
        default="",
        description="Anthropic Claude API key for content generation"
    )
    
    # Feature flags
    ENABLE_REGISTRATION: bool = Field(
        default=True,
        description="Allow new user registration"
    )
    ENABLE_EMAIL_NOTIFICATIONS: bool = Field(
        default=False,
        description="Enable email notifications for workflows"
    )
    
    # Redis settings (for future caching)
    REDIS_URL: str | None = Field(
        default=None,
        description="Redis URL for caching"
    )
    
    # Email settings (for future notifications)
    EMAIL_HOST: str | None = Field(default=None)
    EMAIL_PORT: int = Field(default=587)
    EMAIL_USER: str | None = Field(default=None)
    EMAIL_PASSWORD: str | None = Field(default=None)
    EMAIL_USE_TLS: bool = Field(default=True)

    # Keycloak settings (for future integration)
    KEYCLOAK_URL: str | None = Field(
        default=None,
        description="Keycloak server URL for SSO integration"
    )
    KEYCLOAK_REALM: str | None = Field(
        default=None,
        description="Keycloak realm name"
    )
    KEYCLOAK_CLIENT_ID: str | None = Field(
        default=None,
        description="Keycloak client ID"
    )


@lru_cache
def get_settings() -> Settings:
    """Get cached application settings."""
    return Settings()


# Global settings instance
settings = get_settings()