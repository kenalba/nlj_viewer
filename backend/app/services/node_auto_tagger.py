"""
Node Auto-Tagging Service - Automated learning objective and keyword tagging for nodes.

Leverages the Knowledge Extraction Service to automatically analyze and tag nodes
with learning objectives and keywords, providing confidence scoring and quality metrics.
"""

import asyncio
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database_manager import db_manager
from app.models.node import Node
from app.models.learning_objective import (
    NodeLearningObjective, NodeKeyword
)
from app.services.knowledge_extraction_service import KnowledgeExtractionService
from app.services.kafka_service import get_xapi_event_service
import os
import logging

logger = logging.getLogger(__name__)


class TaggingStrategy(Enum):
    """Auto-tagging strategies for different scenarios."""
    CONSERVATIVE = "conservative"  # High confidence threshold, fewer tags
    BALANCED = "balanced"         # Moderate confidence, good coverage
    COMPREHENSIVE = "comprehensive"  # Lower confidence, maximum coverage


class TaggingQuality(Enum):
    """Quality assessment for auto-tagged content."""
    HIGH = "high"           # >90% confidence, manual review optional
    MEDIUM = "medium"       # 70-90% confidence, review recommended  
    LOW = "low"            # 50-70% confidence, manual review required
    UNCERTAIN = "uncertain" # <50% confidence, manual tagging suggested


@dataclass
class TaggingResult:
    """Result of auto-tagging analysis."""
    node_id: uuid.UUID
    strategy_used: TaggingStrategy
    overall_quality: TaggingQuality
    confidence_score: float
    
    # Tagging results
    objectives_added: List[Dict[str, Any]]
    keywords_added: List[Dict[str, Any]]
    objectives_suggested: List[Dict[str, Any]]  # Below threshold but relevant
    keywords_suggested: List[Dict[str, Any]]
    
    # Quality metrics
    content_analysis_time: float
    total_processing_time: float
    extraction_metadata: Dict[str, Any]


@dataclass
class AutoTaggingConfig:
    """Configuration for auto-tagging behavior."""
    strategy: TaggingStrategy = TaggingStrategy.BALANCED
    
    # Confidence thresholds by strategy
    confidence_thresholds: Dict[TaggingStrategy, Dict[str, float]] = None
    
    # Quality settings
    max_objectives_per_node: int = 5
    max_keywords_per_node: int = 8
    enable_suggestions: bool = True
    
    # Processing settings
    batch_size: int = 50
    max_concurrent_extractions: int = 3
    retry_failed_extractions: bool = True
    
    def __post_init__(self):
        if self.confidence_thresholds is None:
            # Use environment configuration for thresholds
            base_threshold = float(os.getenv("AUTO_TAGGING_CONFIDENCE_THRESHOLD", "0.75"))
            
            self.confidence_thresholds = {
                TaggingStrategy.CONSERVATIVE: {
                    "objectives": min(base_threshold + 0.10, 0.95),
                    "keywords": min(base_threshold + 0.05, 0.90),
                    "suggestion": base_threshold - 0.05
                },
                TaggingStrategy.BALANCED: {
                    "objectives": base_threshold,
                    "keywords": base_threshold - 0.05,
                    "suggestion": base_threshold - 0.15
                },
                TaggingStrategy.COMPREHENSIVE: {
                    "objectives": base_threshold - 0.10,
                    "keywords": base_threshold - 0.15,
                    "suggestion": base_threshold - 0.25
                }
            }
        
        # Apply environment overrides
        self.max_objectives_per_node = int(os.getenv("AUTO_TAGGING_MAX_OBJECTIVES_PER_NODE", str(self.max_objectives_per_node)))
        self.max_keywords_per_node = int(os.getenv("AUTO_TAGGING_MAX_KEYWORDS_PER_NODE", str(self.max_keywords_per_node)))
        self.batch_size = int(os.getenv("AUTO_TAGGING_BATCH_SIZE", str(self.batch_size)))
        self.max_concurrent_extractions = int(os.getenv("AUTO_TAGGING_MAX_CONCURRENT", str(self.max_concurrent_extractions)))
        self.enable_suggestions = os.getenv("AUTO_TAGGING_ENABLE_SUGGESTIONS", "true").lower() == "true"
        self.retry_failed_extractions = os.getenv("AUTO_TAGGING_RETRY_FAILED", "true").lower() == "true"


