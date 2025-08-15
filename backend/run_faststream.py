#!/usr/bin/env python3
"""
FastStream Application Runner
Starts the NLJ Platform FastStream event processor.
"""

import asyncio
import logging
import sys
import uvloop
from pathlib import Path

# Add backend to Python path
sys.path.append(str(Path(__file__).parent))

# Import FastStream app
from app.brokers.kafka_broker import app

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


async def main():
    """Run FastStream application with uvloop for better performance"""
    logger.info("Starting NLJ FastStream Event Processor...")
    logger.info("=" * 50)
    
    try:
        # Run FastStream application
        await app.run()
    except KeyboardInterrupt:
        logger.info("Received shutdown signal, stopping...")
    except Exception as e:
        logger.error(f"FastStream application error: {e}")
        raise
    finally:
        logger.info("FastStream application stopped")


if __name__ == "__main__":
    # Install uvloop for better async performance
    uvloop.install()
    
    # Run the application
    asyncio.run(main())