"""
Auto-Tagging Background Worker - Process auto-tagging jobs via event system.

This worker can be run independently to process auto-tagging events from the Kafka queue.
It follows the same pattern as other background workers in the system.
"""

import asyncio
import logging
import signal
import sys
from contextlib import asynccontextmanager
from typing import Optional

from app.core.database_manager import db_manager
from app.services.kafka_service import get_kafka_service, get_xapi_event_service
from app.handlers.auto_tagging_handlers import (
    handle_auto_tagging_event,
    handle_manual_tagging_event
)
import logging

logger = logging.getLogger(__name__)


class AutoTaggingWorker:
    """Background worker for processing auto-tagging events."""
    
    def __init__(self):
        self.kafka_service = None
        self.running = False
        self.tasks = []
    
    async def start(self):
        """Start the auto-tagging worker."""
        try:
            logger.info("Starting Auto-Tagging Worker...")
            
            # Initialize services
            self.kafka_service = get_kafka_service()
            
            # Start Kafka producer/consumer
            await self.kafka_service.start_producer()
            logger.info("Kafka producer started")
            
            # Set running flag
            self.running = True
            
            # Start event consumers
            await self._start_event_consumers()
            
            logger.info("Auto-Tagging Worker started successfully")
            
        except Exception as e:
            logger.error(f"Failed to start Auto-Tagging Worker: {e}")
            await self.stop()
            raise
    
    async def stop(self):
        """Stop the auto-tagging worker."""
        logger.info("Stopping Auto-Tagging Worker...")
        
        self.running = False
        
        # Cancel all running tasks
        for task in self.tasks:
            if not task.done():
                task.cancel()
        
        # Wait for tasks to complete
        if self.tasks:
            await asyncio.gather(*self.tasks, return_exceptions=True)
        
        # Stop Kafka services
        if self.kafka_service:
            try:
                await self.kafka_service.stop_producer()
                await self.kafka_service.stop_consumer()
            except Exception as e:
                logger.error(f"Error stopping Kafka services: {e}")
        
        # Close database connections
        try:
            await db_manager.close()
        except Exception as e:
            logger.error(f"Error closing database: {e}")
        
        logger.info("Auto-Tagging Worker stopped")
    
    async def _start_event_consumers(self):
        """Start event consumers for auto-tagging topics."""
        try:
            # Consumer for auto-tagging events
            auto_tagging_consumer = await self.kafka_service.create_consumer(
                topics=["nlj.auto.tagging"],
                group_id="auto-tagging-worker",
                auto_offset_reset="earliest"
            )
            
            # Consumer for manual tagging events
            manual_tagging_consumer = await self.kafka_service.create_consumer(
                topics=["nlj.manual.tagging"],
                group_id="manual-tagging-worker",
                auto_offset_reset="earliest"
            )
            
            # Start consuming tasks
            auto_tagging_task = asyncio.create_task(
                self._consume_auto_tagging_events(auto_tagging_consumer)
            )
            manual_tagging_task = asyncio.create_task(
                self._consume_manual_tagging_events(manual_tagging_consumer)
            )
            
            self.tasks.extend([auto_tagging_task, manual_tagging_task])
            
            logger.info("Event consumers started for auto-tagging and manual tagging")
            
        except Exception as e:
            logger.error(f"Failed to start event consumers: {e}")
            raise
    
    async def _consume_auto_tagging_events(self, consumer):
        """Consume auto-tagging events from Kafka."""
        try:
            await consumer.start()
            logger.info("Auto-tagging event consumer started")
            
            while self.running:
                try:
                    # Poll for messages with timeout
                    msg_pack = await consumer.getmany(timeout_ms=1000, max_records=10)
                    
                    for topic_partition, messages in msg_pack.items():
                        for message in messages:
                            try:
                                # Decode event
                                event = message.value
                                
                                logger.debug(f"Processing auto-tagging event: {event.get('event_type', 'unknown')}")
                                
                                # Process event
                                await handle_auto_tagging_event(event)
                                
                                # Commit offset
                                await consumer.commit({topic_partition: message.offset + 1})
                                
                            except Exception as e:
                                logger.error(f"Error processing auto-tagging message: {e}")
                                logger.exception("Full traceback:")
                                # Continue processing other messages
                                continue
                
                except asyncio.TimeoutError:
                    # Normal timeout, continue polling
                    continue
                except Exception as e:
                    if self.running:
                        logger.error(f"Error in auto-tagging consumer loop: {e}")
                        await asyncio.sleep(5)  # Back off on error
                    
        except Exception as e:
            logger.error(f"Auto-tagging consumer failed: {e}")
        finally:
            try:
                await consumer.stop()
            except Exception as e:
                logger.error(f"Error stopping auto-tagging consumer: {e}")
    
    async def _consume_manual_tagging_events(self, consumer):
        """Consume manual tagging events from Kafka."""
        try:
            await consumer.start()
            logger.info("Manual tagging event consumer started")
            
            while self.running:
                try:
                    # Poll for messages with timeout
                    msg_pack = await consumer.getmany(timeout_ms=1000, max_records=10)
                    
                    for topic_partition, messages in msg_pack.items():
                        for message in messages:
                            try:
                                # Decode event
                                event = message.value
                                
                                logger.debug(f"Processing manual tagging event: {event.get('event_type', 'unknown')}")
                                
                                # Process event
                                await handle_manual_tagging_event(event)
                                
                                # Commit offset
                                await consumer.commit({topic_partition: message.offset + 1})
                                
                            except Exception as e:
                                logger.error(f"Error processing manual tagging message: {e}")
                                logger.exception("Full traceback:")
                                # Continue processing other messages
                                continue
                
                except asyncio.TimeoutError:
                    # Normal timeout, continue polling
                    continue
                except Exception as e:
                    if self.running:
                        logger.error(f"Error in manual tagging consumer loop: {e}")
                        await asyncio.sleep(5)  # Back off on error
                    
        except Exception as e:
            logger.error(f"Manual tagging consumer failed: {e}")
        finally:
            try:
                await consumer.stop()
            except Exception as e:
                logger.error(f"Error stopping manual tagging consumer: {e}")
    
    async def health_check(self) -> dict:
        """Return health status of the worker."""
        return {
            "status": "healthy" if self.running else "stopped",
            "kafka_connected": self.kafka_service.is_connected if self.kafka_service else False,
            "active_tasks": len([t for t in self.tasks if not t.done()]),
            "database_connected": db_manager.is_connected if hasattr(db_manager, 'is_connected') else True
        }


