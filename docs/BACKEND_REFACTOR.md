# NLJ Platform Backend Refactoring Plan

## 🎯 Objective

Refactor the current NLJ Platform backend to comply with Clean Architecture principles as defined in CLAUDE.md. This includes implementing proper layer separation, dependency inversion, and the Repository/Use Case patterns.

## 🚨 Current Architectural Violations

### **1. Missing Repository Pattern**
- **Current Issue**: Services directly use SQLAlchemy queries instead of repository abstraction
- **Violation**: `ContentService` contains raw SQL queries and database operations
- **Impact**: Tight coupling between business logic and data access
- **Example**: `ContentService.get_content_list()` contains complex SQLAlchemy queries

### **2. Controllers Directly Import Models**
- **Current Issue**: API controllers import ORM models (`from app.models.user import User`)
- **Violation**: Controllers should only work with schemas, not ORM models
- **Found In**: `content.py`, `auth.py`, `analytics.py`, `generation.py`
- **Example**: `content.py:14` imports `ContentState, ContentType, LearningStyle`

### **3. Controllers Use SQLAlchemy Directly**
- **Current Issue**: API routes inject `AsyncSession` and handle database operations
- **Violation**: Controllers should delegate to Use Cases/Services only
- **Found In**: All API endpoints use `db: AsyncSession = Depends(get_db)`
- **Example**: Controllers directly instantiate services with `AsyncSession`

### **4. Missing Use Case Layer**
- **Current Issue**: Business logic mixed into Services without clear Use Case orchestration
- **Violation**: No separation between orchestration (Use Cases) and domain services
- **Impact**: Services handle both business workflows AND data access
- **Example**: `ContentService` handles CRUD, permissions, AND workflow logic

### **5. Incorrect Permission Handling**
- **Current Issue**: Role checking done in controllers with hardcoded arrays
- **Violation**: Business rules embedded in presentation layer
- **Example**: `if current_user.role not in [UserRole.CREATOR, UserRole.REVIEWER...]`
- **Should Be**: Delegated to domain services or use cases

### **6. Schema Boundary Violations**
- **Current Issue**: No clear separation between API schemas and service schemas
- **Violation**: Services accept controller schemas directly
- **Impact**: Tight coupling between API contracts and business logic
- **Example**: `ContentService.create_content(content_data: ContentCreate, ...)`

## 📋 Refactoring Plan

### **Phase 1: Foundation Layer (High Priority)**

#### **1.1 Create Repository Layer** 
**Directory Structure:**
```
app/services/orm_repositories/
├── __init__.py
├── base_repository.py        # Abstract base repository with common CRUD
├── content_repository.py     # ContentItem complex queries
├── user_repository.py        # User queries and filters
├── media_repository.py       # Media asset queries
├── node_repository.py        # Node-related queries
├── training_repository.py    # Training program/session queries
└── analytics_repository.py   # Analytics and reporting queries
```

**Key Components:**
- **BaseRepository**: Abstract class with common CRUD operations
- **Specific Repositories**: Complex queries isolated from business logic
- **Query Objects**: For complex filtering and search operations

**Effort**: 3-5 days  
**Dependencies**: None  
**Testing**: Unit tests for each repository with in-memory database

#### **1.2 Create ORM Services Layer**
**Directory Structure:**
```
app/services/orm_services/
├── __init__.py
├── base_orm_service.py       # Base class with transaction management
├── content_orm_service.py    # Content CRUD + transactions
├── user_orm_service.py       # User CRUD + transactions  
├── media_orm_service.py      # Media CRUD + transactions
├── node_orm_service.py       # Node CRUD + transactions
├── training_orm_service.py   # Training CRUD + transactions
└── analytics_orm_service.py  # Analytics CRUD + transactions
```

**Key Responsibilities:**
- **Transaction Management**: Commit/rollback boundaries
- **CRUD Operations**: Using repositories for data access
- **Data Validation**: ORM-level validation before persistence
- **Relationship Management**: Handle complex entity relationships

**Effort**: 2-3 days  
**Dependencies**: 1.1 (Repositories)  
**Testing**: Integration tests with database transactions

#### **1.3 Create Service-Level Schemas**
**Directory Structure:**
```
app/models/schemas/services/
├── __init__.py
├── content_schemas.py        # Service-level content DTOs
├── user_schemas.py          # Service-level user DTOs
├── media_schemas.py         # Service-level media DTOs
├── node_schemas.py          # Service-level node DTOs
├── training_schemas.py      # Service-level training DTOs
└── analytics_schemas.py     # Service-level analytics DTOs
```

**Key Principles:**
- **Separation**: Different from API schemas in `app/schemas/`
- **Rich Types**: Use PositiveInt, StringConstraints, Literals
- **Validation**: Business-level validation rules
- **Conversion**: Methods to convert to/from API schemas

**Effort**: 2-3 days  
**Dependencies**: None  
**Testing**: Schema validation tests with edge cases

