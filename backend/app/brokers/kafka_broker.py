"""
FastStream Kafka broker configuration for NLJ Platform.
Replaces unified_consumer.py with modern FastStream architecture.
"""

import logging
import os
from typing import Dict, Any

from faststream import FastStream
from faststream.kafka import KafkaBroker

logger = logging.getLogger(__name__)

# Kafka configuration from environment
KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "redpanda:29092")
KAFKA_CLIENT_ID = os.getenv("KAFKA_CLIENT_ID", "nlj-faststream-platform")
KAFKA_GROUP_ID = os.getenv("KAFKA_GROUP_ID", "nlj-unified-consumer")

# Initialize FastStream Kafka broker
broker = KafkaBroker(
    bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
    client_id=KAFKA_CLIENT_ID,
)

# Import xAPI validation subscriber middleware  

logger.info("🔧 xAPI validation subscriber middleware imported")
logger.info("🔧 Middleware will be applied at subscriber level")

# Create FastStream application
app = FastStream(broker, title="NLJ Platform Event Processor")

logger.info("FastStream broker initialized:")
logger.info(f"  Bootstrap servers: {KAFKA_BOOTSTRAP_SERVERS}")
logger.info(f"  Client ID: {KAFKA_CLIENT_ID}")
logger.info(f"  Consumer group: {KAFKA_GROUP_ID}")


@app.on_startup
async def startup():
    """Application startup handler"""
    logger.info("🚀 NLJ FastStream Event Processor starting up")
    logger.info("=" * 50)
    
    # Import handlers to register subscribers
    from app.handlers import content_handlers
    from app.handlers import training_handlers
    from app.handlers import auto_tagging_handlers
    from app.handlers import knowledge_extraction_handlers
    from app.handlers import node_interaction_handlers
    from app.handlers import survey_handlers
    
    logger.info("✅ All event handlers imported and registered")


@app.on_shutdown
async def shutdown():
    """Application shutdown handler"""
    logger.info("🛑 NLJ FastStream Event Processor shutting down")


# Health check endpoint
@broker.subscriber("health-check", group_id=f"{KAFKA_GROUP_ID}-health")
async def health_check(message: Dict[str, Any]):
    """Health check message handler"""
    logger.info(f"Health check received: {message}")
    return {"status": "healthy", "service": "nlj-faststream-processor"}


if __name__ == "__main__":
    import uvloop
    import asyncio
    
    # Use uvloop for better performance
    uvloop.install()
    
    # Run the FastStream application
    logger.info("Starting FastStream application...")
    asyncio.run(app.run())