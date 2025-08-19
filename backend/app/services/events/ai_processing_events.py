"""
AI processing event publishing for knowledge extraction, auto-tagging, and ML operations.
Handles events for LLM-powered content analysis and AI-driven learning optimization.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Optional
from uuid import uuid4

from .base_event_service import get_kafka_service

logger = logging.getLogger(__name__)


class AIProcessingEventService:
    """Event service for AI processing operations like knowledge extraction and auto-tagging."""

    def __init__(self):
        self._kafka_service = None

    async def _get_kafka(self):
        """Get Kafka service instance."""
        if not self._kafka_service:
            self._kafka_service = await get_kafka_service()
        return self._kafka_service

    # =========================================================================
    # KNOWLEDGE EXTRACTION EVENTS
    # =========================================================================

    async def publish_knowledge_extraction_started(
        self,
        extraction_id: str,
        user_id: str,
        user_email: str,
        user_name: str,
        extraction_type: str,  # "node", "activity", "bulk"
        target_id: Optional[str] = None,  # node_id or activity_id
        target_count: Optional[int] = None  # for bulk operations
    ) -> None:
        """Publish a knowledge extraction started event."""

        kafka = await self._get_kafka()

        event = {
            "id": str(uuid4()),
            "event_type": "knowledge_extraction_started",
            "actor": {
                "mbox": f"mailto:{user_email}",
                "name": user_name,
                "objectType": "Agent",
            },
            "verb": {
                "id": "http://adlnet.gov/expapi/verbs/launched",
                "display": {"en-US": "launched"},
            },
            "object": {
                "id": f"nlj://knowledge-extraction/{extraction_id}",
                "definition": {
                    "name": {"en-US": f"Knowledge Extraction - {extraction_type}"},
                    "description": {"en-US": f"LLM-powered metadata extraction from {extraction_type}"},
                    "type": "http://nlj-platform.com/activitytype/knowledge-extraction",
                    "extensions": {
                        "extraction_type": extraction_type,
                        "target_id": target_id,
                        "target_count": target_count,
                        "extraction_id": extraction_id
                    }
                }
            },
            "context": {
                "instructor": {"name": user_name, "mbox": f"mailto:{user_email}"},
                "platform": "NLJ Knowledge Extraction System",
                "language": "en-US"
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await kafka.publish_event(topic="nlj.knowledge.extraction", event=event, key=extraction_id)

    async def publish_knowledge_extraction_completed(
        self,
        extraction_id: str,
        user_id: str,
        user_email: str,
        user_name: str,
        extraction_type: str,
        items_processed: int,
        objectives_extracted: int,
        keywords_extracted: int,
        processing_time_seconds: float,
        target_id: Optional[str] = None,
    ) -> None:
        """Publish a knowledge extraction completed event."""

        kafka = await self._get_kafka()

        event = {
            "id": str(uuid4()),
            "event_type": "knowledge_extraction_completed",
            "actor": {
                "mbox": f"mailto:{user_email}",
                "name": user_name,
                "objectType": "Agent",
            },
            "verb": {
                "id": "http://adlnet.gov/expapi/verbs/completed",
                "display": {"en-US": "completed"},
            },
            "object": {
                "id": f"nlj://knowledge-extraction/{extraction_id}",
                "definition": {
                    "name": {"en-US": f"Knowledge Extraction - {extraction_type}"},
                    "description": {"en-US": "LLM-powered metadata extraction completed"},
                    "type": "http://nlj-platform.com/activitytype/knowledge-extraction",
                }
            },
            "result": {
                "completion": True,
                "success": True,
                "extensions": {
                    "items_processed": items_processed,
                    "objectives_extracted": objectives_extracted,
                    "keywords_extracted": keywords_extracted,
                    "processing_time_seconds": processing_time_seconds,
                    "extraction_rate": objectives_extracted + keywords_extracted / processing_time_seconds if processing_time_seconds > 0 else 0,
                }
            },
            "context": {
                "instructor": {"name": user_name, "mbox": f"mailto:{user_email}"},
                "platform": "NLJ Knowledge Extraction System",
                "language": "en-US",
                "extensions": {
                    "target_id": target_id,
                    "extraction_type": extraction_type,
                }
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await kafka.publish_event(topic="nlj.knowledge.extraction", event=event, key=extraction_id)

    async def publish_knowledge_extraction_failed(
        self,
        extraction_id: str,
        user_id: str,
        user_email: str,
        user_name: str,
        extraction_type: str,
        error_message: str,
        processing_time_seconds: float,
        target_id: Optional[str] = None,
    ) -> None:
        """Publish a knowledge extraction failed event."""

        kafka = await self._get_kafka()

        event = {
            "id": str(uuid4()),
            "event_type": "knowledge_extraction_failed",
            "actor": {
                "mbox": f"mailto:{user_email}",
                "name": user_name,
                "objectType": "Agent",
            },
            "verb": {
                "id": "http://adlnet.gov/expapi/verbs/failed",
                "display": {"en-US": "failed"},
            },
            "object": {
                "id": f"nlj://knowledge-extraction/{extraction_id}",
                "definition": {
                    "name": {"en-US": f"Knowledge Extraction - {extraction_type}"},
                    "description": {"en-US": "LLM-powered metadata extraction failed"},
                    "type": "http://nlj-platform.com/activitytype/knowledge-extraction",
                }
            },
            "result": {
                "completion": False,
                "success": False,
                "extensions": {
                    "error_message": error_message,
                    "processing_time_seconds": processing_time_seconds,
                }
            },
            "context": {
                "instructor": {"name": user_name, "mbox": f"mailto:{user_email}"},
                "platform": "NLJ Knowledge Extraction System", 
                "language": "en-US",
                "extensions": {
                    "target_id": target_id,
                    "extraction_type": extraction_type,
                }
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await kafka.publish_event(topic="nlj.knowledge.extraction", event=event, key=extraction_id)

    # =========================================================================
    # AUTO-TAGGING EVENTS
    # =========================================================================

    async def publish_auto_tagging_started(
        self,
        tagging_session_id: str,
        user_id: str,
        user_email: str,
        user_name: str,
        node_id: str,
        tagging_strategy: str,  # "conservative", "balanced", "comprehensive"
        content_preview: Optional[str] = None,
    ) -> None:
        """Publish an auto-tagging started event."""

        kafka = await self._get_kafka()

        event = {
            "id": str(uuid4()),
            "event_type": "auto_tagging_started",
            "actor": {
                "mbox": f"mailto:{user_email}",
                "name": user_name,
                "objectType": "Agent",
            },
            "verb": {
                "id": "http://adlnet.gov/expapi/verbs/launched",
                "display": {"en-US": "launched"},
            },
            "object": {
                "id": f"nlj://auto-tagging/{tagging_session_id}",
                "definition": {
                    "name": {"en-US": f"Auto-Tagging Session - {tagging_strategy}"},
                    "description": {"en-US": f"AI-powered content tagging with {tagging_strategy} strategy"},
                    "type": "http://nlj-platform.com/activitytype/auto-tagging",
                    "extensions": {
                        "node_id": node_id,
                        "tagging_strategy": tagging_strategy,
                        "content_preview": content_preview[:200] + "..." if content_preview and len(content_preview) > 200 else content_preview,
                    }
                }
            },
            "context": {
                "instructor": {"name": user_name, "mbox": f"mailto:{user_email}"},
                "platform": "NLJ Auto-Tagging System",
                "language": "en-US"
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await kafka.publish_event(topic="nlj.auto.tagging", event=event, key=tagging_session_id)

    async def publish_auto_tagging_completed(
        self,
        tagging_session_id: str,
        user_id: str,
        user_email: str,
        user_name: str,
        node_id: str,
        tagging_strategy: str,
        suggested_objectives: int,
        suggested_keywords: int,
        confidence_scores: Dict[str, float],
        processing_time_seconds: float,
        domain_detected: Optional[str] = None,
    ) -> None:
        """Publish an auto-tagging completed event."""

        kafka = await self._get_kafka()

        event = {
            "id": str(uuid4()),
            "event_type": "auto_tagging_completed",
            "actor": {
                "mbox": f"mailto:{user_email}",
                "name": user_name,
                "objectType": "Agent",
            },
            "verb": {
                "id": "http://adlnet.gov/expapi/verbs/completed",
                "display": {"en-US": "completed"},
            },
            "object": {
                "id": f"nlj://auto-tagging/{tagging_session_id}",
                "definition": {
                    "name": {"en-US": f"Auto-Tagging Session - {tagging_strategy}"},
                    "description": {"en-US": "AI-powered content tagging completed"},
                    "type": "http://nlj-platform.com/activitytype/auto-tagging",
                }
            },
            "result": {
                "completion": True,
                "success": True,
                "extensions": {
                    "suggested_objectives": suggested_objectives,
                    "suggested_keywords": suggested_keywords,
                    "avg_confidence_score": sum(confidence_scores.values()) / len(confidence_scores) if confidence_scores else 0,
                    "processing_time_seconds": processing_time_seconds,
                    "domain_detected": domain_detected,
                    "tagging_rate": (suggested_objectives + suggested_keywords) / processing_time_seconds if processing_time_seconds > 0 else 0,
                }
            },
            "context": {
                "instructor": {"name": user_name, "mbox": f"mailto:{user_email}"},
                "platform": "NLJ Auto-Tagging System",
                "language": "en-US",
                "extensions": {
                    "node_id": node_id,
                    "tagging_strategy": tagging_strategy,
                    "confidence_scores": confidence_scores,
                }
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await kafka.publish_event(topic="nlj.auto.tagging", event=event, key=tagging_session_id)

    async def publish_batch_auto_tagging_completed(
        self,
        batch_id: str,
        user_id: str,
        user_email: str,
        user_name: str,
        nodes_processed: int,
        total_objectives: int,
        total_keywords: int,
        processing_time_seconds: float,
        tagging_strategy: str,
        success_rate: float,
    ) -> None:
        """Publish a batch auto-tagging completed event."""

        kafka = await self._get_kafka()

        event = {
            "id": str(uuid4()),
            "event_type": "batch_auto_tagging_completed",
            "actor": {
                "mbox": f"mailto:{user_email}",
                "name": user_name,
                "objectType": "Agent",
            },
            "verb": {
                "id": "http://adlnet.gov/expapi/verbs/completed",
                "display": {"en-US": "completed"},
            },
            "object": {
                "id": f"nlj://batch-auto-tagging/{batch_id}",
                "definition": {
                    "name": {"en-US": f"Batch Auto-Tagging - {nodes_processed} nodes"},
                    "description": {"en-US": f"Bulk AI-powered content tagging using {tagging_strategy} strategy"},
                    "type": "http://nlj-platform.com/activitytype/batch-auto-tagging",
                }
            },
            "result": {
                "completion": True,
                "success": success_rate >= 0.8,
                "score": {"scaled": success_rate},
                "extensions": {
                    "nodes_processed": nodes_processed,
                    "total_objectives": total_objectives,
                    "total_keywords": total_keywords,
                    "processing_time_seconds": processing_time_seconds,
                    "success_rate": success_rate,
                    "avg_tags_per_node": (total_objectives + total_keywords) / nodes_processed if nodes_processed > 0 else 0,
                    "processing_rate": nodes_processed / processing_time_seconds if processing_time_seconds > 0 else 0,
                }
            },
            "context": {
                "instructor": {"name": user_name, "mbox": f"mailto:{user_email}"},
                "platform": "NLJ Auto-Tagging System",
                "language": "en-US",
                "extensions": {
                    "batch_id": batch_id,
                    "tagging_strategy": tagging_strategy,
                }
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await kafka.publish_event(topic="nlj.auto.tagging", event=event, key=batch_id)

    async def publish_tag_suggestion_approved(
        self,
        suggestion_id: str,
        user_id: str,
        user_email: str,
        user_name: str,
        node_id: str,
        tag_type: str,  # "objective" or "keyword" 
        tag_text: str,
        confidence_score: float,
        review_action: str,  # "approved", "rejected", "modified"
        modified_text: Optional[str] = None,
    ) -> None:
        """Publish a tag suggestion approval event."""

        kafka = await self._get_kafka()

        event = {
            "id": str(uuid4()),
            "event_type": "tag_suggestion_reviewed",
            "actor": {
                "mbox": f"mailto:{user_email}",
                "name": user_name,
                "objectType": "Agent",
            },
            "verb": {
                "id": "http://adlnet.gov/expapi/verbs/approved" if review_action == "approved" else "http://adlnet.gov/expapi/verbs/rejected",
                "display": {"en-US": review_action},
            },
            "object": {
                "id": f"nlj://tag-suggestion/{suggestion_id}",
                "definition": {
                    "name": {"en-US": f"Tag Suggestion - {tag_type}"},
                    "description": {"en-US": f"AI-suggested {tag_type}: '{tag_text}'"},
                    "type": "http://nlj-platform.com/activitytype/tag-suggestion",
                    "extensions": {
                        "tag_type": tag_type,
                        "original_text": tag_text,
                        "confidence_score": confidence_score,
                    }
                }
            },
            "result": {
                "success": review_action == "approved",
                "response": modified_text if review_action == "modified" else tag_text,
                "extensions": {
                    "review_action": review_action,
                    "was_modified": modified_text is not None,
                }
            },
            "context": {
                "instructor": {"name": user_name, "mbox": f"mailto:{user_email}"},
                "platform": "NLJ Auto-Tagging System",
                "language": "en-US",
                "extensions": {
                    "node_id": node_id,
                    "suggestion_id": suggestion_id,
                }
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await kafka.publish_event(topic="nlj.auto.tagging", event=event, key=suggestion_id)


# Global instance
_ai_processing_event_service = AIProcessingEventService()


async def get_ai_processing_event_service() -> AIProcessingEventService:
    """Get the global AI processing event service instance."""
    return _ai_processing_event_service