### **Phase 2: Business Logic Layer (Medium Priority)**

#### **2.1 Create Use Case Layer**
**Directory Structure:**
```
app/services/use_cases/
├── __init__.py
├── content_management/
│   ├── __init__.py
│   ├── create_content_use_case.py      # Content creation workflow
│   ├── update_content_use_case.py      # Content modification workflow
│   ├── publish_content_use_case.py     # Publishing workflow
│   ├── delete_content_use_case.py      # Deletion workflow
│   └── share_content_use_case.py       # Public sharing workflow
├── user_management/
│   ├── __init__.py
│   ├── register_user_use_case.py       # User registration workflow
│   ├── authenticate_user_use_case.py   # Authentication workflow
│   ├── update_profile_use_case.py      # Profile management workflow
│   └── manage_permissions_use_case.py  # Permission management workflow
├── training_management/
│   ├── __init__.py
│   ├── create_program_use_case.py      # Training program creation
│   ├── schedule_session_use_case.py    # Session scheduling workflow
│   ├── register_session_use_case.py    # Session registration workflow
│   └── manage_bookings_use_case.py     # Booking management workflow
├── analytics_management/
│   ├── __init__.py
│   ├── generate_analytics_use_case.py  # Analytics generation workflow
│   └── export_data_use_case.py         # Data export workflow
└── ai_processing/
    ├── __init__.py
    ├── generate_content_use_case.py     # AI content generation workflow
    ├── extract_knowledge_use_case.py    # Knowledge extraction workflow
    └── auto_tag_content_use_case.py     # Auto-tagging workflow
```

**Key Responsibilities:**
- **Workflow Orchestration**: Coordinate multiple domain services and ORM services
- **Business Rule Enforcement**: Apply complex business rules
- **Event Publishing**: Emit domain events for cross-cutting concerns
- **Error Handling**: Business-level error handling and recovery

**Effort**: 4-6 days  
**Dependencies**: 1.1, 1.2, 1.3  
**Testing**: Use case tests with mocked dependencies

#### **2.2 Extract Domain Services**
**Directory Structure:**
```
app/services/domain_services/
├── __init__.py
├── permission_service.py              # Centralized permissions logic
├── content_validation_service.py      # Business validation rules
├── workflow_service.py                # State transition logic
├── analytics_calculation_service.py   # Business analytics calculations
├── content_recommendation_service.py  # Recommendation algorithms
├── notification_service.py            # Business notification rules
└── pricing_service.py                 # Business pricing logic (if applicable)
```

**Key Principles:**
- **Pure Business Logic**: No I/O dependencies
- **Stateless**: All inputs provided as parameters
- **Single Responsibility**: Each service handles one business domain
- **Testable**: Easy to unit test without external dependencies

**Effort**: 3-4 days  
**Dependencies**: 2.1  
**Testing**: Pure unit tests with no external dependencies

### **Phase 3: Controller Refactoring (Medium Priority)**

#### **3.1 Refactor API Controllers**

**Changes Required:**
1. **Remove Model Imports**: No more `from app.models.user import User`
2. **Remove SQLAlchemy Dependencies**: No more `db: AsyncSession = Depends(get_db)`
3. **Use Case Dependencies**: Inject use cases instead of services
4. **Schema Conversion**: Convert API schemas to service schemas at boundaries
5. **Remove Business Logic**: Delegate all business decisions to use cases

**Example Refactoring:**

**Before:**
```python
@router.post("/", response_model=ContentResponse)
async def create_content(
    content_data: ContentCreate, 
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
) -> ContentResponse:
    # Permission check in controller (violation)
    if current_user.role not in [UserRole.CREATOR, UserRole.REVIEWER]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    service = ContentService(db)  # Direct service instantiation
    content = await service.create_content(content_data, current_user.id)
    return ContentResponse.from_orm(content)
```

**After:**
```python
@router.post("/", response_model=ContentResponse)
async def create_content(
    content_data: ContentCreate,
    create_content_use_case: CreateContentUseCase = Depends(get_create_content_use_case)
) -> ContentResponse:
    # Convert API schema to service schema
    service_data = ContentServiceSchema.from_api_schema(content_data)
    
    # Delegate to use case (handles permissions internally)
    result = await create_content_use_case.execute(service_data)
    
    # Convert service result to API response
    return ContentResponse.from_service_schema(result)
```

**Effort**: 5-7 days  
**Dependencies**: 2.1, 2.2  
**Testing**: API integration tests with use case mocks

#### **3.2 Create Dependency Injection Container**
**Directory Structure:**
```
app/core/
├── bootstrap.py              # DI container setup and configuration
├── dependencies.py           # FastAPI dependency factories
└── interfaces.py             # Interface definitions for dependency injection
```

**Key Components:**
- **Bootstrap**: Configure all dependency relationships
- **Dependency Factories**: FastAPI-compatible dependency providers
- **Interface Definitions**: Abstract base classes for dependency inversion

