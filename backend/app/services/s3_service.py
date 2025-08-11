"""
S3 service for media storage using AWS S3 or LocalStack.
Provides a unified interface for media file operations with both local development and production support.
"""

import uuid
import os
import boto3
import hashlib
from typing import Optional, Dict, Any, BinaryIO
from datetime import datetime, timedelta
from io import BytesIO
from botocore.exceptions import ClientError, NoCredentialsError
from fastapi import UploadFile, HTTPException
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class S3MediaService:
    """
    S3-based media storage service that works with both AWS S3 and LocalStack.
    Handles file uploads, downloads, and management with proper error handling and security.
    """
    
    def __init__(self):
        """Initialize S3 client with LocalStack or AWS configuration."""
        try:
            self.s3_client = boto3.client(
                's3',
                endpoint_url=settings.S3_ENDPOINT_URL,  # None for AWS, http://localhost:4566 for LocalStack
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION
            )
            
            self.media_bucket = settings.S3_BUCKET_MEDIA
            self.backup_bucket = settings.S3_BUCKET_BACKUPS
            
            # Set public URL base (for LocalStack or CloudFront)
            if settings.S3_PUBLIC_URL_BASE:
                self.public_url_base = settings.S3_PUBLIC_URL_BASE
            elif settings.S3_ENDPOINT_URL:  # LocalStack
                self.public_url_base = f"{settings.S3_ENDPOINT_URL}/{self.media_bucket}"
            else:  # AWS S3
                self.public_url_base = f"https://{self.media_bucket}.s3.{settings.AWS_REGION}.amazonaws.com"
            
            logger.info(f"S3MediaService initialized with bucket: {self.media_bucket}")
            
        except Exception as e:
            logger.error(f"Failed to initialize S3MediaService: {e}")
            raise
    
    async def upload_media_file(
        self,
        file: UploadFile,
        media_id: uuid.UUID,
        folder: str = "uploads",
        make_public: bool = False
    ) -> Dict[str, Any]:
        """
        Upload a media file to S3 storage.
        
        Args:
            file: FastAPI UploadFile object
            media_id: Unique identifier for the media item
            folder: S3 folder/prefix for organization
            make_public: Whether to make the file publicly accessible
            
        Returns:
            Dictionary with file metadata and URLs
            
        Raises:
            HTTPException: If upload fails
        """
        try:
            # Generate unique S3 key
            file_extension = self._get_file_extension(file.filename, file.content_type)
            s3_key = f"{folder}/{media_id}{file_extension}"
            
            # If public, use public folder
            if make_public:
                s3_key = f"public/{folder}/{media_id}{file_extension}"
            
            # Read file content
            file_content = await file.read()
            file_size = len(file_content)
            
            # Calculate file hash for integrity
            file_hash = hashlib.md5(file_content).hexdigest()
            
            # Prepare upload metadata
            metadata = {
                'original_filename': file.filename or 'unknown',
                'content_type': file.content_type or 'application/octet-stream',
                'upload_timestamp': datetime.utcnow().isoformat(),
                'file_hash': file_hash,
                'media_id': str(media_id)
            }
            
            # Upload to S3
            self.s3_client.upload_fileobj(
                BytesIO(file_content),
                self.media_bucket,
                s3_key,
                ExtraArgs={
                    'ContentType': file.content_type or 'application/octet-stream',
                    'Metadata': metadata,
                    'ACL': 'public-read' if make_public else 'private'
                }
            )
            
            # Generate URLs
            public_url = f"{self.public_url_base}/{s3_key}" if make_public else None
            presigned_url = self.generate_presigned_url(s3_key, expires_in=3600)
            
            logger.info(f"Successfully uploaded media file: {s3_key} (size: {file_size} bytes)")
            
            return {
                'file_id': str(media_id),
                'original_filename': file.filename,
                'content_type': file.content_type,
                'file_size': file_size,
                's3_key': s3_key,
                'bucket': self.media_bucket,
                'public_url': public_url,
                'presigned_url': presigned_url,
                'file_hash': file_hash,
                'uploaded_at': datetime.utcnow().isoformat()
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            logger.error(f"AWS S3 error uploading file: {error_code} - {e}")
            raise HTTPException(status_code=500, detail=f"S3 upload failed: {error_code}")
        
        except Exception as e:
            logger.error(f"Failed to upload media file: {e}")
            raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    
    async def download_media_file(
        self,
        s3_key: str,
        as_attachment: bool = True
    ) -> tuple[bytes, str, str]:
        """
        Download a media file from S3.
        
        Args:
            s3_key: S3 object key
            as_attachment: Whether to return as downloadable attachment
            
        Returns:
            Tuple of (file_content, content_type, filename)
        """
        try:
            # Get object from S3
            response = self.s3_client.get_object(Bucket=self.media_bucket, Key=s3_key)
            
            file_content = response['Body'].read()
            content_type = response.get('ContentType', 'application/octet-stream')
            
            # Extract filename from metadata or S3 key
            metadata = response.get('Metadata', {})
            filename = metadata.get('original_filename') or os.path.basename(s3_key)
            
            return file_content, content_type, filename
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                raise HTTPException(status_code=404, detail="Media file not found")
            else:
                logger.error(f"S3 download error: {e}")
                raise HTTPException(status_code=500, detail="Failed to download file")
    
    async def delete_media_file(self, s3_key: str) -> bool:
        """
        Delete a media file from S3.
        
        Args:
            s3_key: S3 object key to delete
            
        Returns:
            True if successful, False otherwise
        """
        try:
            self.s3_client.delete_object(Bucket=self.media_bucket, Key=s3_key)
            logger.info(f"Successfully deleted media file: {s3_key}")
            return True
            
        except ClientError as e:
            logger.error(f"Failed to delete S3 object {s3_key}: {e}")
            return False
    
    def generate_presigned_url(
        self,
        s3_key: str,
        expires_in: int = 3600,
        method: str = 'get_object'
    ) -> str:
        """
        Generate a presigned URL for private file access.
        
        Args:
            s3_key: S3 object key
            expires_in: URL expiration time in seconds
            method: S3 operation ('get_object', 'put_object')
            
        Returns:
            Presigned URL string
        """
        try:
            url = self.s3_client.generate_presigned_url(
                method,
                Params={'Bucket': self.media_bucket, 'Key': s3_key},
                ExpiresIn=expires_in
            )
            return url
            
        except ClientError as e:
            logger.error(f"Failed to generate presigned URL for {s3_key}: {e}")
            raise HTTPException(status_code=500, detail="Failed to generate download URL")
    
    async def list_media_files(
        self,
        prefix: str = "",
        max_keys: int = 100
    ) -> list[Dict[str, Any]]:
        """
        List media files in S3 bucket with optional prefix filtering.
        
        Args:
            prefix: S3 key prefix for filtering
            max_keys: Maximum number of objects to return
            
        Returns:
            List of file metadata dictionaries
        """
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.media_bucket,
                Prefix=prefix,
                MaxKeys=max_keys
            )
            
            files = []
            for obj in response.get('Contents', []):
                # Get object metadata
                try:
                    head_response = self.s3_client.head_object(
                        Bucket=self.media_bucket,
                        Key=obj['Key']
                    )
                    metadata = head_response.get('Metadata', {})
                except:
                    metadata = {}
                
                files.append({
                    'key': obj['Key'],
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'].isoformat(),
                    'etag': obj['ETag'].strip('"'),
                    'original_filename': metadata.get('original_filename'),
                    'content_type': metadata.get('content_type'),
                    'media_id': metadata.get('media_id')
                })
            
            return files
            
        except ClientError as e:
            logger.error(f"Failed to list S3 objects: {e}")
            raise HTTPException(status_code=500, detail="Failed to list media files")
    
    async def backup_media_file(self, s3_key: str) -> bool:
        """
        Create a backup copy of a media file in the backup bucket.
        
        Args:
            s3_key: Original S3 key to backup
            
        Returns:
            True if backup successful
        """
        try:
            # Copy to backup bucket with timestamp
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            backup_key = f"backups/{timestamp}_{s3_key}"
            
            self.s3_client.copy_object(
                CopySource={'Bucket': self.media_bucket, 'Key': s3_key},
                Bucket=self.backup_bucket,
                Key=backup_key
            )
            
            logger.info(f"Successfully backed up {s3_key} to {backup_key}")
            return True
            
        except ClientError as e:
            logger.error(f"Failed to backup file {s3_key}: {e}")
            return False
    
    def _get_file_extension(self, filename: Optional[str], content_type: Optional[str]) -> str:
        """Extract file extension from filename or content type."""
        if filename and '.' in filename:
            return os.path.splitext(filename)[1].lower()
        
        # Map common content types to extensions
        content_type_map = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'image/svg+xml': '.svg',
            'audio/mpeg': '.mp3',
            'audio/wav': '.wav',
            'audio/ogg': '.ogg',
            'video/mp4': '.mp4',
            'video/mpeg': '.mpeg',
            'video/quicktime': '.mov',
            'application/pdf': '.pdf',
            'text/plain': '.txt',
            'application/json': '.json'
        }
        
        return content_type_map.get(content_type or '', '.bin')
    
    def health_check(self) -> Dict[str, Any]:
        """
        Perform health check on S3 service.
        
        Returns:
            Health status dictionary
        """
        try:
            # Try to list bucket contents (minimal operation)
            self.s3_client.head_bucket(Bucket=self.media_bucket)
            
            return {
                'status': 'healthy',
                'service': 'S3MediaService',
                'bucket': self.media_bucket,
                'endpoint': settings.S3_ENDPOINT_URL or 'AWS S3',
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            return {
                'status': 'unhealthy',
                'service': 'S3MediaService',
                'error': error_code,
                'timestamp': datetime.utcnow().isoformat()
            }
        except Exception as e:
            return {
                'status': 'error',
                'service': 'S3MediaService',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }


# Global service instance
s3_media_service = S3MediaService()