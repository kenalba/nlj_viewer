"""
Unified logging context for tracking operations across async boundaries.
Provides session-based logging context for better traceability.
"""

import logging
import uuid
from contextvars import ContextVar
from typing import Optional, Dict, Any
from dataclasses import dataclass

# Context variables for tracking async operations
_session_context: ContextVar[Optional["SessionLoggingContext"]] = ContextVar('session_context', default=None)


@dataclass
class SessionLoggingContext:
    """Context for session-based logging with unified tracking."""
    session_id: str
    user_id: str
    user_email: str
    operation: str  # e.g., "content_generation", "document_upload"
    trace_id: Optional[str] = None
    extra_context: Optional[Dict[str, Any]] = None
    
    def __post_init__(self):
        if not self.trace_id:
            self.trace_id = str(uuid.uuid4())[:8]  # Short trace ID
        if not self.extra_context:
            self.extra_context = {}


class SessionLogger:
    """Enhanced logger with session context."""
    
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
        self._base_name = name
    
    def _get_context_prefix(self) -> str:
        """Get context prefix for log messages."""
        context = _session_context.get()
        if not context:
            return ""
        
        return f"[{context.operation}:{context.trace_id}:{context.session_id[:8]}] "
    
    def _log_with_context(self, level: int, msg: str, *args, **kwargs):
        """Log with session context prefix."""
        prefix = self._get_context_prefix()
        context = _session_context.get()
        
        # Add context information to extra if available
        extra = kwargs.get('extra', {})
        if context:
            extra.update({
                'session_id': context.session_id,
                'user_id': context.user_id,
                'user_email': context.user_email,
                'operation': context.operation,
                'trace_id': context.trace_id,
                **context.extra_context
            })
        kwargs['extra'] = extra
        
        self.logger.log(level, prefix + msg, *args, **kwargs)
    
    def debug(self, msg: str, *args, **kwargs):
        self._log_with_context(logging.DEBUG, msg, *args, **kwargs)
    
    def info(self, msg: str, *args, **kwargs):
        self._log_with_context(logging.INFO, msg, *args, **kwargs)
    
    def warning(self, msg: str, *args, **kwargs):
        self._log_with_context(logging.WARNING, msg, *args, **kwargs)
    
    def error(self, msg: str, *args, **kwargs):
        self._log_with_context(logging.ERROR, msg, *args, **kwargs)
    
    def critical(self, msg: str, *args, **kwargs):
        self._log_with_context(logging.CRITICAL, msg, *args, **kwargs)


def get_session_logger(name: str) -> SessionLogger:
    """Get a session-aware logger."""
    return SessionLogger(name)


def set_session_context(context: SessionLoggingContext):
    """Set the session context for the current async task."""
    _session_context.set(context)


def get_session_context() -> Optional[SessionLoggingContext]:
    """Get the current session context."""
    return _session_context.get()


def clear_session_context():
    """Clear the session context."""
    _session_context.set(None)


class SessionContextManager:
    """Context manager for session-based logging."""
    
    def __init__(self, session_id: str, user_id: str, user_email: str, operation: str, **extra_context):
        self.context = SessionLoggingContext(
            session_id=session_id,
            user_id=user_id,
            user_email=user_email,
            operation=operation,
            extra_context=extra_context
        )
        self.previous_context = None
    
    def __enter__(self):
        self.previous_context = _session_context.get()
        _session_context.set(self.context)
        return self.context
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        _session_context.set(self.previous_context)


def with_session_context(session_id: str, user_id: str, user_email: str, operation: str, **extra_context):
    """Context manager decorator for session-based logging."""
    return SessionContextManager(session_id, user_id, user_email, operation, **extra_context)


# Utility functions for common logging patterns
def log_api_request(logger: SessionLogger, endpoint: str, method: str = "POST", **details):
    """Log an API request with consistent formatting."""
    logger.info(f"🌐 API Request: {method} {endpoint}")
    for key, value in details.items():
        logger.info(f"  - {key}: {value}")


def log_database_operation(logger: SessionLogger, operation: str, table: str, **details):
    """Log a database operation with consistent formatting."""
    logger.info(f"💾 Database {operation}: {table}")
    for key, value in details.items():
        logger.info(f"  - {key}: {value}")


def log_external_api_call(logger: SessionLogger, service: str, operation: str, **details):
    """Log an external API call with consistent formatting."""
    logger.info(f"🔗 External API Call: {service} - {operation}")
    for key, value in details.items():
        logger.info(f"  - {key}: {value}")


def log_event_published(logger: SessionLogger, event_type: str, topic: str, **details):
    """Log an event publication with consistent formatting."""
    logger.info(f"📡 Event Published: {event_type} → {topic}")
    for key, value in details.items():
        logger.info(f"  - {key}: {value}")


def log_error_with_context(logger: SessionLogger, error: Exception, operation: str, **context):
    """Log an error with full context and traceback."""
    logger.error(f"💥 Error in {operation}: {type(error).__name__}")
    logger.error(f"  - Message: {str(error)}")
    for key, value in context.items():
        logger.error(f"  - {key}: {value}")
    
    # Log traceback for debugging
    import traceback
    logger.error(f"  - Traceback: {traceback.format_exc()}")