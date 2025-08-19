"""
Knowledge Extraction Service - LLM-powered metadata extraction with semantic normalization.

This service uses configurable LLM models to extract learning objectives and keywords from content,
then applies semantic similarity analysis to prevent taxonomy proliferation by normalizing
related terms (e.g., "EVs", "electric vehicles", "electric cars" -> "electric vehicles").

Key Features:
- Configurable LLM model selection via environment variables
- LLM-powered content analysis for nodes and activities
- Semantic similarity detection for deduplication
- Managed taxonomy with normalization rules
- Confidence scoring and human review workflows
- Integration with Content Studio and import processes
"""

import hashlib
import re
import uuid
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
import os

import anthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database_manager import db_manager
from app.models.learning_objective import LearningObjective, Keyword, NodeLearningObjective, NodeKeyword
from app.models.node import Node
import logging

logger = logging.getLogger(__name__)


@dataclass
class ExtractedMetadata:
    """Structured metadata extracted from content."""
    learning_objectives: List[str]
    keywords: List[str]
    domain: Optional[str]
    difficulty_level: Optional[int]
    cognitive_levels: List[str]
    confidence_score: float
    content_hash: str
    raw_llm_response: Dict[str, Any]


@dataclass
class NormalizedTerm:
    """A normalized term with similarity confidence."""
    canonical_term: str
    original_term: str
    similarity_score: float
    action_taken: str  # "matched", "created", "merged"


@dataclass
class LLMConfig:
    """Configuration for LLM model selection and parameters."""
    model_name: str
    max_tokens: int
    temperature: float
    provider: str = "anthropic"
    
    @classmethod
    def from_environment(cls) -> 'LLMConfig':
        """Create LLM config from environment variables."""
        return cls(
            model_name=os.getenv("KNOWLEDGE_EXTRACTION_MODEL", "claude-3-haiku-20240307"),
            max_tokens=int(os.getenv("KNOWLEDGE_EXTRACTION_MAX_TOKENS", "1000")),
            temperature=float(os.getenv("KNOWLEDGE_EXTRACTION_TEMPERATURE", "0.1")),
            provider=os.getenv("KNOWLEDGE_EXTRACTION_PROVIDER", "anthropic")
        )


