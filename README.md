# NLJ Viewer - Unified Learning Platform

A full-stack TypeScript application for creating, managing, and delivering interactive Non-Linear Journey (NLJ) training scenarios, surveys, assessments, and games with comprehensive analytics and role-based access control.

## 🚀 Quick Start

### Development Environment
```bash
# Install dependencies and start both frontend & backend
npm install
npm run dev
```

Visit `http://localhost:5173` for the frontend and `http://localhost:8000/docs` for the API documentation.

### Production Deployment
```bash
# Full production build and deployment
./deploy-callcoach.sh

# Manual deployment steps:
npm run build:frontend
sudo cp -r frontend/dist/* /var/www/callcoach.training/
sudo systemctl restart callcoach-api
sudo nginx -s reload
```

**🌐 Live Production Site**: https://callcoach.training  
**📖 API Documentation**: https://callcoach.training/api/docs

## 📋 Platform Overview

### **Backend Infrastructure**
- **FastAPI Backend**: High-performance Python backend with comprehensive API endpoints and async support
- **PostgreSQL Database**: Robust data persistence with SQLAlchemy ORM and 139+ sample activities
- **JWT Authentication**: Secure authentication with role-based access control and centralized permissions
- **Event-Driven Architecture**: Apache Kafka (KRaft mode) for real-time training session management and xAPI streaming
- **Training System**: Complete native scheduling with registration, booking, conflict resolution, and real-time updates
- **Content Management**: Full CRUD operations with approval workflows, filtering, search, and pagination
- **Docker Deployment**: Production-ready containerization with development and production configurations

### **Frontend Architecture**  
- **Modern Navigation**: Redesigned sidebar with HOME, Dashboard, ACTIVITIES, SOURCES, MEDIA, GENERATION, Events, PEOPLE
- **Analytics Dashboard**: Consolidated 5-tab system with Overview, People Analytics, Content & Performance, Compliance, and Audit Trail
- **Activities Management**: Card/table view toggle with advanced filtering, search, and direct play links
- **Content Studio**: AI-powered content generation with Claude API integration and document management
- **Flow Editor**: WYSIWYG visual editor with React Flow, database persistence, and 18+ node types  
- **Responsive Design**: Mobile-first design with Material-UI, theme support, and accessibility features

### **Learning Activities & Games**
- **Complete Question Types**: True/False, Multiple Choice, Ordering, Matching, Short Answer, Likert Scales, Rating Questions, Matrix Questions, Sliders, Text Areas
- **Interactive Games**: Connections word puzzles (NYT-style) and Wordle games
- **Visual Interactions**: Drag-and-drop ordering, visual connection lines for matching
- **Keyboard Navigation**: Full keyboard support for accessibility
- **Audio Feedback**: User-controlled sound system with oscillator-based audio
- **xAPI Integration**: Comprehensive event tracking with learning analytics

## 🏗️ Architecture

The platform is built with modern web technologies and event-driven architecture:

- **Frontend**: TypeScript + React + Material-UI + Vite
- **Backend**: Python + FastAPI + SQLAlchemy + PostgreSQL
- **Event System**: Apache Kafka (KRaft mode) for real-time integration
- **Training System**: Native scheduling system for training session management
- **Deployment**: Docker + Docker Compose
- **Testing**: Vitest + React Testing Library (326 tests passing)

## 📚 Documentation

For detailed documentation, development setup, and architectural information, see:

- **[CLAUDE.md](./CLAUDE.md)** - Complete platform documentation with features, setup, and development guidelines
- **[Backend Setup](./backend/README.md)** - Backend-specific setup and API documentation
- **[Backend Architecture](./backend/BACKEND_SETUP.md)** - Database schema and backend architecture details

## 🔧 Development & Build Process

### Understanding the Project Structure

The project uses a **monorepo structure** with separate frontend and backend builds:

```
nlj_viewer/                    # Root directory
├── package.json              # Root orchestration scripts
├── frontend/                 # React + Vite application
│   ├── package.json         # Frontend dependencies and build scripts
│   └── dist/               # Frontend build output
└── backend/                 # FastAPI application
    ├── pyproject.toml      # Python dependencies
    └── app/               # Backend source code
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
npm run test -- --run      # Run test suite (326 tests passing)
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
   cd /full/path/to/nlj_viewer/frontend
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
npm run test -- --run # Run test suite (326 tests passing) - ALWAYS use --run flag
npm run lint         # Run ESLint
```

### Docker Commands

For containerized development, see **[Docker-README.md](./Docker-README.md)** for comprehensive Docker deployment guide.

```bash
# Development with hot reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production deployment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Legacy commands
docker-compose up               # Start all services
docker-compose up nlj-api       # Start just NLJ backend
docker-compose down             # Stop all services
```

### Backend Commands
```bash
cd backend
uv sync                         # Install dependencies
. .venv/bin/activate           # Activate virtual environment
uvicorn app.main:app --reload   # Development server
python -m pytest               # Run tests
```

### Pre-deployment Verification
```bash
./scripts/pre-deploy.sh  # Comprehensive verification:
                        # ✅ TypeScript compilation
                        # ✅ Test suite (326 tests)
                        # ✅ Critical lint issues
                        # ✅ Build success
```

## 🌟 Current Status

✅ **Production System**: Live at https://callcoach.training
- Full-stack deployment with nginx, PostgreSQL, FastAPI, and Apache Kafka
- Automated deployment pipeline with SSL certificates and production configuration
- Comprehensive API documentation with OpenAPI/Swagger at `/api/docs`
- 326+ tests passing with comprehensive coverage across all platform components

✅ **Event-Driven Training System**: Complete native scheduling infrastructure
- **Real-Time Training Management**: Session scheduling, booking, registration with conflict resolution
- **Apache Kafka Integration**: Event streaming for async operations with real-time status tracking
- **Frontend Training Suite**: Complete UI including program management, session creation, and learner dashboards
- **Live Status Updates**: Real-time polling with visual progress indicators and comprehensive booking workflows

✅ **Analytics Dashboard**: Consolidated 5-tab system with live data
- **Overview**: Platform metrics with Daily Activity Timeline and engagement statistics
- **People Analytics**: ML-powered top performer analysis with behavioral insights and learning patterns
- **Content & Performance**: Activity trends, engagement metrics, and comprehensive performance analytics
- **Compliance Dashboard**: Risk assessment with user-specific compliance tracking and gap analysis
- **Audit Trail**: xAPI statement browser with search, filtering, and JSON export capabilities

✅ **AI-Powered Content Studio**: Claude API integration for content generation
- **Document Management**: Multi-format support (PDF, DOCX, PPTX) with Claude Files API integration
- **Content Generation**: Real-time AI generation with progress tracking and Flow Editor integration  
- **Source Library**: Comprehensive document lifecycle with metadata extraction and reuse capabilities
- **Advanced Workflows**: Batch processing, template systems, and streamlined creation interfaces

## 🚀 Next Steps

🔄 **Training System Enhancements**: Advanced Scheduling Features
- **Calendar Integration**: Visual calendar UI for session scheduling and booking management
- **Instructor Management**: Instructor assignment workflows and availability tracking
- **Recurring Sessions**: Automated recurring session templates and bulk scheduling
- **Enhanced Analytics**: Comprehensive training program performance dashboard and reporting

🔄 **Content Creation Enhancements**
- Extract LLM Prompt Construction as standalone feature
- Add content creation templates to New Activity workflow
- Implement Import Activity functionality
- Enhanced content management and approval workflows

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

Built with modern web technologies for scalable, accessible learning experiences.