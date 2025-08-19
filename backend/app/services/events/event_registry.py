"""
Unified event service registry.
Provides a single interface to all event services for backwards compatibility.
"""

import logging
from typing import Any, Dict, Optional

from .base_event_service import get_kafka_service, BaseKafkaService
from .content_events import get_content_event_service, ContentEventService
from .training_events import get_training_event_service, TrainingEventService
from .ai_processing_events import get_ai_processing_event_service, AIProcessingEventService

logger = logging.getLogger(__name__)


class UnifiedEventService:
    """
    Unified event service that aggregates all domain-specific event services.
    Provides backwards compatibility with the original kafka_service interface.
    """

    def __init__(self):
        self._kafka: Optional[BaseKafkaService] = None
        self._content: Optional[ContentEventService] = None
        self._training: Optional[TrainingEventService] = None
        self._ai_processing: Optional[AIProcessingEventService] = None

    async def _ensure_services(self):
        """Ensure all services are initialized."""
        if not self._kafka:
            self._kafka = await get_kafka_service()
        if not self._content:
            self._content = await get_content_event_service()
        if not self._training:
            self._training = await get_training_event_service()
        if not self._ai_processing:
            self._ai_processing = await get_ai_processing_event_service()

    # =========================================================================
    # CORE KAFKA METHODS - Delegated to BaseKafkaService
    # =========================================================================

    async def start_producer(self) -> None:
        """Start Kafka producer."""
        await self._ensure_services()
        await self._kafka.start_producer()

    async def stop_producer(self) -> None:
        """Stop Kafka producer."""
        if self._kafka:
            await self._kafka.stop_producer()

    async def publish_event(
        self, 
        topic: str, 
        event: Dict[str, Any], 
        key: str = None, 
        validate: bool = True
    ) -> None:
        """Publish an event to a Kafka topic."""
        await self._ensure_services()
        await self._kafka.publish_event(topic, event, key, validate)

    async def health_check(self) -> Dict[str, Any]:
        """Check service health."""
        await self._ensure_services()
        return await self._kafka.health_check()

    # =========================================================================
    # CONTENT & WORKFLOW EVENTS - Delegated to ContentEventService
    # =========================================================================

    # Workflow Events
    async def publish_workflow_submitted(self, *args, **kwargs) -> None:
        """Publish workflow submitted event."""
        await self._ensure_services()
        await self._content.publish_workflow_submitted(*args, **kwargs)

    async def publish_workflow_approved(self, *args, **kwargs) -> None:
        """Publish workflow approved event."""
        await self._ensure_services()
        await self._content.publish_workflow_approved(*args, **kwargs)

    async def publish_workflow_rejected(self, *args, **kwargs) -> None:
        """Publish workflow rejected event."""
        await self._ensure_services()
        await self._content.publish_workflow_rejected(*args, **kwargs)

    async def publish_workflow_revision_requested(self, *args, **kwargs) -> None:
        """Publish workflow revision requested event."""
        await self._ensure_services()
        await self._content.publish_workflow_revision_requested(*args, **kwargs)

    async def publish_content_published(self, *args, **kwargs) -> None:
        """Publish content published event."""
        await self._ensure_services()
        await self._content.publish_content_published(*args, **kwargs)

    # Content Generation Events
    async def publish_content_generation_requested(self, *args, **kwargs) -> None:
        """Publish content generation requested event."""
        await self._ensure_services()
        await self._content.publish_content_generation_requested(*args, **kwargs)

    async def publish_content_generation_started(self, *args, **kwargs) -> None:
        """Publish content generation started event."""
        await self._ensure_services()
        await self._content.publish_content_generation_started(*args, **kwargs)

    async def publish_content_generation_completed(self, *args, **kwargs) -> None:
        """Publish content generation completed event."""
        await self._ensure_services()
        await self._content.publish_content_generation_completed(*args, **kwargs)

    async def publish_content_generation_progress(self, *args, **kwargs) -> None:
        """Publish content generation progress event."""
        await self._ensure_services()
        await self._content.publish_content_generation_progress(*args, **kwargs)

    async def publish_content_generation_failed(self, *args, **kwargs) -> None:
        """Publish content generation failed event."""
        await self._ensure_services()
        await self._content.publish_content_generation_failed(*args, **kwargs)

    # =========================================================================
    # TRAINING EVENTS - Delegated to TrainingEventService  
    # =========================================================================

    # Program Events
    async def publish_program_created(self, *args, **kwargs) -> None:
        """Publish program created event."""
        await self._ensure_services()
        await self._training.publish_program_created(*args, **kwargs)

    async def publish_program_published(self, *args, **kwargs) -> None:
        """Publish program published event."""
        await self._ensure_services()
        await self._training.publish_program_published(*args, **kwargs)

    # Session Events
    async def publish_session_scheduled(self, *args, **kwargs) -> None:
        """Publish session scheduled event."""
        await self._ensure_services()
        await self._training.publish_session_scheduled(*args, **kwargs)

    async def publish_session_cancelled(self, *args, **kwargs) -> None:
        """Publish session cancelled event."""
        await self._ensure_services()
        await self._training.publish_session_cancelled(*args, **kwargs)

    # Booking Events
    async def publish_booking_requested(self, *args, **kwargs) -> None:
        """Publish booking requested event."""
        await self._ensure_services()
        await self._training.publish_booking_requested(*args, **kwargs)

    async def publish_booking_confirmed(self, *args, **kwargs) -> None:
        """Publish booking confirmed event."""
        await self._ensure_services()
        await self._training.publish_booking_confirmed(*args, **kwargs)

    async def publish_booking_waitlisted(self, *args, **kwargs) -> None:
        """Publish booking waitlisted event."""
        await self._ensure_services()
        await self._training.publish_booking_waitlisted(*args, **kwargs)

    async def publish_booking_cancelled(self, *args, **kwargs) -> None:
        """Publish booking cancelled event."""
        await self._ensure_services()
        await self._training.publish_booking_cancelled(*args, **kwargs)

    # Attendance Events
    async def publish_attendance_checked_in(self, *args, **kwargs) -> None:
        """Publish attendance checked in event."""
        await self._ensure_services()
        await self._training.publish_attendance_checked_in(*args, **kwargs)

    async def publish_attendance_completed(self, *args, **kwargs) -> None:
        """Publish attendance completed event."""
        await self._ensure_services()
        await self._training.publish_attendance_completed(*args, **kwargs)

    # Certificate Events
    async def publish_certificate_earned(self, *args, **kwargs) -> None:
        """Publish certificate earned event."""
        await self._ensure_services()
        await self._training.publish_certificate_earned(*args, **kwargs)

    # =========================================================================
    # AI PROCESSING EVENTS - Delegated to AIProcessingEventService
    # =========================================================================

    # Knowledge Extraction Events
    async def publish_knowledge_extraction_started(self, *args, **kwargs) -> None:
        """Publish knowledge extraction started event."""
        await self._ensure_services()
        await self._ai_processing.publish_knowledge_extraction_started(*args, **kwargs)

    async def publish_knowledge_extraction_completed(self, *args, **kwargs) -> None:
        """Publish knowledge extraction completed event."""
        await self._ensure_services()
        await self._ai_processing.publish_knowledge_extraction_completed(*args, **kwargs)

    async def publish_knowledge_extraction_failed(self, *args, **kwargs) -> None:
        """Publish knowledge extraction failed event."""
        await self._ensure_services()
        await self._ai_processing.publish_knowledge_extraction_failed(*args, **kwargs)

    # Auto-Tagging Events
    async def publish_auto_tagging_started(self, *args, **kwargs) -> None:
        """Publish auto-tagging started event."""
        await self._ensure_services()
        await self._ai_processing.publish_auto_tagging_started(*args, **kwargs)

    async def publish_auto_tagging_completed(self, *args, **kwargs) -> None:
        """Publish auto-tagging completed event."""
        await self._ensure_services()
        await self._ai_processing.publish_auto_tagging_completed(*args, **kwargs)

    async def publish_batch_auto_tagging_completed(self, *args, **kwargs) -> None:
        """Publish batch auto-tagging completed event."""
        await self._ensure_services()
        await self._ai_processing.publish_batch_auto_tagging_completed(*args, **kwargs)

    async def publish_tag_suggestion_approved(self, *args, **kwargs) -> None:
        """Publish tag suggestion approved event."""
        await self._ensure_services()
        await self._ai_processing.publish_tag_suggestion_approved(*args, **kwargs)


# Global instance
_unified_event_service = UnifiedEventService()


async def get_event_service() -> UnifiedEventService:
    """
    Get the unified event service.
    This is the main entry point for all event publishing.
    """
    return _unified_event_service


# Backwards compatibility alias
async def get_xapi_event_service() -> UnifiedEventService:
    """Backwards compatibility alias for the original kafka service."""
    return await get_event_service()