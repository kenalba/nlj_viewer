#!/usr/bin/env python3
"""
DEFUNCT - OLD CONSUMER SERVICE

⚠️  THIS FILE IS NO LONGER USED ⚠️

This consumer has been replaced by unified_consumer.py which runs in the nlj_xapi_consumer container.
The unified consumer handles ALL event types including content generation, training, and surveys.

DO NOT USE THIS FILE - it only handles xAPI events, not content generation.

See: unified_consumer.py for the current implementation
Container: nlj_xapi_consumer (running unified_consumer.py)

---

OLD DESCRIPTION (for reference only):
Dedicated Kafka Consumer Service
Runs as a separate container to process xAPI events from RedPanda → Ralph LRS → ElasticSearch
"""

import asyncio
import json
import logging
import os
import signal
import sys
from pathlib import Path
from typing import Any, Dict

# Add backend to path
sys.path.append(str(Path(__file__).parent))

from aiokafka import AIOKafkaConsumer
from app.services.ralph_lrs_service import RalphLRSService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SurveyEventConsumer:
    """Dedicated consumer for survey xAPI events"""
    
    def __init__(self):
        self.bootstrap_servers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "redpanda:29092")
        self.ralph_service = RalphLRSService()
        self.consumer = None
        self.is_running = False
        
        # Topics to consume
        self.topics = ["nlj.survey.responses", "xapi-events"]
        
        logger.info(f"Consumer initialized for topics: {self.topics}")
        logger.info(f"Kafka servers: {self.bootstrap_servers}")
    
    async def start(self):
        """Start the consumer"""
        if self.is_running:
            logger.warning("Consumer already running")
            return
        
        logger.info("🚀 Starting Survey Event Consumer")
        
        try:
            # Create consumer
            self.consumer = AIOKafkaConsumer(
                *self.topics,
                bootstrap_servers=self.bootstrap_servers,
                group_id="survey-analytics-consumer",
                auto_offset_reset='earliest',  # Process all existing messages
                enable_auto_commit=True,
                value_deserializer=lambda m: json.loads(m.decode('utf-8')) if m else None
            )
            
            await self.consumer.start()
            self.is_running = True
            
            logger.info(f"✅ Consumer started, processing topics: {self.topics}")
            
            # Process messages
            processed_count = 0
            async for message in self.consumer:
                try:
                    if message.value:
                        await self.process_message(message.value)
                        processed_count += 1
                        
                        if processed_count % 100 == 0:
                            logger.info(f"📊 Processed {processed_count} events")
                            
                except Exception as e:
                    logger.error(f"Error processing message: {e}")
                    continue
                
        except asyncio.CancelledError:
            logger.info("Consumer cancelled")
        except Exception as e:
            logger.error(f"Consumer error: {e}")
        finally:
            await self.stop()
    
    async def process_message(self, xapi_event: Dict[str, Any]):
        """Process a single xAPI event by sending it to Ralph LRS"""
        
        try:
            # Validate it's an xAPI statement
            if not all(key in xapi_event for key in ['actor', 'verb', 'object']):
                logger.warning(f"Invalid xAPI statement: {xapi_event}")
                return
            
            # Send to Ralph LRS
            result = await self.ralph_service.store_statement(xapi_event)
            
            if result.get('success'):
                verb = xapi_event.get('verb', {}).get('id', 'unknown')
                obj_id = xapi_event.get('object', {}).get('id', 'unknown')
                logger.debug(f"✅ Stored: {verb} → {obj_id}")
            else:
                logger.warning(f"Failed to store statement: {result}")
                
        except Exception as e:
            logger.error(f"Error processing xAPI event: {e}")
    
    async def stop(self):
        """Stop the consumer"""
        logger.info("🛑 Stopping consumer...")
        self.is_running = False
        
        if self.consumer:
            await self.consumer.stop()
        
        await self.ralph_service.close()
        logger.info("✅ Consumer stopped")


async def main():
    """Main consumer loop with graceful shutdown"""
    
    consumer = SurveyEventConsumer()
    
    # Handle shutdown signals
    def signal_handler():
        logger.info("Received shutdown signal")
        consumer.is_running = False
    
    # Register signal handlers
    signal.signal(signal.SIGTERM, lambda s, f: signal_handler())
    signal.signal(signal.SIGINT, lambda s, f: signal_handler())
    
    try:
        await consumer.start()
    except KeyboardInterrupt:
        logger.info("Consumer interrupted by user")
    except Exception as e:
        logger.error(f"Consumer failed: {e}")
    finally:
        await consumer.stop()


if __name__ == "__main__":
    asyncio.run(main())