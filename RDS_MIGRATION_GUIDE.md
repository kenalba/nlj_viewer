# 🗄️ NLJ Platform RDS Migration Guide

Complete guide for migrating from direct PostgreSQL to AWS RDS using LocalStack for development parity.

## 📋 Overview

This migration provides:
- **Development/Production Parity**: Identical RDS APIs in development and production
- **Backup & Restore**: Automated snapshot management and disaster recovery testing
- **Connection Pooling**: RDS proxy simulation for scalable connection management
- **Monitoring**: CloudWatch-like metrics and performance insights
- **Security**: VPC, security groups, and encryption testing

## 🚀 Quick Start

### Option 1: Fresh RDS Setup (Recommended)
```bash
# Start complete LocalStack environment with RDS
./scripts/start-localstack-rds.sh --migrate

# This will:
# 1. Start all LocalStack services (S3, SES, RDS)
# 2. Create PostgreSQL RDS instance
# 3. Migrate existing data to RDS
# 4. Configure application to use RDS
```

### Option 2: Manual Step-by-Step Migration
```bash
# 1. Start LocalStack with RDS
docker-compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.localstack.yml -f docker-compose.rds.yml up -d

# 2. Wait for services to initialize (2-3 minutes)
docker-compose logs -f localstack

# 3. Test LocalStack RDS integration
python3 scripts/test-rds-integration.py

# 4. Migrate existing data
python3 scripts/migrate-to-rds.py

# 5. Verify migration
python3 scripts/migrate-to-rds.py --validate-only
```

## 📊 Available Services

### 🌐 Web Interfaces
- **Frontend**: http://localhost:5173
- **API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs  
- **LocalStack Dashboard**: http://localhost:4566
- **Kafka UI**: http://localhost:8080

### 🗄️ Database Management
- **RDS Status**: `curl http://localhost:8000/api/database/status`
- **Create Snapshot**: `curl -X POST http://localhost:8000/api/database/snapshots`
- **List Snapshots**: `curl http://localhost:8000/api/database/snapshots`
- **Connection Info**: `curl http://localhost:8000/api/database/connection-info`

### 📧 Email Services
- **Email Health**: `curl http://localhost:8000/api/notifications/health`
- **Send Survey**: `curl -X POST http://localhost:8000/api/notifications/send-survey-invitation`

## 🔧 Configuration

### Environment Variables

#### Development with RDS (`.env` for backend)
```bash
# Enable RDS mode
USE_RDS=true
RDS_ENDPOINT_URL=http://localhost:4566
RDS_DB_INSTANCE_ID=nlj-postgres-dev

# LocalStack AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# S3 Configuration
S3_ENDPOINT_URL=http://localhost:4566
S3_BUCKET_MEDIA=nlj-media-dev

# SES Configuration  
SES_ENDPOINT_URL=http://localhost:4566
SES_FROM_EMAIL=noreply@nlj-platform.local
ENABLE_EMAIL_NOTIFICATIONS=true

# Database URL (auto-resolved from RDS)
DATABASE_URL=postgresql+asyncpg://nlj_admin:nlj_secure_password_2024@localhost:5432/nlj_platform
```

#### Production with AWS RDS
```bash
# Enable RDS mode
USE_RDS=true
# RDS_ENDPOINT_URL not set (uses real AWS)
RDS_DB_INSTANCE_ID=nlj-postgres-prod

# Real AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# S3 Configuration
# S3_ENDPOINT_URL not set (uses real AWS)
S3_BUCKET_MEDIA=your-prod-bucket

# SES Configuration
# SES_ENDPOINT_URL not set (uses real AWS)
SES_FROM_EMAIL=noreply@yourdomain.com
```

### Docker Compose Configurations

#### S3 + SES Only (Keep PostgreSQL Container)
```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.localstack.yml up
```

#### Full LocalStack with RDS
```bash  
docker-compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.localstack.yml -f docker-compose.rds.yml up
```

## 🛠️ Management Operations

### Database Operations

#### Create Snapshot
```bash
# Via API
curl -X POST http://localhost:8000/api/database/snapshots \
  -H "Content-Type: application/json" \
  -d '{"snapshot_id": "manual-backup-20240101"}'

# Via CLI
python3 -c "
import asyncio
from backend.app.services.database_service import rds_database_service
asyncio.run(rds_database_service.create_snapshot('manual-backup-$(date +%Y%m%d)'))
"
```

