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
- **FastAPI Backend**: High-performance Python backend with async support
- **PostgreSQL Database**: Robust data persistence with SQLAlchemy ORM
- **JWT Authentication**: Secure user authentication and session management
- **Role-Based Access Control**: Multi-tier permissions (Player/Creator/Reviewer/Approver/Admin)
- **Event-Driven Architecture**: Apache Kafka for real-time integration and xAPI event streaming
- **Internal Training System**: Native training session scheduling and booking management
- **Docker Deployment**: Containerized deployment with Docker Compose
- **Content API**: Full CRUD operations with filtering, search, and pagination

### **Frontend Architecture**
- **Modern Dashboard**: Responsive home page with quick actions, metrics, and review queue
- **Activities Browser**: Card/table view toggle with advanced filtering and search
- **Content-Aware URLs**: Deep linking support for activities (`/app/play/[id]`)
- **Flow Editor**: WYSIWYG visual editor with React Flow integration
- **Responsive Design**: Mobile-first design with Material-UI components
- **Theme Support**: Dark/light themes with toggle functionality

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

✅ **Production Deployment Complete**: Live at https://callcoach.training
- Full-stack deployment with nginx, PostgreSQL, and FastAPI
- Automated deployment pipeline with `deploy-callcoach.sh`
- SSL certificates and production-ready configuration
- API documentation available at `/api/docs`

✅ **Event-Driven Training System Complete**: Native Scheduling Infrastructure
- **Internal Training System**: Comprehensive native training session scheduling and booking management
- **Apache Kafka Event Bus**: KRaft mode configuration for real-time event streaming and operation tracking
- **Event-Driven Architecture**: Complete event-driven API endpoints with real-time status polling and async operation tracking
- **Frontend Training Interface**: Complete UI for training program management, session scheduling, and learner registration
- **Real-Time Updates**: Live status polling with custom hooks and visual progress indicators for all training operations
- **Role-Based Training Management**: Permission-based access for program creation, session scheduling, and learner registration

✅ **Phase 6 Complete**: Advanced Variable Management & Permissions System
- **Variable Interpolation Engine**: Comprehensive expression evaluation with mathematical operations, string manipulation, and conditional logic
- **Expression Validation**: Real-time validation with syntax highlighting and error reporting
- **Dynamic Content Rendering**: Variable interpolation with `{{variable}}` syntax across all content types
- **Centralized Permissions System**: Migration from hardcoded role checking to centralized permission functions
- **Enhanced Flow Editor**: Branch editor for conditional logic and improved variable management
- **UI/UX Improvements**: Redesigned review panels, improved layouts, and enhanced user experience

✅ **Phase 5 Complete**: Enhanced Content Creation Workflow
- Template-based activity creation with 5 pre-built templates
- Visual template selection with Material-UI interface
- Two-step creation flow with proper validation
- Seamless Flow Editor integration with database persistence

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