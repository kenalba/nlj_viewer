# NLJ Platform - Unified Learning Platform

A full-stack TypeScript application for creating, managing, and delivering interactive Non-Linear Journey (NLJ) training scenarios, surveys, assessments, and games with comprehensive analytics and role-based access control.

## 🚀 Quick Start

### Prerequisites
1. **Docker & Docker Compose**: Install Docker Desktop or Docker Engine with Compose V2
2. **LocalStack Pro API Key**: Required for RDS/S3/SES services
   - Sign up at https://localstack.cloud and get your API key
   - Add to `.env`: `LOCALSTACK_API_KEY=your_api_key_here`

### Development Environment

#### Step 1: Environment Configuration
```bash
# Create .env with required configuration
cp .env.example .env

# Edit .env and ensure these settings:
# LOCALSTACK_API_KEY=your_localstack_pro_api_key
# USE_RDS=true
# CLAUDE_API_KEY=your_claude_api_key
# (other settings as needed)
```

#### Step 2: Start Full Development Stack
```bash
# Start all services including LocalStack RDS, analytics, and frontend hot reload
docker compose --profile analytics \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  -f docker-compose.localstack.yml \
  -f docker-compose.rds.yml \
  --env-file .env \
  up -d

# This starts:
# - LocalStack Pro (RDS PostgreSQL, S3, SES)
# - NLJ API with RDS connection
# - Frontend with hot reload (port 5173)
# - RedPanda (Kafka replacement) with Console UI
# - Elasticsearch for analytics
# - FastStream consumer for event processing
```

#### Step 3: Access the Platform
- **NLJ Frontend**: http://localhost:5173 (with hot reload)
- **NLJ API**: http://localhost:8000/docs
- **LocalStack Health**: http://localhost:4566/_localstack/health
- **Elasticsearch**: http://localhost:9200
- **RedPanda Console**: http://localhost:8080 (Kafka/event streaming management)

#### Step 4: Populate with Sample Data
```bash
# Generate sample activities, surveys, training events, and xAPI data
docker compose exec nlj-api uv run python scripts/generate_fake_analytics_data.py
```

### Production Deployment
```bash
# Production system with built frontend
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Visit these URLs:
# - NLJ Platform: http://localhost:8081 (nginx-served frontend)
# - NLJ API: http://localhost:8000/docs
```

### Simplified Development (Without LocalStack)
```bash
# Basic development with PostgreSQL and RedPanda
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Access points:
# - Frontend (hot reload): http://localhost:5173
# - Backend API: http://localhost:8000/docs
# - RedPanda Console: http://localhost:8080
```

**🌐 Live Production Site**: https://callcoach.training  
**📖 API Documentation**: https://callcoach.training/api/docs

## 📋 Platform Overview

The NLJ Platform transforms educational content creation through AI-powered tools, visual flow editing, and comprehensive analytics. Built with modern event-driven architecture, it enables organizations to create engaging interactive training with intelligent optimization.

### **🎯 Core Learning Experience**
- **18+ Question Types**: True/False, Multiple Choice, Ordering, Matching, Short Answer, Likert Scales, Rating Questions, Matrix Questions, Sliders, Text Areas
- **Interactive Games**: Connections word puzzles (NYT-style) and Wordle games with comprehensive dictionary validation
- **Visual Flow Editor**: React Flow-based WYSIWYG editor with drag-and-drop node creation and real-time preview
- **Smart Interactions**: Drag-and-drop ordering, visual connection lines, keyboard navigation with accessibility support
- **Audio Feedback System**: User-controlled oscillator-based audio with completion sounds and interaction feedback

### **🤖 AI-Powered Intelligence (Phase 2.4 Complete)**
- **Smart Recommendations Engine**: ML-powered content suggestions based on learning objectives, keywords, and performance metrics
- **Knowledge Extraction Service**: LLM-powered metadata extraction from content with normalization and taxonomy management
- **Auto-Tagging System**: Event-driven automated tagging with quality assurance workflows and manual override capabilities
- **Content Studio Integration**: Claude API integration for document processing, content generation, and AI-assisted creation workflows
- **Performance-Aware Suggestions**: Content recommendations based on success rates, completion times, and user engagement patterns

