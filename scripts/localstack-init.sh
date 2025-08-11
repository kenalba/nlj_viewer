#!/bin/bash

echo "🚀 Initializing LocalStack AWS services for NLJ Platform..."

# Wait for LocalStack to be ready
echo "⏳ Waiting for LocalStack to be ready..."
until curl -s http://localhost:4566/_localstack/health | grep -q '"s3": "available"'; do
    echo "   Waiting for S3 to be available..."
    sleep 2
done

until curl -s http://localhost:4566/_localstack/health | grep -q '"ses": "available"'; do
    echo "   Waiting for SES to be available..."
    sleep 2
done

echo "✅ LocalStack services are ready!"

# Create S3 buckets for media and backups
echo "🪣 Creating S3 buckets..."
awslocal s3 mb s3://nlj-media-dev
awslocal s3 mb s3://nlj-backups-dev

# Configure S3 bucket policy for public media access
echo "🔓 Setting up S3 bucket policies..."
awslocal s3api put-bucket-policy --bucket nlj-media-dev --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::nlj-media-dev/public/*"
    }
  ]
}'

# Configure CORS for S3 bucket (for frontend uploads)
awslocal s3api put-bucket-cors --bucket nlj-media-dev --cors-configuration '{
  "CORSRules": [
    {
      "AllowedOrigins": ["http://localhost:5173", "http://localhost:3000"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}'

# Configure SES for email notifications
echo "📧 Setting up SES email configuration..."
awslocal ses verify-email-identity --email-address noreply@nlj-platform.local
awslocal ses verify-email-identity --email-address admin@nlj-platform.local
awslocal ses verify-email-identity --email-address surveys@nlj-platform.local

# Create SES configuration set for tracking
awslocal ses create-configuration-set --configuration-set Name=nlj-email-tracking

# Optional: Create SNS topic for SMS notifications (future enhancement)
echo "📱 Creating SNS topic for future SMS support..."
awslocal sns create-topic --name nlj-sms-notifications

# List created resources
echo "🎉 LocalStack initialization complete!"
echo "📊 Created resources:"
echo "   S3 Buckets:"
awslocal s3 ls
echo "   SES Verified Emails:"
awslocal ses list-verified-email-addresses --query 'VerifiedEmailAddresses'
echo "   SNS Topics:"
awslocal sns list-topics --query 'Topics[].TopicArn'

echo "🌐 LocalStack Dashboard: http://localhost:4566/dashboard"
echo "📁 S3 Media Bucket URL: http://localhost:4566/nlj-media-dev"

# Check if RDS service is enabled
if curl -s http://localhost:4566/_localstack/health | grep -q '"rds": "available"'; then
    echo "🗄️  RDS service detected, initializing PostgreSQL..."
    
    # Run RDS initialization if available
    if [ -f "/etc/localstack/init/ready.d/02-init-rds.sh" ]; then
        echo "   Running RDS initialization script..."
        bash /etc/localstack/init/ready.d/02-init-rds.sh
    fi
fi

echo "✨ Ready for NLJ Platform development!"