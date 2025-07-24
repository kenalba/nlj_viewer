# NLJ Platform Backend

FastAPI backend for the NLJ (Non-Linear Journey) Platform with content creation and approval workflows.

## Tech Stack

- **FastAPI** - Modern async web framework
- **SQLAlchemy 2.0** - Database ORM with async support
- **PostgreSQL** - Primary database
- **Pydantic v2** - Data validation with modern typing
- **Alembic** - Database migrations
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

3. **Run database migrations:**
```bash
alembic upgrade head
```

4. **Start the development server:**
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

5. **Access the API:**
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