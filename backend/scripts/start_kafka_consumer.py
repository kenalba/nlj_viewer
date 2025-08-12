#!/usr/bin/env python3
"""
Start Kafka to Ralph LRS Consumer Service.
Processes xAPI events from Kafka topics and stores them in Ralph LRS.
"""

import asyncio
import logging
import signal
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.kafka_ralph_consumer import get_kafka_ralph_consumer

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


class KafkaConsumerService:
    """Main service to run Kafka consumer."""

    def __init__(self):
        self.consumer = None
        self.is_running = False

    async def start(self):
        """Start the Kafka consumer service."""
        try:
            logger.info("Starting Kafka Ralph LRS Consumer Service...")

            # Get consumer instance
            self.consumer = await get_kafka_ralph_consumer()

            # Start consuming
            await self.consumer.start_consuming()
            self.is_running = True

            logger.info("✅ Kafka Ralph LRS Consumer Service started successfully")

            # Keep running until shutdown
            while self.is_running:
                await asyncio.sleep(1)

        except Exception as e:
            logger.error(f"❌ Error in Kafka consumer service: {e}")
            raise
        finally:
            await self.stop()

    async def stop(self):
        """Stop the Kafka consumer service."""
        if self.consumer and self.is_running:
            logger.info("Stopping Kafka Ralph LRS Consumer Service...")
            await self.consumer.stop_consuming()
            self.is_running = False
            logger.info("✅ Kafka Ralph LRS Consumer Service stopped")


# Global service instance
service = KafkaConsumerService()


def signal_handler(signum, frame):
    """Handle shutdown signals."""
    logger.info(f"Received signal {signum}, shutting down...")
    service.is_running = False


async def main():
    """Main entry point."""
    # Set up signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        await service.start()
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt, shutting down...")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
