# NLJ Platform - Docker Integration Guide

This document explains the Docker setup for the NLJ Platform, which now includes a fully containerized frontend alongside the existing backend services.

## 🏗️ Architecture Overview

The Docker setup includes:
- **PostgreSQL Database**: Data persistence
- **Apache Kafka**: Event streaming and integration
- **FastAPI Backend**: Python API server
- **React Frontend**: Vite-based web application with nginx
- **Kafka UI**: Development tools (optional)

## 📁 Docker Files Structure

```
├── docker-compose.yml           # Base configuration
├── docker-compose.dev.yml       # Development overrides
├── docker-compose.prod.yml      # Production overrides
├── frontend/
│   ├── Dockerfile              # Multi-stage frontend build
│   └── nginx.conf              # Nginx configuration
└── backend/
    └── Dockerfile              # Backend API build
```

## 🚀 Quick Start Commands

### Development Environment
```bash
# Start all services with frontend hot reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Start in background
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# View logs
docker-compose logs -f nlj-frontend-dev
```

**Access Points:**
- Frontend (hot reload): http://localhost:5173
- Backend API: http://localhost:8000/docs
- Kafka UI: http://localhost:8080
- Database: localhost:5432

### Production Environment
```bash
# Start production system
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Scale services if needed
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale nlj-api=2
```

**Access Points:**
- Full Application: http://localhost (nginx serves frontend + API proxy)
- API Only: http://localhost/api/docs
- Database: localhost:5432

### Backend Only (Original Setup)
```bash
# Start just backend services
docker-compose up nlj-db nlj-api kafka
```

## 🔧 Configuration

### Environment Variables

Create `.env` file in the root directory:

```bash
# Database
DATABASE_URL=postgresql+asyncpg://nlj_user:nlj_pass@nlj-db:5432/nlj_platform

# Application
DEBUG=false                    # Set to false for production
SECRET_KEY=your-secret-key-change-in-production
ENABLE_REGISTRATION=true

# Frontend URLs
FRONTEND_URL=http://localhost
FRONTEND_API_URL=http://localhost/api

# External APIs
CLAUDE_API_KEY=your-claude-api-key
ELEVENLABS_API_KEY=your-elevenlabs-key

# Kafka
KAFKA_BOOTSTRAP_SERVERS=kafka:29092

# CORS (development only)
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Frontend Build Configuration

The frontend Dockerfile supports multiple build targets:

- **development**: Hot reload with Vite dev server
- **production**: Optimized build with nginx

### Nginx Configuration

The frontend nginx configuration includes:
- SPA routing support
- API proxy to backend (`/api/*` → `http://nlj-api:8000/*`)
- Static asset caching
- GZIP compression
- Security headers
- Health check endpoint

## 📊 Service Dependencies

```mermaid
graph TB
    A[nlj-db] --> B[nlj-api]
    C[kafka] --> B
    B --> D[nlj-frontend]
    C --> E[kafka-ui]
```

## 🔍 Monitoring & Health Checks

All services include health checks:

```bash
# Check service health
docker-compose ps

# View health check logs
docker inspect nlj_frontend | grep -A 10 Health

# Manual health checks
curl http://localhost/health        # Frontend
curl http://localhost:8000/health  # Backend
```

## 🛠️ Development Workflow

### Making Frontend Changes
With hot reload enabled in development mode, changes are automatically reflected:

1. Edit files in `./frontend/`
2. Changes appear instantly at http://localhost:5173
3. No rebuild required

### Making Backend Changes
Backend hot reload is enabled via volume mounting:

1. Edit files in `./backend/app/`
2. FastAPI auto-reloads on file changes
3. Check logs: `docker-compose logs -f nlj-api`

### Database Changes
```bash
# Run migrations
docker-compose exec nlj-api alembic upgrade head

# Access database
docker-compose exec nlj-db psql -U nlj_user -d nlj_platform
```

## 🚢 Production Deployment

### Option 1: Docker Compose (Recommended)
```bash
# Deploy with Docker
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Update deployment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Option 2: Legacy Manual Deployment
Use the existing `deploy-callcoach.sh` script for traditional deployment.

## 🐛 Troubleshooting

### Common Issues

**Frontend not loading:**
```bash
# Check frontend container
docker-compose logs nlj-frontend

# Verify nginx config
docker-compose exec nlj-frontend nginx -t
```

**API proxy not working:**
```bash
# Check backend connectivity
docker-compose exec nlj-frontend curl http://nlj-api:8000/health

# Verify network
docker network inspect nlj_viewer_nlj_network
```

**Database connection issues:**
```bash
# Check database health
docker-compose exec nlj-db pg_isready -U nlj_user

# Check backend database connection
docker-compose exec nlj-api python -c "from app.core.database import engine; print(engine)"
```

### Logs and Debugging
```bash
# View all logs
docker-compose logs

# Follow specific service
docker-compose logs -f nlj-frontend

# Debug container
docker-compose exec nlj-frontend sh
```

## 📋 Maintenance

### Cleanup
```bash
# Stop all services
docker-compose down

# Remove volumes (careful: deletes data!)
docker-compose down -v

# Clean up images
docker system prune
```

### Backups
```bash
# Backup database
docker-compose exec nlj-db pg_dump -U nlj_user nlj_platform > backup.sql

# Backup volumes
docker run --rm -v nlj_viewer_nlj_db_data:/data -v $(pwd):/backup alpine tar czf /backup/db-backup.tar.gz -C /data .
```

## 🔄 Migration from Legacy Setup

To migrate from the manual deployment to Docker:

1. **Backup existing data**
2. **Set up environment variables**
3. **Test with development configuration**
4. **Deploy production configuration**
5. **Update DNS/load balancer to point to new setup**

The legacy deployment script remains available for backwards compatibility.