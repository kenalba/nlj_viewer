"""
xAPI validation middleware for FastStream.
Validates xAPI 1.0.3 compliance for all incoming events.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Callable, Dict

from faststream import BaseMiddleware
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


class XAPIValidationMiddleware(BaseMiddleware):
    """
    FastStream middleware for xAPI 1.0.3 compliance validation.
    Validates incoming messages against xAPI specification before processing.
    """

    def __init__(self):
        super().__init__()
        self.validation_errors = []
        self.validation_count = 0
        self.valid_count = 0

    async def __call__(self, message: Any, call_next: Callable) -> Any:
        """
        Validate xAPI statement before processing.
        
        Args:
            message: The incoming Kafka message
            call_next: The next middleware/handler in the chain
            
        Returns:
            Result from the next handler if validation passes
            
        Raises:
            XAPIValidationError: If validation fails
        """
        
        logger.info(f"🔍 xAPI Validation Middleware called - validation #{self.validation_count + 1}")
        
        try:
            # Increment validation counter
            self.validation_count += 1
            logger.info(f"📊 Total validations so far: {self.validation_count} (valid: {self.valid_count})")
            
            # Extract message data
            logger.info(f"📥 Extracting message data from: {type(message)}")
            message_data = self._extract_message_data(message)
            logger.info(f"📦 Extracted message keys: {list(message_data.keys()) if isinstance(message_data, dict) else 'not-dict'}")
            
            # Log basic message info
            event_id = message_data.get('id', 'no-id') if isinstance(message_data, dict) else 'no-dict'
            logger.info(f"🎯 Processing event ID: {event_id}")
            
            # Validate xAPI statement structure
            logger.info(f"✅ Starting xAPI validation for event: {event_id}")
            validation_errors = self._validate_xapi_statement(message_data)
            logger.info(f"🔍 Validation completed, errors found: {len(validation_errors)}")
            
            if validation_errors:
                # Log validation failure
                logger.error(f"❌ xAPI validation FAILED for event {event_id}: {validation_errors}")
                self.validation_errors.extend(validation_errors)
                
                # Publish to error topic for monitoring
                await self._handle_validation_failure(message_data, validation_errors)
                
                # Stop processing invalid events
                logger.error(f"🚫 BLOCKING invalid event {event_id} from processing")
                raise XAPIValidationError(f"xAPI validation failed: {validation_errors}")
            
            # Validation passed
            self.valid_count += 1
            logger.info(f"✅ xAPI validation PASSED for event {event_id} - proceeding to handler")
            
            # Continue to next handler
            logger.info(f"🚀 Calling next handler for event {event_id}")
            result = await call_next(message)
            logger.info(f"🎉 Handler completed successfully for event {event_id}")
            return result
            
        except ValidationError as e:
            error_msg = f"xAPI schema validation error: {e}"
            logger.error(f"❌ PYDANTIC VALIDATION ERROR: {error_msg}")
            await self._handle_validation_failure(message, [error_msg])
            raise XAPIValidationError(error_msg)
            
        except Exception as e:
            logger.error(f"❌ UNEXPECTED ERROR in xAPI validation: {e}")
            import traceback
            logger.error(f"❌ Full traceback: {traceback.format_exc()}")
            raise

    def _extract_message_data(self, message: Any) -> Dict[str, Any]:
        """Extract message data from FastStream message object"""
        
        logger.info(f"🔍 Message type: {type(message)}")
        logger.info(f"🔍 Message attributes: {dir(message) if hasattr(message, '__dict__') else 'no-attributes'}")
        
        if hasattr(message, 'body'):
            # FastStream message object
            logger.info(f"📦 Extracting from message.body: {type(message.body)}")
            return message.body
        elif isinstance(message, dict):
            # Direct dictionary
            logger.info(f"📦 Message is already a dict with keys: {list(message.keys())}")
            return message
        else:
            # Try to convert to dict
            logger.info(f"📦 Attempting to convert {type(message)} to dict")
            try:
                result = dict(message)
                logger.info(f"📦 Conversion successful: {list(result.keys())}")
                return result
            except Exception as e:
                logger.error(f"❌ Conversion failed: {e}")
                raise XAPIValidationError(f"Unable to extract message data from: {type(message)}")

    def _validate_xapi_statement(self, data: Dict[str, Any]) -> list:
        """
        Validate xAPI statement structure and content.
        
        Args:
            data: The xAPI statement data
            
        Returns:
            List of validation errors (empty if valid)
        """
        errors = []
        
        logger.info(f"🔍 Validating xAPI statement with keys: {list(data.keys()) if isinstance(data, dict) else 'not-dict'}")
        
        # Log the data structure for debugging
        if isinstance(data, dict):
            logger.info(f"📄 Event details - ID: {data.get('id', 'missing')}, Version: {data.get('version', 'missing')}")
            logger.info(f"📄 Actor: {data.get('actor', {}).get('mbox', 'no-mbox')}")
            logger.info(f"📄 Verb: {data.get('verb', {}).get('id', 'no-verb')}")
            logger.info(f"📄 Object: {data.get('object', {}).get('id', 'no-object')}")
        
        try:
            # Use Pydantic model for comprehensive validation
            logger.info("✅ Attempting Pydantic validation...")
            validated_statement = XAPIStatement(**data)
            logger.info(f"✅ Pydantic validation PASSED for ID: {validated_statement.id}")
            
            # Additional custom validations
            logger.info("🔍 Running custom validation checks...")
            verb_errors = self._validate_verb_id(data.get('verb', {}))
            actor_errors = self._validate_actor_format(data.get('actor', {}))
            timestamp_errors = self._validate_timestamp_format(data.get('timestamp', ''))
            object_errors = self._validate_object_id(data.get('object', {}))
            
            errors.extend(verb_errors)
            errors.extend(actor_errors)
            errors.extend(timestamp_errors)
            errors.extend(object_errors)
            
            logger.info(f"🔍 Custom validation results - verb: {len(verb_errors)}, actor: {len(actor_errors)}, timestamp: {len(timestamp_errors)}, object: {len(object_errors)}")
            
        except ValidationError as e:
            # Convert Pydantic validation errors to readable format
            logger.error(f"❌ PYDANTIC validation error: {e}")
            for error in e.errors():
                field_path = '.'.join(str(loc) for loc in error['loc'])
                error_msg = f"{field_path}: {error['msg']}"
                errors.append(error_msg)
                logger.error(f"❌ Validation error: {error_msg}")
        except Exception as e:
            error_msg = f"Unexpected validation error: {e}"
            errors.append(error_msg)
            logger.error(f"❌ {error_msg}")
                
        logger.info(f"🔍 Total validation errors found: {len(errors)}")
        return errors

    def _validate_verb_id(self, verb: Dict[str, Any]) -> list:
        """Validate verb ID against known xAPI verbs"""
        errors = []
        
        verb_id = verb.get('id', '')
        
        # Known xAPI verb patterns
        valid_verb_patterns = [
            'http://adlnet.gov/expapi/verbs/',
            'http://activitystrea.ms/schema/1.0/',
            'http://nlj.platform/verbs/',  # Custom platform verbs
        ]
        
        if not any(verb_id.startswith(pattern) for pattern in valid_verb_patterns):
            errors.append(f"Unknown verb ID pattern: {verb_id}")
        
        # Require display property
        if 'display' not in verb:
            errors.append("Verb missing required 'display' property")
        elif not isinstance(verb['display'], dict):
            errors.append("Verb 'display' must be an object")
        elif 'en-US' not in verb['display']:
            errors.append("Verb 'display' must contain 'en-US' language")
            
        return errors

    def _validate_actor_format(self, actor: Dict[str, Any]) -> list:
        """Validate actor format"""
        errors = []
        
        # Check for required identification
        if 'mbox' not in actor and 'account' not in actor:
            errors.append("Actor must have either 'mbox' or 'account' for identification")
        
        # Validate mbox format if present
        if 'mbox' in actor:
            mbox = actor['mbox']
            if not mbox.startswith('mailto:'):
                errors.append(f"Actor mbox must start with 'mailto:': {mbox}")
                
        # Validate account format if present
        if 'account' in actor:
            account = actor['account']
            if not isinstance(account, dict):
                errors.append("Actor 'account' must be an object")
            elif not all(key in account for key in ['name', 'homePage']):
                errors.append("Actor 'account' must contain 'name' and 'homePage'")
                
        return errors

    def _validate_timestamp_format(self, timestamp: str) -> list:
        """Validate timestamp format (ISO 8601)"""
        errors = []
        
        if not timestamp:
            errors.append("Timestamp is required")
            return errors
            
        try:
            # Try to parse as ISO 8601
            datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        except ValueError:
            errors.append(f"Invalid timestamp format (must be ISO 8601): {timestamp}")
            
        return errors

    def _validate_object_id(self, obj: Dict[str, Any]) -> list:
        """Validate object ID format"""
        errors = []
        
        object_id = obj.get('id', '')
        
        if not object_id:
            errors.append("Object ID is required")
            return errors
        
        # Valid object ID patterns for platform
        valid_id_patterns = [
            'http://nlj.platform/',
            'http://adlnet.gov/expapi/',
            'https://',
        ]
        
        if not any(object_id.startswith(pattern) for pattern in valid_id_patterns):
            errors.append(f"Object ID should use recognized URI scheme: {object_id}")
            
        return errors

    async def _handle_validation_failure(self, message_data: Any, errors: list) -> None:
        """Handle validation failure by logging and optionally publishing to error topic"""
        
        error_details = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "validation_errors": errors,
            "message_data": message_data,
            "error_type": "xapi_validation_failure"
        }
        
        # Log detailed error
        logger.error(f"xAPI Validation Failed: {error_details}")
        
        # Could publish to dead letter queue/error topic here
        # await self.publish_to_error_topic(error_details)

    def get_validation_stats(self) -> Dict[str, Any]:
        """Get validation statistics for monitoring"""
        
        total_validations = self.validation_count
        failed_validations = len(self.validation_errors)
        success_rate = (self.valid_count / total_validations * 100) if total_validations > 0 else 0
        
        return {
            "total_validations": total_validations,
            "successful_validations": self.valid_count,
            "failed_validations": failed_validations,
            "success_rate": round(success_rate, 2),
            "recent_errors": self.validation_errors[-10:] if self.validation_errors else []
        }


# Global middleware instance for statistics tracking
xapi_validation_middleware = XAPIValidationMiddleware()


logger.info("xAPI validation middleware initialized for FastStream")