async def run_worker():
    """Run the auto-tagging worker with proper error handling and graceful shutdown."""
    # Setup logging
    logging.basicConfig(level=logging.INFO)
    
    worker = AutoTaggingWorker()
    
    # Setup signal handlers for graceful shutdown
    def signal_handler(signum, frame):
        logger.info(f"Received signal {signum}, initiating shutdown...")
        asyncio.create_task(worker.stop())
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # Start the worker
        await worker.start()
        
        # Keep running until stopped
        while worker.running:
            await asyncio.sleep(1)
            
            # Periodic health check
            if asyncio.get_running_loop().time() % 30 == 0:
                health = await worker.health_check()
                logger.debug(f"Worker health: {health}")
    
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt, shutting down...")
    except Exception as e:
        logger.error(f"Worker failed with error: {e}")
        logger.exception("Full traceback:")
    finally:
        await worker.stop()


if __name__ == "__main__":
    """
    Entry point for running the auto-tagging worker.
    
    Usage:
        python -m app.workers.auto_tagging_worker
        
    Or with Docker:
        docker compose exec nlj-api python -m app.workers.auto_tagging_worker
    """
    try:
        asyncio.run(run_worker())
    except KeyboardInterrupt:
        logger.info("Worker interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Failed to start worker: {e}")
        sys.exit(1)