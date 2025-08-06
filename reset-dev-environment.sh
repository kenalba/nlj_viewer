#!/bin/bash
# NLJ Platform Development Environment Reset Script
# This completely resets the development environment from scratch

set -e  # Exit on any error

echo "🔄 NLJ Platform Development Environment Reset"
echo "============================================="

# Stop all containers and remove everything
echo "🛑 Stopping all services and cleaning up..."
docker-compose down -v --remove-orphans 2>/dev/null || true

# Remove any orphaned containers
echo "🧹 Removing any orphaned containers..."
docker container prune -f 2>/dev/null || true

# Remove any unused volumes
echo "🗑️  Removing unused volumes..."
docker volume prune -f 2>/dev/null || true

# Build fresh containers
echo "🔧 Building fresh containers..."
docker-compose build --no-cache nlj-api

# Start database first
echo "🗄️  Starting fresh PostgreSQL database..."
docker-compose up nlj-db -d

# Wait for database
echo "⏳ Waiting for database to be ready..."
timeout=60
counter=0
while ! docker exec nlj_postgres pg_isready -U nlj_user -d nlj_platform 2>/dev/null; do
    sleep 2
    counter=$((counter + 2))
    if [ $counter -ge $timeout ]; then
        echo "❌ Database failed to start within ${timeout} seconds"
        docker-compose logs nlj-db
        exit 1
    fi
    echo "   ... waiting (${counter}s/${timeout}s)"
done

echo "✅ Database is ready!"

# Start API service
echo "🚀 Starting API service..."
docker-compose up nlj-api -d

# Wait for API
echo "⏳ Waiting for API service to be ready..."
timeout=90
counter=0
while ! docker exec nlj_api curl -f http://localhost:8000/health 2>/dev/null; do
    sleep 3
    counter=$((counter + 3))
    if [ $counter -ge $timeout ]; then
        echo "❌ API service failed to start within ${timeout} seconds"
        echo "API Logs:"
        docker-compose logs nlj-api
        exit 1
    fi
    echo "   ... waiting (${counter}s/${timeout}s)"
done

echo "✅ API service is ready!"

# Run migration
echo "📊 Running database migration..."
docker exec nlj_api alembic upgrade head

# Check migration status
echo "🔍 Checking migration status..."
docker exec nlj_api alembic current

# Run seeding
echo "🌱 Seeding database with sample data..."
docker exec nlj_api python seed_database.py

# Start Kafka (optional)
echo "📨 Starting Kafka service..."
docker-compose up kafka -d

echo ""
echo "🎉 Development environment reset complete!"
echo "=========================================="
echo ""
echo "🌐 Services Available:"
echo "  • Frontend: http://localhost:5173 (run 'npm run dev' in frontend/)"
echo "  • Backend API: http://localhost:8000"
echo "  • API Documentation: http://localhost:8000/docs"
echo "  • Database: postgresql://nlj_user:nlj_pass@localhost:5432/nlj_platform"
echo ""
echo "👤 User Accounts:"
echo "  • admin / admin123456 (Administrator)"
echo "  • creator / creator123 (Content Creator)"
echo "  • reviewer / reviewer123 (Content Reviewer)" 
echo "  • player / player123 (Player/Learner)"
echo "  • learner / learner123 (Training Learner)"
echo ""
echo "📚 Sample Content Created:"
echo "  • FSA Product Knowledge Assessment"
echo "  • Customer Service Excellence Training"
echo "  • Word Connections Game"
echo "  • Employee Satisfaction Survey"
echo ""
echo "🎓 Training Programs Available:"
echo "  • Financial Services Advisor Certification (4h)"
echo "  • Customer Service Excellence Workshop (3h)"
echo "  • Emerging Leaders Development Program (6h)"
echo ""
echo "🔧 Development Commands:"
echo "  • View logs: docker-compose logs -f [service-name]"
echo "  • Stop services: docker-compose down"
echo "  • Restart API: docker-compose restart nlj-api"
echo "  • Connect to DB: docker exec -it nlj_postgres psql -U nlj_user -d nlj_platform"
echo ""
echo "✨ Ready for development!"