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

The platform is built with modern web technologies:

- **Frontend**: TypeScript + React + Material-UI + Vite
- **Backend**: Python + FastAPI + SQLAlchemy + PostgreSQL
- **Deployment**: Docker + Docker Compose
- **Testing**: Vitest + React Testing Library (326 tests passing)

## 📚 Documentation

For detailed documentation, development setup, and architectural information, see:

- **[CLAUDE.md](./CLAUDE.md)** - Complete platform documentation with features, setup, and development guidelines
- **[Backend Setup](./backend/README.md)** - Backend-specific setup and API documentation
- **[Backend Architecture](./backend/BACKEND_SETUP.md)** - Database schema and backend architecture details

## 🔧 Development

### Frontend Commands
```bash
npm run dev          # Development server
npm run build        # Production build
npm run test -- --run # Run test suite (326 tests passing)
npm run lint         # Run ESLint
```

### Backend Commands
```bash
uvicorn app.main:app --reload    # Development server
python -m pytest                # Run tests
docker-compose up               # Run with Docker
```

### Pre-deployment Verification
```bash
./scripts/pre-deploy.sh  # Verify build, tests, and deployment readiness
```

## 🌟 Current Status

✅ **Production Deployment Complete**: Live at https://callcoach.training
- Full-stack deployment with nginx, PostgreSQL, and FastAPI
- Automated deployment pipeline with `deploy-callcoach.sh`
- SSL certificates and production-ready configuration
- API documentation available at `/api/docs`

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

🔄 **Content Creation Enhancements**
- Extract LLM Prompt Construction as standalone feature
- Add content creation templates to New Activity workflow
- Implement Import Activity functionality
- Enhanced content management and approval workflows

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

Built with modern web technologies for scalable, accessible learning experiences.