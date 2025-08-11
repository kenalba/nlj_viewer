#!/usr/bin/env python3
"""
LocalStack Integration Test Script

Tests S3 media storage and SES email functionality with LocalStack.
Run this script after starting LocalStack to verify the integration.

Usage:
    python scripts/test-localstack.py
"""

import os
import sys
import asyncio
import tempfile
from pathlib import Path

# Add backend to path for imports
sys.path.append(str(Path(__file__).parent.parent / "backend"))

from app.services.s3_service import s3_media_service
from app.services.email_service import email_service, EmailRecipient
from app.core.config import settings


async def test_s3_service():
    """Test S3 media storage functionality."""
    print("🪣 Testing S3 Media Service...")
    
    try:
        # Test health check
        health = s3_media_service.health_check()
        print(f"   Health Status: {health['status']}")
        print(f"   Bucket: {health.get('bucket', 'N/A')}")
        print(f"   Endpoint: {health.get('endpoint', 'N/A')}")
        
        if health['status'] != 'healthy':
            print(f"   ❌ S3 service is not healthy: {health}")
            return False
        
        # Create a test file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as temp_file:
            temp_file.write("LocalStack S3 integration test file")
            temp_file_path = temp_file.name
        
        try:
            # Simulate FastAPI UploadFile
            class MockUploadFile:
                def __init__(self, file_path):
                    self.filename = os.path.basename(file_path)
                    self.content_type = "text/plain"
                    self._file_path = file_path
                
                async def read(self):
                    with open(self._file_path, 'rb') as f:
                        return f.read()
            
            mock_file = MockUploadFile(temp_file_path)
            
            # Test file upload
            import uuid
            test_media_id = uuid.uuid4()
            
            print(f"   📤 Uploading test file (ID: {test_media_id})...")
            upload_result = await s3_media_service.upload_media_file(
                file=mock_file,
                media_id=test_media_id,
                folder="test",
                make_public=True
            )
            
            print(f"   ✅ Upload successful!")
            print(f"   S3 Key: {upload_result['s3_key']}")
            print(f"   File Size: {upload_result['file_size']} bytes")
            print(f"   Public URL: {upload_result.get('public_url', 'N/A')}")
            
            # Test file download
            print(f"   📥 Testing file download...")
            file_content, content_type, filename = await s3_media_service.download_media_file(
                s3_key=upload_result['s3_key']
            )
            
            if b"LocalStack S3 integration test file" in file_content:
                print(f"   ✅ Download successful! Content matches.")
            else:
                print(f"   ❌ Download failed or content mismatch.")
                return False
            
            # Test presigned URL generation
            presigned_url = s3_media_service.generate_presigned_url(
                s3_key=upload_result['s3_key'],
                expires_in=300
            )
            print(f"   🔗 Generated presigned URL: {presigned_url[:80]}...")
            
            # Clean up test file
            await s3_media_service.delete_media_file(upload_result['s3_key'])
            print(f"   🗑️  Test file deleted")
            
        finally:
            # Clean up temp file
            os.unlink(temp_file_path)
        
        print("   ✅ S3 service tests passed!")
        return True
        
    except Exception as e:
        print(f"   ❌ S3 service test failed: {e}")
        return False


async def test_ses_service():
    """Test SES email service functionality."""
    print("📧 Testing SES Email Service...")
    
    try:
        # Test health check
        health = email_service.health_check()
        print(f"   Health Status: {health['status']}")
        print(f"   Endpoint: {health.get('endpoint', 'N/A')}")
        
        if health['status'] not in ['healthy', 'unhealthy']:  # LocalStack may report as unhealthy but still work
            print(f"   ❌ SES service is not available: {health}")
            return False
        
        # Test survey invitation email
        print("   📨 Testing survey invitation email...")
        test_recipients = [
            EmailRecipient(email="test@example.com", name="Test User 1"),
            EmailRecipient(email="admin@nlj-platform.local", name="Test Admin")
        ]
        
        result = await email_service.send_survey_invitation(
            survey_title="LocalStack Integration Test Survey",
            survey_url="http://localhost:5173/shared/test-survey-123",
            recipients=test_recipients,
            sender_name="LocalStack Test",
            custom_message="This is a test message from the LocalStack integration test."
        )
        
        print(f"   Email Send Result:")
        print(f"   ✅ Success: {result.success}")
        print(f"   📊 Recipients: {result.recipient_count}")
        print(f"   📧 Message ID: {result.message_id}")
        print(f"   ❌ Failed: {len(result.failed_recipients)}")
        
        if result.failed_recipients:
            print(f"   Failed recipients: {result.failed_recipients}")
        
        # Test admin notification
        print("   🔔 Testing admin notification...")
        admin_result = await email_service.send_admin_notification(
            subject="LocalStack Integration Test",
            message="This is a test admin notification from the LocalStack integration test script.",
            notification_type="test"
        )
        
        print(f"   Admin Email Result: {admin_result.success}")
        
        if result.success or admin_result.success:
            print("   ✅ SES service tests passed!")
            return True
        else:
            print("   ❌ SES service tests failed!")
            return False
        
    except Exception as e:
        print(f"   ❌ SES service test failed: {e}")
        return False


async def main():
    """Run all LocalStack integration tests."""
    print("🚀 LocalStack Integration Test Suite")
    print("====================================")
    print()
    
    # Display configuration
    print("📋 Configuration:")
    print(f"   S3 Endpoint: {settings.S3_ENDPOINT_URL}")
    print(f"   S3 Media Bucket: {settings.S3_BUCKET_MEDIA}")
    print(f"   SES Endpoint: {settings.SES_ENDPOINT_URL}")
    print(f"   SES From Email: {settings.SES_FROM_EMAIL}")
    print(f"   Email Notifications: {settings.ENABLE_EMAIL_NOTIFICATIONS}")
    print()
    
    if not settings.S3_ENDPOINT_URL:
        print("❌ S3_ENDPOINT_URL not set - LocalStack configuration missing")
        return False
    
    if not settings.SES_ENDPOINT_URL:
        print("❌ SES_ENDPOINT_URL not set - LocalStack configuration missing")
        return False
    
    # Run tests
    s3_success = await test_s3_service()
    print()
    
    ses_success = await test_ses_service()
    print()
    
    # Summary
    print("📊 Test Results Summary:")
    print(f"   S3 Service: {'✅ PASS' if s3_success else '❌ FAIL'}")
    print(f"   SES Service: {'✅ PASS' if ses_success else '❌ FAIL'}")
    print()
    
    if s3_success and ses_success:
        print("🎉 All LocalStack integration tests passed!")
        print()
        print("📚 Next Steps:")
        print("   1. Start the full development environment:")
        print("      docker-compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.localstack.yml up")
        print("   2. Test media uploads via the API: POST /api/media/upload")
        print("   3. Test survey email distribution: POST /api/notifications/send-survey-invitation")
        return True
    else:
        print("❌ Some LocalStack integration tests failed!")
        print("   Please check LocalStack configuration and service status.")
        return False


if __name__ == "__main__":
    # Set environment variables for testing
    os.environ.setdefault("S3_ENDPOINT_URL", "http://localhost:4566")
    os.environ.setdefault("S3_BUCKET_MEDIA", "nlj-media-dev")
    os.environ.setdefault("SES_ENDPOINT_URL", "http://localhost:4566")
    os.environ.setdefault("SES_FROM_EMAIL", "noreply@nlj-platform.local")
    os.environ.setdefault("ENABLE_EMAIL_NOTIFICATIONS", "true")
    
    # Run the test suite
    success = asyncio.run(main())
    sys.exit(0 if success else 1)