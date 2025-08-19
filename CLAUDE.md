# NLJ Platform - Developer Instructions

A full-stack TypeScript application for creating, managing, and delivering interactive Non-Linear Journey (NLJ) training scenarios, surveys, assessments, and games with comprehensive analytics and role-based access control.

## Key Business Value
The platform transforms educational content creation into streamlined workflows, enabling organizations to create engaging interactive training, surveys, and assessments through AI-powered content generation and visual flow editing.

## Target Users  
- Training coordinators and instructional designers
- Content creators and subject matter experts
- Learners and trainees accessing interactive content
- Administrators managing training programs and analytics

# Workflow Guidelines
- Before code writing always find interfaces (parent ABC-classes) of all objects you would like to interact with to understand their protocol and use it correctly
- Before running code check existing code hierarchy and architecture - this codebase follows Clean Architecture principles, which set strict rules regarding classes isolation, file hierarchy and inheritances
- When you write code for backend execute all commands in `backend/` folder or use `docker compose --file docker-compose.local.yml` command in `/` folder if you need to run a command in docker containers
- Be sure to typecheck with `mypy` when you're done making a series of code changes
- Always check your code with `ruff check .`
- Prefer running single tests, and not the whole test suite, for performance
- Optimize for readability over cleverness

# Key Architectural Patterns
- **Clean Architecture**: Separation of concerns with dependency inversion
- **Repository Pattern**: Data access abstraction via ORM repositories - To interact with any method in OrmRepository we must use related OrmService
- **Use Case Pattern**: Business logic encapsulation in use cases (managers) and they use other more narrow services (ORM and Domain Services)
- **Dependency Injection**: We use Dependency Injection Container (Bootstrap) for service configuration and then we use FastAPI's dependencies to initialize services (use cases, orm services and etc)
- **Domain-Driven Design**: Rich domain models with business logic when it is possible
- **Event-Driven Architecture**: Background jobs and async workflows are handled with Kafka/FastStream

# Technology Stack

- **Language**: Python 3.11+ (Backend), TypeScript (Frontend)
- **Web Framework**: FastAPI with async/await support
- **Frontend**: React 19 + Vite + Material-UI + TypeScript
- **Database**: PostgreSQL with SQLAlchemy ORM 2.0 and Alembic migrations
- **Package Manager**: uv (Python), npm (Node.js)
- **Architecture**: Clean Architecture with dependency injection
- **Authentication**: JWT-based authentication with role-based access control
- **AI/ML**: Anthropic Claude for content generation and document processing
- **Storage**: AWS S3 (LocalStack for local development)
- **Event System**: Apache Kafka with FastStream for event-driven architecture
- **Testing**: pytest (Backend), Vitest + React Testing Library (Frontend)
- **Deployment**: Docker + Docker Compose with nginx

## Backend Development Guidelines

### Clean Architecture Principles (!)
- **MANDATORY**: Follow clean architecture with strict layer separation
- **MANDATORY**: You cannot use elements from a higher-level module in a lower-level module (e.g., never pass controller Pydantic models into services; convert to service-level schemas first)

#### Layers and directories
- **Controllers** (`app/api`) — API routes, queue handlers; request/response schemas live in `app/schemas` and are not reused elsewhere
- **Infrastructure** (`app/core`) — concrete adapters for external systems: DB session factory, file storage, LLMs, message broker, auth
- **Services** (`app/services`)
  - **Use Cases** (`services/*_service.py`) — orchestration of workflows; call domain services and ORM services (e.g., content generation pipeline)
  - **Domain Services** (`services/`) — business logic not tied to ORM or I/O (pure logic where possible)
- **Models** (`app/models`) — SQLAlchemy ORM models
- **Schemas** (`app/schemas`) — Pydantic schemas for API and service-level data validation
- **Core** (`app/core`) — configuration, database management, security, dependencies
- **Utils** (`app/utils`) — cross-cutting utilities like permissions and xAPI builders

#### Allowed dependencies (directional)
- `core` → used by everyone; depends on nothing within app except config
- `schemas` → may depend on `core`; used for data validation at API and service boundaries
- `models` → may depend on `core`; SQLAlchemy ORM models only
- `services` — may depend on `models`, `schemas`, and `core`; never import API controllers
- `utils` → may depend on `models`, `schemas`, and `core`
- `api` → may depend on `services`, `schemas`, `core`, and `utils`; never call models directly

#### Schema and DTO boundaries
- API request/response models are in `app/schemas` and used at controller layer
- Service methods should accept and return Pydantic schemas, not raw ORM models
- Convert at the boundary before calling services

#### Transactions and side effects
- Services own DB sessions and transactions
- Use dependency injection for database sessions via FastAPI Depends
- Side effects external to DB (S3, emails, Kafka) should be executed via service methods

### Code Quality Standards
- **General**: Write pythonic code with meaningful variable names and list/dict comprehensions where appropriate
- **Attributes access**: Avoid using `hasattr` and `getattr` functions, use instances attributes directly
- **Type Annotations**:
    - Always specify explicit type annotations for function parameters and return values
    - Check the code with `mypy` and fix all issues
    - If you know the type of something from external library and are confident, use `typing.cast`
    - If the type issue cannot be fixed use `# type: ignore` to suppress the error
- **Line Length**: Adhere to 120 characters maximum
- **Function Length**: Break down complex logic into functions of no more than 50 lines
- **Data Structures**: Prefer Pydantic Models for external data (API, LLM). Use standard dataclasses for business logic-related data
- **Validation**: Add all required custom validations to Pydantic models
- **Rich Types**: Use PositiveInt, StringConstraints, Literals, etc when possible, and use modern (3.9+) Python typing.
- **Docstrings**: Never use docstrings for any functions and classes
- **Comments**: Add comments only where required to explain tricky parts or support better function structuring
- **Inheritance**: Prefer composition over inheritance when designing class relationships
- **Single Responsibility**: Keep functions focused on a single responsibility
- **Global Vars**: Avoid global variables