### **📊 Comprehensive Analytics Dashboard**
- **5-Tab Analytics System**: Overview, People Analytics, Content & Performance, Compliance, and Audit Trail
- **ML-Powered Insights**: Top performer analysis with behavioral characteristics and learning pattern detection
- **Real-Time Monitoring**: Live activity tracking with xAPI integration and comprehensive event streaming
- **Performance Analytics**: Content effectiveness tracking, engagement metrics, and optimization recommendations
- **Compliance Tracking**: Risk assessment dashboard with user-specific compliance monitoring and gap analysis

### **🎛️ Content Creation & Management**
- **Flow Editor**: Visual scenario builder with database persistence, auto-layout algorithms, and JSON export
- **Template System**: Pre-built activity templates (Survey, Assessment, Training, Interactive Game) with smart initialization
- **Multi-Format Import**: Trivie Excel support, NLJ JSON files, and document processing (PDF, DOCX, PPTV)
- **Version Control**: Content versioning with publication workflow and approval system integration
- **Public Sharing**: Secure token-based sharing with QR codes, analytics tracking, and mobile-optimized player interface

## 🏗️ Architecture & Technology

### **Backend Infrastructure**
- **FastAPI + Python 3.11+**: High-performance async API with comprehensive endpoint coverage
- **PostgreSQL**: Robust data persistence with SQLAlchemy 2.0 ORM and Alembic migrations
- **Event-Driven Architecture**: Apache Kafka with FastStream for real-time processing and system integration
- **JWT Authentication**: Secure authentication with role-based access control and centralized permissions
- **AI Integration**: Anthropic Claude API for content generation and Elasticsearch for analytics
- **Docker Deployment**: Production-ready containerization with nginx reverse proxy

### **Frontend Architecture**  
- **React 19 + TypeScript**: Modern component architecture with strict type safety
- **Material-UI**: Responsive design system with dark/light theme support and accessibility features
- **Vite Build System**: Fast development and optimized production builds
- **React Flow**: Visual flow editing with drag-and-drop, auto-layout, and real-time updates
- **Comprehensive Routing**: Deep linking support with content-aware URLs (`/app/play/[id]`)
- **State Management**: React Context + useReducer pattern with TypeScript discriminated unions

### **Event & Analytics System**
- **Apache Kafka**: Real-time event streaming with KRaft mode configuration
- **FastStream Migration**: Modern event processing replacing legacy systems with type-safe handlers
- **Elasticsearch**: Analytics data storage with optimized queries and performance monitoring
- **xAPI Integration**: Learning analytics with comprehensive statement generation and validation
- **Background Processing**: Async workflows for content generation, recommendations, and analytics

## 📚 Key Features by Area

### **🎓 Learning Activities & Games**
- **Question Node Types**: Complete coverage of educational assessment formats
- **Drag-and-Drop Interactions**: Ordering, matching, and visual connection interfaces
- **Word Games**: NYT-style Connections and Wordle games with comprehensive dictionary validation
- **Keyboard Navigation**: Full accessibility support with arrow keys, Enter, and number key shortcuts
- **Progress Tracking**: Visual indicators, completion tracking, and immediate feedback systems
- **xAPI Event Tracking**: Comprehensive learning analytics with statement generation and validation

### **🧠 AI-Powered Intelligence**
- **Content Recommendation Engine**: Hybrid PostgreSQL + Elasticsearch approach for intelligent suggestions
- **Knowledge Extraction Pipeline**: LLM-powered metadata extraction with confidence scoring and normalization
- **Auto-Tagging Service**: Event-driven tagging with quality assurance and manual override workflows  
- **Performance Analytics**: Node-level success rates, completion times, and user engagement tracking
- **Smart Node Palette**: Performance-aware node suggestions in Flow Editor with reusability recommendations

### **📈 Analytics & Reporting**
- **Overview Dashboard**: Platform metrics with daily activity timeline and engagement statistics
- **People Analytics**: ML-powered top performer analysis with behavioral insights and learning patterns
- **Content Performance**: Activity trends, completion rates, and comprehensive engagement metrics
- **Compliance Dashboard**: Risk assessment with user-specific tracking and gap analysis
- **Audit Trail**: xAPI statement browser with search, filtering, pagination, and JSON export

