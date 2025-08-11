"""
Database management API endpoints for RDS operations.
Provides backup, restore, monitoring, and configuration management.
"""

from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from app.core.deps import get_current_user
from app.models.user import User
from app.services.database_service import rds_database_service
from app.utils.permissions import can_manage_system

router = APIRouter(prefix="/database", tags=["database"])


class DatabaseStatusResponse(BaseModel):
    """Database instance status information."""
    instance_id: str
    status: str
    engine: str
    engine_version: str
    endpoint: dict
    allocated_storage: Optional[int] = None
    availability_zone: Optional[str] = None
    multi_az: Optional[bool] = None


class SnapshotRequest(BaseModel):
    """Request model for creating database snapshots."""
    snapshot_id: Optional[str] = Field(None, description="Custom snapshot ID (auto-generated if not provided)")
    instance_id: Optional[str] = Field(None, description="RDS instance ID (defaults to primary)")


class SnapshotResponse(BaseModel):
    """Database snapshot information."""
    snapshot_id: str
    instance_id: str
    status: str
    engine: str
    allocated_storage: Optional[int] = None
    snapshot_create_time: Optional[datetime] = None


class RestoreRequest(BaseModel):
    """Request model for restoring from snapshot."""
    snapshot_id: str = Field(..., description="Snapshot ID to restore from")
    new_instance_id: str = Field(..., description="New instance identifier")
    instance_class: str = Field("db.t3.micro", description="Instance class for restored database")


class ConnectionInfoResponse(BaseModel):
    """Database connection information."""
    available: bool
    host: Optional[str] = None
    port: Optional[int] = None
    database: Optional[str] = None
    username: Optional[str] = None
    connection_string: Optional[str] = None
    instance_id: Optional[str] = None
    engine_version: Optional[str] = None
    error: Optional[str] = None


@router.get("/status", response_model=DatabaseStatusResponse)
async def get_database_status(
    instance_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Get RDS instance status and metadata.
    
    Requires system management permissions.
    """
    if not can_manage_system(current_user):
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions to view database status"
        )
    
    try:
        status = await rds_database_service.get_instance_status(instance_id)
        
        if status.get('error'):
            raise HTTPException(
                status_code=500,
                detail=f"Failed to get database status: {status['error']}"
            )
        
        return DatabaseStatusResponse(**status)
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database status check failed: {str(e)}"
        )


@router.post("/snapshots", response_model=SnapshotResponse)
async def create_snapshot(
    request: SnapshotRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Create a manual database snapshot.
    
    Creates a point-in-time backup of the specified RDS instance.
    """
    if not can_manage_system(current_user):
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions to create database snapshots"
        )
    
    try:
        # Create snapshot in background for large databases
        snapshot_info = await rds_database_service.create_snapshot(
            snapshot_id=request.snapshot_id,
            instance_id=request.instance_id
        )
        
        return SnapshotResponse(**snapshot_info)
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Snapshot creation failed: {str(e)}"
        )


@router.get("/snapshots", response_model=List[SnapshotResponse])
async def list_snapshots(
    instance_id: Optional[str] = None,
    max_records: int = 20,
    current_user: User = Depends(get_current_user)
):
    """
    List available database snapshots.
    
    Returns manual snapshots ordered by creation time (newest first).
    """
    if not can_manage_system(current_user):
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions to list database snapshots"
        )
    
    try:
        snapshots = await rds_database_service.list_snapshots(
            instance_id=instance_id,
            max_records=max_records
        )
        
        return [SnapshotResponse(**snapshot) for snapshot in snapshots]
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list snapshots: {str(e)}"
        )


@router.post("/restore")
async def restore_from_snapshot(
    request: RestoreRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Restore database from snapshot.
    
    Creates a new RDS instance from the specified snapshot.
    This operation runs in the background and can take several minutes.
    """
    if not can_manage_system(current_user):
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions to restore database"
        )
    
    try:
        # Start restore operation
        restore_info = await rds_database_service.restore_from_snapshot(
            snapshot_id=request.snapshot_id,
            new_instance_id=request.new_instance_id,
            instance_class=request.instance_class
        )
        
        return {
            "success": True,
            "message": f"Database restore initiated for instance: {request.new_instance_id}",
            "restore_info": restore_info
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database restore failed: {str(e)}"
        )


@router.get("/connection-info", response_model=ConnectionInfoResponse)
async def get_connection_info(
    instance_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Get database connection information.
    
    Returns connection details for application configuration.
    """
    if not can_manage_system(current_user):
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions to view database connection info"
        )
    
    try:
        connection_info = await rds_database_service.get_connection_info(instance_id)
        return ConnectionInfoResponse(**connection_info)
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get connection info: {str(e)}"
        )


@router.get("/replica-info", response_model=Optional[ConnectionInfoResponse])
async def get_replica_info(
    current_user: User = Depends(get_current_user)
):
    """
    Get read replica connection information.
    
    Returns connection details for read replica if available.
    """
    if not can_manage_system(current_user):
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions to view replica info"
        )
    
    try:
        replica_info = await rds_database_service.get_replica_info()
        
        if replica_info:
            return ConnectionInfoResponse(**replica_info)
        
        return None
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get replica info: {str(e)}"
        )


@router.get("/health")
async def get_database_health(
    current_user: User = Depends(get_current_user)
):
    """
    Get database service health status.
    
    Useful for monitoring and debugging RDS connectivity.
    """
    try:
        health_status = rds_database_service.health_check()
        
        return {
            "database_service": health_status,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        return {
            "database_service": {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
        }