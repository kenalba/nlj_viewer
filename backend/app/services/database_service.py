"""
Database service for managing RDS connections and operations.
Provides utilities for RDS management, backup, restore, and monitoring.
"""

import boto3
import asyncio
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from botocore.exceptions import ClientError

from app.core.config import settings

logger = logging.getLogger(__name__)


class RDSDatabaseService:
    """
    Service for managing RDS PostgreSQL instances through LocalStack or AWS.
    Provides backup, restore, monitoring, and connection management capabilities.
    """
    
    def __init__(self):
        """Initialize RDS client with LocalStack or AWS configuration."""
        try:
            self.rds_client = boto3.client(
                'rds',
                endpoint_url=settings.RDS_ENDPOINT_URL if hasattr(settings, 'RDS_ENDPOINT_URL') else None,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION
            )
            
            self.db_instance_id = getattr(settings, 'RDS_DB_INSTANCE_ID', 'nlj-postgres-dev')
            self.replica_instance_id = getattr(settings, 'RDS_REPLICA_INSTANCE_ID', 'nlj-postgres-replica')
            
            logger.info(f"RDSDatabaseService initialized for instance: {self.db_instance_id}")
            
        except Exception as e:
            logger.error(f"Failed to initialize RDSDatabaseService: {e}")
            raise
    
    async def get_instance_status(self, instance_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Get RDS instance status and metadata.
        
        Args:
            instance_id: RDS instance identifier (defaults to primary instance)
            
        Returns:
            Dictionary with instance status information
        """
        try:
            instance_id = instance_id or self.db_instance_id
            
            response = self.rds_client.describe_db_instances(
                DBInstanceIdentifier=instance_id
            )
            
            instance = response['DBInstances'][0]
            
            return {
                'instance_id': instance['DBInstanceIdentifier'],
                'status': instance['DBInstanceStatus'],
                'engine': instance['Engine'],
                'engine_version': instance['EngineVersion'],
                'instance_class': instance['DBInstanceClass'],
                'endpoint': {
                    'address': instance.get('Endpoint', {}).get('Address'),
                    'port': instance.get('Endpoint', {}).get('Port')
                },
                'allocated_storage': instance.get('AllocatedStorage'),
                'storage_type': instance.get('StorageType'),
                'multi_az': instance.get('MultiAZ'),
                'availability_zone': instance.get('AvailabilityZone'),
                'backup_retention_period': instance.get('BackupRetentionPeriod'),
                'created_time': instance.get('InstanceCreateTime'),
                'latest_restorable_time': instance.get('LatestRestorableTime')
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            logger.error(f"Failed to get RDS instance status: {error_code}")
            return {
                'instance_id': instance_id,
                'status': 'error',
                'error': error_code
            }
    
    async def create_snapshot(
        self,
        snapshot_id: Optional[str] = None,
        instance_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a manual snapshot of the RDS instance.
        
        Args:
            snapshot_id: Custom snapshot identifier (auto-generated if not provided)
            instance_id: RDS instance to snapshot (defaults to primary instance)
            
        Returns:
            Dictionary with snapshot information
        """
        try:
            instance_id = instance_id or self.db_instance_id
            
            if not snapshot_id:
                timestamp = datetime.utcnow().strftime('%Y%m%d-%H%M%S')
                snapshot_id = f"{instance_id}-manual-{timestamp}"
            
            logger.info(f"Creating RDS snapshot: {snapshot_id}")
            
            response = self.rds_client.create_db_snapshot(
                DBSnapshotIdentifier=snapshot_id,
                DBInstanceIdentifier=instance_id,
                Tags=[
                    {'Key': 'Environment', 'Value': 'development'},
                    {'Key': 'Project', 'Value': 'nlj-platform'},
                    {'Key': 'Type', 'Value': 'manual'},
                    {'Key': 'CreatedBy', 'Value': 'database-service'}
                ]
            )
            
            snapshot = response['DBSnapshot']
            
            return {
                'snapshot_id': snapshot['DBSnapshotIdentifier'],
                'instance_id': snapshot['DBInstanceIdentifier'],
                'status': snapshot['Status'],
                'engine': snapshot['Engine'],
                'allocated_storage': snapshot['AllocatedStorage'],
                'snapshot_create_time': snapshot.get('SnapshotCreateTime'),
                'availability_zone': snapshot.get('AvailabilityZone')
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            logger.error(f"Failed to create RDS snapshot: {error_code}")
            raise Exception(f"Snapshot creation failed: {error_code}")
    
    async def restore_from_snapshot(
        self,
        snapshot_id: str,
        new_instance_id: str,
        instance_class: str = "db.t3.micro"
    ) -> Dict[str, Any]:
        """
        Restore RDS instance from snapshot.
        
        Args:
            snapshot_id: Snapshot identifier to restore from
            new_instance_id: New instance identifier
            instance_class: Instance class for restored database
            
        Returns:
            Dictionary with restore operation information
        """
        try:
            logger.info(f"Restoring RDS instance {new_instance_id} from snapshot {snapshot_id}")
            
            response = self.rds_client.restore_db_instance_from_db_snapshot(
                DBInstanceIdentifier=new_instance_id,
                DBSnapshotIdentifier=snapshot_id,
                DBInstanceClass=instance_class,
                PubliclyAccessible=True,
                MultiAZ=False,
                AutoMinorVersionUpgrade=False,
                Tags=[
                    {'Key': 'Environment', 'Value': 'development'},
                    {'Key': 'Project', 'Value': 'nlj-platform'},
                    {'Key': 'Type', 'Value': 'restored'},
                    {'Key': 'SourceSnapshot', 'Value': snapshot_id}
                ]
            )
            
            instance = response['DBInstance']
            
            return {
                'instance_id': instance['DBInstanceIdentifier'],
                'status': instance['DBInstanceStatus'],
                'source_snapshot': snapshot_id,
                'engine': instance['Engine'],
                'instance_class': instance['DBInstanceClass'],
                'creation_time': instance.get('InstanceCreateTime')
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            logger.error(f"Failed to restore from snapshot: {error_code}")
            raise Exception(f"Restore failed: {error_code}")
    
    async def list_snapshots(
        self,
        instance_id: Optional[str] = None,
        max_records: int = 20
    ) -> List[Dict[str, Any]]:
        """
        List available snapshots for an RDS instance.
        
        Args:
            instance_id: RDS instance identifier (defaults to primary instance)
            max_records: Maximum number of snapshots to return
            
        Returns:
            List of snapshot information dictionaries
        """
        try:
            instance_id = instance_id or self.db_instance_id
            
            response = self.rds_client.describe_db_snapshots(
                DBInstanceIdentifier=instance_id,
                MaxRecords=max_records,
                SnapshotType='manual'  # Only manual snapshots
            )
            
            snapshots = []
            for snapshot in response.get('DBSnapshots', []):
                snapshots.append({
                    'snapshot_id': snapshot['DBSnapshotIdentifier'],
                    'instance_id': snapshot['DBInstanceIdentifier'],
                    'status': snapshot['Status'],
                    'engine': snapshot['Engine'],
                    'allocated_storage': snapshot['AllocatedStorage'],
                    'snapshot_create_time': snapshot.get('SnapshotCreateTime'),
                    'availability_zone': snapshot.get('AvailabilityZone')
                })
            
            # Sort by creation time (newest first)
            snapshots.sort(key=lambda x: x.get('snapshot_create_time') or datetime.min, reverse=True)
            
            return snapshots
            
        except ClientError as e:
            logger.error(f"Failed to list snapshots: {e}")
            return []
    
    async def get_connection_info(self, instance_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Get database connection information for application configuration.
        
        Args:
            instance_id: RDS instance identifier (defaults to primary instance)
            
        Returns:
            Dictionary with connection details
        """
        try:
            status = await self.get_instance_status(instance_id)
            
            if status['status'] != 'available':
                return {
                    'available': False,
                    'status': status['status'],
                    'error': f"Instance not available: {status['status']}"
                }
            
            endpoint = status['endpoint']
            
            # Translate localhost to localstack for container networking
            host = endpoint['address']
            if host == 'localhost' and settings.RDS_ENDPOINT_URL and 'localstack' in settings.RDS_ENDPOINT_URL:
                host = 'localstack'
            
            return {
                'available': True,
                'host': host,
                'port': endpoint['port'],
                'database': 'nlj_platform',  # Default database name
                'username': 'nlj_admin',     # From RDS setup
                'connection_string': f"postgresql+asyncpg://nlj_admin:nlj_secure_password_2024@{host}:{endpoint['port']}/nlj_platform?ssl=disable",
                'instance_id': status['instance_id'],
                'engine_version': status['engine_version']
            }
            
        except Exception as e:
            logger.error(f"Failed to get connection info: {e}")
            return {
                'available': False,
                'error': str(e)
            }
    
    async def get_replica_info(self) -> Optional[Dict[str, Any]]:
        """Get read replica connection information."""
        try:
            replica_status = await self.get_instance_status(self.replica_instance_id)
            
            if replica_status['status'] == 'available':
                endpoint = replica_status['endpoint']
                
                # Translate localhost to localstack for container networking
                host = endpoint['address']
                if host == 'localhost' and settings.RDS_ENDPOINT_URL and 'localstack' in settings.RDS_ENDPOINT_URL:
                    host = 'localstack'
                
                return {
                    'available': True,
                    'host': host,
                    'port': endpoint['port'],
                    'connection_string': f"postgresql+asyncpg://nlj_admin:nlj_secure_password_2024@{host}:{endpoint['port']}/nlj_platform?ssl=disable",
                    'instance_id': replica_status['instance_id']
                }
            
            return None
            
        except Exception as e:
            logger.warning(f"Read replica not available: {e}")
            return None
    
    def health_check(self) -> Dict[str, Any]:
        """
        Perform health check on RDS service.
        
        Returns:
            Health status dictionary
        """
        try:
            # Try to describe the primary instance
            response = self.rds_client.describe_db_instances(
                DBInstanceIdentifier=self.db_instance_id
            )
            
            instance = response['DBInstances'][0]
            
            return {
                'status': 'healthy',
                'service': 'RDSDatabaseService',
                'instance_status': instance['DBInstanceStatus'],
                'endpoint': getattr(settings, 'RDS_ENDPOINT_URL', None) or 'AWS RDS',
                'instance_id': self.db_instance_id,
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            return {
                'status': 'unhealthy',
                'service': 'RDSDatabaseService',
                'error': error_code,
                'timestamp': datetime.utcnow().isoformat()
            }
        except Exception as e:
            return {
                'status': 'error',
                'service': 'RDSDatabaseService',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }


# Global service instance
rds_database_service = RDSDatabaseService()