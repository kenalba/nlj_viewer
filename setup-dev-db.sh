#!/bin/bash
# NLJ Platform Development Database Setup Script
# Run this to initialize a fresh development environment

set -e  # Exit on any error

echo "🚀 NLJ Platform Development Database Setup"
echo "=========================================="

# Stop any running containers and clear volumes
echo "📦 Cleaning up existing containers and volumes..."
docker-compose down -v 2>/dev/null || true

# Build containers to ensure latest code
echo "🔧 Building containers with latest code..."
docker-compose build nlj-api

# Start database service first
echo "🗄️  Starting PostgreSQL database..."
docker-compose up nlj-db -d

# Wait for database to be healthy
echo "⏳ Waiting for database to be ready..."
timeout=60
counter=0
while ! docker exec -i nlj_postgres pg_isready -U nlj_user -d nlj_platform 2>/dev/null; do
    sleep 2
    counter=$((counter + 2))
    if [ $counter -ge $timeout ]; then
        echo "❌ Database failed to start within ${timeout} seconds"
        exit 1
    fi
done

echo "✅ Database is ready!"

# Clean database completely to ensure fresh start
echo "🧹 Cleaning database schema for fresh start..."
docker exec nlj_postgres psql -U nlj_user -d nlj_platform -c "
  DROP SCHEMA IF EXISTS public CASCADE; 
  CREATE SCHEMA public; 
  GRANT ALL ON SCHEMA public TO nlj_user; 
  GRANT ALL ON SCHEMA public TO public;
  -- Also clean up alembic version table if it exists
  DROP TABLE IF EXISTS alembic_version;
" 2>/dev/null || true

# Start API service
echo "🚀 Starting NLJ API service..."
docker-compose up nlj-api -d

# Wait for API to be ready
echo "⏳ Waiting for API service to be ready..."
timeout=60
counter=0
while ! docker exec -i nlj_api curl -f http://localhost:8000/health 2>/dev/null; do
    sleep 2
    counter=$((counter + 2))
    if [ $counter -ge $timeout ]; then
        echo "❌ API service failed to start within ${timeout} seconds"
        exit 1
    fi
done

echo "✅ API service is ready!"

# Run database migration
echo "📊 Running database migration..."
docker exec nlj_api alembic upgrade head

# Seed database with sample data
echo "🌱 Seeding database with sample data..."
docker exec nlj_api python seed_database.py

# Start Kafka (optional for development)
echo "📨 Starting Kafka service (optional)..."
docker-compose up kafka -d

echo ""
echo "🎉 Development environment setup complete!"
echo "========================================="
echo ""
echo "📋 Services running:"
echo "  • NLJ Frontend: http://localhost:5173 (run 'npm run dev' in frontend/)"
echo "  • NLJ API: http://localhost:8000"
echo "  • API Docs: http://localhost:8000/docs"
echo "  • PostgreSQL: localhost:5432"
echo "  • Kafka: localhost:9092"
echo ""
echo "👥 Test Users Created:"
echo "  • Admin: admin / admin123456"
echo "  • Creator: creator / creator123"
echo "  • Reviewer: reviewer / reviewer123"
echo "  • Player: player / player123"
echo "  • Learner: learner / learner123"
echo ""
echo "📚 Sample Content Available:"
echo "  • FSA Product Knowledge Assessment"
echo "  • Customer Service Excellence Training"
echo "  • Word Connections Game"
echo "  • Employee Satisfaction Survey"
echo ""
echo "🎯 Training Programs Created:"
echo "  • Financial Services Advisor Certification"
echo "  • Customer Service Excellence Workshop"
echo "  • Emerging Leaders Development Program"
echo ""
echo "🛠️  Development Notes:"
echo "  • Database data persists in Docker volumes"
echo "  • To reset: run this script again"
echo "  • To stop: docker-compose down"
echo "  • To view logs: docker-compose logs -f [service-name]"
echo ""
echo "Happy coding! 🚀"