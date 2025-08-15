"""
Debug middleware to understand what FastStream is passing to middleware.
"""

import logging
from typing import Any, Callable
from faststream import BaseMiddleware

logger = logging.getLogger(__name__)


class DebugMiddleware(BaseMiddleware):
    """
    Simple debug middleware to see what FastStream passes to middleware
    """

    def __init__(self):
        super().__init__()
        self.call_count = 0

    async def __call__(self, message: Any, call_next: Callable) -> Any:
        """
        Debug middleware that logs everything and passes through
        """
        self.call_count += 1
        
        logger.info(f"🐛 DEBUG MIDDLEWARE CALLED #{self.call_count}")
        logger.info(f"🐛 Message type: {type(message)}")
        logger.info(f"🐛 Message dir: {dir(message)}")
        logger.info(f"🐛 Message str: {str(message)}")
        
        if hasattr(message, '__dict__'):
            logger.info(f"🐛 Message dict: {message.__dict__}")
            
        if hasattr(message, 'body'):
            logger.info(f"🐛 Message body type: {type(message.body)}")
            logger.info(f"🐛 Message body: {message.body}")
        
        logger.info(f"🐛 Calling next handler...")
        result = await call_next(message)
        logger.info(f"🐛 Handler returned: {result}")
        
        return result


# Global instance
debug_middleware = DebugMiddleware()

logger.info("Debug middleware initialized")