class KnowledgeExtractionService:
    """
    Service for intelligent extraction and normalization of learning metadata.
    
    Prevents taxonomy proliferation through semantic similarity analysis
    and maintains a clean, manageable knowledge graph.
    """
    
    def __init__(
        self,
        anthropic_client: Optional[anthropic.AsyncAnthropic] = None,
        llm_config: Optional[LLMConfig] = None
    ):
        self.anthropic_client = anthropic_client or anthropic.AsyncAnthropic()
        self.llm_config = llm_config or LLMConfig.from_environment()
        
        # Validate model compatibility
        self._validate_model_config()
        
        # Taxonomy management settings
        self.similarity_threshold = float(os.getenv("KNOWLEDGE_SIMILARITY_THRESHOLD", "0.85"))
        self.confidence_threshold = float(os.getenv("KNOWLEDGE_CONFIDENCE_THRESHOLD", "0.7"))
        self.max_keywords_per_content = int(os.getenv("KNOWLEDGE_MAX_KEYWORDS", "10"))
        self.max_objectives_per_content = int(os.getenv("KNOWLEDGE_MAX_OBJECTIVES", "5"))
        
        # Common domain patterns for classification
        self.domain_patterns = {
            'automotive': ['car', 'vehicle', 'engine', 'brake', 'transmission', 'dealership', 'service'],
            'sales': ['customer', 'lead', 'conversion', 'objection', 'closing', 'proposal'],
            'technology': ['software', 'programming', 'database', 'API', 'system', 'development'],
            'safety': ['hazard', 'risk', 'compliance', 'regulation', 'safety', 'emergency'],
            'training': ['learning', 'education', 'skill', 'competency', 'development', 'assessment']
        }
        
        logger.info(f"Knowledge extraction service initialized with model: {self.llm_config.model_name}")

    def _validate_model_config(self) -> None:
        """Validate that the configured model is supported."""
        anthropic_models = [
            "claude-3-haiku-20240307",
            "claude-3-sonnet-20240229", 
            "claude-3-opus-20240229",
            "claude-3-5-haiku-20241022",
            "claude-3-5-sonnet-20241022"
        ]
        
        if self.llm_config.provider == "anthropic":
            if self.llm_config.model_name not in anthropic_models:
                logger.warning(f"Unknown Anthropic model: {self.llm_config.model_name}. Proceeding anyway.")
        else:
            logger.warning(f"Unsupported LLM provider: {self.llm_config.provider}. Only 'anthropic' is currently supported.")

    async def extract_content_metadata(
        self,
        content: str,
        content_type: str = "unknown",
        context: Optional[Dict[str, Any]] = None
    ) -> ExtractedMetadata:
        """
        Extract learning objectives and keywords from content using configured LLM.
        
        Args:
            content: The text content to analyze
            content_type: Type of content (node, activity, document, etc.)
            context: Additional context like title, domain hints, etc.
            
        Returns:
            Structured metadata with confidence scoring
        """
        try:
            # Prepare context information
            context_info = ""
            if context:
                if context.get('title'):
                    context_info += f"Title: {context['title']}\n"
                if context.get('domain'):
                    context_info += f"Domain: {context['domain']}\n"
                if context.get('content_type'):
                    context_info += f"Content Type: {context['content_type']}\n"

            # Craft the extraction prompt
            prompt = self._build_extraction_prompt(content, content_type, context_info)
            
            # Call configured LLM for analysis
            if self.llm_config.provider == "anthropic":
                response = await self._call_anthropic(prompt)
            else:
                raise ValueError(f"Unsupported LLM provider: {self.llm_config.provider}")
            
            # Parse structured response
            extracted = self._parse_llm_response(response, content)
            
            # Classify domain if not provided
            if not extracted.domain:
                extracted.domain = self._classify_domain(content, extracted.keywords)
            
            logger.info(f"Extracted metadata using {self.llm_config.model_name}: {len(extracted.keywords)} keywords, {len(extracted.learning_objectives)} objectives, domain: {extracted.domain}")
            return extracted
            
        except Exception as e:
            logger.error(f"Error extracting metadata with {self.llm_config.model_name}: {e}")
            return self._create_fallback_metadata(content)

    async def _call_anthropic(self, prompt: str) -> str:
        """Call Anthropic API with configured model parameters."""
        try:
            response = await self.anthropic_client.messages.create(
                model=self.llm_config.model_name,
                max_tokens=self.llm_config.max_tokens,
                temperature=self.llm_config.temperature,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            return response.content[0].text
            
        except Exception as e:
            logger.error(f"Error calling Anthropic API: {e}")
            raise

    async def normalize_and_store_metadata(
        self,
        extracted: ExtractedMetadata,
        content_id: Optional[uuid.UUID] = None,
        node_id: Optional[uuid.UUID] = None,
        auto_apply: bool = True
    ) -> Dict[str, List[NormalizedTerm]]:
        """
        Normalize extracted terms against existing taxonomy and store relationships.
        
        Args:
            extracted: Metadata from extraction service
            content_id: Optional activity ID for lineage tracking
            node_id: Optional node ID for relationship storage
            auto_apply: Whether to automatically apply high-confidence matches
            
        Returns:
            Dictionary of normalized terms with actions taken
        """
        async with db_manager.get_session() as session:
            try:
                # Normalize learning objectives
                normalized_objectives = await self._normalize_learning_objectives(
                    session, extracted.learning_objectives, extracted.domain, content_id
                )
                
                # Normalize keywords
                normalized_keywords = await self._normalize_keywords(
                    session, extracted.keywords, extracted.domain, content_id
                )
                
                # Create relationships if node_id provided
                if node_id and auto_apply:
                    await self._create_node_relationships(
                        session, node_id, normalized_objectives, normalized_keywords
                    )
                
                await session.commit()
                
                return {
                    'learning_objectives': normalized_objectives,
                    'keywords': normalized_keywords
                }
                
            except Exception as e:
                await session.rollback()
                logger.error(f"Error normalizing metadata: {e}")
                raise

    async def _normalize_learning_objectives(
        self,
        session: AsyncSession,
        objectives: List[str],
        domain: Optional[str],
        content_id: Optional[uuid.UUID]
    ) -> List[NormalizedTerm]:
        """Normalize learning objectives against existing taxonomy."""
        normalized = []
        
        # Get existing objectives for similarity comparison
        stmt = select(LearningObjective).options(selectinload(LearningObjective.node_relationships))
        if domain:
            stmt = stmt.where(LearningObjective.domain == domain)
        
        existing_objectives = await session.execute(stmt)
        existing_objs = existing_objectives.scalars().all()
        
        for obj_text in objectives:
            # Find best match using semantic similarity
            best_match, similarity = self._find_best_semantic_match(
                obj_text, [obj.objective_text for obj in existing_objs]
            )
            
            if best_match and similarity >= self.similarity_threshold:
                # High similarity - use existing objective
                existing_obj = next(obj for obj in existing_objs if obj.objective_text == best_match)
                existing_obj.increment_usage()
                
                normalized.append(NormalizedTerm(
                    canonical_term=best_match,
                    original_term=obj_text,
                    similarity_score=similarity,
                    action_taken="matched"
                ))
                
            else:
                # Create new objective
                cognitive_level = self._classify_cognitive_level(obj_text)
                difficulty = self._estimate_difficulty(obj_text)
                
                new_obj = LearningObjective(
                    objective_text=obj_text,
                    domain=domain,
                    cognitive_level=cognitive_level,
                    difficulty_level=difficulty,
                    usage_count=1,
                    created_from_activity_id=content_id
                )
                
                session.add(new_obj)
                
                normalized.append(NormalizedTerm(
                    canonical_term=obj_text,
                    original_term=obj_text,
                    similarity_score=1.0,
                    action_taken="created"
                ))
        
        return normalized

    async def _normalize_keywords(
        self,
        session: AsyncSession,
        keywords: List[str],
        domain: Optional[str],
        content_id: Optional[uuid.UUID]
    ) -> List[NormalizedTerm]:
        """Normalize keywords against existing taxonomy."""
        normalized = []
        
        # Get existing keywords for similarity comparison
        stmt = select(Keyword).options(selectinload(Keyword.node_relationships))
        if domain:
            stmt = stmt.where(Keyword.domain == domain)
            
        existing_keywords = await session.execute(stmt)
        existing_kws = existing_keywords.scalars().all()
        
        for kw_text in keywords:
            # Normalize the keyword text (lowercase, remove extra spaces)
            normalized_kw = self._normalize_keyword_text(kw_text)
            
            # Find best match using semantic similarity
            best_match, similarity = self._find_best_semantic_match(
                normalized_kw, [kw.keyword_text for kw in existing_kws]
            )
            
            if best_match and similarity >= self.similarity_threshold:
                # High similarity - use existing keyword
                existing_kw = next(kw for kw in existing_kws if kw.keyword_text == best_match)
                existing_kw.increment_usage()
                
                normalized.append(NormalizedTerm(
                    canonical_term=best_match,
                    original_term=kw_text,
                    similarity_score=similarity,
                    action_taken="matched"
                ))
                
            else:
                # Create new keyword
                category = self._classify_keyword_category(normalized_kw, domain)
                
                new_kw = Keyword(
                    keyword_text=normalized_kw,
                    domain=domain,
                    category=category,
                    usage_count=1,
                    created_from_activity_id=content_id
                )
                
                session.add(new_kw)
                
                normalized.append(NormalizedTerm(
                    canonical_term=normalized_kw,
                    original_term=kw_text,
                    similarity_score=1.0,
                    action_taken="created"
                ))
        
        return normalized

    def _build_extraction_prompt(self, content: str, content_type: str, context_info: str) -> str:
        """Build the LLM prompt for metadata extraction."""
        return f"""Analyze this {content_type} content and extract structured learning metadata.

{context_info}

Content to analyze:
{content[:2000]}  # Limit content length

Extract and return ONLY a JSON object with this exact structure:
{{
    "learning_objectives": [
        "Specific, measurable learning outcomes (2-5 objectives)"
    ],
    "keywords": [
        "Key terms and concepts (5-10 keywords, normalize similar terms)"
    ],
    "domain": "Primary subject domain (automotive, sales, technology, safety, training, etc.)",
    "difficulty_level": 3,  # 1-10 scale
    "cognitive_levels": ["understand", "apply"],  # Bloom's taxonomy levels
    "confidence_score": 0.85  # 0.0-1.0 confidence in extraction quality
}}

Guidelines:
- Learning objectives should be specific, measurable outcomes
- Keywords should be normalized (use "electric vehicles" not "EVs", "electric cars", etc.)
- Choose the most specific domain that fits the content
- Cognitive levels: remember, understand, apply, analyze, evaluate, create
- Be conservative with confidence scores

Return only the JSON object, no additional text."""

    def _parse_llm_response(self, response_text: str, original_content: str) -> ExtractedMetadata:
        """Parse LLM JSON response into structured metadata."""
        try:
            # Extract JSON from response (handle potential markdown formatting)
            json_text = response_text.strip()
            if json_text.startswith('```json'):
                json_text = json_text.split('```json')[1].split('```')[0].strip()
            elif json_text.startswith('```'):
                json_text = json_text.split('```')[1].split('```')[0].strip()
            
            import json
            parsed = json.loads(json_text)
            
            return ExtractedMetadata(
                learning_objectives=parsed.get('learning_objectives', []),
                keywords=parsed.get('keywords', []),
                domain=parsed.get('domain'),
                difficulty_level=parsed.get('difficulty_level', 3),
                cognitive_levels=parsed.get('cognitive_levels', ['understand']),
                confidence_score=float(parsed.get('confidence_score', 0.7)),
                content_hash=hashlib.sha256(original_content.encode()).hexdigest()[:16],
                raw_llm_response=parsed
            )
            
        except Exception as e:
            logger.warning(f"Failed to parse LLM response: {e}. Response: {response_text[:200]}...")
            return self._create_fallback_metadata(original_content)

    def _create_fallback_metadata(self, content: str) -> ExtractedMetadata:
        """Create basic metadata when LLM extraction fails."""
        # Simple keyword extraction from content
        words = re.findall(r'\b[a-zA-Z]{3,}\b', content.lower())
        common_words = {'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'dont', 'each', 'end', 'got', 'let', 'man', 'put', 'say', 'she', 'too', 'use'}
        keywords = [word for word in set(words) if word not in common_words][:5]
        
        return ExtractedMetadata(
            learning_objectives=[],
            keywords=keywords,
            domain=self._classify_domain(content, keywords),
            difficulty_level=3,
            cognitive_levels=['understand'],
            confidence_score=0.3,
            content_hash=hashlib.sha256(content.encode()).hexdigest()[:16],
            raw_llm_response={}
        )

    def _classify_domain(self, content: str, keywords: List[str]) -> Optional[str]:
        """Classify content domain based on content and keywords."""
        content_lower = content.lower()
        keywords_lower = [kw.lower() for kw in keywords]
        
        domain_scores = {}
        for domain, patterns in self.domain_patterns.items():
            score = 0
            for pattern in patterns:
                if pattern in content_lower:
                    score += 2
                if any(pattern in kw for kw in keywords_lower):
                    score += 1
            domain_scores[domain] = score
        
        if domain_scores:
            best_domain = max(domain_scores.items(), key=lambda x: x[1])
            return best_domain[0] if best_domain[1] > 0 else None
        return None

    def _find_best_semantic_match(self, text: str, candidates: List[str]) -> Tuple[Optional[str], float]:
        """Find the best semantic match using simple text similarity."""
        if not candidates:
            return None, 0.0
        
        # Simple implementation - could be enhanced with embeddings
        text_lower = text.lower().strip()
        best_match = None
        best_score = 0.0
        
        for candidate in candidates:
            candidate_lower = candidate.lower().strip()
            
            # Exact match
            if text_lower == candidate_lower:
                return candidate, 1.0
            
            # Jaccard similarity on word sets
            text_words = set(text_lower.split())
            candidate_words = set(candidate_lower.split())
            
            if text_words and candidate_words:
                intersection = len(text_words & candidate_words)
                union = len(text_words | candidate_words)
                similarity = intersection / union if union > 0 else 0.0
                
                if similarity > best_score:
                    best_score = similarity
                    best_match = candidate
        
        return best_match, best_score

    def _normalize_keyword_text(self, keyword: str) -> str:
        """Normalize keyword text for consistency."""
        # Convert to lowercase, strip whitespace, remove extra spaces
        normalized = re.sub(r'\s+', ' ', keyword.lower().strip())
        
        # Apply common normalization rules
        normalizations = {
            r'\bevs?\b': 'electric vehicles',
            r'\bai\b': 'artificial intelligence',
            r'\bml\b': 'machine learning',
            r'\bapi\b': 'API',
            r'\bcrm\b': 'CRM',
        }
        
        for pattern, replacement in normalizations.items():
            normalized = re.sub(pattern, replacement, normalized, flags=re.IGNORECASE)
        
        return normalized

    def _classify_cognitive_level(self, objective_text: str) -> str:
        """Classify learning objective by Bloom's taxonomy."""
        text_lower = objective_text.lower()
        
        # Simple keyword-based classification
        if any(word in text_lower for word in ['create', 'design', 'develop', 'build', 'construct']):
            return 'create'
        elif any(word in text_lower for word in ['evaluate', 'assess', 'judge', 'critique', 'compare']):
            return 'evaluate'
        elif any(word in text_lower for word in ['analyze', 'examine', 'investigate', 'determine']):
            return 'analyze'
        elif any(word in text_lower for word in ['apply', 'use', 'implement', 'demonstrate', 'solve']):
            return 'apply'
        elif any(word in text_lower for word in ['understand', 'explain', 'describe', 'interpret']):
            return 'understand'
        else:
            return 'remember'

    def _estimate_difficulty(self, objective_text: str) -> int:
        """Estimate difficulty level 1-10 based on objective complexity."""
        # Simple heuristic based on text complexity and cognitive level
        cognitive_level = self._classify_cognitive_level(objective_text)
        
        base_difficulty = {
            'remember': 2,
            'understand': 3,
            'apply': 5,
            'analyze': 7,
            'evaluate': 8,
            'create': 9
        }.get(cognitive_level, 3)
        
        # Adjust based on text length and complexity
        word_count = len(objective_text.split())
        if word_count > 15:
            base_difficulty += 1
        elif word_count < 5:
            base_difficulty -= 1
            
        return max(1, min(10, base_difficulty))

    def _classify_keyword_category(self, keyword: str, domain: Optional[str]) -> str:
        """Classify keyword into categories for better organization."""
        keyword_lower = keyword.lower()
        
        # Domain-specific categories
        if domain == 'automotive':
            if any(word in keyword_lower for word in ['engine', 'transmission', 'brake', 'suspension']):
                return 'technical'
            elif any(word in keyword_lower for word in ['service', 'maintenance', 'repair']):
                return 'service'
            elif any(word in keyword_lower for word in ['safety', 'airbag', 'seatbelt']):
                return 'safety'
        elif domain == 'sales':
            if any(word in keyword_lower for word in ['customer', 'client', 'prospect']):
                return 'customer'
            elif any(word in keyword_lower for word in ['process', 'pipeline', 'funnel']):
                return 'process'
            elif any(word in keyword_lower for word in ['closing', 'objection', 'negotiation']):
                return 'technique'
        
        # General categories
        if any(word in keyword_lower for word in ['process', 'procedure', 'workflow']):
            return 'process'
        elif any(word in keyword_lower for word in ['technology', 'system', 'software']):
            return 'technical'
        elif any(word in keyword_lower for word in ['safety', 'risk', 'compliance']):
            return 'safety'
        else:
            return 'general'

    async def _create_node_relationships(
        self,
        session: AsyncSession,
        node_id: uuid.UUID,
        objectives: List[NormalizedTerm],
        keywords: List[NormalizedTerm]
    ) -> None:
        """Create relationships between node and normalized terms."""
        
        # Create objective relationships
        for norm_obj in objectives:
            # Find the objective in database
            stmt = select(LearningObjective).where(
                LearningObjective.objective_text == norm_obj.canonical_term
            )
            result = await session.execute(stmt)
            objective = result.scalar_one_or_none()
            
            if objective:
                # Create relationship with confidence-based relevance score
                relevance = min(1.0, norm_obj.similarity_score + 0.1)  # Slight boost for matched terms
                
                relationship = NodeLearningObjective(
                    node_id=node_id,
                    objective_id=objective.id,
                    relevance_score=Decimal(str(relevance)),
                    auto_tagged=True,
                    tagged_by=None  # System-generated
                )
                session.add(relationship)
        
        # Create keyword relationships
        for norm_kw in keywords:
            # Find the keyword in database
            stmt = select(Keyword).where(Keyword.keyword_text == norm_kw.canonical_term)
            result = await session.execute(stmt)
            keyword = result.scalar_one_or_none()
            
            if keyword:
                # Create relationship with confidence-based relevance score
                relevance = min(1.0, norm_kw.similarity_score + 0.1)
                
                relationship = NodeKeyword(
                    node_id=node_id,
                    keyword_id=keyword.id,
                    relevance_score=Decimal(str(relevance)),
                    auto_tagged=True,
                    tagged_by=None  # System-generated
                )
                session.add(relationship)


# Convenience functions for common use cases
async def extract_node_metadata(node_id: uuid.UUID, service: Optional[KnowledgeExtractionService] = None) -> Dict[str, Any]:
    """Extract metadata from a specific node."""
    if not service:
        service = KnowledgeExtractionService()
    
    async with db_manager.get_session() as session:
        stmt = select(Node).where(Node.id == node_id)
        result = await session.execute(stmt)
        node = result.scalar_one_or_none()
        
        if not node:
            raise ValueError(f"Node {node_id} not found")
        
        # Extract content text from node
        content_text = _extract_text_from_node_content(node.content)
        
        # Extract metadata
        metadata = await service.extract_content_metadata(
            content=content_text,
            content_type=node.node_type,
            context={
                'title': node.title or f"{node.node_type} node",
                'node_type': node.node_type
            }
        )
        
        # Normalize and store
        normalized = await service.normalize_and_store_metadata(
            extracted=metadata,
            node_id=node_id
        )
        
        return {
            'extracted': metadata,
            'normalized': normalized
        }


def _extract_text_from_node_content(content: Dict[str, Any]) -> str:
    """Extract meaningful text from node content JSON."""
    text_parts = []
    
    # Common text fields across node types
    if isinstance(content, dict):
        for key in ['text', 'content', 'title', 'description', 'question', 'prompt']:
            if key in content and content[key]:
                text_parts.append(str(content[key]))
        
        # Extract from choices/options
        if 'choices' in content:
            for choice in content['choices']:
                if isinstance(choice, dict) and 'text' in choice:
                    text_parts.append(choice['text'])
        
        # Extract from other structured content
        for key, value in content.items():
            if isinstance(value, str) and len(value) > 10:
                text_parts.append(value)
    
    return ' '.join(text_parts)