### Dependency management
- **Package Manager**: Use `uv` package manager for all dependency management
- **Python commands**: Never use `python` command - always use `uv run python` instead and ensure that cwd is `backend`

### Database & ORM Guidelines
- **Migrations**: Use Alembic, never create multiple migration files per PR, instead collect all required changes in one file
- **Relationships**: Always prefer "back_populates" over "back_ref" with explicit "uselist"
- **Business Logic**: Never include database operations in controllers (endpoints), always use Services
- **Autogeneration**: Prefer autogenerate with careful review: keep migration files readable and minimal

### Logging & Error Handling
- **Logging**: Use Python's built-in logging, structured where possible
- **Log Format**: Use clear, informative messages with context
- **Debug Logs**: Avoid adding debug log messages
- **Exceptions**: NEVER use try/except unless 100% necessary for business logic
- **Error Philosophy**: Raising exceptions when something goes wrong is acceptable, but only when required (`Ask forgiveness not permission` approach is okay)

### Development Environment
- **Container-Based**: All development happens in Docker containers
- **Services**: All external services (DB, S3, Kafka, etc.) run in containers
- **Commands**: Use `uv run` for all Python commands within backend directory

## Frontend Development Guidelines

### Architecture Principles
- **Component Architecture**: Functional components with hooks for state management
- **State Management**: React Context + useReducer pattern for complex state, useState for simple local state
- **Type Safety**: Strict TypeScript with explicit type definitions
- **Accessibility**: Full keyboard navigation and ARIA support for all interactive elements
- **Responsive Design**: Mobile-first approach with Material-UI breakpoints

### Code Standards
- **TypeScript**: Strict mode enabled, explicit types required
- **Line Length**: 120 characters maximum
- **Components**: Prefer function components with hooks over class components
- **Props**: Define explicit interfaces for all component props
- **State**: Use TypeScript discriminated unions for complex state
- **Event Handling**: Proper event typing and preventDefault usage
- **Error Boundaries**: Implement error boundaries for robust error handling

### Testing Guidelines
- **Testing Library**: Vitest + React Testing Library
- **Coverage**: Maintain high test coverage for critical paths
- **Test Structure**: Arrange-Act-Assert pattern
- **Mocking**: Mock external API calls and services
- **Accessibility**: Include accessibility tests with screen reader simulation

# File Naming Conventions

## Backend
- **Classes**: PascalCase (e.g., `ContentService`, `UserModel`), including abbreviations: "Api" not "API", "Llm" not "LLM"
- **Variables**: snake_case for variables and function names
- **Files**: snake_case (e.g., `content_service.py`, `user_model.py`)
- **Modules**: snake_case directories
- **Constants**: UPPER_SNAKE_CASE

## Frontend
- **Components**: PascalCase (e.g., `GameView.tsx`, `NodeRenderer.tsx`)
- **Files**: PascalCase for components, camelCase for utilities
- **Hooks**: camelCase starting with "use" (e.g., `useGameEngine.ts`)
- **Types**: PascalCase interfaces (e.g., `NLJScenario`, `NodeType`)
- **Constants**: UPPER_SNAKE_CASE

## Database Organization
- **Migrations**: Timestamped Alembic files in `backend/alembic/versions/`
- **Models**: One model per file in `backend/app/models/`
- **Relationships**: Use `back_populates` over `back_ref` with explicit `uselist`

## Testing Structure
- **Backend**: Mirror app structure in `backend/tests/`
- **Frontend**: `__tests__` directories alongside source files
- **Integration**: Separate integration tests from unit tests

## Configuration Management
- **Environment**: `.env` files for different environments
- **Settings**: Centralized configuration via Pydantic settings
- **Secrets**: Separate `.env.secrets` files (never committed)

## Commands

### Backend Commands
- **Install**: `uv sync`
- **Run API (dev)**: `uv run fastapi dev app/main.py`
- **Lint**: `uv run ruff check .`
- **Format**: `uv run ruff format`
- **Type check**: `uv run mypy`
- **Tests (all)**: `uv run pytest -q`
- **Tests (single file)**: `uv run pytest -q tests/path/to/test_file.py`
- **Alembic upgrade**: `uv run alembic upgrade head`
- **Alembic autogenerate**: `uv run alembic revision --autogenerate -m "your message"`

### Frontend Commands
- **Install**: `npm install`
- **Run dev server**: `npm run dev`
- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Tests**: `npm run test -- --run` (always use --run flag)
- **Type check**: `tsc --noEmit`

### Docker Commands
- **Show containers**: `docker compose --file docker-compose.yml ps -a`
- **Development stack**: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up`
- **Production**: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`

## Event-Driven Architecture
- **Library**: Apache Kafka with FastStream
- **Handlers**: `app/handlers/` for event processing
- **Events**: `app/services/events/` for event definitions
- **Usage**: Keep handlers thin; delegate to use cases/services

# Git Instructions
- Use conventional commit format: `feat:`, `fix:`, `docs:`, `refactor:`, etc.
- Use line length with 72 characters for all git messages
- This project uses pre-commit hooks - check if git commit was successful
- If git commit fails due to pre-commit errors:
    - If there are any mypy issues then ask me to fix them
    - For other errors, make required changes yourself
- Before committing check for unstaged files - they can break pre-commit hooks
- Prefer imperative mood and scoped, minimal commits
- Keep PRs small and focused with clear descriptions

# Important Instructions
Do what has been asked; nothing more, nothing less.
NEVER do a workaround rather than actually solving a problem.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.