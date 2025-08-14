#!/bin/bash
set -e

echo "🚀 Starting NLJ Platform deployment..."

# Configuration
PROJECT_ROOT="/mnt/c/Users/aeroz/Documents/GitHub/nlj_viewer"
REACT_PROJECT_PATH="$PROJECT_ROOT/frontend"
FASTAPI_PROJECT_PATH="$PROJECT_ROOT/backend"
WEB_ROOT="/var/www/callcoach.training"
BACKUP_DIR="/var/backups/callcoach"

# Create backup
echo "📦 Creating backup..."
sudo mkdir -p $BACKUP_DIR
if [ -d $WEB_ROOT ]; then
    sudo cp -r $WEB_ROOT $BACKUP_DIR/$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
fi

# Start database if not running
echo "🐘 Starting PostgreSQL database..."
cd $FASTAPI_PROJECT_PATH
docker-compose up -d db

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Run database migrations
echo "📊 Running database migrations..."
cd $FASTAPI_PROJECT_PATH
source .venv/bin/activate
alembic upgrade head

# Build React app
echo "⚛️  Building React application..."
cd $REACT_PROJECT_PATH
npm ci --production=false
npm run build

# Deploy React build
echo "📋 Deploying React build..."
sudo mkdir -p $WEB_ROOT
sudo rm -rf $WEB_ROOT/*
sudo cp -r $REACT_PROJECT_PATH/dist/* $WEB_ROOT/
sudo chown -R www-data:www-data $WEB_ROOT
sudo chmod -R 755 $WEB_ROOT

# Start Docker backend
echo "🐍 Starting Docker backend..."
cd $PROJECT_ROOT
docker compose up -d nlj-api

# Install nginx configuration
echo "🌐 Installing nginx configuration..."
sudo cp $PROJECT_ROOT/nginx-callcoach.conf /etc/nginx/sites-available/callcoach.training
sudo ln -sf /etc/nginx/sites-available/callcoach.training /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Restart services
echo "🔄 Restarting services..."
sudo systemctl reload nginx

# Verify deployment
echo "✅ Verifying deployment..."
sleep 5

# Check database
if docker ps | grep -q nlj_postgres; then
    echo "✅ PostgreSQL database is running"
else
    echo "❌ PostgreSQL database is not running"
    exit 1
fi

# Check FastAPI Docker service
if docker ps | grep -q nlj_api; then
    echo "✅ FastAPI Docker service is running"
else
    echo "❌ FastAPI Docker service failed to start"
    docker ps -a | grep nlj_api
    exit 1
fi

# Check nginx
if sudo systemctl is-active --quiet nginx; then
    echo "✅ nginx is running"
else
    echo "❌ nginx failed to start"
    sudo systemctl status nginx
    exit 1
fi

echo "🎉 Deployment completed successfully!"
echo "🌐 Site available at: https://callcoach.training"
echo "📖 API docs at: https://callcoach.training/api/docs"