"""
Concept Analysis Utilities - Advanced content analysis for auto-tagging.

Provides utilities for analyzing content structure, extracting semantic concepts,
and performing quality assessments for auto-tagging workflows.
"""

import re
import hashlib
from typing import Dict, List, Any, Optional, Tuple, Set
from dataclasses import dataclass
from enum import Enum

import logging

logger = logging.getLogger(__name__)


class ContentComplexity(Enum):
    """Content complexity levels for analysis."""
    SIMPLE = "simple"           # Basic concepts, clear language
    MODERATE = "moderate"       # Some technical terms, moderate complexity
    COMPLEX = "complex"         # Technical content, domain-specific
    ADVANCED = "advanced"       # Highly technical, expert-level


class ConceptCategory(Enum):
    """Categories of concepts found in content."""
    FACTUAL = "factual"         # Facts, definitions, specific information
    PROCEDURAL = "procedural"   # Steps, processes, how-to content
    CONCEPTUAL = "conceptual"   # Principles, theories, abstract concepts
    METACOGNITIVE = "metacognitive"  # Learning strategies, self-awareness


@dataclass
class ContentAnalysis:
    """Comprehensive analysis of content for auto-tagging optimization."""
    
    # Basic metrics
    word_count: int
    sentence_count: int
    paragraph_count: int
    complexity_score: float  # 0-1 scale
    
    # Content characteristics
    complexity_level: ContentComplexity
    primary_concept_category: ConceptCategory
    concept_categories: List[ConceptCategory]
    
    # Semantic analysis
    key_phrases: List[str]
    technical_terms: Set[str]
    domain_indicators: List[str]
    
    # Quality metrics
    clarity_score: float     # 0-1, higher = clearer content
    specificity_score: float # 0-1, higher = more specific
    taggability_score: float # 0-1, higher = better for auto-tagging
    
    # Recommendations
    recommended_strategy: str
    confidence_adjustment: float  # Multiplier for base confidence
    suggested_focus: List[str]    # What to focus on during tagging