### **🎨 Content Creation Tools**
- **Visual Flow Editor**: Database-integrated editor with save/load, auto-layout, and real-time preview
- **Template-Based Creation**: Pre-built templates for different activity types with smart initialization
- **AI Content Studio**: Claude API integration for document upload, processing, and content generation
- **Import Capabilities**: Trivie Excel conversion, NLJ JSON support, and multi-format document processing
- **Approval Workflows**: Multi-stage review process with role-based permissions and workflow tracking

### **🌐 Sharing & Distribution**
- **Public Activity Sharing**: Secure token-based sharing with optional expiration dates
- **QR Code Generation**: Mobile-friendly access with automatic QR code creation
- **Unauthenticated Player**: Clean, branded interface for shared activities without login requirements
- **Share Analytics**: Real-time tracking of public views, completions, and engagement metrics
- **Cross-Platform Access**: Responsive design optimized for desktop and mobile devices

## 🔧 Development & Build Process

### Understanding the Project Structure

The project uses a **monorepo structure** with separate frontend and backend builds:

```
nlj_platform/                  # Root directory
├── package.json               # Root orchestration scripts
├── frontend/                  # React + Vite application
│   ├── package.json          # Frontend dependencies and build scripts
│   └── dist/                # Frontend build output
└── backend/                  # FastAPI application
    ├── pyproject.toml        # Python dependencies
    └── app/                 # Backend source code
```

### Build Commands

**From the root directory:**
```bash
npm run build                # Full platform build (schema + frontend)
npm run build:frontend       # Frontend build only
npm run generate:schema      # Generate schema documentation
```

**From the frontend directory:**
```bash
cd frontend
npm run build               # Vite build → dist/ folder
npm run dev                 # Development server
npm run test -- --run      # Run test suite - ALWAYS use --run flag
npm run lint                # Run ESLint
```

### 🚨 Build Troubleshooting

**Issue: `npm run build` fails with working directory errors**
```bash
Error: ENOENT: no such file or directory, uv_cwd
```

**Solutions:**
1. **Navigate to frontend directory first:**
   ```bash
   cd frontend
   npm run build
   ```

2. **Use absolute paths (WSL environments):**
   ```bash
   cd /full/path/to/nlj_platform/frontend
   npm run build
   ```

3. **Reset working directory:**
   ```bash
   cd .
   npm run build
   ```

**Issue: TypeScript compilation errors**
```bash
cd frontend
npm run build  # Check specific TypeScript errors
```

**Issue: Dependency problems**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Frontend Commands
```bash
npm run dev          # Development server
npm run build        # Production build
npm run test -- --run # Run test suite (116+ tests passing) - ALWAYS use --run flag
npm run lint         # Run ESLint
```

### Docker Commands

For comprehensive Docker setup details, see **[Docker-README.md](./Docker-README.md)**.

#### Full Development Stack (Recommended)
```bash
# Complete development environment with LocalStack, RDS, and analytics
docker compose --profile analytics \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  -f docker-compose.localstack.yml \
  -f docker-compose.rds.yml \
  --env-file .env up -d
```

#### Service-Specific Deployments
```bash
# FastStream event processing only
docker compose --profile faststream -f docker-compose.yml up -d

# Analytics with Elasticsearch
docker compose --profile analytics -f docker-compose.yml up -d

# Production deployment
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Basic development (PostgreSQL + RedPanda only)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

#### Management Commands
```bash
# Stop all services
docker compose down

# View service status
docker compose ps

# Check service logs
docker compose logs -f nlj-api
docker compose logs -f nlj-frontend-dev

# Health checks
curl http://localhost:4566/_localstack/health  # LocalStack
curl http://localhost:8000/health             # API
curl http://localhost:9200/_cluster/health    # Elasticsearch
```

### Backend Commands
```bash
cd backend
uv sync                         # Install dependencies
. .venv/bin/activate           # Activate virtual environment
uv run fastapi dev app/main.py # Development server
uv run pytest                 # Run tests
uv run ruff check .            # Lint code
uv run mypy                    # Type checking
```

### Pre-deployment Verification
```bash
./scripts/pre-deploy.sh  # Comprehensive verification:
                        # ✅ TypeScript compilation
                        # ✅ Test suite (116+ tests)
                        # ✅ Critical lint issues
                        # ✅ Build success
