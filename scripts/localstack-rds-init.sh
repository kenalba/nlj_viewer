#!/bin/bash

echo "🗄️  Setting up LocalStack RDS PostgreSQL instance..."

# Wait for LocalStack RDS to be available
echo "⏳ Waiting for LocalStack RDS service..."
until curl -s http://localhost:4566/_localstack/health | grep -q '"rds": "available"'; do
    echo "   Waiting for RDS to be available..."
    sleep 3
done

echo "✅ LocalStack RDS service is ready!"

# Create RDS subnet group (required for RDS instances)
echo "🌐 Creating RDS subnet group..."
awslocal rds create-db-subnet-group \
    --db-subnet-group-name nlj-subnet-group \
    --db-subnet-group-description "NLJ Platform RDS subnet group" \
    --subnet-ids "subnet-12345" "subnet-67890" \
    --tags Key=Environment,Value=development Key=Project,Value=nlj-platform

# Create RDS parameter group for PostgreSQL customization
echo "⚙️  Creating RDS parameter group..."
awslocal rds create-db-parameter-group \
    --db-parameter-group-name nlj-postgres-params \
    --db-parameter-group-family postgres15 \
    --description "NLJ Platform PostgreSQL parameters"

# Set custom parameters for development
awslocal rds modify-db-parameter-group \
    --db-parameter-group-name nlj-postgres-params \
    --parameters ParameterName=shared_preload_libraries,ParameterValue="pg_stat_statements",ApplyMethod=pending-reboot \
    --parameters ParameterName=log_statement,ParameterValue=all,ApplyMethod=immediate \
    --parameters ParameterName=log_min_duration_statement,ParameterValue=100,ApplyMethod=immediate

# Create RDS security group
echo "🔒 Creating RDS security group..."
VPC_ID=$(awslocal ec2 describe-vpcs --query 'Vpcs[0].VpcId' --output text 2>/dev/null || echo "vpc-12345678")
SG_ID=$(awslocal ec2 create-security-group \
    --group-name nlj-rds-sg \
    --description "NLJ Platform RDS security group" \
    --vpc-id $VPC_ID \
    --query 'GroupId' --output text 2>/dev/null || echo "sg-12345678")

# Allow PostgreSQL access (port 5432)
awslocal ec2 authorize-security-group-ingress \
    --group-id $SG_ID \
    --protocol tcp \
    --port 5432 \
    --cidr 0.0.0.0/0 2>/dev/null || true

# Create the RDS PostgreSQL instance
echo "🚀 Creating RDS PostgreSQL instance..."
awslocal rds create-db-instance \
    --db-instance-identifier nlj-postgres-dev \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --engine-version 15.4 \
    --master-username nlj_admin \
    --master-user-password nlj_secure_password_2024 \
    --allocated-storage 20 \
    --storage-type gp2 \
    --db-name nlj_platform \
    --vpc-security-group-ids $SG_ID \
    --db-subnet-group-name nlj-subnet-group \
    --db-parameter-group-name nlj-postgres-params \
    --backup-retention-period 7 \
    --storage-encrypted \
    --multi-az false \
    --publicly-accessible true \
    --auto-minor-version-upgrade false \
    --deletion-protection false \
    --tags Key=Environment,Value=development Key=Project,Value=nlj-platform

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

# Create a read replica for testing (optional)
echo "🔄 Creating read replica for testing..."
awslocal rds create-db-instance-read-replica \
    --db-instance-identifier nlj-postgres-replica \
    --source-db-instance-identifier nlj-postgres-dev \
    --db-instance-class db.t3.micro \
    --publicly-accessible true \
    --auto-minor-version-upgrade false \
    --tags Key=Environment,Value=development Key=Type,Value=read-replica

# Create database snapshot for backup testing
echo "📸 Creating initial database snapshot..."
awslocal rds create-db-snapshot \
    --db-instance-identifier nlj-postgres-dev \
    --db-snapshot-identifier nlj-postgres-initial-snapshot

echo "🎉 LocalStack RDS PostgreSQL setup complete!"
echo ""
echo "📚 Available Resources:"
awslocal rds describe-db-instances --query 'DBInstances[].{ID:DBInstanceIdentifier,Status:DBInstanceStatus,Engine:Engine,Endpoint:Endpoint.Address}'
echo ""
echo "💡 Next Steps:"
echo "   1. Update your application configuration to use the RDS endpoint"
echo "   2. Run database migrations against the RDS instance"
echo "   3. Test backup and restore operations"