"""
Enhanced xAPI statement builder with node metadata integration.

This module extends the existing xAPI functionality to include node-level
metadata in statements, enabling granular analytics and cross-activity 
content intelligence.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.node import Node
from app.models.content import ContentItem
from app.models.learning_objective import LearningObjective, Keyword
from app.services.node_service import NodeService

logger = logging.getLogger(__name__)


class NodeXAPIBuilder:
    """
    Builder for creating xAPI statements enhanced with node-level metadata.
    
    Provides utilities for enriching xAPI statements with node performance
    data, learning objectives, keywords, and content intelligence.
    """
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.node_service = NodeService(session)
    
    async def enrich_statement_with_node_metadata(
        self, 
        statement: Dict[str, Any], 
        node_id: UUID,
        include_performance: bool = True,
        include_concepts: bool = True
    ) -> Dict[str, Any]:
        """
        Enrich an xAPI statement with comprehensive node metadata.
        
        Args:
            statement: Base xAPI statement dictionary
            node_id: ID of the node to include metadata for
            include_performance: Whether to include performance metrics
            include_concepts: Whether to include learning objectives and keywords
            
        Returns:
            Enhanced xAPI statement with node metadata
        """
        
        # Get node details
        node = await self.session.get(Node, node_id)
        if not node:
            logger.warning(f"Node {node_id} not found for xAPI enrichment")
            return statement
        
        # Create enhanced copy
        enhanced_statement = statement.copy()
        
        # Ensure object structure exists
        if 'object' not in enhanced_statement:
            enhanced_statement['object'] = {}
        if 'definition' not in enhanced_statement['object']:
            enhanced_statement['object']['definition'] = {}
        if 'extensions' not in enhanced_statement['object']['definition']:
            enhanced_statement['object']['definition']['extensions'] = {}
        
        extensions = enhanced_statement['object']['definition']['extensions']
        
        # Add core node metadata
        extensions['http://nlj.platform/extensions/node_metadata'] = {
            'node_id': str(node_id),
            'node_type': node.node_type,
            'content_hash': node.content_hash,
            'title': node.title,
            'description': node.description,
            'difficulty_level': node.difficulty_level,
            'created_at': node.created_at.isoformat() if node.created_at else None,
            'updated_at': node.updated_at.isoformat() if node.updated_at else None
        }
        
        # Add performance context if requested
        if include_performance:
            extensions['http://nlj.platform/extensions/performance_context'] = {
                'node_historical_success_rate': float(node.success_rate) if node.success_rate else None,
                'node_avg_completion_time': node.avg_completion_time,
                'node_difficulty_score': float(node.difficulty_score) if node.difficulty_score else None,
                'node_engagement_score': float(node.engagement_score) if node.engagement_score else None
            }
        
        # Add learning concepts if requested
        if include_concepts:
            concepts_data = await self._get_node_concepts(node_id)
            if concepts_data:
                extensions['http://nlj.platform/extensions/learning_concepts'] = concepts_data
        
        return enhanced_statement
    
    async def create_node_interaction_statement(
        self,
        node_id: UUID,
        actor: Dict[str, Any],
        verb_id: str,
        verb_display: str,
        result: Optional[Dict[str, Any]] = None,
        context_extensions: Optional[Dict[str, Any]] = None,
        activity_id: Optional[UUID] = None,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a node-focused xAPI statement from scratch.
        
        Args:
            node_id: Target node ID
            actor: xAPI actor object
            verb_id: xAPI verb ID (IRI)
            verb_display: Human-readable verb display
            result: Optional result object
            context_extensions: Additional context extensions
            activity_id: Parent activity ID if applicable
            session_id: Session identifier
            
        Returns:
            Complete xAPI statement targeting the node
        """
        
        # Get node for object construction
        node = await self.session.get(Node, node_id)
        if not node:
            raise ValueError(f"Node {node_id} not found")
        
        # Build base statement
        statement = {
            'id': str(uuid4()),
            'version': '1.0.3',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'actor': actor,
            'verb': {
                'id': verb_id,
                'display': {'en-US': verb_display}
            },
            'object': {
                'id': f'node://{node_id}',
                'definition': {
                    'name': {'en-US': node.title or f'Node {node_id}'},
                    'description': {'en-US': node.description or ''},
                    'type': f'http://nlj.platform/activity-types/{node.node_type}',
                    'extensions': {}
                }
            }
        }
        
        # Add result if provided
        if result:
            statement['result'] = result
        
        # Build context
        context = {
            'platform': 'NLJ Platform',
            'language': 'en-US',
            'extensions': context_extensions or {}
        }
        
        # Add session and activity context
        if session_id:
            context['registration'] = session_id
            context['extensions']['http://nlj.platform/extensions/session_id'] = session_id
        
        if activity_id:
            # Get activity details for parent context
            activity = await self.session.get(ContentItem, activity_id)
            if activity:
                context['contextActivities'] = {
                    'parent': [{
                        'id': f'activity://{activity_id}',
                        'definition': {
                            'name': {'en-US': activity.title or f'Activity {activity_id}'},
                            'type': 'http://nlj.platform/activity-types/activity'
                        }
                    }]
                }
                context['extensions']['http://nlj.platform/extensions/activity_id'] = str(activity_id)
        
        statement['context'] = context
        
        # Enrich with node metadata
        enhanced_statement = await self.enrich_statement_with_node_metadata(
            statement, node_id, include_performance=True, include_concepts=True
        )
        
        return enhanced_statement
    
    async def create_node_sequence_context(
        self, 
        activity_id: UUID, 
        current_node_id: UUID
    ) -> Dict[str, Any]:
        """
        Create context information about node sequence within an activity.
        
        Args:
            activity_id: Parent activity ID
            current_node_id: Current node being tracked
            
        Returns:
            Context extensions with sequence information
        """
        
        # Get all nodes for this activity in order
        nodes_with_relationships = await self.node_service.get_nodes_by_activity(activity_id, ordered=True)
        
        # Find current node position
        current_position = None
        total_nodes = len(nodes_with_relationships)
        
        for i, (node, activity_node) in enumerate(nodes_with_relationships):
            if node.id == current_node_id:
                current_position = i
                break
        
        if current_position is None:
            logger.warning(f"Node {current_node_id} not found in activity {activity_id}")
            return {}
        
        # Build sequence context
        sequence_context = {
            'http://nlj.platform/extensions/sequence_context': {
                'current_position': current_position,
                'total_nodes': total_nodes,
                'progress_percentage': round((current_position / total_nodes) * 100, 1) if total_nodes > 0 else 0,
                'activity_id': str(activity_id)
            }
        }
        
        # Add previous/next node information
        if current_position > 0:
            prev_node, _ = nodes_with_relationships[current_position - 1]
            sequence_context['http://nlj.platform/extensions/sequence_context']['previous_node'] = {
                'node_id': str(prev_node.id),
                'node_type': prev_node.node_type,
                'title': prev_node.title
            }
        
        if current_position < total_nodes - 1:
            next_node, _ = nodes_with_relationships[current_position + 1]
            sequence_context['http://nlj.platform/extensions/sequence_context']['next_node'] = {
                'node_id': str(next_node.id),
                'node_type': next_node.node_type,
                'title': next_node.title
            }
        
        return sequence_context
    
    async def create_bulk_statements_for_activity(
        self,
        activity_id: UUID,
        actor: Dict[str, Any],
        session_id: str,
        events: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Create multiple node-enhanced xAPI statements for an activity session.
        
        Args:
            activity_id: Parent activity ID
            actor: xAPI actor object
            session_id: Session identifier
            events: List of event dictionaries with node_id, verb, result data
            
        Returns:
            List of enhanced xAPI statements
        """
        
        statements = []
        
        for event in events:
            try:
                node_id = UUID(event['node_id'])
                
                # Get sequence context
                sequence_context = await self.create_node_sequence_context(activity_id, node_id)
                
                # Merge with event context
                context_extensions = {**sequence_context, **event.get('context_extensions', {})}
                
                # Create statement
                statement = await self.create_node_interaction_statement(
                    node_id=node_id,
                    actor=actor,
                    verb_id=event['verb_id'],
                    verb_display=event['verb_display'],
                    result=event.get('result'),
                    context_extensions=context_extensions,
                    activity_id=activity_id,
                    session_id=session_id
                )
                
                statements.append(statement)
                
            except Exception as e:
                logger.error(f"Failed to create statement for event {event}: {e}")
                continue
        
        return statements
    
    async def _get_node_concepts(self, node_id: UUID) -> Optional[Dict[str, Any]]:
        """Get learning objectives and keywords for a node"""
        
        try:
            # Get learning objectives
            objectives_result = await self.session.execute(
                select(LearningObjective)
                .join(LearningObjective.node_relationships)
                .where(LearningObjective.node_relationships.any(node_id=node_id))
            )
            objectives = objectives_result.scalars().all()
            
            # Get keywords
            keywords_result = await self.session.execute(
                select(Keyword)
                .join(Keyword.node_relationships)
                .where(Keyword.node_relationships.any(node_id=node_id))
            )
            keywords = keywords_result.scalars().all()
            
            if not objectives and not keywords:
                return None
            
            return {
                'learning_objectives': [
                    {
                        'id': str(obj.id),
                        'text': obj.objective_text,
                        'domain': obj.domain,
                        'cognitive_level': obj.cognitive_level,
                        'difficulty_level': obj.difficulty_level
                    } for obj in objectives
                ],
                'keywords': [
                    {
                        'id': str(kw.id),
                        'text': kw.keyword_text,
                        'domain': kw.domain,
                        'category': kw.category
                    } for kw in keywords
                ]
            }
            
        except Exception as e:
            logger.error(f"Failed to get concepts for node {node_id}: {e}")
            return None


class NodeXAPIStatementValidator:
    """Validator for node-enhanced xAPI statements"""
    
    @staticmethod
    def validate_node_statement(statement: Dict[str, Any]) -> List[str]:
        """
        Validate a node-enhanced xAPI statement.
        
        Returns:
            List of validation errors (empty if valid)
        """
        errors = []
        
        # Check required xAPI fields
        required_fields = ['id', 'actor', 'verb', 'object']
        for field in required_fields:
            if field not in statement:
                errors.append(f"Missing required field: {field}")
        
        # Check object format for nodes
        obj = statement.get('object', {})
        object_id = obj.get('id', '')
        
        if object_id.startswith('node://'):
            # Validate node ID format
            node_id_str = object_id.replace('node://', '')
            try:
                UUID(node_id_str)
            except ValueError:
                errors.append(f"Invalid node ID format in object.id: {object_id}")
        
        # Check for node metadata in extensions
        definition = obj.get('definition', {})
        extensions = definition.get('extensions', {})
        
        node_metadata = extensions.get('http://nlj.platform/extensions/node_metadata')
        if node_metadata:
            required_metadata = ['node_id', 'node_type']
            for field in required_metadata:
                if field not in node_metadata:
                    errors.append(f"Missing required node metadata field: {field}")
        
        return errors


# Utility functions for integration

async def create_node_xapi_builder(session: AsyncSession) -> NodeXAPIBuilder:
    """Create a NodeXAPIBuilder instance"""
    return NodeXAPIBuilder(session)


def extract_node_id_from_statement(statement: Dict[str, Any]) -> Optional[UUID]:
    """Extract node ID from an xAPI statement"""
    
    # Check object ID first
    obj = statement.get('object', {})
    object_id = obj.get('id', '')
    
    if object_id.startswith('node://'):
        try:
            return UUID(object_id.replace('node://', ''))
        except ValueError:
            pass
    
    # Check extensions
    definition = obj.get('definition', {})
    extensions = definition.get('extensions', {})
    
    node_metadata = extensions.get('http://nlj.platform/extensions/node_metadata', {})
    node_id_str = node_metadata.get('node_id')
    
    if node_id_str:
        try:
            return UUID(node_id_str)
        except ValueError:
            pass
    
    return None


def is_node_statement(statement: Dict[str, Any]) -> bool:
    """Check if an xAPI statement targets a node"""
    return extract_node_id_from_statement(statement) is not None


logger.info("Node xAPI builder utilities loaded")