**Effort**: 2-3 days  
**Dependencies**: 2.1  
**Testing**: DI container tests ensuring proper wiring

### **Phase 4: Infrastructure Updates (Lower Priority)**

#### **4.1 Update Handlers for Clean Architecture**

**Changes Required:**
- Refactor event handlers in `app/handlers/` to use Use Cases instead of Services
- Remove direct database access from handlers
- Ensure handlers are thin and delegate to business logic

**Effort**: 2-3 days  
**Dependencies**: 2.1  

#### **4.2 Testing Infrastructure**

**New Testing Structure:**
```
backend/tests/
├── unit/
│   ├── repositories/         # Repository unit tests
│   ├── orm_services/         # ORM service unit tests
│   ├── domain_services/      # Domain service unit tests
│   └── use_cases/           # Use case unit tests
├── integration/
│   ├── api/                 # API integration tests
│   ├── database/            # Database integration tests
│   └── events/              # Event handler integration tests
└── fixtures/
    ├── database_fixtures.py  # Test database setup
    ├── mock_fixtures.py      # Mock object factories
    └── test_data.py          # Test data generators
```

**Testing Strategy:**
- **Unit Tests**: Fast, isolated tests for each layer
- **Integration Tests**: Test layer interactions
- **API Tests**: End-to-end API testing
- **Database Tests**: Test with real database (containerized)

**Effort**: 3-4 days  
**Dependencies**: All previous phases  

## 🎯 Implementation Strategy

### **Incremental Refactoring Approach**

1. **Service-by-Service**: Refactor one service area at a time
   - Start with **Content Management** (most complex)
   - Then **User Management** (foundational)
   - Then **Training Management**
   - Finally **Analytics & AI Processing**

2. **Maintain Backward Compatibility**: 
   - Keep old services running during transition
   - Use feature flags if needed
   - Gradual migration of endpoints

3. **Test-Driven Refactoring**:
   - Write tests for current behavior first
   - Refactor to new architecture
   - Ensure tests still pass
   - Add new tests for new architecture

4. **Documentation Updates**:
   - Update API documentation
   - Create architectural decision records (ADRs)
   - Update developer onboarding guides

### **Testing-First Implementation**

Since no tests currently exist, we'll implement a **testing-first approach**:

1. **Characterization Tests**: Write tests for existing behavior
2. **Refactor with Tests**: Use tests to ensure refactoring doesn't break functionality  
3. **New Architecture Tests**: Write comprehensive tests for new architecture
4. **Regression Suite**: Build comprehensive regression test suite

### **Quality Gates**

Each phase must pass these quality gates:

1. **Code Quality**: `uv run ruff check .` passes
2. **Type Safety**: `uv run mypy` passes with no errors
3. **Test Coverage**: Minimum 80% test coverage for new code
4. **Performance**: No performance regressions
5. **Documentation**: All new components documented

## 📊 Effort Summary

| Phase | Component | Effort | Priority | Dependencies | Testing |
|-------|-----------|---------|----------|--------------|---------|
| 1.1 | Repository Layer | 3-5 days | **High** | None | Unit Tests |
| 1.2 | ORM Services | 2-3 days | **High** | 1.1 | Integration Tests |
| 1.3 | Service Schemas | 2-3 days | **High** | None | Schema Tests |
| 2.1 | Use Cases | 4-6 days | **Medium** | Phase 1 | Use Case Tests |
| 2.2 | Domain Services | 3-4 days | **Medium** | 2.1 | Unit Tests |
| 3.1 | Controller Refactor | 5-7 days | **Medium** | Phase 2 | API Tests |
| 3.2 | Dependency Injection | 2-3 days | **Medium** | 2.1 | DI Tests |
| 4.1 | Handler Updates | 2-3 days | **Low** | Phase 2 | Handler Tests |
| 4.2 | Test Infrastructure | 3-4 days | **Ongoing** | Each phase | Meta Tests |

**Total Estimated Effort**: 26-38 days

## 🚀 Next Steps

1. **Approve Plan**: Review and approve this refactoring plan
2. **Setup Testing Infrastructure**: Create test framework and fixtures
3. **Start Phase 1.1**: Implement Repository Layer for Content domain
4. **Continuous Integration**: Ensure CI/CD works with new architecture
5. **Monitor Progress**: Track progress against this plan and adjust as needed

## 📚 Success Criteria

The refactoring will be considered successful when:

1. **Clean Architecture Compliance**: All violations in CLAUDE.md resolved
2. **Test Coverage**: >80% coverage for all new code  
3. **Performance**: No performance regressions
4. **Code Quality**: All quality gates passing
5. **Team Productivity**: Developers can work faster with new architecture
6. **Maintainability**: Code is easier to understand and modify

---

*This refactoring plan transforms the NLJ Platform backend from a service-oriented architecture to proper Clean Architecture with strict layer separation, dependency inversion, and comprehensive testing.*