```

### 🚨 Docker Troubleshooting

#### Common Issues

1. **LocalStack License Error (exit code 55)**
   ```bash
   # Ensure LOCALSTACK_API_KEY is set in .env
   echo "LOCALSTACK_API_KEY=your_key_here" >> .env
   
   # Pass env file to docker compose
   docker compose --env-file .env -f ... up
   ```

2. **Database Connection Issues / API Startup Timing**
   ```bash
   # Check RDS instance status
   curl http://localhost:4566/_localstack/health
   
   # If API fails to connect on first start, restart the API container
   # This is due to RDS initialization timing in LocalStack
   docker compose restart nlj-api
   
   # Verify RDS endpoint
   docker compose exec nlj-api uv run python -c "
   from app.services.database_service import rds_database_service
   import asyncio
   print(asyncio.run(rds_database_service.get_connection_info()))
   "
   ```

3. **Analytics API 500 Errors**
   - Elasticsearch needs proper field mappings for xAPI data
   - Check Elasticsearch health: `curl http://localhost:9200/_cluster/health`
   - Restart analytics components: `docker compose restart elasticsearch nlj-faststream-consumer`

4. **Frontend Hot Reload Issues**
   ```bash
   # If frontend doesn't reload, restart the frontend service
   docker compose restart nlj-frontend-dev
   ```

5. **Activities Tab Not Loading / Timeout Issues**
   ```bash
   # If Activities tab hangs or times out, likely database performance issue
   # Solution: Clear database and reload sample data
   docker compose down --volumes
   docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.localstack.yml -f docker-compose.rds.yml --env-file .env up -d
   
   # Wait for services to be healthy, then load sample data
   docker compose exec nlj-api uv run python scripts/load_sample_surveys.py
   ```

6. **Port Conflicts**
   ```bash
   # Check for conflicting services on required ports
   lsof -i :5173  # Frontend dev
   lsof -i :8000  # API
   lsof -i :4566  # LocalStack
   lsof -i :9200  # Elasticsearch
   lsof -i :9092  # RedPanda
   lsof -i :8080  # RedPanda Console
   ```

#### Health Check Commands
```bash
# Check all service health
docker compose ps

# Test API connectivity
curl http://localhost:8000/health

# Test frontend
curl http://localhost:5173

# Test LocalStack services
curl http://localhost:4566/_localstack/health

# Test Elasticsearch
curl http://localhost:9200/_cluster/health

# Test database connection via API
docker compose exec nlj-api uv run python -c "
import asyncio
from app.core.database_manager import db_manager
async def test():
    health = await db_manager.health_check()
    print(health)
asyncio.run(test())
"

# Test content API with authentication
TOKEN=$(curl -s -X POST "http://localhost:8000/api/auth/login" -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123456"}' | jq -r '.access_token')
curl -s "http://localhost:8000/api/content/?limit=5" -H "Authorization: Bearer $TOKEN" | jq '{total: .total, titles: [.items[].title]}'
```

## 🌟 Current Status & Recent Completions

### ✅ **Phase 2.4 Complete (Latest)**: Smart Recommendations Engine with Performance Integration
- **Intelligent Content Recommendations**: ML-powered suggestion engine using hybrid PostgreSQL + Elasticsearch approach
- **Performance-Based Suggestions**: Content recommendations based on success rates, completion times, and user engagement
- **Smart Node Reusability**: High-performing node suggestions with performance metrics integration
- **Concept-Aware Filtering**: Learning objective and keyword-based content discovery and recommendations

### ✅ **Phase 2.3 Complete**: Content Studio Integration with Auto-Tagging
- **Auto-Tagging Service**: Event-driven automated tagging with quality assurance workflows
- **Manual Override System**: Content creator tools for tagging quality control and approval workflows
- **Batch Processing**: Efficient tagging operations with background processing and progress tracking
- **Integration with Content Studio**: Seamless tagging integration with AI-powered content generation flows