class ConceptAnalyzer:
    """Advanced content analyzer for optimizing auto-tagging performance."""
    
    def __init__(self):
        # Technical term patterns for different domains
        self.domain_patterns = {
            'automotive': [
                r'\b(?:engine|brake|transmission|suspension|chassis|exhaust|fuel|oil|tire|wheel|battery|alternator|radiator|clutch|differential|carburetor)\b',
                r'\b(?:horsepower|torque|rpm|mpg|displacement|compression|octane|diesel|gasoline|hybrid|electric)\b'
            ],
            'sales': [
                r'\b(?:prospect|lead|conversion|closing|objection|pipeline|roi|revenue|quota|commission|upsell|cross-sell)\b',
                r'\b(?:crm|kpi|customer|client|deal|proposal|negotiation|discount|pricing|margin)\b'
            ],
            'safety': [
                r'\b(?:hazard|risk|ppe|osha|compliance|regulation|accident|incident|injury|emergency)\b',
                r'\b(?:procedure|protocol|training|certification|inspection|audit)\b'
            ],
            'technical': [
                r'\b(?:software|hardware|database|server|network|api|protocol|algorithm|framework|library)\b',
                r'\b(?:code|programming|development|deployment|testing|debugging|optimization)\b'
            ]
        }
        
        # Complexity indicators
        self.complexity_indicators = {
            'simple': [
                r'\b(?:what|where|when|who|is|are|can|will|simple|basic|easy)\b',
                r'\b(?:yes|no|true|false|always|never|all|none)\b'
            ],
            'moderate': [
                r'\b(?:how|why|because|therefore|however|although|compare|analyze)\b',
                r'\b(?:process|method|approach|technique|strategy)\b'
            ],
            'complex': [
                r'\b(?:synthesis|integration|evaluation|optimization|correlation|methodology)\b',
                r'\b(?:furthermore|consequently|nevertheless|notwithstanding)\b'
            ],
            'advanced': [
                r'\b(?:paradigm|heuristic|epistemological|ontological|phenomenological)\b',
                r'\b(?:meta-analysis|empirical|theoretical|conceptual framework)\b'
            ]
        }
        
        # Question type patterns
        self.question_patterns = {
            'factual': [
                r'\b(?:what is|define|identify|list|name|state)\b',
                r'\b(?:when did|where is|who was|how many|how much)\b'
            ],
            'procedural': [
                r'\b(?:how to|steps|procedure|process|method|technique)\b',
                r'\b(?:first|next|then|finally|in order to)\b'
            ],
            'conceptual': [
                r'\b(?:why|explain|describe|compare|contrast|relationship)\b',
                r'\b(?:principle|theory|concept|idea|meaning|significance)\b'
            ],
            'metacognitive': [
                r'\b(?:strategy|approach|plan|monitor|evaluate|reflect)\b',
                r'\b(?:think about|consider|assess|judge|learning)\b'
            ]
        }
    
    def analyze_content(self, content: str, content_type: str = "unknown", context: Optional[Dict] = None) -> ContentAnalysis:
        """
        Perform comprehensive content analysis for auto-tagging optimization.
        
        Args:
            content: Text content to analyze
            content_type: Type of content (question, text, etc.)
            context: Additional context information
            
        Returns:
            ContentAnalysis with detailed metrics and recommendations
        """
        try:
            # Basic text metrics
            words = content.split()
            sentences = self._count_sentences(content)
            paragraphs = len([p for p in content.split('\n\n') if p.strip()])
            
            # Content complexity analysis
            complexity_score = self._calculate_complexity_score(content)
            complexity_level = self._determine_complexity_level(complexity_score, content)
            
            # Concept category analysis
            concept_categories = self._identify_concept_categories(content, content_type)
            primary_category = concept_categories[0] if concept_categories else ConceptCategory.FACTUAL
            
            # Semantic analysis
            key_phrases = self._extract_key_phrases(content)
            technical_terms = self._identify_technical_terms(content)
            domain_indicators = self._identify_domain_indicators(content)
            
            # Quality metrics
            clarity_score = self._calculate_clarity_score(content, sentences, len(words))
            specificity_score = self._calculate_specificity_score(content, technical_terms)
            taggability_score = self._calculate_taggability_score(
                complexity_score, clarity_score, specificity_score, len(words)
            )
            
            # Generate recommendations
            recommended_strategy = self._recommend_tagging_strategy(
                complexity_level, taggability_score, len(words)
            )
            confidence_adjustment = self._calculate_confidence_adjustment(
                taggability_score, clarity_score, len(words)
            )
            suggested_focus = self._generate_tagging_focus_suggestions(
                primary_category, domain_indicators, complexity_level
            )
            
            return ContentAnalysis(
                word_count=len(words),
                sentence_count=sentences,
                paragraph_count=paragraphs,
                complexity_score=complexity_score,
                complexity_level=complexity_level,
                primary_concept_category=primary_category,
                concept_categories=concept_categories,
                key_phrases=key_phrases,
                technical_terms=technical_terms,
                domain_indicators=domain_indicators,
                clarity_score=clarity_score,
                specificity_score=specificity_score,
                taggability_score=taggability_score,
                recommended_strategy=recommended_strategy,
                confidence_adjustment=confidence_adjustment,
                suggested_focus=suggested_focus
            )
            
        except Exception as e:
            logger.error(f"Error analyzing content: {e}")
            # Return minimal analysis for failed cases
            return self._build_minimal_analysis(content)
    
    def _count_sentences(self, text: str) -> int:
        """Count sentences in text using multiple delimiters."""
        # Split on sentence endings, accounting for abbreviations
        sentence_endings = re.split(r'[.!?]+\s+', text)
        return max(1, len([s for s in sentence_endings if s.strip()]))
    
    def _calculate_complexity_score(self, content: str) -> float:
        """Calculate content complexity score (0-1)."""
        scores = []
        total_matches = 0
        
        for level, patterns in self.complexity_indicators.items():
            level_matches = 0
            for pattern in patterns:
                matches = len(re.findall(pattern, content, re.IGNORECASE))
                level_matches += matches
                total_matches += matches
            
            # Weight by complexity level
            if level == 'simple':
                scores.append(level_matches * 0.1)
            elif level == 'moderate':
                scores.append(level_matches * 0.4)
            elif level == 'complex':
                scores.append(level_matches * 0.7)
            elif level == 'advanced':
                scores.append(level_matches * 1.0)
        
        # Normalize by content length and total matches
        if total_matches == 0:
            return 0.3  # Default moderate complexity
        
        raw_score = sum(scores) / max(total_matches, 1)
        
        # Adjust for content length (longer content tends to be more complex)
        length_factor = min(len(content.split()) / 100, 1.0) * 0.2
        
        return min(raw_score + length_factor, 1.0)
    
    def _determine_complexity_level(self, score: float, content: str) -> ContentComplexity:
        """Determine complexity level from score and content characteristics."""
        if score >= 0.8:
            return ContentComplexity.ADVANCED
        elif score >= 0.6:
            return ContentComplexity.COMPLEX
        elif score >= 0.3:
            return ContentComplexity.MODERATE
        else:
            return ContentComplexity.SIMPLE
    
    def _identify_concept_categories(self, content: str, content_type: str) -> List[ConceptCategory]:
        """Identify what types of concepts are present in the content."""
        categories = []
        category_scores = {}
        
        for category, patterns in self.question_patterns.items():
            score = 0
            for pattern in patterns:
                matches = len(re.findall(pattern, content, re.IGNORECASE))
                score += matches
            category_scores[category] = score
        
        # Sort by score and convert to enums
        sorted_categories = sorted(category_scores.items(), key=lambda x: x[1], reverse=True)
        
        for category, score in sorted_categories:
            if score > 0:
                if category == 'factual':
                    categories.append(ConceptCategory.FACTUAL)
                elif category == 'procedural':
                    categories.append(ConceptCategory.PROCEDURAL)
                elif category == 'conceptual':
                    categories.append(ConceptCategory.CONCEPTUAL)
                elif category == 'metacognitive':
                    categories.append(ConceptCategory.METACOGNITIVE)
        
        # Default to factual if no patterns match
        if not categories:
            categories.append(ConceptCategory.FACTUAL)
        
        return categories
    
    def _extract_key_phrases(self, content: str) -> List[str]:
        """Extract key phrases from content using simple heuristics."""
        # Remove common words and extract potential key phrases
        words = content.lower().split()
        
        # Common stop words to filter out
        stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
            'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
            'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
            'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
        }
        
        # Extract meaningful words (>3 chars, not stop words)
        meaningful_words = [
            word.strip('.,!?;:()[]{}') for word in words 
            if len(word) > 3 and word.lower() not in stop_words
        ]
        
        # Find repeated important terms
        word_freq = {}
        for word in meaningful_words:
            word_freq[word] = word_freq.get(word, 0) + 1
        
        # Extract phrases of 2-3 words that contain important terms
        key_phrases = []
        content_lower = content.lower()
        
        # Look for capitalized phrases (likely important concepts)
        capitalized_phrases = re.findall(r'\b[A-Z][a-zA-Z\s]{2,30}(?=[.!?;:]|\s[A-Z]|\s*$)', content)
        key_phrases.extend([phrase.strip() for phrase in capitalized_phrases[:5]])
        
        # Add high-frequency meaningful words
        sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
        key_phrases.extend([word for word, freq in sorted_words[:8] if freq > 1])
        
        return list(set(key_phrases))[:10]  # Return top 10 unique phrases
    
    def _identify_technical_terms(self, content: str) -> Set[str]:
        """Identify technical terms in content using domain patterns."""
        technical_terms = set()
        
        for domain, patterns in self.domain_patterns.items():
            for pattern in patterns:
                matches = re.findall(pattern, content, re.IGNORECASE)
                technical_terms.update(matches)
        
        # Also look for acronyms and capitalized technical terms
        acronyms = re.findall(r'\b[A-Z]{2,6}\b', content)
        technical_terms.update(acronyms)
        
        return technical_terms
    
    def _identify_domain_indicators(self, content: str) -> List[str]:
        """Identify which domains this content likely belongs to."""
        domain_scores = {}
        
        for domain, patterns in self.domain_patterns.items():
            score = 0
            for pattern in patterns:
                matches = len(re.findall(pattern, content, re.IGNORECASE))
                score += matches
            if score > 0:
                domain_scores[domain] = score
        
        # Sort by score and return domains with significant presence
        sorted_domains = sorted(domain_scores.items(), key=lambda x: x[1], reverse=True)
        return [domain for domain, score in sorted_domains if score >= 2]
    
    def _calculate_clarity_score(self, content: str, sentence_count: int, word_count: int) -> float:
        """Calculate how clear and well-structured the content is."""
        if word_count == 0:
            return 0.0
        
        # Average words per sentence (lower is generally clearer)
        avg_words_per_sentence = word_count / max(sentence_count, 1)
        sentence_clarity = max(0, 1.0 - (avg_words_per_sentence - 15) / 25)
        
        # Presence of clear structure indicators
        structure_indicators = len(re.findall(r'\b(?:first|second|next|then|finally|therefore|however|because)\b', content, re.IGNORECASE))
        structure_score = min(structure_indicators / 3.0, 1.0)
        
        # Question marks (indicate clear questions)
        question_score = min(content.count('?') / 2.0, 1.0)
        
        # Combine scores
        clarity = (sentence_clarity * 0.5) + (structure_score * 0.3) + (question_score * 0.2)
        return min(clarity, 1.0)
    
    def _calculate_specificity_score(self, content: str, technical_terms: Set[str]) -> float:
        """Calculate how specific and detailed the content is."""
        word_count = len(content.split())
        if word_count == 0:
            return 0.0
        
        # Technical terms ratio
        tech_ratio = len(technical_terms) / max(word_count, 1) * 10
        tech_score = min(tech_ratio, 1.0)
        
        # Numbers and specific values
        numbers = len(re.findall(r'\b\d+(?:\.\d+)?\b', content))
        number_score = min(numbers / max(word_count / 20, 1), 1.0)
        
        # Specific action words
        action_words = len(re.findall(r'\b(?:calculate|measure|determine|identify|analyze|evaluate|compare|select|choose)\b', content, re.IGNORECASE))
        action_score = min(action_words / max(word_count / 30, 1), 1.0)
        
        # Combine scores
        specificity = (tech_score * 0.4) + (number_score * 0.3) + (action_score * 0.3)
        return min(specificity, 1.0)
    
    def _calculate_taggability_score(self, complexity: float, clarity: float, specificity: float, word_count: int) -> float:
        """Calculate how suitable content is for auto-tagging."""
        # Optimal word count range (50-300 words work best)
        if word_count < 10:
            length_score = 0.1
        elif word_count < 50:
            length_score = word_count / 50.0 * 0.6
        elif word_count <= 300:
            length_score = 1.0
        elif word_count <= 500:
            length_score = max(0.8 - (word_count - 300) / 200 * 0.3, 0.5)
        else:
            length_score = 0.5
        
        # Balance of complexity, clarity, and specificity
        content_balance = (complexity * 0.3) + (clarity * 0.4) + (specificity * 0.3)
        
        # Final taggability score
        taggability = (content_balance * 0.7) + (length_score * 0.3)
        return min(taggability, 1.0)
    
    def _recommend_tagging_strategy(self, complexity: ContentComplexity, taggability: float, word_count: int) -> str:
        """Recommend auto-tagging strategy based on content analysis."""
        if taggability >= 0.8 and complexity in [ContentComplexity.MODERATE, ContentComplexity.COMPLEX]:
            return "comprehensive"
        elif taggability >= 0.6:
            return "balanced"
        elif complexity == ContentComplexity.SIMPLE and word_count < 100:
            return "conservative"
        elif taggability < 0.4:
            return "manual_review_recommended"
        else:
            return "balanced"
    
    def _calculate_confidence_adjustment(self, taggability: float, clarity: float, word_count: int) -> float:
        """Calculate confidence adjustment multiplier for auto-tagging."""
        base_adjustment = 1.0
        
        # Adjust based on taggability
        if taggability >= 0.8:
            base_adjustment += 0.1
        elif taggability < 0.4:
            base_adjustment -= 0.2
        
        # Adjust based on clarity
        if clarity >= 0.8:
            base_adjustment += 0.05
        elif clarity < 0.5:
            base_adjustment -= 0.1
        
        # Adjust based on content length
        if 50 <= word_count <= 200:
            base_adjustment += 0.05
        elif word_count < 20:
            base_adjustment -= 0.15
        
        return max(0.5, min(base_adjustment, 1.2))
    
    def _generate_tagging_focus_suggestions(
        self, 
        primary_category: ConceptCategory, 
        domains: List[str], 
        complexity: ContentComplexity
    ) -> List[str]:
        """Generate suggestions for what to focus on during tagging."""
        suggestions = []
        
        # Category-specific suggestions
        if primary_category == ConceptCategory.FACTUAL:
            suggestions.extend(["specific facts", "definitions", "key terms"])
        elif primary_category == ConceptCategory.PROCEDURAL:
            suggestions.extend(["processes", "procedures", "sequential steps"])
        elif primary_category == ConceptCategory.CONCEPTUAL:
            suggestions.extend(["principles", "theories", "relationships"])
        elif primary_category == ConceptCategory.METACOGNITIVE:
            suggestions.extend(["learning strategies", "self-assessment", "reflection"])
        
        # Domain-specific suggestions
        if domains:
            suggestions.append(f"domain expertise: {', '.join(domains)}")
        
        # Complexity-specific suggestions
        if complexity == ContentComplexity.SIMPLE:
            suggestions.append("basic concepts only")
        elif complexity == ContentComplexity.ADVANCED:
            suggestions.append("advanced technical concepts")
        
        return suggestions[:5]  # Return top 5 suggestions
    
    def _build_minimal_analysis(self, content: str) -> ContentAnalysis:
        """Build minimal analysis for error cases."""
        word_count = len(content.split()) if content else 0
        
        return ContentAnalysis(
            word_count=word_count,
            sentence_count=1,
            paragraph_count=1,
            complexity_score=0.3,
            complexity_level=ContentComplexity.SIMPLE,
            primary_concept_category=ConceptCategory.FACTUAL,
            concept_categories=[ConceptCategory.FACTUAL],
            key_phrases=[],
            technical_terms=set(),
            domain_indicators=[],
            clarity_score=0.5,
            specificity_score=0.3,
            taggability_score=0.4,
            recommended_strategy="conservative",
            confidence_adjustment=0.8,
            suggested_focus=["basic analysis"]
        )