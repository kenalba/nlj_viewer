"""
Event-driven architecture services.

Modular event publishing system for the NLJ platform, broken down by domain:
- training_events: Program, session, booking, attendance events
- content_events: Content generation, workflow, review events  
- learning_events: Knowledge extraction, auto-tagging events
- system_events: Conflict detection, legacy methods
"""

from .event_registry import get_event_service

__all__ = ['get_event_service']