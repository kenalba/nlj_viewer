# Backend Scripts

This directory contains utility scripts for database management and development tasks.

## Available Scripts

### Database Management
- `seed_database.py` - Creates users, loads static content, and creates training programs
- `seed_users_only.py` - Creates only basic user accounts for testing
- `clean_database.py` - Cleans database of all data
- `test_connection.py` - Tests PostgreSQL database connection

### Content Management
- `migrate_sample_content.py` - Migrates sample content from static files
- `debug_content.py` - Debug script for testing content API

### Migration & Testing
- `test_migration_simple.py` - Simple migration testing

## Usage

### Run from Docker Container (Recommended)
```bash
# Test database connection
docker exec nlj_api python scripts/test_connection.py

# Create users only
docker exec nlj_api python scripts/seed_users_only.py

# Full database seeding (users + content + training programs)
docker exec nlj_api python scripts/seed_database.py

# Clean database
docker exec nlj_api python scripts/clean_database.py
```

### Run Locally (requires local Python environment)
```bash
cd backend
python scripts/seed_users_only.py
```

## VSCode Tasks

The project includes VSCode tasks for easy access to these scripts:

1. Open Command Palette (`Ctrl+Shift+P`)
2. Type "Tasks: Run Task"
3. Select from available tasks:
   - 🚀 Start Development Environment
   - 🗄️ Initialize Database
   - 👥 Seed Users Only
   - 🌱 Seed Full Database
   - 🧹 Clean Database
   - 🔍 Test Database Connection
   - 📊 Database Status
   - 🎯 Quick Setup: Database + Users

## Development Workflow

For a fresh development environment:

1. **Quick Setup**: Use the "🎯 Quick Setup: Database + Users" task
2. **Full Setup**: Use the "🔄 Reset Development Environment" task
3. **Daily Development**: Use "🚀 Start Development Environment" task

## Static Content Loading

The `seed_database.py` script automatically loads content from these locations (in order):
1. `/static/sample_nljs/`
2. `/frontend/public/static/sample_nljs/`
3. `/frontend/static/sample_nljs/`

If static files aren't found, it falls back to hardcoded sample content.

## User Accounts Created

All seeding scripts create these test accounts:

| Username | Password | Role | Email |
|----------|----------|------|-------|
| admin | admin123456 | Administrator | admin@nlj-platform.com |
| creator | creator123 | Content Creator | creator@nlj-platform.com |
| reviewer | reviewer123 | Content Reviewer | reviewer@nlj-platform.com |
| player | player123 | Player/Learner | player@nlj-platform.com |
| learner | learner123 | Training Learner | learner@nlj-platform.com |

## Environment Variables

Scripts use these environment variables:
- `DATABASE_URL` - PostgreSQL connection string (defaults to local development)