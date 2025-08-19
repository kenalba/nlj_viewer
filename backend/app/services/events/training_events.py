"""
Training-related event publishing for programs, sessions, bookings, and attendance.
Handles events for the complete training lifecycle.
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4

from .base_event_service import get_kafka_service

logger = logging.getLogger(__name__)


class TrainingEventService:
    """Event service for training programs, sessions, bookings, and attendance."""

    def __init__(self):
        self._kafka_service = None

    async def _get_kafka(self):
        """Get Kafka service instance."""
        if not self._kafka_service:
            self._kafka_service = await get_kafka_service()
        return self._kafka_service

    # =========================================================================
    # PROGRAM LIFECYCLE EVENTS
    # =========================================================================

    async def publish_program_created(
        self,
        program_id: str,
        program_title: str,
        program_description: str,
        creator_id: str,
        creator_email: str,
        creator_name: str,
        learning_objectives: Optional[List[str]] = None,
        prerequisites: Optional[List[str]] = None,
    ) -> None:
        """Publish a training program created event."""

        kafka = await self._get_kafka()

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": creator_name,
                "mbox": f"mailto:{creator_email}",
                "account": {"name": creator_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/authored", "display": {"en-US": "authored"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/training-programs/{program_id}",
                "definition": {
                    "name": {"en-US": program_title},
                    "description": {"en-US": program_description},
                    "type": "http://adlnet.gov/expapi/activities/course",
                },
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/learning_objectives": (learning_objectives or []),
                    "http://nlj.platform/extensions/prerequisites": (prerequisites or []),
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await kafka.publish_event(topic="nlj.training.programs", event=event, key=program_id)

    async def publish_program_published(
        self,
        program_id: str,
        program_title: str,
        publisher_id: str,
        publisher_email: str,
        publisher_name: str,
        session_count: int = 0,
    ) -> None:
        """Publish a training program published event."""

        kafka = await self._get_kafka()

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": publisher_name,
                "mbox": f"mailto:{publisher_email}",
                "account": {"name": publisher_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/published", "display": {"en-US": "published"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/training-programs/{program_id}",
                "definition": {
                    "name": {"en-US": program_title},
                    "description": {"en-US": "Training program made available to learners"},
                    "type": "http://adlnet.gov/expapi/activities/course",
                },
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {"http://nlj.platform/extensions/session_count": session_count},
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await kafka.publish_event(topic="nlj.training.programs", event=event, key=program_id)

    # =========================================================================
    # SESSION LIFECYCLE EVENTS
    # =========================================================================

    async def publish_session_scheduled(
        self,
        session_id: str,
        program_id: str,
        program_title: str,
        session_date: str,
        session_time: str,
        location: str,
        max_participants: int,
        instructor_id: str,
        instructor_email: str,
        instructor_name: str,
    ) -> None:
        """Publish a training session scheduled event."""

        kafka = await self._get_kafka()

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": instructor_name,
                "mbox": f"mailto:{instructor_email}",
                "account": {"name": instructor_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/scheduled", "display": {"en-US": "scheduled"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/training-sessions/{session_id}",
                "definition": {
                    "name": {"en-US": f"{program_title} - {session_date} {session_time}"},
                    "description": {"en-US": f"Training session scheduled for {session_date} at {location}"},
                    "type": "http://adlnet.gov/expapi/activities/lesson",
                },
            },
            "context": {
                "platform": "NLJ Platform",
                "parent": {"id": f"http://nlj.platform/training-programs/{program_id}"},
                "extensions": {
                    "http://nlj.platform/extensions/session_date": session_date,
                    "http://nlj.platform/extensions/session_time": session_time,
                    "http://nlj.platform/extensions/location": location,
                    "http://nlj.platform/extensions/max_participants": max_participants,
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await kafka.publish_event(topic="nlj.training.sessions", event=event, key=session_id)

    # =========================================================================
    # BOOKING & REGISTRATION EVENTS
    # =========================================================================

    async def publish_booking_requested(
        self,
        booking_id: str,
        session_id: str,
        program_title: str,
        learner_id: str,
        learner_email: str,
        learner_name: str,
        special_requirements: Optional[str] = None,
    ) -> None:
        """Publish a booking requested event."""

        kafka = await self._get_kafka()

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": learner_name,
                "mbox": f"mailto:{learner_email}",
                "account": {"name": learner_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/registered", "display": {"en-US": "registered"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/training-sessions/{session_id}",
                "definition": {
                    "name": {"en-US": program_title},
                    "description": {"en-US": "Training session registration requested"},
                    "type": "http://adlnet.gov/expapi/activities/lesson",
                },
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/booking_id": booking_id,
                    "http://nlj.platform/extensions/special_requirements": special_requirements or "",
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await kafka.publish_event(topic="nlj.training.bookings", event=event, key=booking_id)

    async def publish_booking_confirmed(
        self,
        booking_id: str,
        session_id: str,
        program_title: str,
        learner_id: str,
        learner_email: str,
        learner_name: str,
        confirmation_code: Optional[str] = None,
    ) -> None:
        """Publish a booking confirmed event."""

        kafka = await self._get_kafka()

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": "Training System",
                "account": {"name": "system", "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/approved", "display": {"en-US": "approved"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/training-bookings/{booking_id}",
                "definition": {
                    "name": {"en-US": f"{program_title} - Booking Confirmation"},
                    "description": {"en-US": "Training session booking confirmed"},
                    "type": "http://nlj.platform/activities/booking",
                },
            },
            "context": {
                "platform": "NLJ Platform",
                "parent": {"id": f"http://nlj.platform/training-sessions/{session_id}"},
                "extensions": {
                    "http://nlj.platform/extensions/learner_id": learner_id,
                    "http://nlj.platform/extensions/learner_name": learner_name,
                    "http://nlj.platform/extensions/confirmation_code": confirmation_code or "",
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await kafka.publish_event(topic="nlj.training.bookings", event=event, key=booking_id)

    async def publish_booking_waitlisted(
        self,
        booking_id: str,
        session_id: str,
        program_title: str,
        learner_id: str,
        learner_email: str,
        learner_name: str,
        waitlist_position: int,
    ) -> None:
        """Publish a booking waitlisted event."""

        kafka = await self._get_kafka()

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": "Training System",
                "account": {"name": "system", "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://nlj.platform/verbs/waitlisted", "display": {"en-US": "waitlisted"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/training-bookings/{booking_id}",
                "definition": {
                    "name": {"en-US": f"{program_title} - Waitlist"},
                    "description": {"en-US": "Training session booking placed on waitlist"},
                    "type": "http://nlj.platform/activities/booking",
                },
            },
            "context": {
                "platform": "NLJ Platform",
                "parent": {"id": f"http://nlj.platform/training-sessions/{session_id}"},
                "extensions": {
                    "http://nlj.platform/extensions/learner_id": learner_id,
                    "http://nlj.platform/extensions/learner_name": learner_name,
                    "http://nlj.platform/extensions/waitlist_position": waitlist_position,
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await kafka.publish_event(topic="nlj.training.bookings", event=event, key=booking_id)

    # =========================================================================
    # CANCELLATION EVENTS
    # =========================================================================

    async def publish_session_cancelled(
        self,
        session_id: str,
        program_title: str,
        cancellation_reason: str,
        cancelled_by_id: str,
        cancelled_by_email: str,
        cancelled_by_name: str,
        affected_bookings: int = 0,
    ) -> None:
        """Publish a session cancelled event."""

        kafka = await self._get_kafka()

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": cancelled_by_name,
                "mbox": f"mailto:{cancelled_by_email}",
                "account": {"name": cancelled_by_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/voided", "display": {"en-US": "cancelled"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/training-sessions/{session_id}",
                "definition": {
                    "name": {"en-US": program_title},
                    "description": {"en-US": "Training session cancelled"},
                    "type": "http://adlnet.gov/expapi/activities/lesson",
                },
            },
            "result": {
                "extensions": {
                    "http://nlj.platform/extensions/cancellation_reason": cancellation_reason,
                    "http://nlj.platform/extensions/affected_bookings": affected_bookings,
                }
            },
            "context": {"platform": "NLJ Platform"},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await kafka.publish_event(topic="nlj.training.sessions", event=event, key=session_id)

    async def publish_booking_cancelled(
        self,
        booking_id: str,
        session_id: str,
        program_title: str,
        learner_id: str,
        learner_email: str,
        learner_name: str,
        cancellation_reason: Optional[str] = None,
        cancelled_by_system: bool = False,
    ) -> None:
        """Publish a booking cancelled event."""

        kafka = await self._get_kafka()

        actor_name = "Training System" if cancelled_by_system else learner_name
        actor_account = "system" if cancelled_by_system else learner_id
        actor_mbox = None if cancelled_by_system else f"mailto:{learner_email}"

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": actor_name,
                "account": {"name": actor_account, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/voided", "display": {"en-US": "cancelled"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/training-bookings/{booking_id}",
                "definition": {
                    "name": {"en-US": f"{program_title} - Booking Cancellation"},
                    "description": {"en-US": "Training session booking cancelled"},
                    "type": "http://nlj.platform/activities/booking",
                },
            },
            "context": {
                "platform": "NLJ Platform",
                "parent": {"id": f"http://nlj.platform/training-sessions/{session_id}"},
                "extensions": {
                    "http://nlj.platform/extensions/learner_id": learner_id,
                    "http://nlj.platform/extensions/learner_name": learner_name,
                    "http://nlj.platform/extensions/cancellation_reason": cancellation_reason or "",
                    "http://nlj.platform/extensions/cancelled_by_system": cancelled_by_system,
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        if actor_mbox:
            event["actor"]["mbox"] = actor_mbox

        await kafka.publish_event(topic="nlj.training.bookings", event=event, key=booking_id)

    # =========================================================================
    # ATTENDANCE EVENTS
    # =========================================================================

    async def publish_attendance_checked_in(
        self,
        session_id: str,
        program_title: str,
        learner_id: str,
        learner_email: str,
        learner_name: str,
        check_in_time: Optional[str] = None,
    ) -> None:
        """Publish an attendance check-in event."""

        kafka = await self._get_kafka()

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": learner_name,
                "mbox": f"mailto:{learner_email}",
                "account": {"name": learner_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/attended", "display": {"en-US": "attended"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/training-sessions/{session_id}",
                "definition": {
                    "name": {"en-US": program_title},
                    "description": {"en-US": "Training session attended"},
                    "type": "http://adlnet.gov/expapi/activities/lesson",
                },
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/check_in_time": check_in_time or datetime.now(timezone.utc).isoformat(),
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await kafka.publish_event(topic="nlj.training.attendance", event=event, key=f"{session_id}:{learner_id}")

    async def publish_attendance_completed(
        self,
        session_id: str,
        program_title: str,
        learner_id: str,
        learner_email: str,
        learner_name: str,
        completion_status: str = "completed",
        attendance_percentage: Optional[float] = None,
    ) -> None:
        """Publish an attendance completion event."""

        kafka = await self._get_kafka()

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": learner_name,
                "mbox": f"mailto:{learner_email}",
                "account": {"name": learner_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/completed", "display": {"en-US": "completed"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/training-sessions/{session_id}",
                "definition": {
                    "name": {"en-US": program_title},
                    "description": {"en-US": "Training session completed"},
                    "type": "http://adlnet.gov/expapi/activities/lesson",
                },
            },
            "result": {
                "completion": (completion_status == "completed"),
                "extensions": {
                    "http://nlj.platform/extensions/completion_status": completion_status,
                    "http://nlj.platform/extensions/attendance_percentage": attendance_percentage,
                },
            },
            "context": {"platform": "NLJ Platform"},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await kafka.publish_event(topic="nlj.training.attendance", event=event, key=f"{session_id}:{learner_id}")

    # =========================================================================
    # CERTIFICATE EVENTS
    # =========================================================================

    async def publish_certificate_earned(
        self,
        certificate_id: str,
        certificate_name: str,
        learner_id: str,
        learner_email: str,
        learner_name: str,
        program_id: str,
        session_id: Optional[str] = None,
        completion_date: Optional[datetime] = None,
        expiry_date: Optional[datetime] = None,
        certificate_url: Optional[str] = None,
    ) -> None:
        """Publish a certificate earned event."""

        kafka = await self._get_kafka()

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": learner_name,
                "mbox": f"mailto:{learner_email}",
                "account": {"name": learner_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/earned", "display": {"en-US": "earned"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/certificates/{certificate_id}",
                "definition": {
                    "name": {"en-US": certificate_name},
                    "type": "http://adlnet.gov/expapi/activities/badge",
                },
            },
            "result": {"completion": True, "success": True},
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/program_id": program_id,
                    "http://nlj.platform/extensions/session_id": session_id,
                    "http://nlj.platform/extensions/completion_date": (
                        completion_date or datetime.now(timezone.utc)
                    ).isoformat(),
                    "http://nlj.platform/extensions/expiry_date": (expiry_date.isoformat() if expiry_date else None),
                    "http://nlj.platform/extensions/certificate_url": certificate_url,
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await kafka.publish_event(topic="nlj.training.certificates", event=event, key=certificate_id)


# Global instance
_training_event_service = TrainingEventService()


async def get_training_event_service() -> TrainingEventService:
    """Get the global training event service instance."""
    return _training_event_service