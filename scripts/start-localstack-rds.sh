#!/bin/bash

echo "🚀 Starting NLJ Platform with LocalStack RDS"
echo "============================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Function to wait for service health
wait_for_service() {
    local service_name=$1
    local health_url=$2
    local timeout=${3:-60}
    local elapsed=0
    
    echo "⏳ Waiting for $service_name to be healthy..."
    
    while [ $elapsed -lt $timeout ]; do
        if curl -s "$health_url" > /dev/null 2>&1; then
            echo "✅ $service_name is ready!"
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
        echo "   Waiting... (${elapsed}s/${timeout}s)"
    done
    
    echo "❌ $service_name failed to start within ${timeout}s"
    return 1
}

# Check if we're doing a migration
MIGRATE_DATA=""
if [ "$1" = "--migrate" ]; then
    MIGRATE_DATA="--migrate"
    echo "🔄 Migration mode enabled - will migrate existing data to RDS"
fi

echo "🐳 Starting Docker services..."

# Start the full stack with RDS
docker-compose \
    -f docker-compose.yml \
    -f docker-compose.dev.yml \
    -f docker-compose.localstack.yml \
    -f docker-compose.rds.yml \
    up -d

echo ""
echo "⏳ Waiting for services to initialize..."

# Wait for LocalStack to be ready
if ! wait_for_service "LocalStack" "http://localhost:4566/_localstack/health" 120; then
    echo "❌ LocalStack failed to start"
    exit 1
fi

# Wait a bit more for RDS initialization
echo "⏳ Waiting for RDS to initialize (this may take a few minutes)..."
sleep 30

# Check if RDS instance is available
echo "🔍 Checking RDS instance status..."
RDS_STATUS=$(curl -s "http://localhost:4566/_localstack/health" | grep -o '"rds": "[^"]*"' | cut -d'"' -f4)

if [ "$RDS_STATUS" = "available" ]; then
    echo "✅ RDS service is available"
    
    # Wait for the specific RDS instance to be ready
    echo "⏳ Waiting for PostgreSQL instance to be available..."
    
    # Use the migration script to check RDS availability
    if python3 scripts/migrate-to-rds.py --validate-only > /dev/null 2>&1; then
        echo "✅ RDS PostgreSQL instance is ready"
    else
        echo "⏳ RDS instance still initializing..."
        sleep 60
    fi
else
    echo "❌ RDS service not available: $RDS_STATUS"
fi

# Wait for the API service
if ! wait_for_service "NLJ API" "http://localhost:8000/health" 180; then
    echo "❌ NLJ API failed to start"
    echo "📋 Troubleshooting steps:"
    echo "   1. Check logs: docker-compose logs nlj-api"
    echo "   2. Verify LocalStack: curl http://localhost:4566/_localstack/health"
    exit 1
fi

# Run data migration if requested
if [ "$MIGRATE_DATA" = "--migrate" ]; then
    echo ""
    echo "🔄 Starting data migration to RDS..."
    
    if python3 scripts/migrate-to-rds.py; then
        echo "✅ Data migration completed successfully!"
    else
        echo "❌ Data migration failed. Check the logs above."
        echo "💡 You can retry migration later with: python3 scripts/migrate-to-rds.py"
    fi
fi

echo ""
echo "🎉 NLJ Platform with LocalStack RDS is ready!"
echo "============================================"
echo ""
echo "🌐 Available Services:"
echo "   📱 Frontend:           http://localhost:5173"
echo "   🚀 API:                http://localhost:8000"
echo "   📚 API Docs:           http://localhost:8000/docs"
echo "   ☁️  LocalStack:         http://localhost:4566"
echo "   📊 RedPanda Console:   http://localhost:8080"
echo ""
echo "🗄️  Database Services:"
echo "   📊 RDS Management:     http://localhost:8000/api/database/status"
echo "   🔍 RDS Health:         http://localhost:8000/api/database/health"
echo "   📸 Create Snapshot:    curl -X POST http://localhost:8000/api/database/snapshots"
echo ""
echo "📧 Email Services:"
echo "   📨 Email Health:       http://localhost:8000/api/notifications/health"
echo "   ✉️  Send Test Email:    Available via API docs"
echo ""
echo "🧪 Testing Commands:"
echo "   Test LocalStack:       python3 scripts/test-localstack.py"
echo "   Test RDS Migration:    python3 scripts/migrate-to-rds.py --validate-only"
echo "   View RDS Snapshots:    curl http://localhost:8000/api/database/snapshots"
echo ""
echo "🔧 Management Commands:"
echo "   View logs:             docker-compose logs [service-name]"
echo "   Stop services:         docker-compose down"
echo "   Restart services:      docker-compose restart [service-name]"
echo ""

if [ "$MIGRATE_DATA" != "--migrate" ]; then
    echo "💡 To migrate existing data to RDS, run:"
    echo "   python3 scripts/migrate-to-rds.py"
    echo ""
fi

echo "✨ Happy developing with LocalStack RDS! 🎊"