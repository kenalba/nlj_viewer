"""
FastStream event handlers for survey and analytics events.
Handles survey responses, completions, and analytics processing.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict

from faststream import Depends
from pydantic import BaseModel, Field

from app.brokers.kafka_broker import broker
from app.services.enhanced_elasticsearch_service import get_elasticsearch_service, ElasticsearchService
from app.middleware.xapi_subscriber_middleware import xapi_validation_middleware

logger = logging.getLogger(__name__)


class XAPIEvent(BaseModel):
    """Base xAPI event structure for validation"""
    id: str
    version: str = "1.0.3"
    timestamp: str
    actor: Dict[str, Any]
    verb: Dict[str, Any]
    object: Dict[str, Any]
    result: Dict[str, Any] = Field(default_factory=dict)
    context: Dict[str, Any] = Field(default_factory=dict)
    
    # Allow additional fields from the event producer
    event_id: str = Field(default="", description="Event producer ID")
    producer_id: str = Field(default="", description="Event producer identifier")
    producer_timestamp: str = Field(default="", description="Producer timestamp")
    
    class Config:
        extra = "allow"  # Allow additional fields not defined in the model


# =========================================================================
# SURVEY RESPONSE HANDLERS
# =========================================================================

@broker.subscriber(
    "nlj.survey.responses", 
    group_id="nlj-survey-analytics",
    middlewares=[xapi_validation_middleware]
)
async def handle_survey_events(
    event: XAPIEvent,
    elasticsearch_service: ElasticsearchService = Depends(get_elasticsearch_service)
) -> None:
    """Handle survey response events for analytics"""
    
    try:
        verb_id = event.verb["id"]
        
        if verb_id == "http://adlnet.gov/expapi/verbs/answered":
            await _process_survey_response(event, elasticsearch_service)
        elif verb_id == "http://adlnet.gov/expapi/verbs/completed":
            await _process_survey_completion(event, elasticsearch_service)
        elif verb_id == "http://activitystrea.ms/schema/1.0/start":
            await _process_survey_started(event, elasticsearch_service)
        else:
            logger.warning(f"Unhandled survey verb: {verb_id}")
            return
        
        logger.info(f"Survey event {event.id} processed successfully")
        
    except Exception as e:
        logger.error(f"Error processing survey event {event.id}: {e}")
        raise


async def _process_survey_response(event: XAPIEvent, elasticsearch_service: ElasticsearchService) -> None:
    """Process survey response (answered) event"""
    
    # Extract response details
    actor = event.actor
    object_data = event.object
    result = event.result
    context = event.context
    
    # Enhance event with survey-specific metadata for analytics
    enhanced_event = event.dict()
    
    # Extract survey ID from context extensions or object ID
    extensions = context.get("extensions", {})
    parent_survey = extensions.get("http://nlj.platform/extensions/parent_survey")
    
    if not parent_survey:
        # Try to extract from object ID if it's a survey question
        object_id = object_data.get("id", "")
        if "/questions/" in object_id:
            # Extract survey ID from question URL pattern
            parts = object_id.split("/")
            if len(parts) > 4:  # http://nlj.platform/content/survey-id/question/q001
                parent_survey = parts[4]
    
    # Store the xAPI statement for analytics
    await elasticsearch_service.store_xapi_statement(enhanced_event)
    
    # Log response details
    respondent = actor.get("mbox", "anonymous").replace("mailto:", "")
    response_value = result.get("response", "no_response")
    question_id = object_data.get("id", "").split("/")[-1]
    
    logger.info(f"Survey response: {respondent} answered {question_id} with '{response_value}'")


async def _process_survey_completion(event: XAPIEvent, elasticsearch_service: ElasticsearchService) -> None:
    """Process survey completion event"""
    
    # Store the completion event for analytics
    await elasticsearch_service.store_xapi_statement(event.dict())
    
    # Extract completion details
    actor = event.actor
    object_data = event.object
    result = event.result
    
    respondent = actor.get("mbox", "anonymous").replace("mailto:", "")
    survey_id = object_data.get("id", "").split("/")[-1]
    completion_time = result.get("duration", "unknown")
    
    logger.info(f"Survey completion: {respondent} completed {survey_id} in {completion_time}")


async def _process_survey_started(event: XAPIEvent, elasticsearch_service: ElasticsearchService) -> None:
    """Process survey started event"""
    
    # Store the start event for analytics
    await elasticsearch_service.store_xapi_statement(event.dict())
    
    # Extract start details
    actor = event.actor
    object_data = event.object
    
    respondent = actor.get("mbox", "anonymous").replace("mailto:", "")
    survey_id = object_data.get("id", "").split("/")[-1]
    
    logger.info(f"Survey started: {respondent} began {survey_id}")


# =========================================================================
# GENERAL xAPI EVENT HANDLER
# =========================================================================

@broker.subscriber(
    "xapi-events", 
    group_id="nlj-xapi-analytics",
    middlewares=[xapi_validation_middleware]
) 
async def handle_general_xapi_events(
    event: XAPIEvent,
    elasticsearch_service: ElasticsearchService = Depends(get_elasticsearch_service)
) -> None:
    """Handle general xAPI events for analytics storage"""
    
    logger.info(f"🔄 FastStream handler called for event ID: {getattr(event, 'id', 'UNKNOWN')}")
    
    try:
        logger.info(f"📝 Event data received: actor={event.actor.get('mbox', 'no-mbox')}, verb={event.verb.get('id', 'no-verb')}")
        
        # Validate event structure
        if not hasattr(event, 'id') or not event.id:
            logger.error("❌ Event missing ID field")
            return
            
        logger.info(f"✅ Event validation passed for ID: {event.id}")
        
        # Get Elasticsearch service
        logger.info(f"🔧 Elasticsearch service type: {type(elasticsearch_service)}")
        
        # Convert event to dict
        event_dict = event.dict()
        logger.info(f"📊 Event converted to dict, keys: {list(event_dict.keys())}")
        
        # Store in Elasticsearch
        logger.info(f"💾 Attempting to store event in Elasticsearch...")
        result = await elasticsearch_service.store_xapi_statement(event_dict)
        logger.info(f"✅ Elasticsearch storage result: {result}")
        
        # Extract event details for logging
        verb_id = event.verb.get("id", "unknown-verb")
        actor = event.actor.get("mbox", "anonymous").replace("mailto:", "")
        object_id = event.object.get("id", "unknown-object").split("/")[-1]
        
        logger.info(f"🎉 SUCCESS: xAPI event processed - {actor} performed '{verb_id}' on '{object_id}'")
        
    except Exception as e:
        logger.error(f"❌ ERROR processing general xAPI event {getattr(event, 'id', 'UNKNOWN')}: {e}")
        logger.error(f"❌ Exception type: {type(e)}")
        import traceback
        logger.error(f"❌ Full traceback: {traceback.format_exc()}")
        raise


# =========================================================================
# LEARNING ACTIVITY HANDLERS
# =========================================================================

@broker.subscriber(
    "nlj.learning.activities", 
    group_id="nlj-learning-analytics",
    middlewares=[xapi_validation_middleware]
)
async def handle_learning_activity_events(
    event: XAPIEvent,
    elasticsearch_service: ElasticsearchService = Depends(get_elasticsearch_service)
) -> None:
    """Handle learning activity events (game completions, interactions, etc.)"""
    
    try:
        verb_id = event.verb["id"]
        
        # Store event for analytics
        await elasticsearch_service.store_xapi_statement(event.dict())
        
        # Process specific learning events
        if verb_id == "http://adlnet.gov/expapi/verbs/completed":
            await _process_activity_completion(event)
        elif verb_id == "http://adlnet.gov/expapi/verbs/answered":
            await _process_question_interaction(event)
        elif verb_id == "http://adlnet.gov/expapi/verbs/experienced":
            await _process_content_interaction(event)
        
        logger.info(f"Learning activity event {event.id} processed successfully")
        
    except Exception as e:
        logger.error(f"Error processing learning activity event {event.id}: {e}")
        raise


async def _process_activity_completion(event: XAPIEvent) -> None:
    """Process activity completion for learning analytics"""
    
    actor = event.actor
    object_data = event.object
    result = event.result
    
    learner = actor.get("mbox", "anonymous").replace("mailto:", "")
    activity_id = object_data.get("id", "").split("/")[-1]
    success = result.get("success", False)
    score = result.get("score", {}).get("scaled")
    
    logger.info(f"Activity completion: {learner} completed {activity_id} (success: {success}, score: {score})")


async def _process_question_interaction(event: XAPIEvent) -> None:
    """Process question interaction for detailed analytics"""
    
    actor = event.actor
    object_data = event.object
    result = event.result
    context = event.context
    
    learner = actor.get("mbox", "anonymous").replace("mailto:", "")
    question_id = object_data.get("id", "").split("/")[-1]
    response = result.get("response", "no_response")
    
    # Check for question type from extensions
    extensions = context.get("extensions", {})
    question_type = extensions.get("http://nlj.platform/extensions/question_type", "unknown")
    
    logger.info(f"Question interaction: {learner} answered {question_type} question {question_id}: '{response}'")


async def _process_content_interaction(event: XAPIEvent) -> None:
    """Process general content interaction for engagement analytics"""
    
    actor = event.actor
    object_data = event.object
    context = event.context
    
    learner = actor.get("mbox", "anonymous").replace("mailto:", "")
    content_id = object_data.get("id", "").split("/")[-1]
    
    # Check for interaction details from extensions
    extensions = context.get("extensions", {})
    interaction_type = extensions.get("http://nlj.platform/extensions/interaction_type", "view")
    
    logger.info(f"Content interaction: {learner} performed {interaction_type} on {content_id}")


logger.info("Survey and analytics event handlers registered with FastStream")