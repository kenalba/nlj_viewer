"""FastStream event handlers for NLJ Platform"""

# Import all handlers to ensure they're registered with FastStream
from . import content_handlers
from . import survey_handlers
from . import training_handlers
from . import node_interaction_handlers
from . import knowledge_extraction_handlers
from . import auto_tagging_handlers

__all__ = [
    "content_handlers",
    "survey_handlers",
    "training_handlers",
    "node_interaction_handlers",
    "knowledge_extraction_handlers",
    "auto_tagging_handlers"
]