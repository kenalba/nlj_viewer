#!/usr/bin/env python3
"""
Unified xAPI Event Consumer
Single dedicated container for processing ALL xAPI events with intelligent routing.
Handles: surveys, analytics, content generation, training, sessions, bookings, etc.
"""

import asyncio
import json
import logging
import os
import signal
import sys
from pathlib import Path
from typing import Any, Callable, Dict, Optional

# Add backend to path
sys.path.append(str(Path(__file__).parent))

from aiokafka import AIOKafkaConsumer
from app.services.ralph_lrs_service import RalphLRSService
from app.services.kafka_service import kafka_service

# Import all event handlers
from app.services.event_consumers import (
    # Training system events
    consume_program_created_event,
    consume_program_published_event,
    consume_session_scheduled_event,
    consume_booking_requested_event,
    consume_session_cancelled_event,
    consume_booking_cancelled_event,
    consume_attendance_checked_in_event,
    consume_attendance_completed_event,
    # Content generation events
    consume_content_generation_requested_event,
    consume_content_generation_started_event,
    consume_content_generation_progress_event,
    consume_content_generation_completed_event,
    consume_content_generation_failed_event,
    consume_content_generation_modified_event,
    consume_content_generation_imported_event,
    consume_content_generation_reviewed_event,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class UnifiedXAPIConsumer:
    """
    Unified consumer for all xAPI events.
    Routes events to appropriate handlers based on verb, extensions, and context.
    """
    
    def __init__(self):
        self.bootstrap_servers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "redpanda:29092")
        self.ralph_service = RalphLRSService()
        self.consumer = None
        self.is_running = False
        
        # All xAPI topics to consume
        self.topics = [
            "nlj.survey.responses",      # Survey/analytics events  
            "nlj.content.generation",    # Content generation events
            "nlj.training.programs",     # Training program events
            "nlj.training.sessions",     # Training session events
            "nlj.training.bookings",     # Booking/registration events
            "xapi-events",              # General xAPI events
        ]
        
        # Event routing table: (verb, event_type_indicator) -> handler
        self.event_handlers: Dict[str, Callable[[Dict[str, Any]], None]] = {
            # Survey/Analytics Events (verb: experienced/answered/completed)
            "survey.started": self._handle_survey_started,
            "survey.answered": self._handle_survey_response,
            "survey.completed": self._handle_survey_completion,
            
            # Content Generation Events (verb: authored + generation_status)
            "content.generation.requested": consume_content_generation_requested_event,
            "content.generation.started": consume_content_generation_started_event,
            "content.generation.progress": consume_content_generation_progress_event,
            "content.generation.completed": consume_content_generation_completed_event,
            "content.generation.failed": consume_content_generation_failed_event,
            "content.generation.modified": consume_content_generation_modified_event,
            "content.generation.imported": consume_content_generation_imported_event,
            "content.generation.reviewed": consume_content_generation_reviewed_event,
            
            # Training System Events
            "program.created": consume_program_created_event,
            "program.published": consume_program_published_event,
            "session.scheduled": consume_session_scheduled_event,
            "session.cancelled": consume_session_cancelled_event,
            "booking.requested": consume_booking_requested_event,
            "booking.cancelled": consume_booking_cancelled_event,
            "attendance.checked_in": consume_attendance_checked_in_event,
            "attendance.completed": consume_attendance_completed_event,
        }
        
        logger.info(f"🔧 Unified xAPI Consumer initialized")
        logger.info(f"   Topics: {self.topics}")
        logger.info(f"   Event handlers: {len(self.event_handlers)} types")
        logger.info(f"   Kafka servers: {self.bootstrap_servers}")
    
    async def start(self):
        """Start the unified consumer"""
        if self.is_running:
            logger.warning("Consumer already running")
            return
        
        logger.info("🚀 Starting Unified xAPI Consumer")
        logger.info("=" * 50)
        
        try:
            # Initialize Kafka producer for event publishing
            logger.info("🔧 Initializing Kafka producer for event publishing...")
            await kafka_service.start_producer()
            logger.info("✅ Kafka producer initialized successfully")
            
            # Create consumer for all xAPI topics
            self.consumer = AIOKafkaConsumer(
                *self.topics,
                bootstrap_servers=self.bootstrap_servers,
                group_id="nlj-unified-xapi-consumer",
                auto_offset_reset='earliest',
                enable_auto_commit=True,
                value_deserializer=lambda m: json.loads(m.decode('utf-8')) if m else None
            )
            
            await self.consumer.start()
            self.is_running = True
            
            logger.info("✅ Consumer started successfully")
            logger.info(f"📊 Processing events from topics: {self.topics}")
            
            # Process messages
            processed_count = 0
            event_type_counts = {}
            
            async for message in self.consumer:
                try:
                    if message.value:
                        event_type = await self._process_message(message.topic, message.value)
                        processed_count += 1
                        
                        # Track event types
                        if event_type:
                            event_type_counts[event_type] = event_type_counts.get(event_type, 0) + 1
                        
                        # Periodic status updates
                        if processed_count % 100 == 0:
                            logger.info(f"📊 Processed {processed_count} events")
                            logger.info(f"   Event types: {dict(list(event_type_counts.items())[:5])}")
                            
                except Exception as e:
                    logger.error(f"❌ Error processing message: {e}")
                    continue
                
        except asyncio.CancelledError:
            logger.info("Consumer cancelled")
        except Exception as e:
            logger.error(f"❌ Consumer error: {e}")
        finally:
            await self.stop()
    
    async def _process_message(self, topic: str, xapi_event: Dict[str, Any]) -> Optional[str]:
        """Process a single xAPI event with intelligent routing"""
        
        try:
            # Validate it's a proper xAPI statement
            if not all(key in xapi_event for key in ['actor', 'verb', 'object']):
                logger.warning(f"Invalid xAPI statement structure: {list(xapi_event.keys())}")
                return None
            
            # Determine event type using intelligent routing
            event_type = self._determine_event_type(topic, xapi_event)
            
            if not event_type:
                verb = xapi_event.get('verb', {}).get('id', 'unknown')
                logger.debug(f"Unrecognized event type - Topic: {topic}, Verb: {verb}")
                return None
            
            # Get handler for this event type
            handler = self.event_handlers.get(event_type)
            
            if not handler:
                logger.warning(f"No handler registered for event type: {event_type}")
                return None
            
            # Route event to appropriate handler
            logger.debug(f"🔀 Routing {event_type} event to handler")
            await handler(xapi_event)
            
            return event_type
            
        except Exception as e:
            logger.error(f"❌ Error processing xAPI event: {e}")
            return None
    
    def _determine_event_type(self, topic: str, event: Dict[str, Any]) -> Optional[str]:
        """Intelligently determine event type from topic, verb, and extensions"""
        
        verb_id = event.get('verb', {}).get('id', '')
        context_ext = event.get('context', {}).get('extensions', {})
        result_ext = event.get('result', {}).get('extensions', {})
        object_id = event.get('object', {}).get('id', '')
        
        # Survey/Analytics Events
        if verb_id == "http://adlnet.gov/expapi/verbs/answered":
            # Check if it's a survey question response
            if context_ext.get("http://nlj.platform/extensions/parent_survey"):
                return "survey.answered"
                
        elif verb_id == "http://adlnet.gov/expapi/verbs/completed":
            # Check if it's a survey completion
            if "survey" in object_id.lower() or context_ext.get("http://nlj.platform/extensions/parent_survey"):
                return "survey.completed"
        
        # Content Generation Events (verb: authored + generation_status)
        elif verb_id == "http://adlnet.gov/expapi/verbs/authored":
            generation_status = (
                result_ext.get("http://nlj.platform/extensions/generation_status") or
                context_ext.get("http://nlj.platform/extensions/generation_status")
            )
            
            if generation_status:
                return f"content.generation.{generation_status}"
        
        # Training Program Events
        elif verb_id == "http://adlnet.gov/expapi/verbs/registered":
            if "program" in object_id:
                return "program.created"
            elif "session" in object_id:
                return "booking.requested"
                
        elif verb_id == "http://adlnet.gov/expapi/verbs/attended":
            if "session" in object_id:
                return "attendance.checked_in"
                
        # Session Events
        elif verb_id == "http://nlj.platform/extensions/verbs/scheduled":
            return "session.scheduled"
            
        elif verb_id == "http://nlj.platform/extensions/verbs/cancelled":
            if "session" in object_id:
                return "session.cancelled"
            elif "booking" in object_id:
                return "booking.cancelled"
        
        # Survey Started Events (verb: experienced)
        elif verb_id == "http://adlnet.gov/expapi/verbs/experienced":
            # Check if it's a survey start event
            if context_ext.get("http://nlj.platform/extensions/parent_survey"):
                return "survey.started"
        
        # Check extensions for more specific event typing
        event_type = context_ext.get("http://nlj.platform/extensions/event_type")
        if event_type:
            return event_type
            
        return None
    
    async def _handle_survey_started(self, event: Dict[str, Any]) -> None:
        """Handle survey started event by forwarding to Ralph LRS"""
        try:
            result = await self.ralph_service.store_statement(event)
            
            if result.get('success'):
                logger.debug("✅ Survey started event stored in Ralph LRS")
            else:
                logger.warning(f"⚠️  Failed to store survey started event: {result}")
                
        except Exception as e:
            logger.error(f"❌ Error handling survey started event: {e}")
    
    async def _handle_survey_response(self, event: Dict[str, Any]) -> None:
        """Handle survey response by forwarding to Ralph LRS"""
        try:
            result = await self.ralph_service.store_statement(event)
            
            if result.get('success'):
                logger.debug("✅ Survey response stored in Ralph LRS")
            else:
                logger.warning(f"⚠️  Failed to store survey response: {result}")
                
        except Exception as e:
            logger.error(f"❌ Error handling survey response: {e}")
    
    async def _handle_survey_completion(self, event: Dict[str, Any]) -> None:
        """Handle survey completion by forwarding to Ralph LRS"""
        try:
            result = await self.ralph_service.store_statement(event)
            
            if result.get('success'):
                survey_id = event.get('context', {}).get('extensions', {}).get(
                    'http://nlj.platform/extensions/parent_survey', 'unknown'
                )
                logger.info(f"✅ Survey completion stored: {survey_id}")
            else:
                logger.warning(f"⚠️  Failed to store survey completion: {result}")
                
        except Exception as e:
            logger.error(f"❌ Error handling survey completion: {e}")
    
    async def stop(self):
        """Stop the consumer"""
        logger.info("🛑 Stopping Unified xAPI Consumer...")
        self.is_running = False
        
        if self.consumer:
            await self.consumer.stop()
        
        await self.ralph_service.close()
        logger.info("✅ Consumer stopped")


async def main():
    """Main consumer loop with graceful shutdown"""
    
    consumer = UnifiedXAPIConsumer()
    
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