### ✅ **Phase 2.2 Complete**: Auto-Tagging Service with Event-Driven Architecture
- **LLM-Powered Auto-Tagging**: Intelligent tagging using knowledge extraction service with confidence scoring
- **Event-Driven Processing**: Kafka-based async tagging pipeline with real-time updates and monitoring
- **Quality Assurance Tools**: Manual review workflows, batch operations, and tagging quality metrics
- **API Integration**: RESTful endpoints for tagging operations, review processes, and batch management

### ✅ **Phase 2.1 Complete**: LLM-Powered Knowledge Extraction & Normalization  
- **Knowledge Extraction Service**: AI-powered metadata extraction from content with learning objectives and keywords
- **Taxonomy Management**: Normalized term management with canonical mapping and confidence scoring
- **Quality Assurance**: Manual override capabilities with reviewer workflows and validation tools
- **API Endpoints**: RESTful knowledge extraction APIs with batch processing and monitoring capabilities

### ✅ **Production System**: Live at https://callcoach.training
- Full-stack deployment with nginx, PostgreSQL, FastAPI, and Apache Kafka event streaming
- Automated deployment pipeline with SSL certificates and production configuration
- Comprehensive API documentation with OpenAPI/Swagger at `/api/docs`
- 116+ tests passing with comprehensive coverage across all platform components

### ✅ **FastStream Migration**: Modern Event Processing System
- **Enhanced Elasticsearch Service**: Direct integration replacing legacy systems with complete analytics support
- **FastStream Integration**: Modern, type-safe event processing with Apache Kafka and comprehensive validation
- **Event Handlers**: Training, content, and survey event processing with async workflows
- **Performance Optimization**: Container optimization, health monitoring, and resource management

### ✅ **Core Platform Features**: Production-Ready Infrastructure
- **Visual Flow Editor**: Database-integrated editor with real-time preview and comprehensive node support
- **AI Content Studio**: Claude API integration for document processing and content generation
- **Public Sharing System**: Secure token-based sharing with QR codes and comprehensive analytics
- **Analytics Dashboard**: 5-tab system with ML insights, compliance tracking, and audit trails
- **Event-Driven Architecture**: Apache Kafka with FastStream for real-time processing and integration

## 🚀 Next Steps & Roadmap

### 🔄 **Phase 3 Priority**: Flow Editor Node Intelligence Integration
- **Smart Node Palette**: Performance-aware node browser with real-time success metrics and usage frequency
- **Enhanced Node Editors**: AI-powered content suggestions, difficulty prediction, and smart choice generation
- **Flow-Level Intelligence**: Concept coverage analysis, learning path optimization, and content gap detection
- **Contextual Recommendations**: Related node suggestions based on current flow content and learning objectives

### 🔄 **Advanced Training Features**
- **Calendar Integration**: Visual calendar UI for session scheduling and booking management
- **Instructor Management**: Assignment workflows, availability tracking, and capacity management
- **Recurring Sessions**: Automated session templates with bulk scheduling capabilities
- **Enhanced Analytics**: Training program performance dashboard with comprehensive reporting

### 🔄 **Content Creation Enhancements**
- **Advanced Node Types**: Fill-in-the-blank, classification, hotspot, and memory game question types
- **Media Integration**: Enhanced drag & drop upload, image optimization, and video support
- **Template Expansion**: Industry-specific templates with guided creation workflows
- **Version Control**: Advanced versioning with performance comparison and automated rollback

## 📄 Development Documentation

For detailed development information:

- **[CLAUDE.md](./CLAUDE.md)** - Developer instructions, architectural patterns, and coding standards
- **[BACKLOG.md](./BACKLOG.md)** - Development roadmap and feature planning
- **[Backend Setup](./backend/README.md)** - Backend-specific setup and API documentation
- **[Docker README](./Docker-README.md)** - Comprehensive Docker deployment guide

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

Built with modern web technologies for scalable, accessible learning experiences. Special thanks to all contributors and the open-source community for the foundational technologies that make this platform possible.