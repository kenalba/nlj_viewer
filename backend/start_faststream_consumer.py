#!/usr/bin/env python3
"""
FastStream consumer startup script.
Runs the content generation event handlers in the background.
"""

import asyncio
import logging
import signal
import sys
from app.brokers.kafka_broker import broker

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global flag for graceful shutdown
shutdown_flag = False

def signal_handler(signum, frame):
    """Handle shutdown signals."""
    global shutdown_flag
    logger.info(f"Received signal {signum}, starting graceful shutdown...")
    shutdown_flag = True

async def main():
    """Main consumer loop."""
    global shutdown_flag
    
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    logger.info("🚀 Starting FastStream content generation consumer...")
    
    try:
        # Start the broker
        await broker.start()
        logger.info("✅ FastStream consumer started successfully")
        
        # Keep running until shutdown signal
        while not shutdown_flag:
            await asyncio.sleep(1)
            
    except Exception as e:
        logger.error(f"❌ Error running FastStream consumer: {e}")
        sys.exit(1)
    finally:
        logger.info("🔌 Shutting down FastStream consumer...")
        try:
            await broker.close()
            logger.info("✅ FastStream consumer stopped gracefully")
        except Exception as e:
            logger.error(f"❌ Error during shutdown: {e}")

if __name__ == "__main__":
    asyncio.run(main())