#### Restore from Snapshot
```bash
# Via API (requires authentication)
curl -X POST http://localhost:8000/api/database/restore \
  -H "Content-Type: application/json" \
  -d '{
    "snapshot_id": "manual-backup-20240101",
    "new_instance_id": "nlj-postgres-restored",
    "instance_class": "db.t3.micro"
  }'
```

#### List All Snapshots
```bash
# Via API
curl http://localhost:8000/api/database/snapshots

# Via AWS CLI (LocalStack)
awslocal rds describe-db-snapshots --db-instance-identifier nlj-postgres-dev
```

### Data Migration Operations

#### Backup Current Database
```bash
# Create backup only (don't migrate)
python3 scripts/migrate-to-rds.py --backup-only
```

#### Full Migration  
```bash
# Complete migration with validation
python3 scripts/migrate-to-rds.py

# Migration steps:
# 1. Creates backup of current PostgreSQL
# 2. Waits for RDS instance to be available  
# 3. Migrates schema to RDS
# 4. Migrates data to RDS
# 5. Validates data integrity
# 6. Updates configuration files
```

#### Validate Existing Migration
```bash
# Check data integrity
python3 scripts/migrate-to-rds.py --validate-only
```

#### Restore from Existing Backup
```bash
# Restore data without creating new backup
python3 scripts/migrate-to-rds.py --restore-only
```

## 🧪 Testing & Validation

### Comprehensive Testing
```bash
# Full test suite (5-10 minutes)
python3 scripts/test-rds-integration.py

# Quick tests only (1-2 minutes)
python3 scripts/test-rds-integration.py --quick

# API endpoints only (30 seconds)
python3 scripts/test-rds-integration.py --api-only
```

### Individual Service Testing
```bash
# Test all LocalStack services
python3 scripts/test-localstack.py

# Test RDS service health
curl http://localhost:4566/_localstack/health | jq '.services.rds'

# Test database connection
python3 -c "
import asyncio
from backend.app.services.database_service import rds_database_service
result = asyncio.run(rds_database_service.get_connection_info())
print('Available:', result['available'])
print('Host:', result.get('host'))
"
```

## 📊 Monitoring & Debugging

### Service Health Checks
```bash
# LocalStack service status
curl http://localhost:4566/_localstack/health

# NLJ API health
curl http://localhost:8000/health

# Database service health
curl http://localhost:8000/api/database/health

# Email service health
curl http://localhost:8000/api/notifications/health
```

### Log Investigation
```bash
# LocalStack logs
docker-compose logs localstack

# NLJ API logs
docker-compose logs nlj-api

# All services logs
docker-compose logs

# Follow logs in real-time
docker-compose logs -f localstack
```

### RDS Instance Information
```bash
# Instance status
curl http://localhost:8000/api/database/status

# Connection information  
curl http://localhost:8000/api/database/connection-info

# Available snapshots
curl http://localhost:8000/api/database/snapshots

# Read replica info (if available)
curl http://localhost:8000/api/database/replica-info
```

## 🔄 Migration Scenarios

### Scenario 1: Fresh Development Setup
```bash
# Start with RDS from the beginning
./scripts/start-localstack-rds.sh

# No migration needed - starts with empty RDS
# Run your normal database migrations/seeders
```

### Scenario 2: Existing Data Migration
```bash
# Start RDS and migrate existing PostgreSQL data  
./scripts/start-localstack-rds.sh --migrate

# This preserves all existing data
```

### Scenario 3: Rollback to Direct PostgreSQL
```bash
# Stop RDS setup
docker-compose down

# Start without RDS override
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Update backend/.env to remove USE_RDS=true
```

### Scenario 4: Hybrid Setup (RDS + Direct PostgreSQL)
```bash
# Keep both running for comparison/testing
# RDS on port 5432 (through LocalStack)
# Direct PostgreSQL on port 5433 (custom port)

# Modify docker-compose.yml PostgreSQL service:
# ports:
#   - "5433:5432"
```

## 🚨 Troubleshooting

### Common Issues

