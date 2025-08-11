#!/bin/bash

echo "🗄️  Setting up LocalStack RDS PostgreSQL instance..."

# Wait for LocalStack RDS to be available
echo "⏳ Waiting for LocalStack RDS service..."
until curl -s http://localhost:4566/_localstack/health | grep -q '"rds": "available"'; do
    echo "   Waiting for RDS to be available..."
    sleep 3
done

echo "✅ LocalStack RDS service is ready!"

# Create the RDS PostgreSQL instance (simplified for LocalStack)
echo "🚀 Creating RDS PostgreSQL instance..."
awslocal rds create-db-instance \
    --db-instance-identifier nlj-postgres-dev \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --engine-version 15.4 \
    --master-username nlj_admin \
    --master-user-password nlj_secure_password_2024 \
    --allocated-storage 20 \
    --db-name nlj_platform \
    --backup-retention-period 0 \
    --no-multi-az \
    --publicly-accessible \
    --no-auto-minor-version-upgrade \
    --no-deletion-protection

# Wait for RDS instance to be available
echo "⏳ Waiting for RDS instance to become available..."
awslocal rds wait db-instance-available --db-instance-identifier nlj-postgres-dev

# Get RDS endpoint
echo "🔍 Getting RDS endpoint information..."
RDS_ENDPOINT=$(awslocal rds describe-db-instances \
    --db-instance-identifier nlj-postgres-dev \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text)

RDS_PORT=$(awslocal rds describe-db-instances \
    --db-instance-identifier nlj-postgres-dev \
    --query 'DBInstances[0].Endpoint.Port' \
    --output text)

echo "✅ RDS PostgreSQL instance created successfully!"
echo "📋 Connection Details:"
echo "   Endpoint: $RDS_ENDPOINT"
echo "   Port: $RDS_PORT"
echo "   Database: nlj_platform"
echo "   Username: nlj_admin"
echo "   Password: nlj_secure_password_2024"
echo ""
echo "🔗 Connection String:"
echo "   postgresql+asyncpg://nlj_admin:nlj_secure_password_2024@$RDS_ENDPOINT:$RDS_PORT/nlj_platform"

echo "🎉 LocalStack RDS PostgreSQL setup complete!"