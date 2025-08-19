"""
xAPI validation subscriber middleware for FastStream.
Implements correct subscriber middleware pattern as per FastStream documentation.
"""

import logging
from typing import Any, Callable, Dict

from pydantic import BaseModel, ValidationError, Field

logger = logging.getLogger(__name__)


class XAPIValidationError(Exception):
    """Custom exception for xAPI validation failures"""
    pass


class XAPIActor(BaseModel):
    """xAPI Actor validation schema"""
    objectType: str = Field(default="Agent", pattern="^Agent$")
    name: str = Field(..., min_length=1, max_length=100)
    mbox: str = Field(..., pattern=r"^mailto:[^@]+@[^@]+\.[^@]+$")
    account: Dict[str, str] = None


class XAPIVerb(BaseModel):
    """xAPI Verb validation schema"""
    id: str = Field(..., pattern=r"^https?://")
    display: Dict[str, str] = Field(...)


class XAPIObject(BaseModel):
    """xAPI Object validation schema"""
    objectType: str = Field(default="Activity", pattern="^Activity$")
    id: str = Field(..., min_length=1)
    definition: Dict[str, Any] = None


class XAPIResult(BaseModel):
    """xAPI Result validation schema"""
    completion: bool = None
    success: bool = None
    response: str = None
    score: Dict[str, float] = None
    duration: str = None


class XAPIContext(BaseModel):
    """xAPI Context validation schema"""
    platform: str = None
    language: str = None
    extensions: Dict[str, Any] = None


class XAPIStatement(BaseModel):
    """Complete xAPI statement validation schema"""
    id: str = Field(...)
    version: str = Field(default="1.0.3", pattern="^1\.0\.3$")
    timestamp: str = Field(...)
    actor: XAPIActor
    verb: XAPIVerb
    object: XAPIObject
    result: XAPIResult = None
    context: XAPIContext = None


# Global validation statistics
validation_stats = {
    "total_validations": 0,
    "successful_validations": 0,
    "failed_validations": 0,
    "validation_errors": []
}


def _extract_message_data(message: Any) -> Dict[str, Any]:
    """Extract message data from FastStream message object"""
    
    logger.debug(f"🔍 Message type: {type(message)}")
    
    # Try different FastStream message attributes
    if hasattr(message, 'decoded_body'):
        logger.debug("📦 Extracting from message.decoded_body")
        return message.decoded_body
    elif hasattr(message, 'body'):
        logger.debug("📦 Extracting from message.body")
        return message.body
    elif hasattr(message, 'value'):
        logger.debug("📦 Extracting from message.value")
        return message.value
    elif isinstance(message, dict):
        logger.debug("📦 Message is already a dict")
        return message
    else:
        # Try to convert to dict
        logger.debug(f"📦 Attempting to convert {type(message)} to dict")
        try:
            result = dict(message)
            logger.debug("📦 Conversion successful")
            return result
        except Exception as e:
            logger.error(f"❌ Conversion failed: {e}")
            raise XAPIValidationError(f"Unable to extract message data from: {type(message)}")


def _validate_xapi_statement(data: Dict[str, Any]) -> list:
    """
    Validate xAPI statement structure and content.
    
    Returns:
        List of validation errors (empty if valid)
    """
    errors = []
    
    logger.debug(f"🔍 Validating xAPI statement with keys: {list(data.keys()) if isinstance(data, dict) else 'not-dict'}")
    
    if isinstance(data, dict):
        event_id = data.get('id', 'missing')
        logger.debug(f"📄 Event ID: {event_id}")
        logger.debug(f"📄 Actor: {data.get('actor', {}).get('mbox', 'no-mbox')}")
        logger.debug(f"📄 Verb: {data.get('verb', {}).get('id', 'no-verb')}")
    
    try:
        # Use Pydantic model for comprehensive validation
        logger.debug("✅ Attempting Pydantic validation...")
        validated_statement = XAPIStatement(**data)
        logger.debug(f"✅ Pydantic validation PASSED for ID: {validated_statement.id}")
        
        # Additional custom validations could go here
        # For now, we'll rely on Pydantic validation
        
    except ValidationError as e:
        logger.warning(f"❌ PYDANTIC validation error: {e}")
        for error in e.errors():
            field_path = '.'.join(str(loc) for loc in error['loc'])
            error_msg = f"{field_path}: {error['msg']}"
            errors.append(error_msg)
            logger.warning(f"❌ Validation error: {error_msg}")
    except Exception as e:
        error_msg = f"Unexpected validation error: {e}"
        errors.append(error_msg)
        logger.error(f"❌ {error_msg}")
            
    logger.debug(f"🔍 Total validation errors found: {len(errors)}")
    return errors


async def xapi_validation_middleware(call_next: Callable, message: Any) -> Any:
    """
    xAPI validation subscriber middleware for FastStream.
    
    This middleware validates incoming xAPI events according to 1.0.3 specification.
    
    Args:
        call_next: The next function in the middleware chain
        message: The incoming message from Kafka
        
    Returns:
        Result from the next handler if validation passes
        
    Raises:
        XAPIValidationError: If validation fails critically
    """
    
    validation_stats["total_validations"] += 1
    logger.info(f"🔍 xAPI Validation Middleware called - validation #{validation_stats['total_validations']}")
    
    try:
        # Extract message data
        logger.debug(f"📥 Extracting message data from: {type(message)}")
        message_data = _extract_message_data(message)
        
        # Get event ID for logging
        event_id = message_data.get('id', 'no-id') if isinstance(message_data, dict) else 'no-dict'
        logger.info(f"🎯 Processing event ID: {event_id}")
        
        # Validate xAPI statement structure
        logger.debug(f"✅ Starting xAPI validation for event: {event_id}")
        validation_errors = _validate_xapi_statement(message_data)
        
        if validation_errors:
            # Log validation failure but don't block processing
            validation_stats["failed_validations"] += 1
            validation_stats["validation_errors"].extend(validation_errors)
            
            logger.warning(f"⚠️  xAPI validation FAILED for event {event_id}: {validation_errors}")
            logger.warning("⚠️  Allowing event to proceed for graceful degradation")
            
            # For now, let invalid events through with warnings
            # In production, you might want to route to dead letter queue
            
        else:
            # Validation passed
            validation_stats["successful_validations"] += 1
            logger.info(f"✅ xAPI validation PASSED for event {event_id}")
        
        # Continue to next handler regardless of validation result
        logger.info(f"🚀 Calling next handler for event {event_id}")
        result = await call_next(message)
        logger.info(f"🎉 Handler completed successfully for event {event_id}")
        
        return result
        
    except Exception as e:
        validation_stats["failed_validations"] += 1
        logger.error(f"❌ UNEXPECTED ERROR in xAPI validation middleware: {e}")
        import traceback
        logger.error(f"❌ Full traceback: {traceback.format_exc()}")
        
        # For robustness, continue processing even if middleware fails
        logger.warning("⚠️  Bypassing validation due to error - allowing event to proceed")
        return await call_next(message)


def get_validation_stats() -> Dict[str, Any]:
    """Get validation statistics for monitoring"""
    
    total_validations = validation_stats["total_validations"]
    success_rate = (validation_stats["successful_validations"] / total_validations * 100) if total_validations > 0 else 0
    
    return {
        "total_validations": total_validations,
        "successful_validations": validation_stats["successful_validations"],
        "failed_validations": validation_stats["failed_validations"],
        "success_rate": round(success_rate, 2),
        "recent_errors": validation_stats["validation_errors"][-10:] if validation_stats["validation_errors"] else []
    }


logger.info("xAPI subscriber validation middleware initialized for FastStream")