# NLJ Platform Backend

FastAPI backend for the NLJ (Non-Linear Journey) Platform with content creation, AI-powered content generation, and approval workflows.

## Features

- **Content Management**: Full CRUD operations for learning activities with role-based access control
- **AI Content Generation**: Integrated Claude API for document-based content creation
- **Source Document Management**: Upload, processing, and metadata extraction for PDFs, DOCX, and PPTX files
- **User Authentication**: JWT-based authentication with multi-tier role system
- **Real-time Generation**: Background task processing with progress tracking
- **Approval Workflows**: Multi-stage content review and approval system

## Tech Stack

- **FastAPI** - Modern async web framework with OpenAPI documentation
- **SQLAlchemy 2.0** - Database ORM with async support
- **PostgreSQL** - Primary database with advanced JSON support
- **Anthropic Claude API** - AI content generation and document processing
- **Pydantic v2** - Data validation with modern typing
- **Alembic** - Database migrations
- **uv** - Fast Python package management
- **Python 3.11+** - Modern Python with type hints

## Development Setup

### Prerequisites
- Python 3.11+
- uv (Python package manager)
- Docker & Docker Compose
- PostgreSQL (via Docker)

### Quick Start

1. **Install dependencies with uv:**
```bash
cd backend
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
uv pip install -e ".[dev]"
```

2. **Start PostgreSQL with Docker:**
```bash
docker-compose up -d db
```

3. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your configuration:
# DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/nlj_db
# SECRET_KEY=your-secret-key-here
# ANTHROPIC_API_KEY=your-claude-api-key-here
```

4. **Run database migrations:**
```bash
alembic upgrade head
```

5. **Start the development server:**
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

6. **Access the API:**
- API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs
- OpenAPI spec: http://localhost:8000/openapi.json

## Project Structure

```
backend/
├── app/
│   ├── api/           # API route handlers
│   ├── core/          # Core configuration and utilities
│   ├── models/        # SQLAlchemy database models
│   ├── schemas/       # Pydantic schemas for API
│   ├── services/      # Business logic layer
│   └── main.py        # FastAPI application entry point
├── alembic/           # Database migration files
├── tests/             # Test suite
├── docker-compose.yml # Development services
├── Dockerfile         # Container build file
└── pyproject.toml     # Project configuration
```

## Development Commands

```bash
# Install dependencies
uv pip install -e ".[dev]"

# Code formatting
black app/
isort app/

# Type checking
mypy app/

# Linting
ruff check app/

# Run tests
pytest

# Database migrations
alembic revision --autogenerate -m "Description"
alembic upgrade head
```

## API Documentation

The API documentation is automatically generated and available at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Key API Endpoints

#### Content Management
- `GET /api/content` - List activities with filtering and pagination
- `POST /api/content` - Create new learning activity
- `GET /api/content/{id}` - Get activity details
- `PUT /api/content/{id}` - Update activity
- `DELETE /api/content/{id}` - Delete activity

#### Source Documents & Content Studio
- `POST /api/sources/upload` - Upload source documents (PDF, DOCX, PPTX)
- `GET /api/sources` - List user's source documents with metadata
- `GET /api/sources/{id}` - Get source document details
- `POST /api/sources/{id}/generate-summary` - Generate AI metadata for document
- `DELETE /api/sources/{id}` - Delete source document

#### AI Content Generation
- `POST /api/generation/content-studio/generate` - Start integrated content generation
- `GET /api/generation/content-studio/sessions/{id}/status` - Get generation progress
- `POST /api/generation/sessions` - Create generation session
- `POST /api/generation/sessions/{id}/start` - Start generation process
- `POST /api/generation/sessions/{id}/create-activity` - Create activity from generated content

#### User Management
- `POST /api/auth/login` - User authentication
- `POST /api/auth/register` - User registration
- `GET /api/users/me` - Get current user profile
- `GET /api/users` - List users (admin only)