#### RDS Instance Not Starting
```bash
# Check LocalStack logs
docker-compose logs localstack

# Verify RDS service enabled  
curl http://localhost:4566/_localstack/health | jq '.services.rds'

# Restart LocalStack
docker-compose restart localstack

# Check RDS initialization
docker-compose exec localstack cat /etc/localstack/init/ready.d/02-init-rds.sh
```

#### Connection Failures
```bash
# Test RDS connection
python3 -c "
import asyncio, asyncpg
async def test():
    try:
        conn = await asyncpg.connect('postgresql://nlj_admin:nlj_secure_password_2024@localhost:4566/nlj_platform')
        result = await conn.fetchval('SELECT 1')
        print('Connection successful:', result)
        await conn.close()
    except Exception as e:
        print('Connection failed:', e)
asyncio.run(test())
"

# Check if port is correct (LocalStack RDS might use different port)
netstat -tulpn | grep 4566
```

#### Migration Failures
```bash
# Create manual backup first
python3 scripts/migrate-to-rds.py --backup-only

# Check backup file
ls -la backups/

# Try restore only
python3 scripts/migrate-to-rds.py --restore-only

# Validate data integrity  
python3 scripts/migrate-to-rds.py --validate-only
```

#### API Authentication Issues
```bash
# Some endpoints require authentication
# Get token from login endpoint first:
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "your-password"}'

# Use token in subsequent requests:
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/database/status
```

### Performance Issues

#### Slow RDS Startup
```bash
# RDS instances take time to initialize
# Monitor progress:
watch -n 5 'curl -s http://localhost:8000/api/database/status | jq .'

# Increase startup timeout in docker-compose.rds.yml:
# healthcheck:
#   start_period: 120s  # Increase from 60s
```

#### Memory Issues
```bash
# LocalStack + RDS can use significant memory
# Monitor usage:
docker stats

# Reduce LocalStack services if needed:
# SERVICES=rds  # Only RDS, disable S3,SES temporarily
```

## 🎯 Production Deployment

### AWS RDS Migration

#### 1. Create Production RDS Instance
```bash
aws rds create-db-instance \
  --db-instance-identifier nlj-postgres-prod \
  --db-instance-class db.t3.small \
  --engine postgres \
  --engine-version 15.4 \
  --master-username nlj_admin \
  --master-user-password YOUR_SECURE_PASSWORD \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-your-security-group \
  --db-subnet-group-name your-subnet-group
```

#### 2. Update Production Environment
```bash
# production.env
USE_RDS=true
RDS_DB_INSTANCE_ID=nlj-postgres-prod
AWS_REGION=us-east-1
# Remove _ENDPOINT_URL variables to use real AWS

# Update DATABASE_URL with production endpoint
DATABASE_URL=postgresql+asyncpg://nlj_admin:PASSWORD@your-rds-endpoint:5432/nlj_platform
```

#### 3. Data Migration to Production
```bash
# 1. Create backup from development
python3 scripts/migrate-to-rds.py --backup-only

# 2. Upload backup to S3
aws s3 cp backups/nlj_backup_*.sql s3://your-backup-bucket/

# 3. Restore to production RDS
# (Use AWS DMS or manual psql restore)
```

## 📚 Additional Resources

### Scripts Reference
- `scripts/start-localstack-rds.sh` - Complete RDS environment startup
- `scripts/migrate-to-rds.py` - Data migration tool
- `scripts/test-rds-integration.py` - Comprehensive testing
- `scripts/localstack-rds-init.sh` - RDS instance initialization
- `scripts/test-localstack.py` - Basic LocalStack testing

### API Documentation
- **Interactive API Docs**: http://localhost:8000/docs
- **Database APIs**: http://localhost:8000/docs#/database
- **Notification APIs**: http://localhost:8000/docs#/notifications

### LocalStack Documentation
- [LocalStack RDS Documentation](https://docs.localstack.cloud/user-guide/aws/rds/)
- [LocalStack Configuration](https://docs.localstack.cloud/references/configuration/)

---

## 🎉 Success! 

Your NLJ Platform now supports both development and production RDS deployments with complete feature parity. The same codebase works seamlessly with LocalStack for development and AWS RDS for production.

### Next Steps:
1. **Test your application** with the RDS setup
2. **Create regular snapshots** for backup testing  
3. **Monitor performance** using the provided endpoints
4. **Practice disaster recovery** using snapshot restore
5. **Plan production deployment** using the migration guide above

Happy developing with RDS! 🚀