class NodeAutoTaggerService:
    """Service for automatically tagging nodes with learning objectives and keywords."""
    
    def __init__(self, config: Optional[AutoTaggingConfig] = None):
        self.config = config or AutoTaggingConfig()
        self.extraction_service = KnowledgeExtractionService()
        self.event_service = None  # Lazy initialization
    
    async def _get_event_service(self):
        """Lazy initialization of event service."""
        if self.event_service is None:
            self.event_service = get_xapi_event_service()
        return self.event_service
    
    async def auto_tag_node(
        self, 
        node_id: uuid.UUID,
        user_id: Optional[str] = None,
        force_retag: bool = False,
        custom_strategy: Optional[TaggingStrategy] = None
    ) -> TaggingResult:
        """
        Automatically tag a single node with learning objectives and keywords.
        
        Args:
            node_id: Node to analyze and tag
            user_id: User initiating the tagging (for audit trail)
            force_retag: Re-tag even if node already has auto-tags
            custom_strategy: Override default tagging strategy
            
        Returns:
            TaggingResult with applied tags and quality metrics
        """
        start_time = datetime.now()
        strategy = custom_strategy or self.config.strategy
        
        try:
            async with db_manager.get_session() as session:
                # Get node with existing relationships
                stmt = select(Node).options(
                    selectinload(Node.learning_objective_relationships),
                    selectinload(Node.keyword_relationships)
                ).where(Node.id == node_id)
                
                result = await session.execute(stmt)
                node = result.scalar_one_or_none()
                
                if not node:
                    raise ValueError(f"Node {node_id} not found")
                
                # Check if node already has auto-tags and force_retag is False
                if not force_retag:
                    existing_auto_objectives = [
                        rel for rel in node.learning_objective_relationships 
                        if rel.auto_tagged
                    ]
                    existing_auto_keywords = [
                        rel for rel in node.keyword_relationships 
                        if rel.auto_tagged
                    ]
                    
                    if existing_auto_objectives or existing_auto_keywords:
                        logger.info(f"Node {node_id} already has auto-tags, skipping (use force_retag=True to override)")
                        return await self._build_skip_result(node, strategy, start_time)
                
                # Extract content text
                content_text = self._extract_node_text(node)
                if not content_text.strip():
                    logger.warning(f"No extractable text from node {node_id}")
                    return await self._build_empty_result(node, strategy, start_time, "no_content")
                
                # Perform content analysis
                analysis_start = datetime.now()
                
                extracted_metadata = await self.extraction_service.extract_content_metadata(
                    content=content_text,
                    content_type=node.node_type,
                    context={
                        'title': node.title,
                        'node_id': str(node_id),
                        'auto_tagging': True
                    }
                )
                
                analysis_time = (datetime.now() - analysis_start).total_seconds()
                
                # Normalize and filter by confidence
                normalized = await self.extraction_service.normalize_and_store_metadata(
                    extracted=extracted_metadata,
                    node_id=node_id,
                    auto_apply=False  # We'll apply manually with confidence filtering
                )
                
                # Apply confidence-based filtering and tagging
                tagging_result = await self._apply_confident_tags(
                    session, node, normalized, strategy, extracted_metadata.confidence_score
                )
                
                # Publish auto-tagging event
                event_service = await self._get_event_service()
                await event_service.publish_auto_tagging_completed(
                    node_id=str(node_id),
                    user_id=user_id or "system",
                    strategy=strategy.value,
                    quality=tagging_result.overall_quality.value,
                    objectives_added=len(tagging_result.objectives_added),
                    keywords_added=len(tagging_result.keywords_added),
                    confidence_score=tagging_result.confidence_score
                )
                
                await session.commit()
                
                # Complete result
                tagging_result.content_analysis_time = analysis_time
                tagging_result.total_processing_time = (datetime.now() - start_time).total_seconds()
                tagging_result.extraction_metadata = {
                    'llm_confidence': extracted_metadata.confidence_score,
                    'domain': extracted_metadata.domain,
                    'difficulty_level': extracted_metadata.difficulty_level,
                    'cognitive_levels': extracted_metadata.cognitive_levels
                }
                
                logger.info(f"Auto-tagged node {node_id}: {len(tagging_result.objectives_added)} objectives, {len(tagging_result.keywords_added)} keywords")
                return tagging_result
                
        except Exception as e:
            logger.error(f"Error auto-tagging node {node_id}: {e}")
            return await self._build_error_result(node_id, strategy, start_time, str(e))
    
    async def auto_tag_batch(
        self,
        node_ids: List[uuid.UUID],
        user_id: Optional[str] = None,
        strategy: Optional[TaggingStrategy] = None,
        progress_callback: Optional[callable] = None
    ) -> List[TaggingResult]:
        """
        Auto-tag multiple nodes in batches with concurrency control.
        
        Args:
            node_ids: List of nodes to process
            user_id: User initiating the batch tagging
            strategy: Tagging strategy to use
            progress_callback: Optional callback for progress updates
            
        Returns:
            List of TaggingResults for each processed node
        """
        results = []
        strategy = strategy or self.config.strategy
        
        # Process in batches with concurrency limit
        for i in range(0, len(node_ids), self.config.batch_size):
            batch = node_ids[i:i + self.config.batch_size]
            
            # Create semaphore for concurrency control
            semaphore = asyncio.Semaphore(self.config.max_concurrent_extractions)
            
            async def process_node_with_semaphore(node_id: uuid.UUID):
                async with semaphore:
                    return await self.auto_tag_node(node_id, user_id, strategy=strategy)
            
            # Process batch concurrently
            batch_tasks = [process_node_with_semaphore(node_id) for node_id in batch]
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
            
            # Handle results and exceptions
            for j, result in enumerate(batch_results):
                if isinstance(result, Exception):
                    logger.error(f"Error processing node {batch[j]}: {result}")
                    # Create error result
                    error_result = await self._build_error_result(batch[j], strategy, datetime.now(), str(result))
                    results.append(error_result)
                else:
                    results.append(result)
            
            # Progress callback
            if progress_callback:
                progress = (i + len(batch)) / len(node_ids)
                await progress_callback(progress, len(results), len(node_ids))
        
        logger.info(f"Batch auto-tagging completed: {len(results)} nodes processed")
        return results
    
    async def get_auto_tagging_candidates(
        self,
        limit: int = 100,
        exclude_recently_tagged: bool = True,
        min_content_length: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Get nodes that are good candidates for auto-tagging.
        
        Args:
            limit: Maximum nodes to return
            exclude_recently_tagged: Skip nodes tagged in last 7 days
            min_content_length: Minimum extractable content length
            
        Returns:
            List of candidate node information
        """
        async with db_manager.get_session() as session:
            # Base query for nodes without auto-tags
            stmt = select(Node).options(
                selectinload(Node.learning_objective_relationships),
                selectinload(Node.keyword_relationships)
            )
            
            # Exclude recently auto-tagged nodes
            if exclude_recently_tagged:
                recent_cutoff = datetime.now() - timedelta(days=7)
                
                # Subquery for nodes with recent auto-tags
                recent_auto_tagged = select(Node.id).join(NodeLearningObjective).where(
                    and_(
                        NodeLearningObjective.auto_tagged.is_(True),
                        NodeLearningObjective.created_at >= recent_cutoff
                    )
                ).union(
                    select(Node.id).join(NodeKeyword).where(
                        and_(
                            NodeKeyword.auto_tagged.is_(True),
                            NodeKeyword.created_at >= recent_cutoff
                        )
                    )
                )
                
                stmt = stmt.where(Node.id.not_in(recent_auto_tagged))
            
            stmt = stmt.limit(limit)
            result = await session.execute(stmt)
            nodes = result.scalars().all()
            
            candidates = []
            for node in nodes:
                # Check content length
                content_text = self._extract_node_text(node)
                if len(content_text.strip()) < min_content_length:
                    continue
                
                # Count existing tags
                auto_objectives = sum(1 for rel in node.learning_objective_relationships if rel.auto_tagged)
                auto_keywords = sum(1 for rel in node.keyword_relationships if rel.auto_tagged)
                manual_objectives = sum(1 for rel in node.learning_objective_relationships if not rel.auto_tagged)
                manual_keywords = sum(1 for rel in node.keyword_relationships if not rel.auto_tagged)
                
                candidates.append({
                    'node_id': str(node.id),
                    'node_type': node.node_type,
                    'title': node.title,
                    'content_preview': content_text[:200] + "..." if len(content_text) > 200 else content_text,
                    'content_length': len(content_text),
                    'existing_tags': {
                        'auto_objectives': auto_objectives,
                        'auto_keywords': auto_keywords,
                        'manual_objectives': manual_objectives,
                        'manual_keywords': manual_keywords
                    },
                    'tagging_priority': self._calculate_tagging_priority(node, content_text)
                })
            
            # Sort by tagging priority
            candidates.sort(key=lambda x: x['tagging_priority'], reverse=True)
            return candidates
    
    def _extract_node_text(self, node: Node) -> str:
        """Extract meaningful text content from node for analysis."""
        text_parts = []
        
        if node.title:
            text_parts.append(node.title)
        
        if node.description:
            text_parts.append(node.description)
        
        # Extract from node content
        if isinstance(node.content, dict):
            for key in ['text', 'content', 'question', 'prompt', 'instructions']:
                if key in node.content and node.content[key]:
                    text_parts.append(str(node.content[key]))
            
            # Extract from choices/options
            if 'choices' in node.content:
                for choice in node.content['choices']:
                    if isinstance(choice, dict) and 'text' in choice:
                        text_parts.append(choice['text'])
        
        return ' '.join(text_parts)
    
    def _calculate_tagging_priority(self, node: Node, content_text: str) -> float:
        """Calculate priority score for auto-tagging (0-1, higher = more priority)."""
        priority = 0.0
        
        # Content length factor (more content = higher priority)
        content_length = len(content_text.strip())
        if content_length > 200:
            priority += 0.3
        elif content_length > 100:
            priority += 0.2
        elif content_length > 50:
            priority += 0.1
        
        # Node type factor (question types get higher priority)
        question_types = {'multiple_choice', 'true_false', 'short_answer', 'matching', 'ordering'}
        if node.node_type in question_types:
            priority += 0.3
        
        # No existing tags = higher priority
        total_existing_tags = len(node.learning_objective_relationships) + len(node.keyword_relationships)
        if total_existing_tags == 0:
            priority += 0.4
        elif total_existing_tags < 2:
            priority += 0.2
        
        return min(priority, 1.0)
    
    async def _apply_confident_tags(
        self,
        session: AsyncSession,
        node: Node,
        normalized: Dict[str, List],
        strategy: TaggingStrategy,
        base_confidence: float
    ) -> TaggingResult:
        """Apply tags based on confidence thresholds and strategy."""
        thresholds = self.config.confidence_thresholds[strategy]
        
        objectives_added = []
        keywords_added = []
        objectives_suggested = []
        keywords_suggested = []
        
        # Process learning objectives
        for norm_obj in normalized['learning_objectives']:
            confidence = norm_obj.similarity_score * base_confidence
            
            if confidence >= thresholds['objectives']:
                # Add with high confidence
                obj_rel = NodeLearningObjective(
                    node_id=node.id,
                    objective_id=norm_obj.entity_id,
                    relevance_score=confidence,
                    auto_tagged=True,
                    tagged_by=None  # System auto-tagged
                )
                session.add(obj_rel)
                
                objectives_added.append({
                    'objective_text': norm_obj.canonical_term,
                    'confidence': confidence,
                    'action': norm_obj.action_taken
                })
                
            elif self.config.enable_suggestions and confidence >= thresholds['suggestion']:
                # Add to suggestions
                objectives_suggested.append({
                    'objective_text': norm_obj.canonical_term,
                    'confidence': confidence,
                    'action': norm_obj.action_taken,
                    'entity_id': str(norm_obj.entity_id)
                })
        
        # Process keywords  
        for norm_kw in normalized['keywords']:
            confidence = norm_kw.similarity_score * base_confidence
            
            if confidence >= thresholds['keywords']:
                # Add with high confidence
                kw_rel = NodeKeyword(
                    node_id=node.id,
                    keyword_id=norm_kw.entity_id,
                    relevance_score=confidence,
                    auto_tagged=True,
                    tagged_by=None  # System auto-tagged
                )
                session.add(kw_rel)
                
                keywords_added.append({
                    'keyword_text': norm_kw.canonical_term,
                    'confidence': confidence,
                    'action': norm_kw.action_taken
                })
                
            elif self.config.enable_suggestions and confidence >= thresholds['suggestion']:
                # Add to suggestions
                keywords_suggested.append({
                    'keyword_text': norm_kw.canonical_term,
                    'confidence': confidence,
                    'action': norm_kw.action_taken,
                    'entity_id': str(norm_kw.entity_id)
                })
        
        # Determine overall quality
        avg_confidence = (
            sum(obj['confidence'] for obj in objectives_added + keywords_added) /
            max(len(objectives_added) + len(keywords_added), 1)
        )
        
        if avg_confidence >= 0.9:
            quality = TaggingQuality.HIGH
        elif avg_confidence >= 0.75:
            quality = TaggingQuality.MEDIUM
        elif avg_confidence >= 0.6:
            quality = TaggingQuality.LOW
        else:
            quality = TaggingQuality.UNCERTAIN
        
        return TaggingResult(
            node_id=node.id,
            strategy_used=strategy,
            overall_quality=quality,
            confidence_score=avg_confidence,
            objectives_added=objectives_added,
            keywords_added=keywords_added,
            objectives_suggested=objectives_suggested,
            keywords_suggested=keywords_suggested,
            content_analysis_time=0.0,  # Will be set by caller
            total_processing_time=0.0,  # Will be set by caller
            extraction_metadata={}  # Will be set by caller
        )
    
    async def _build_skip_result(self, node: Node, strategy: TaggingStrategy, start_time: datetime) -> TaggingResult:
        """Build result for skipped node (already tagged)."""
        return TaggingResult(
            node_id=node.id,
            strategy_used=strategy,
            overall_quality=TaggingQuality.HIGH,  # Assume existing tags are good
            confidence_score=1.0,
            objectives_added=[],
            keywords_added=[],
            objectives_suggested=[],
            keywords_suggested=[],
            content_analysis_time=0.0,
            total_processing_time=(datetime.now() - start_time).total_seconds(),
            extraction_metadata={'status': 'skipped', 'reason': 'already_tagged'}
        )
    
    async def _build_empty_result(self, node: Node, strategy: TaggingStrategy, start_time: datetime, reason: str) -> TaggingResult:
        """Build result for node with no extractable content."""
        return TaggingResult(
            node_id=node.id,
            strategy_used=strategy,
            overall_quality=TaggingQuality.UNCERTAIN,
            confidence_score=0.0,
            objectives_added=[],
            keywords_added=[],
            objectives_suggested=[],
            keywords_suggested=[],
            content_analysis_time=0.0,
            total_processing_time=(datetime.now() - start_time).total_seconds(),
            extraction_metadata={'status': 'empty', 'reason': reason}
        )
    
    async def _build_error_result(self, node_id: uuid.UUID, strategy: TaggingStrategy, start_time: datetime, error: str) -> TaggingResult:
        """Build result for failed processing."""
        return TaggingResult(
            node_id=node_id,
            strategy_used=strategy,
            overall_quality=TaggingQuality.UNCERTAIN,
            confidence_score=0.0,
            objectives_added=[],
            keywords_added=[],
            objectives_suggested=[],
            keywords_suggested=[],
            content_analysis_time=0.0,
            total_processing_time=(datetime.now() - start_time).total_seconds(),
            extraction_metadata={'status': 'error', 'error': error}
        )