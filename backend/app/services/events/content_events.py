"""
Content-related event publishing for workflows, generation, and reviews.
Handles events for content lifecycle, approval workflows, and AI generation.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from .base_event_service import get_kafka_service

logger = logging.getLogger(__name__)


class ContentEventService:
    """Event service for content generation and workflow events."""

    def __init__(self):
        self._kafka_service = None

    async def _get_kafka(self):
        """Get Kafka service instance."""
        if not self._kafka_service:
            self._kafka_service = await get_kafka_service()
        return self._kafka_service

    # =========================================================================
    # WORKFLOW EVENTS - NEW!
    # =========================================================================

    async def publish_workflow_submitted(
        self,
        workflow_id: str,
        content_id: str,
        content_title: str,
        submitter_id: str,
        submitter_name: str,
        submitter_email: str,
        reviewer_id: Optional[str] = None,
        reviewer_name: Optional[str] = None,
    ) -> None:
        """Publish a workflow submitted for review event."""
        
        kafka = await self._get_kafka()
        
        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": submitter_name,
                "mbox": f"mailto:{submitter_email}",
                "account": {"name": submitter_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/submitted", "display": {"en-US": "submitted"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/content/{content_id}",
                "definition": {
                    "name": {"en-US": content_title},
                    "description": {"en-US": "Content submitted for review"},
                    "type": "http://nlj.platform/activities/content",
                },
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/workflow_id": workflow_id,
                    "http://nlj.platform/extensions/reviewer_id": reviewer_id,
                    "http://nlj.platform/extensions/reviewer_name": reviewer_name,
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await kafka.publish_event(topic="nlj.workflow.submission", event=event, key=workflow_id)

    async def publish_workflow_approved(
        self,
        workflow_id: str,
        content_id: str,
        content_title: str,
        approver_id: str,
        approver_name: str,
        approver_email: str,
        comments: Optional[str] = None,
        auto_publish: bool = False,
    ) -> None:
        """Publish a workflow approved event."""
        
        kafka = await self._get_kafka()
        
        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent", 
                "name": approver_name,
                "mbox": f"mailto:{approver_email}",
                "account": {"name": approver_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/approved", "display": {"en-US": "approved"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/content/{content_id}",
                "definition": {
                    "name": {"en-US": content_title},
                    "description": {"en-US": "Content approved for publication"},
                    "type": "http://nlj.platform/activities/content",
                },
            },
            "result": {
                "extensions": {
                    "http://nlj.platform/extensions/approval_comments": comments or "",
                    "http://nlj.platform/extensions/auto_publish": auto_publish,
                }
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {"http://nlj.platform/extensions/workflow_id": workflow_id},
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await kafka.publish_event(topic="nlj.workflow.approval", event=event, key=workflow_id)

    async def publish_workflow_rejected(
        self,
        workflow_id: str,
        content_id: str,
        content_title: str,
        reviewer_id: str,
        reviewer_name: str,
        reviewer_email: str,
        rejection_reason: str,
        comments: Optional[str] = None,
    ) -> None:
        """Publish a workflow rejected event."""
        
        kafka = await self._get_kafka()
        
        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": reviewer_name,
                "mbox": f"mailto:{reviewer_email}",
                "account": {"name": reviewer_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/rejected", "display": {"en-US": "rejected"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/content/{content_id}",
                "definition": {
                    "name": {"en-US": content_title},
                    "description": {"en-US": "Content rejected during review"},
                    "type": "http://nlj.platform/activities/content",
                },
            },
            "result": {
                "extensions": {
                    "http://nlj.platform/extensions/rejection_reason": rejection_reason,
                    "http://nlj.platform/extensions/reviewer_comments": comments or "",
                }
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {"http://nlj.platform/extensions/workflow_id": workflow_id},
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await kafka.publish_event(topic="nlj.workflow.rejection", event=event, key=workflow_id)

    async def publish_workflow_revision_requested(
        self,
        workflow_id: str,
        content_id: str,
        content_title: str,
        reviewer_id: str,
        reviewer_name: str,
        reviewer_email: str,
        revision_notes: str,
        feedback_areas: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Publish a workflow revision requested event."""
        
        kafka = await self._get_kafka()
        
        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": reviewer_name,
                "mbox": f"mailto:{reviewer_email}",
                "account": {"name": reviewer_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://nlj.platform/verbs/requested-revision", "display": {"en-US": "requested revision"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/content/{content_id}",
                "definition": {
                    "name": {"en-US": content_title},
                    "description": {"en-US": "Content revision requested"},
                    "type": "http://nlj.platform/activities/content",
                },
            },
            "result": {
                "extensions": {
                    "http://nlj.platform/extensions/revision_notes": revision_notes,
                    "http://nlj.platform/extensions/feedback_areas": feedback_areas or {},
                }
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {"http://nlj.platform/extensions/workflow_id": workflow_id},
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await kafka.publish_event(topic="nlj.workflow.revision", event=event, key=workflow_id)

    async def publish_content_published(
        self,
        content_id: str,
        content_title: str,
        version_number: int,
        publisher_id: str,
        publisher_name: str,
        publisher_email: str,
        workflow_id: Optional[str] = None,
    ) -> None:
        """Publish a content published event."""
        
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
                "id": f"http://nlj.platform/content/{content_id}",
                "definition": {
                    "name": {"en-US": content_title},
                    "description": {"en-US": f"Content version {version_number} published"},
                    "type": "http://nlj.platform/activities/content",
                },
            },
            "result": {
                "extensions": {
                    "http://nlj.platform/extensions/version_number": version_number,
                }
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/workflow_id": workflow_id,
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await kafka.publish_event(topic="nlj.content.publication", event=event, key=content_id)

    # =========================================================================
    # CONTENT GENERATION EVENTS - EXTRACTED FROM ORIGINAL
    # =========================================================================

    async def publish_content_generation_requested(
        self,
        session_id: str,
        user_id: str,
        user_email: str,
        user_name: str,
        source_document_ids: Optional[List[str]] = None,
        prompt_config: Optional[Dict[str, Any]] = None,
        content_type: str = "scenario",
        prompt: str = "",
        source_documents: Optional[List[str]] = None,
        session_title: Optional[str] = None,
    ) -> None:
        """Publish a content generation requested event."""

        # Handle backwards compatibility - merge both parameter styles
        if source_document_ids:
            source_documents = source_documents or source_document_ids
        if prompt_config:
            prompt = prompt or prompt_config.get("generated_prompt_text", "")
            content_type = content_type or prompt_config.get("generation_type", "scenario")

        kafka = await self._get_kafka()

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": user_name,
                "mbox": f"mailto:{user_email}",
                "account": {"name": user_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/requested", "display": {"en-US": "requested"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/content-generation-sessions/{session_id}",
                "definition": {
                    "name": {"en-US": session_title or f"Content Generation Session {session_id}"},
                    "description": {"en-US": "AI-powered content generation session"},
                    "type": "http://nlj.platform/activities/content-generation",
                },
            },
            "result": {
                "extensions": {
                    "http://nlj.platform/extensions/content_type": content_type,
                    "http://nlj.platform/extensions/prompt": prompt,
                    "http://nlj.platform/extensions/source_documents": source_documents or [],
                }
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/session_title": session_title or "",
                    "http://nlj.platform/extensions/session_id": session_id,
                    "http://nlj.platform/extensions/generation_status": "requested",
                    "http://nlj.platform/extensions/event_type": "content.generation.requested",
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
        await kafka.publish_event(topic="nlj.content.generation", event=event, key=session_id, validate=False)

    async def publish_content_generation_started(
        self,
        session_id: str,
        user_id: str,
        user_email: str,
        user_name: str,
        content_type: str,
        estimated_duration: Optional[int] = None,
        session_title: Optional[str] = None,
    ) -> None:
        """Publish a content generation started event."""

        kafka = await self._get_kafka()

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": user_name,
                "mbox": f"mailto:{user_email}",
                "account": {"name": user_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/launched", "display": {"en-US": "launched"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/content-generation-sessions/{session_id}",
                "definition": {
                    "name": {"en-US": session_title or f"Content Generation Session {session_id}"},
                    "description": {"en-US": "AI-powered content generation session"},
                    "type": "http://nlj.platform/activities/content-generation",
                },
            },
            "result": {
                "extensions": {
                    "http://nlj.platform/extensions/content_type": content_type,
                    "http://nlj.platform/extensions/estimated_duration": estimated_duration,
                }
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/session_title": session_title or "",
                    "http://nlj.platform/extensions/session_id": session_id,
                    "http://nlj.platform/extensions/generation_status": "started",
                    "http://nlj.platform/extensions/event_type": "content.generation.started",
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
        await kafka.publish_event(topic="nlj.content.generation", event=event, key=session_id, validate=False)

    async def publish_content_generation_progress(
        self,
        session_id: str,
        user_id: str,
        user_email: str,
        user_name: str,
        progress_percentage: int,
        current_step: str,
        session_title: Optional[str] = None,
    ) -> None:
        """Publish a content generation progress event."""

        kafka = await self._get_kafka()

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": user_name,
                "mbox": f"mailto:{user_email}",
                "account": {"name": user_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/progressed", "display": {"en-US": "progressed"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/content-generation-sessions/{session_id}",
                "definition": {
                    "name": {"en-US": session_title or f"Content Generation Session {session_id}"},
                    "description": {"en-US": "AI-powered content generation session"},
                    "type": "http://nlj.platform/activities/content-generation",
                },
            },
            "result": {
                "extensions": {
                    "http://nlj.platform/extensions/progress_percentage": progress_percentage,
                    "http://nlj.platform/extensions/current_step": current_step,
                }
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/session_title": session_title or "",
                    "http://nlj.platform/extensions/session_id": session_id,
                    "http://nlj.platform/extensions/generation_status": "progressing",
                    "http://nlj.platform/extensions/event_type": "content.generation.progress",
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
        await kafka.publish_event(topic="nlj.content.generation", event=event, key=session_id, validate=False)

    async def publish_content_generation_completed(
        self,
        session_id: str,
        user_id: str,
        user_email: str,
        user_name: str,
        content_id: Optional[str] = None,
        duration_seconds: Optional[int] = None,
        tokens_used: Optional[int] = None,
        session_title: Optional[str] = None,
    ) -> None:
        """Publish a content generation completed event."""

        kafka = await self._get_kafka()

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": user_name,
                "mbox": f"mailto:{user_email}",
                "account": {"name": user_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/completed", "display": {"en-US": "completed"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/content-generation-sessions/{session_id}",
                "definition": {
                    "name": {"en-US": session_title or f"Content Generation Session {session_id}"},
                    "description": {"en-US": "AI-powered content generation session"},
                    "type": "http://nlj.platform/activities/content-generation",
                },
            },
            "result": {
                "completion": True,
                "extensions": {
                    "http://nlj.platform/extensions/content_id": content_id,
                    "http://nlj.platform/extensions/duration_seconds": duration_seconds,
                    "http://nlj.platform/extensions/tokens_used": tokens_used,
                },
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/session_title": session_title or "",
                    "http://nlj.platform/extensions/session_id": session_id,
                    "http://nlj.platform/extensions/generation_status": "completed",
                    "http://nlj.platform/extensions/event_type": "content.generation.completed",
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
        await kafka.publish_event(topic="nlj.content.generation", event=event, key=session_id, validate=False)

    async def publish_content_generation_failed(
        self,
        session_id: str,
        user_id: str,
        user_email: str,
        user_name: str,
        error_message: str,
        error_type: Optional[str] = None,
        duration_seconds: Optional[int] = None,
        session_title: Optional[str] = None,
    ) -> None:
        """Publish a content generation failed event."""

        kafka = await self._get_kafka()

        event = {
            "id": str(uuid4()),
            "version": "1.0.3",
            "actor": {
                "objectType": "Agent",
                "name": user_name,
                "mbox": f"mailto:{user_email}",
                "account": {"name": user_id, "homePage": "http://nlj.platform"},
            },
            "verb": {"id": "http://adlnet.gov/expapi/verbs/failed", "display": {"en-US": "failed"}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj.platform/content-generation-sessions/{session_id}",
                "definition": {
                    "name": {"en-US": session_title or f"Content Generation Session {session_id}"},
                    "description": {"en-US": "AI-powered content generation session"},
                    "type": "http://nlj.platform/activities/content-generation",
                },
            },
            "result": {
                "completion": False,
                "extensions": {
                    "http://nlj.platform/extensions/error_message": error_message,
                    "http://nlj.platform/extensions/error_type": error_type or "unknown",
                    "http://nlj.platform/extensions/duration_seconds": duration_seconds,
                },
            },
            "context": {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/session_title": session_title or "",
                    "http://nlj.platform/extensions/session_id": session_id,
                    "http://nlj.platform/extensions/generation_status": "failed",
                    "http://nlj.platform/extensions/event_type": "content.generation.failed",
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
        await kafka.publish_event(topic="nlj.content.generation", event=event, key=session_id, validate=False)


# Global instance
_content_event_service = ContentEventService()


async def get_content_event_service() -> ContentEventService:
    """Get the global content event service instance."""
    return _content_event_service