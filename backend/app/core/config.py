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
        case_sensitive=False,
        extra="ignore",  # Ignore extra environment variables
    )

    # Application settings
    APP_NAME: str = "NLJ Platform API"
    DEBUG: bool = Field(default=False, description="Enable debug mode")
    VERSION: str = "0.1.0"

    # Database settings
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://nlj_user:nlj_pass@localhost:5432/nlj_platform",
        description="Async PostgreSQL database URL",
    )

    # RDS Configuration (for LocalStack and AWS)
    RDS_ENDPOINT_URL: str | None = Field(
        default=None, description="RDS endpoint URL (set for LocalStack: http://localhost:4566)"
    )
    RDS_DB_INSTANCE_ID: str = Field(default="nlj-postgres-dev", description="Primary RDS instance identifier")
    RDS_REPLICA_INSTANCE_ID: str = Field(default="nlj-postgres-replica", description="Read replica instance identifier")
    USE_RDS: bool = Field(default=False, description="Use RDS instead of direct PostgreSQL connection")

    # Database initialization settings
    AUTO_SEED_DATABASE: bool = Field(
        default=False, description="Automatically seed database with essential users on startup if empty"
    )

    # Security settings
    SECRET_KEY: str = Field(
        default="your-secret-key-change-in-production", description="Secret key for JWT token generation"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    EMAIL_RESET_TOKEN_EXPIRE_HOURS: int = 24

    # CORS settings
    ALLOWED_HOSTS: list[str] = Field(
        default=["http://localhost:3000", "http://localhost:5173"], description="Allowed origins for CORS"
    )

    # Frontend URL for public sharing
    FRONTEND_URL: str | None = Field(
        default=None,
        description="Frontend URL for generating public share links. If not set, will be derived from request or default to localhost:5173",
    )

    # File upload settings
    MAX_FILE_SIZE: int = Field(
        default=500 * 1024 * 1024, description="Maximum file upload size in bytes"  # 500MB (Claude Files API limit)
    )
    UPLOAD_DIR: str = Field(default="uploads", description="Directory for file uploads")

    # Claude API settings
    CLAUDE_API_KEY: str = Field(default="", description="Anthropic Claude API key for content generation")

    # ElevenLabs API settings
    ELEVENLABS_API_KEY: str = Field(default="", description="ElevenLabs API key for text-to-speech generation")

    # Feature flags
    ENABLE_REGISTRATION: bool = Field(default=True, description="Allow new user registration")
    ENABLE_EMAIL_NOTIFICATIONS: bool = Field(default=False, description="Enable email notifications for workflows")

    # Calendar integration settings
    GOOGLE_CALENDAR_CLIENT_ID: str = Field(default="", description="Google Calendar OAuth client ID")
    GOOGLE_CALENDAR_CLIENT_SECRET: str = Field(default="", description="Google Calendar OAuth client secret")
    GOOGLE_CALENDAR_REDIRECT_URI: str = Field(
        default="http://localhost:8000/auth/google/callback", description="Google Calendar OAuth redirect URI"
    )

    # Microsoft Calendar integration settings
    MICROSOFT_CLIENT_ID: str = Field(default="", description="Microsoft Graph API client ID")
    MICROSOFT_CLIENT_SECRET: str = Field(default="", description="Microsoft Graph API client secret")
    MICROSOFT_REDIRECT_URI: str = Field(
        default="http://localhost:8000/auth/microsoft/callback", description="Microsoft OAuth redirect URI"
    )

    # AWS/LocalStack Configuration
    AWS_REGION: str = Field(default="us-east-1", description="AWS region")
    AWS_ACCESS_KEY_ID: str = Field(default="test", description="AWS access key (use 'test' for LocalStack)")
    AWS_SECRET_ACCESS_KEY: str = Field(default="test", description="AWS secret key (use 'test' for LocalStack)")

    # S3 Configuration
    S3_ENDPOINT_URL: str | None = Field(
        default=None, description="S3 endpoint URL (set for LocalStack: http://localhost:4566)"
    )
    S3_BUCKET_MEDIA: str = Field(default="nlj-media-prod", description="S3 bucket for media storage")
    S3_BUCKET_BACKUPS: str = Field(default="nlj-backups-prod", description="S3 bucket for backups")
    S3_PUBLIC_URL_BASE: str | None = Field(default=None, description="Base URL for public S3 access")

    # SES Configuration
    SES_ENDPOINT_URL: str | None = Field(
        default=None, description="SES endpoint URL (set for LocalStack: http://localhost:4566)"
    )
    SES_FROM_EMAIL: str = Field(default="noreply@nlj-platform.com", description="Default from email address")
    SES_ADMIN_EMAIL: str = Field(default="admin@nlj-platform.com", description="Admin email address")
    SES_CONFIGURATION_SET: str = Field(default="nlj-email-tracking", description="SES configuration set for tracking")

    # Email settings (legacy SMTP - keeping for backward compatibility)
    EMAIL_HOST: str | None = Field(default=None)
    EMAIL_PORT: int = Field(default=587)
    EMAIL_USER: str | None = Field(default=None)
    EMAIL_PASSWORD: str | None = Field(default=None)
    EMAIL_USE_TLS: bool = Field(default=True)

    # Kafka settings
    KAFKA_BOOTSTRAP_SERVERS: str = Field(
        default="localhost:9092", description="Kafka bootstrap servers for event streaming"
    )
    KAFKA_CLIENT_ID: str = Field(default="nlj-platform", description="Kafka client ID for this application")
    KAFKA_ENABLE_AUTO_COMMIT: bool = Field(default=True, description="Enable auto commit for Kafka consumers")
    KAFKA_AUTO_COMMIT_INTERVAL_MS: int = Field(default=1000, description="Auto commit interval in milliseconds")

    # Cal.com integration settings removed - migrating to our own system

    # Ralph LRS settings
    RALPH_LRS_URL: str = Field(default="http://ralph-lrs:8100", description="Ralph LRS endpoint URL for xAPI storage")
    RALPH_LRS_USERNAME: str = Field(default="nlj-platform", description="Ralph LRS authentication username")
    RALPH_LRS_SECRET: str = Field(default="nlj-secure-secret-2024", description="Ralph LRS authentication password")

    # Elasticsearch settings
    ELASTICSEARCH_URL: str = Field(
        default="http://elasticsearch:9200", description="Elasticsearch cluster URL for analytics"
    )
    ELASTICSEARCH_INDEX: str = Field(
        default="nlj-xapi-statements", description="Elasticsearch index name for xAPI statements"
    )

    # Keycloak settings (for future integration)
    KEYCLOAK_URL: str | None = Field(default=None, description="Keycloak server URL for SSO integration")
    KEYCLOAK_REALM: str | None = Field(default=None, description="Keycloak realm name")
    KEYCLOAK_CLIENT_ID: str | None = Field(default=None, description="Keycloak client ID")


@lru_cache
def get_settings() -> Settings:
    """Get cached application settings."""
    return Settings()


# Global settings instance
settings = get_settings()
