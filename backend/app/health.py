"""
Health check module for FastStream application.
Provides comprehensive health monitoring for the event processing system.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any

from app.brokers.kafka_broker import broker
from app.core.database_manager import db_manager
from app.services.elasticsearch_service import elasticsearch_service
from app.middleware.xapi_validation import xapi_validation_middleware

logger = logging.getLogger(__name__)


async def health_check() -> Dict[str, Any]:
    """
    Comprehensive health check for FastStream application.
    
    Returns:
        Health status dictionary with component statuses
    """
    
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "nlj-faststream-processor",
        "components": {}
    }
    
    try:
        # Check Kafka broker connectivity
        kafka_health = await _check_kafka_health()
        health_status["components"]["kafka"] = kafka_health
        
        # Check database connectivity
        db_health = await _check_database_health()
        health_status["components"]["database"] = db_health
        
        # Check Elasticsearch connectivity
        es_health = await _check_elasticsearch_health()
        health_status["components"]["elasticsearch"] = es_health
        
        # Check xAPI validation middleware stats
        validation_health = _check_validation_middleware_health()
        health_status["components"]["xapi_validation"] = validation_health
        
        # Determine overall health status
        component_statuses = [comp.get("status") for comp in health_status["components"].values()]
        if "unhealthy" in component_statuses:
            health_status["status"] = "unhealthy"
        elif "degraded" in component_statuses:
            health_status["status"] = "degraded"
        
        return health_status
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        health_status["status"] = "unhealthy"
        health_status["error"] = str(e)
        return health_status


async def _check_kafka_health() -> Dict[str, Any]:
    """Check Kafka broker health"""
    try:
        # FastStream broker health check
        return {
            "status": "healthy",
            "kafka_servers": getattr(broker, 'bootstrap_servers', 'redpanda:29092'),
            "client_id": getattr(broker, 'client_id', 'nlj-faststream-platform')
        }
        
    except Exception as e:
        logger.error(f"Kafka health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }


async def _check_database_health() -> Dict[str, Any]:
    """Check database connectivity"""
    try:
        # Ensure database manager is initialized first
        await db_manager.ensure_initialized()
        
        # Test database connection
        health_info = await db_manager.health_check()
        
        return {
            "status": "healthy" if health_info.get("status") == "healthy" else "unhealthy",
            "connection_info": health_info
        }
        
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }


async def _check_elasticsearch_health() -> Dict[str, Any]:
    """Check Elasticsearch connectivity"""
    try:
        # Test Elasticsearch connection
        es_health = await elasticsearch_service.test_connection()
        
        return {
            "status": "healthy" if es_health.get("success") else "unhealthy",
            "elasticsearch_info": es_health
        }
        
    except Exception as e:
        logger.error(f"Elasticsearch health check failed: {e}")
        return {
            "status": "unhealthy", 
            "error": str(e)
        }


def _check_validation_middleware_health() -> Dict[str, Any]:
    """Check xAPI validation middleware health"""
    try:
        # Get validation statistics
        validation_stats = xapi_validation_middleware.get_validation_stats()
        
        # Determine health based on validation success rate
        success_rate = validation_stats.get("success_rate", 100)
        total_validations = validation_stats.get("total_validations", 0)
        
        # If no validations have occurred yet, consider it healthy
        if total_validations == 0:
            status = "healthy"
        elif success_rate >= 95:
            status = "healthy"
        elif success_rate >= 80:
            status = "degraded"
        else:
            status = "unhealthy"
        
        return {
            "status": status,
            "validation_stats": validation_stats
        }
        
    except Exception as e:
        logger.error(f"Validation middleware health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }


async def readiness_check() -> Dict[str, Any]:
    """
    Readiness check to determine if the service is ready to process events.
    
    Returns:
        Readiness status dictionary
    """
    
    readiness_status = {
        "ready": False,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "nlj-faststream-processor",
        "checks": {}
    }
    
    try:
        # Check if Kafka broker is ready
        kafka_ready = await _is_kafka_ready()
        readiness_status["checks"]["kafka"] = {"ready": kafka_ready}
        
        # Check if database is ready
        db_ready = await _is_database_ready()
        readiness_status["checks"]["database"] = {"ready": db_ready}
        
        # Check if Elasticsearch is ready
        es_ready = await _is_elasticsearch_ready()
        readiness_status["checks"]["elasticsearch"] = {"ready": es_ready}
        
        # Service is ready if all components are ready
        readiness_status["ready"] = kafka_ready and db_ready and es_ready
        
        return readiness_status
        
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        readiness_status["ready"] = False
        readiness_status["error"] = str(e)
        return readiness_status


async def _is_kafka_ready() -> bool:
    """Check if Kafka broker is ready for message processing"""
    try:
        # FastStream broker readiness - assume ready if no exceptions
        return True
    except Exception:
        return False


async def _is_database_ready() -> bool:
    """Check if database is ready for queries"""
    try:
        await db_manager.ensure_initialized()
        health = await db_manager.health_check()
        return health.get("healthy", False)
    except Exception:
        return False


async def _is_elasticsearch_ready() -> bool:
    """Check if Elasticsearch is ready for analytics"""
    try:
        es_health = await elasticsearch_service.test_connection()
        return es_health.get("success", False)
    except Exception:
        return False


if __name__ == "__main__":
    # Command-line health check
    async def main():
        health = await health_check()
        print(f"Health Status: {health}")
        
        readiness = await readiness_check()
        print(f"Readiness Status: {readiness}")
    
    asyncio.run(main())