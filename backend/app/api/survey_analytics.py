"""
Survey Analytics API endpoints for survey-specific data and statistics.
Provides comprehensive survey analytics leveraging existing xAPI infrastructure.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database_manager import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.shared_token import SharedTokenCreate
from app.services.ralph_lrs_service import RalphLRSService, get_ralph_lrs_service
from app.services.shared_token_service import SharedTokenService
from app.services.content import ContentService
from app.services.survey_analytics_adapter import survey_analytics_adapter
from app.services.demographic_detector import demographic_detector
from app.utils.permissions import can_edit_content, can_view_analytics

router = APIRouter()


# ============================================================================
# SURVEY CONFIGURATION ENDPOINTS
# ============================================================================

@router.get("/{survey_id}/configuration", summary="Get survey configuration for analytics")
async def get_survey_configuration(
    survey_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get survey configuration including question types, scales, and metadata.
    This endpoint parses the NLJ survey structure and generates analytics configuration
    using the same logic as our frontend SurveyConfigurationService.
    """
    
    if not can_view_analytics(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Insufficient permissions to access survey configuration"
        )

    try:
        # Get survey content from content service
        content_service = ContentService(db)
        survey_uuid = uuid.UUID(survey_id)
        survey_content = await content_service.get_content_by_id(survey_uuid)
        
        if not survey_content:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Survey with ID {survey_id} not found"
            )
        
        # Parse NLJ data to extract survey structure
        nlj_data = survey_content.nlj_data
        if not nlj_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Survey does not contain valid NLJ data"
            )
        
        # Generate configuration using survey parsing logic
        configuration = await _parse_survey_configuration(nlj_data, survey_content)
        
        return {
            "success": True,
            "data": configuration,
            "survey_id": survey_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating survey configuration: {str(e)}"
        )


async def _parse_survey_configuration(nlj_data: Dict[str, Any], survey_content: Any) -> Dict[str, Any]:
    """
    Parse NLJ survey data to generate analytics configuration.
    This mirrors the frontend SurveyConfigurationService logic.
    """
    
    # Extract basic survey info
    survey_name = nlj_data.get("name", survey_content.title)
    activity_type = nlj_data.get("activityType", "survey")
    survey_metadata = nlj_data.get("surveyMetadata", {})
    
    # Extract nodes that can be analyzed
    nodes = nlj_data.get("nodes", [])
    question_nodes = [node for node in nodes if _is_question_node(node)]
    
    # Generate question configurations
    questions = []
    for i, node in enumerate(question_nodes):
        question_config = _generate_question_configuration(node, i, survey_metadata)
        if question_config:
            questions.append(question_config)
    
    # Determine survey type
    survey_type = _determine_survey_type(survey_metadata, activity_type, survey_name)
    
    # Generate demographic configuration
    demographics = _generate_demographic_configuration(survey_metadata)
    
    # Calculate analytics metadata
    analytics_enabled = survey_metadata.get("enableAnalytics", True)
    analytics_questions = len([q for q in questions if q.get("analyticsEnabled", False)]) if analytics_enabled else 0
    
    # Generate display configuration
    display_config = _generate_display_configuration(survey_metadata)
    
    return {
        "surveyId": str(survey_content.id),
        "name": survey_name,
        "type": survey_type,
        "questions": questions,
        "demographics": demographics,
        "totalQuestions": len(questions),
        "analyticsQuestions": analytics_questions,
        "estimatedCompletionTime": _estimate_completion_time(questions),
        "displayConfig": display_config,
        "metadata": {
            "activityType": activity_type,
            "surveyMetadata": survey_metadata,
            "createdAt": survey_content.created_at.isoformat() if survey_content.created_at else None,
            "updatedAt": survey_content.updated_at.isoformat() if survey_content.updated_at else None,
        }
    }


def _is_question_node(node: Dict[str, Any]) -> bool:
    """Check if a node is a question type that supports analytics"""
    question_types = [
        "likert_scale", "rating", "true_false", "text_area", "matrix", "slider",
        "multi_select", "checkbox", "question", "multiple_choice", "short_answer"
    ]
    return node.get("type") in question_types


def _generate_question_configuration(node: Dict[str, Any], order: int, survey_metadata: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Generate configuration for individual question node"""
    node_type = node.get("type")
    node_id = node.get("id")
    
    if not node_type or not node_id:
        return None
    
    # Generate scale configuration based on node type
    scale = _detect_question_scale(node, survey_metadata)
    
    # Check if analytics is supported for this node type
    analytics_supported = node_type in ["likert_scale", "rating", "true_false", "slider", "matrix", "multi_select", "checkbox", "question", "multiple_choice"]
    analytics_enabled = analytics_supported and survey_metadata.get("enableAnalytics", True)
    
    return {
        "id": f"question-{order + 1}",
        "nodeId": node_id,
        "nodeType": node_type,
        "title": node.get("title", f"Question {order + 1}"),
        "text": node.get("text", node.get("content", "No question text")),
        "scale": scale,
        "isRequired": node.get("required", False),
        "hasFollowUp": bool(node.get("followUp", {}).get("enabled", False)),
        "analyticsEnabled": analytics_enabled,
        "category": node.get("category"),
        "section": node.get("section"),
        "order": order + 1,
    }


def _detect_question_scale(node: Dict[str, Any], survey_metadata: Dict[str, Any]) -> Dict[str, Any]:
    """Detect question scale based on node type and configuration"""
    node_type = node.get("type")
    node_id = node.get("id", "unknown")
    
    # Get default semantic mapping from metadata
    default_semantic = survey_metadata.get("defaultSemanticMapping", "custom")
    
    if node_type == "likert_scale":
        scale_config = node.get("scale", {})
        min_val = scale_config.get("min", 1)
        max_val = scale_config.get("max", 5)
        value_count = max_val - min_val + 1
        
        # Check if this is NPS (0-10 scale)
        is_nps = min_val == 0 and max_val == 10
        
        # Generate labels
        labels = _generate_likert_labels(min_val, max_val, scale_config.get("labels", {}))
        
        # Detect semantic mapping from question text
        question_text = node.get("text", "")
        semantic_mapping = default_semantic if default_semantic != "custom" else _detect_semantic_mapping(question_text)
        
        return {
            "id": f"likert-{min_val}-{max_val}",
            "type": "nps" if is_nps else "likert",
            "range": [min_val, max_val],
            "labels": labels,
            "values": list(range(min_val, max_val + 1)),
            "positiveThreshold": int(max_val * 0.7),
            "semanticMapping": semantic_mapping,
            "colorScheme": "nps" if is_nps else "likert",
            "valueCount": value_count,
        }
    
    elif node_type == "rating":
        range_config = node.get("range", {})
        min_val = range_config.get("min", 1)
        max_val = range_config.get("max", 5)
        rating_type = node.get("ratingType", "stars")
        categories = node.get("categories", [])
        value_count = max_val - min_val + 1
        
        # Use categories if provided, otherwise generate numeric labels
        labels = categories if categories else [str(i) for i in range(min_val, max_val + 1)]
        
        # Semantic mapping for stars is usually satisfaction
        question_text = node.get("text", "")
        semantic_mapping = default_semantic if default_semantic != "custom" else (
            "satisfaction" if rating_type == "stars" else _detect_semantic_mapping(question_text)
        )
        
        return {
            "id": f"rating-{rating_type}-{min_val}-{max_val}",
            "type": "rating",
            "subtype": rating_type,
            "range": [min_val, max_val],
            "labels": labels,
            "values": list(range(min_val, max_val + 1)),
            "positiveThreshold": int(max_val * 0.7),
            "semanticMapping": semantic_mapping,
            "colorScheme": "likert",
            "valueCount": value_count,
        }
    
    elif node_type == "true_false":
        return {
            "id": f"binary-{node_id}",
            "type": "binary",
            "range": [0, 1],
            "labels": ["False", "True"],
            "values": [0, 1],
            "positiveThreshold": 1,
            "semanticMapping": default_semantic if default_semantic != "custom" else "custom",
            "colorScheme": "binary",
            "valueCount": 2,
        }
    
    elif node_type == "matrix":
        columns = node.get("columns", [])
        column_labels = [col.get("text", f"Option {i+1}") for i, col in enumerate(columns)]
        column_values = [col.get("value", i) for i, col in enumerate(columns)]
        matrix_type = node.get("matrixType", "single")
        
        question_text = node.get("text", "")
        semantic_mapping = default_semantic if default_semantic != "custom" else _detect_semantic_mapping(question_text)
        
        return {
            "id": f"matrix-{node_id}",
            "type": "matrix",
            "subtype": matrix_type,
            "labels": column_labels,
            "values": column_values,
            "semanticMapping": semantic_mapping,
            "colorScheme": "likert",
            "valueCount": len(columns),
        }
    
    elif node_type == "slider":
        range_config = node.get("range", {})
        min_val = range_config.get("min", 0)
        max_val = range_config.get("max", 100)
        
        labels_config = node.get("labels", {})
        labels = [
            labels_config.get("min", str(min_val)),
            labels_config.get("max", str(max_val))
        ]
        
        question_text = node.get("text", "")
        semantic_mapping = default_semantic if default_semantic != "custom" else _detect_semantic_mapping(question_text)
        
        return {
            "id": f"slider-{min_val}-{max_val}",
            "type": "numeric",
            "subtype": "slider",
            "range": [min_val, max_val],
            "labels": labels,
            "values": [min_val, max_val],
            "positiveThreshold": min_val + (max_val - min_val) * 0.7,
            "semanticMapping": semantic_mapping,
            "colorScheme": "likert",
            "valueCount": min(10, max_val - min_val + 1),
        }
    
    elif node_type == "multiple_choice":
        choices = node.get("choices", [])
        choice_labels = [choice.get("text", f"Choice {i+1}") for i, choice in enumerate(choices)]
        choice_values = [choice.get("id", f"choice_{i}") for i, choice in enumerate(choices)]
        
        return {
            "id": f"multiple_choice-{node_id}",
            "type": "categorical",
            "subtype": "single_choice",
            "labels": choice_labels,
            "values": choice_values,
            "semanticMapping": "custom",
            "colorScheme": "custom",
            "valueCount": len(choices),
        }
    
    # Default for other types (text_area, multi_select, etc.)
    return {
        "id": f"{node_type}-{node_id}",
        "type": "categorical" if node_type in ["multi_select", "checkbox", "question"] else "text",
        "labels": ["Response"],
        "values": ["response"],
        "semanticMapping": "custom",
        "colorScheme": "custom",
        "valueCount": 1,
    }


def _generate_likert_labels(min_val: int, max_val: int, labels_config: Dict[str, Any]) -> List[str]:
    """Generate Likert scale labels"""
    value_count = max_val - min_val + 1
    
    # Use custom labels if provided
    custom_labels = labels_config.get("custom", {})
    if custom_labels:
        return [custom_labels.get(str(min_val + i), str(min_val + i)) for i in range(value_count)]
    
    # Use min/max/middle labels for common scales
    min_label = labels_config.get("min", "")
    max_label = labels_config.get("max", "")
    middle_label = labels_config.get("middle", "")
    
    if value_count == 5 and min_label and max_label:
        return [
            min_label,
            "Disagree",
            middle_label or "Neutral", 
            "Agree",
            max_label
        ]
    elif value_count == 3 and min_label and max_label:
        return [
            min_label,
            middle_label or "Neutral",
            max_label
        ]
    
    # Default numeric labels
    return [str(min_val + i) for i in range(value_count)]


def _detect_semantic_mapping(text: str) -> str:
    """Detect semantic meaning from question text"""
    text_lower = text.lower()
    
    if "satisf" in text_lower or "happy" in text_lower or "pleased" in text_lower:
        return "satisfaction"
    elif "agree" in text_lower or "disagree" in text_lower or "opinion" in text_lower:
        return "agreement"
    elif "perform" in text_lower or "quality" in text_lower or "effective" in text_lower:
        return "performance"
    elif "often" in text_lower or "frequency" in text_lower or "how much" in text_lower:
        return "frequency"
    elif "positive" in text_lower or "negative" in text_lower or "good" in text_lower or "bad" in text_lower:
        return "positive-negative"
    
    return "custom"


def _determine_survey_type(survey_metadata: Dict[str, Any], content_type: str, survey_name: str) -> str:
    """Determine survey type from metadata with sensible defaults"""
    
    # Priority 1: Use explicit survey type from metadata
    explicit_type = survey_metadata.get("surveyType")
    if explicit_type:
        return explicit_type
    
    # Priority 2: Infer from content type if it's specifically 'survey'
    if content_type == "survey":
        name_lower = survey_name.lower()
        if "exit" in name_lower or "departure" in name_lower or "leaving" in name_lower:
            return "exit"
        elif "engagement" in name_lower or "employee" in name_lower:
            return "engagement"
        elif "satisfaction" in name_lower or "feedback" in name_lower:
            return "satisfaction"
        elif "pulse" in name_lower or "quick" in name_lower or "brief" in name_lower:
            return "pulse"
        elif "performance" in name_lower or "review" in name_lower:
            return "performance"
        elif "onboarding" in name_lower or "welcome" in name_lower:
            return "onboarding"
        
        # Default for survey activity type
        return "feedback"
    
    # Priority 3: Default based on content type
    if content_type == "assessment":
        return "performance"
    
    # Priority 4: Fallback to custom
    return "custom"


def _generate_demographic_configuration(survey_metadata: Dict[str, Any]) -> Dict[str, Any]:
    """Generate demographic configuration with metadata context"""
    primary = []
    secondary = ["tenure", "role", "manager", "generation", "gender"]
    
    # Prioritize demographics based on metadata
    if survey_metadata.get("department"):
        primary.append("department")
    if survey_metadata.get("targetAudience"):
        primary.append("audience")
    
    # Default groupings if no metadata
    if not primary:
        primary = ["department", "location"]
    
    # All available demographic groupings - easily extensible
    available_groupings = [
        # Core organizational demographics
        "department", "location", "team", "business_unit", "division",
        # Role-based demographics  
        "role", "manager", "job_level", "employment_type",
        # Tenure demographics
        "tenure", "hire_date_range", "service_years_range",
        # Personal demographics (if collected)
        "generation", "age_range", "gender", "education_level",
        # Custom demographics
        "audience", "segment", "cohort", "custom_1", "custom_2"
    ]
    
    return {
        "primary": primary,
        "secondary": secondary,
        "hierarchical": survey_metadata.get("collectDemographics", True),
        "anonymizationThreshold": 4,
        "availableGroupings": available_groupings,
        # Demographic category definitions for UI
        "categoryDefinitions": {
            "generation": {
                "label": "Generation",
                "type": "categorical",
                "values": ["Gen Z", "Millennial", "Gen X", "Baby Boomer"],
                "description": "Generational cohort based on birth year"
            },
            "gender": {
                "label": "Gender",
                "type": "categorical", 
                "values": ["Male", "Female", "Non-binary", "Prefer not to say"],
                "description": "Gender identity (if voluntarily provided)"
            },
            "age_range": {
                "label": "Age Range",
                "type": "categorical",
                "values": ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"],
                "description": "Age groupings for demographic analysis"
            },
            "tenure": {
                "label": "Tenure",
                "type": "categorical", 
                "values": ["0-6 months", "6-12 months", "1-2 years", "3-5 years", "5+ years"],
                "description": "Length of employment"
            },
            "job_level": {
                "label": "Job Level",
                "type": "hierarchical",
                "values": ["Individual Contributor", "Team Lead", "Manager", "Senior Manager", "Director", "VP+"],
                "description": "Organizational hierarchy level"
            }
        }
    }


def _generate_display_configuration(survey_metadata: Dict[str, Any]) -> Dict[str, Any]:
    """Generate display configuration based on survey metadata"""
    return {
        "defaultGroupBy": "department" if survey_metadata.get("department") else "location",
        "showTrends": True,
        "showBenchmarks": bool(survey_metadata.get("benchmarkCategory")),
        "compactMode": False,
    }


def _estimate_completion_time(questions: List[Dict[str, Any]]) -> int:
    """Estimate completion time for questions in seconds"""
    base_times = {
        "likert_scale": 10,
        "rating": 8,
        "true_false": 5,
        "text_area": 45,
        "matrix": 20,
        "slider": 12,
        "multi_select": 15,
        "checkbox": 15,
        "question": 10,
        "short_answer": 30,
    }
    
    total_time = 0
    for question in questions:
        node_type = question.get("nodeType", "question")
        base_time = base_times.get(node_type, 10)
        follow_up_time = 20 if question.get("hasFollowUp", False) else 0
        total_time += base_time + follow_up_time
    
    return total_time


# ============================================================================
# SURVEY BENCHMARK ENDPOINTS  
# ============================================================================

@router.get("/{survey_id}/benchmarks", summary="Get survey benchmarks (placeholder)")
async def get_survey_benchmarks(
    survey_id: str,
    category: Optional[str] = Query(None, description="Benchmark category (industry, region, etc.)"),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get benchmark data for survey comparison.
    Currently returns placeholder data - will be enhanced with real benchmark database.
    """
    
    if not can_view_analytics(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access survey benchmarks"
        )

    # Placeholder benchmark data - structured for real implementation
    benchmarks = {
        "automotive": {
            "industry": "automotive",
            "sample_size": 2847,
            "survey_types": {
                "satisfaction": {
                    "response_rate": {"p50": 68, "p75": 78, "p90": 85},
                    "completion_rate": {"p50": 82, "p75": 89, "p90": 94},
                    "satisfaction_score": {"p50": 7.2, "p75": 8.1, "p90": 8.8},
                    "nps": {"p50": 32, "p75": 45, "p90": 62}
                },
                "engagement": {
                    "response_rate": {"p50": 72, "p75": 81, "p90": 88},
                    "completion_rate": {"p50": 85, "p75": 91, "p90": 95},
                    "engagement_score": {"p50": 6.8, "p75": 7.6, "p90": 8.3}
                },
                "exit": {
                    "response_rate": {"p50": 45, "p75": 58, "p90": 71},
                    "completion_rate": {"p50": 76, "p75": 84, "p90": 91},
                    "satisfaction_score": {"p50": 5.2, "p75": 6.1, "p90": 7.3}
                }
            },
            "question_benchmarks": {
                "likert_5_satisfaction": {"p50": 3.6, "p75": 4.1, "p90": 4.5},
                "likert_5_agreement": {"p50": 3.4, "p75": 3.9, "p90": 4.3},
                "nps_0_10": {"p50": 6.8, "p75": 7.4, "p90": 8.2},
                "binary_yes_rate": {"p50": 0.62, "p75": 0.71, "p90": 0.82}
            }
        },
        "general": {
            "industry": "cross_industry",
            "sample_size": 12459,
            "survey_types": {
                "satisfaction": {
                    "response_rate": {"p50": 65, "p75": 75, "p90": 83},
                    "completion_rate": {"p50": 79, "p75": 86, "p90": 92},
                    "satisfaction_score": {"p50": 7.0, "p75": 7.8, "p90": 8.5}
                },
                "engagement": {
                    "response_rate": {"p50": 69, "p75": 78, "p90": 85},
                    "completion_rate": {"p50": 83, "p75": 89, "p90": 94},
                    "engagement_score": {"p50": 6.6, "p75": 7.3, "p90": 8.0}
                }
            },
            "question_benchmarks": {
                "likert_5_satisfaction": {"p50": 3.5, "p75": 4.0, "p90": 4.4},
                "likert_5_agreement": {"p50": 3.3, "p75": 3.8, "p90": 4.2},
                "nps_0_10": {"p50": 6.5, "p75": 7.2, "p90": 8.0}
            }
        }
    }
    
    # Select benchmark category
    selected_category = category or "general"
    if selected_category not in benchmarks:
        selected_category = "general"
    
    benchmark_data = benchmarks[selected_category]
    
    return {
        "success": True,
        "data": {
            "category": selected_category,
            "benchmarks": benchmark_data,
            "available_categories": list(benchmarks.keys()),
            "metadata": {
                "last_updated": "2024-01-15T00:00:00Z",
                "data_sources": ["Industry Research Partners", "Public Survey Data"],
                "note": "Placeholder data - real benchmarks coming soon"
            }
        },
        "survey_id": survey_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ============================================================================
# SURVEY STATISTICS ENDPOINTS
# ============================================================================


@router.get("/{survey_id}/analytics", summary="Get comprehensive survey analytics")
async def get_survey_analytics(
    survey_id: str,
    question_id: Optional[str] = Query(None, description="Specific question ID to analyze"),
    group_by: Optional[str] = Query(None, description="Demographic grouping field"),
    since: Optional[str] = Query(None, description="Start date in ISO format"),
    db: AsyncSession = Depends(get_db),
    ralph_service: RalphLRSService = Depends(get_ralph_lrs_service),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get comprehensive survey analytics with question-type-specific aggregations.
    Returns component-ready data transformed by SurveyAnalyticsAdapter.
    """
    if not can_view_analytics(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Insufficient permissions to access survey analytics"
        )

    try:
        # Step 1: Get survey content and configuration
        content_service = ContentService(db)
        survey_uuid = uuid.UUID(survey_id)
        survey_content = await content_service.get_content_by_id(survey_uuid)
        
        if not survey_content:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Survey with ID {survey_id} not found"
            )

        # Step 2: Generate survey configuration for data transformation
        # Extract question configuration from survey NLJ data
        nlj_data = survey_content.nlj_data or {}
        
        # Extract survey metadata
        survey_metadata = nlj_data.get("surveyMetadata", {})
        content_type = survey_content.content_type
        survey_name = survey_content.title
        
        # Find question nodes in the scenario
        nodes = nlj_data.get("nodes", [])
        question_nodes = [node for node in nodes if _is_question_node(node)]
        
        # Generate question configurations
        questions = []
        for i, node in enumerate(question_nodes):
            question_config = _generate_question_configuration(node, i, survey_metadata)
            if question_config:
                questions.append(question_config)
        
        # Determine survey type
        survey_type = _determine_survey_type(survey_metadata, content_type, survey_name)
        
        survey_config = {
            "surveyId": survey_id,
            "name": survey_name,
            "type": survey_type,
            "questions": questions,
        }

        # Step 3: Get raw analytics data from Ralph LRS/ElasticSearch
        raw_analytics = await ralph_service.get_survey_analytics(
            survey_id=survey_id, 
            question_id=question_id,
            group_by=group_by,
            since=since
        )

        # Step 4: Transform raw analytics into component-ready format
        transformed_analytics = survey_analytics_adapter.transform_survey_analytics(
            raw_analytics, 
            survey_config
        )

        if not transformed_analytics.get("success", False):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=transformed_analytics.get("error", "Analytics processing failed")
            )

        # Step 5: Add request metadata
        transformed_analytics.update({
            "filters": {
                "survey_id": survey_id, 
                "question_id": question_id,
                "group_by": group_by,
                "since": since
            },
            "request_timestamp": datetime.now(timezone.utc).isoformat(),
        })

        return transformed_analytics

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Error retrieving survey analytics: {str(e)}"
        )


@router.get("/{survey_id}/questions/{question_id}/analytics", summary="Get question-specific analytics")
async def get_question_analytics(
    survey_id: str,
    question_id: str,
    scale_type: str = Query("likert", description="Question scale type (likert, nps, rating, binary, matrix)"),
    since: Optional[str] = Query(None, description="Start date in ISO format"),
    ralph_service: RalphLRSService = Depends(get_ralph_lrs_service),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get detailed analytics for a specific survey question with scale-aware processing.
    Optimized for different question types with appropriate statistical analysis.
    """
    if not can_view_analytics(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access question analytics"
        )

    try:
        # Use the new question-specific analytics method
        analytics_result = await ralph_service.get_survey_question_analytics(
            survey_id=survey_id,
            question_id=question_id,
            scale_type=scale_type,
            since=since
        )

        if not analytics_result.get("success", False):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=analytics_result.get("error", "Analytics service unavailable")
            )

        return {
            "success": True,
            "data": analytics_result["data"],
            "filters": {
                "survey_id": survey_id,
                "question_id": question_id,
                "scale_type": scale_type,
                "since": since
            },
            "total_responses": analytics_result.get("total_responses", 0),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving question analytics: {str(e)}"
        )


# ============================================================================
# DEMOGRAPHIC ANALYTICS ENDPOINTS
# ============================================================================

@router.get("/{survey_id}/demographics", summary="Get available demographic groupings")
async def get_survey_demographics(
    survey_id: str,
    analyze_existing: bool = Query(True, description="Analyze existing responses to detect demographics"),
    ralph_service: RalphLRSService = Depends(get_ralph_lrs_service),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get available demographic groupings for a survey by analyzing xAPI context extensions.
    Auto-detects demographic fields from existing survey responses.
    """
    if not can_view_analytics(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access demographic data"
        )

    try:
        if analyze_existing:
            # Get sample of survey responses to analyze demographic fields
            statements_result = await ralph_service.get_survey_statements(
                survey_id=survey_id,
                limit=500  # Sample size for analysis
            )
            
            if statements_result.get("success") and statements_result.get("statements"):
                # Analyze statements for demographic patterns
                demographic_config = demographic_detector.analyze_xapi_statements(
                    statements_result["statements"]
                )
                
                # Add survey-specific metadata
                demographic_config.update({
                    "survey_id": survey_id,
                    "analysis_timestamp": datetime.now(timezone.utc).isoformat(),
                    "sample_size": len(statements_result["statements"]),
                })
                
                return demographic_config
            else:
                # No existing data, return default configuration
                return {
                    "success": True,
                    "survey_id": survey_id,
                    "detected_fields": [],
                    "primary_demographics": ["department", "location"],
                    "secondary_demographics": ["tenure", "role"],
                    "configuration": {
                        "primary": ["department", "location"],
                        "secondary": ["tenure", "role"],
                        "hierarchical": True,
                        "anonymization_threshold": 4,
                        "available_groupings": ["department", "location", "tenure", "role"],
                    },
                    "message": "No existing responses found. Using default demographic configuration.",
                    "analysis_timestamp": datetime.now(timezone.utc).isoformat(),
                }
        else:
            # Return standard demographic configuration without analysis
            return {
                "success": True,
                "survey_id": survey_id,
                "detected_fields": ["department", "location", "tenure", "role"],
                "configuration": {
                    "primary": ["department", "location"],
                    "secondary": ["tenure", "role"], 
                    "hierarchical": True,
                    "anonymization_threshold": 4,
                    "available_groupings": ["department", "location", "tenure", "role", "manager", "job_level"],
                },
                "message": "Standard demographic configuration provided.",
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error analyzing demographics: {str(e)}"
        )


@router.get("/{survey_id}/stats", summary="Get survey statistics (legacy)")
async def get_survey_stats(
    survey_id: str,
    since: Optional[str] = Query(None, description="Start date in ISO format"),
    ralph_service: RalphLRSService = Depends(get_ralph_lrs_service),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get comprehensive statistics for a specific survey (legacy endpoint - use /analytics instead)"""

    # TODO: Add proper permission checking for survey access
    if not can_view_analytics(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions to access survey analytics"
        )

    try:
        # Use the enhanced Ralph LRS service method for survey statistics
        survey_stats = await ralph_service.get_survey_statistics(survey_id=survey_id, since=since)

        # Get survey questions count (placeholder - would need to parse nlj_data)
        total_questions = 10  # TODO: Parse actual survey structure from content API

        # Combine stats
        stats = {"total_questions": total_questions, **survey_stats}

        return {
            "success": True,
            "data": stats,
            "filters": {"survey_id": survey_id, "since": since},
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error retrieving survey statistics: {str(e)}"
        )


# ============================================================================
# SURVEY LINKS MANAGEMENT
# ============================================================================


@router.get("/{survey_id}/links", summary="Get survey share links")
async def get_survey_links(
    survey_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get all share links generated for this survey"""

    # TODO: Add proper permission checking for survey access
    if not can_view_analytics(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions to access survey links"
        )

    try:
        # Get share tokens for this survey
        shared_token_service = SharedTokenService(db)
        survey_uuid = uuid.UUID(survey_id)
        share_tokens = await shared_token_service.get_content_shares(survey_uuid)

        # Format response
        links = []
        for token in share_tokens:
            links.append(
                {
                    "id": str(token.id),
                    "token": token.token,
                    "url": f"https://callcoach.training/shared/{token.token}",
                    "created_at": token.created_at.isoformat(),
                    "expires_at": token.expires_at.isoformat() if token.expires_at else None,
                    "is_active": token.is_active
                    and (not token.expires_at or token.expires_at > datetime.now(timezone.utc)),
                    "views": token.access_count,
                    "completions": 0,  # TODO: Calculate from xAPI statements
                    "description": getattr(token, "description", None),
                }
            )

        return {
            "success": True,
            "data": {"links": links, "total": len(links), "active_links": len([l for l in links if l["is_active"]])},
            "survey_id": survey_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error retrieving survey links: {str(e)}"
        )


@router.post("/{survey_id}/links", summary="Create new survey share link")
async def create_survey_link(
    survey_id: str,
    request_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Create a new public share link for the survey"""

    # TODO: Add proper permission checking for survey access
    if not can_edit_content(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions to create survey links"
        )

    try:
        # Extract request parameters
        description = request_data.get("description")
        expires_at_str = request_data.get("expires_at")

        # Parse expiration date if provided
        expires_at = None
        if expires_at_str:
            try:
                expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid expires_at format. Use ISO 8601 format."
                )

        # Create SharedTokenCreate object
        token_data = SharedTokenCreate(description=description, expires_at=expires_at)

        # Create share token
        shared_token_service = SharedTokenService(db)
        survey_uuid = uuid.UUID(survey_id)
        user_uuid = uuid.UUID(current_user.id)

        share_token = await shared_token_service.create_share_token(
            content_id=survey_uuid, user_id=user_uuid, token_data=token_data
        )

        # Format response
        link_data = {
            "id": str(share_token.id),
            "token": share_token.token,
            "url": f"https://callcoach.training/shared/{share_token.token}",
            "created_at": share_token.created_at.isoformat(),
            "expires_at": share_token.expires_at.isoformat() if share_token.expires_at else None,
            "is_active": True,
            "views": 0,
            "completions": 0,
            "description": getattr(share_token, "description", None),
        }

        return {"success": True, "data": link_data, "generated_at": datetime.now(timezone.utc).isoformat()}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error creating survey link: {str(e)}"
        )


@router.delete("/{survey_id}/links/{token_id}", summary="Revoke survey share link")
async def revoke_survey_link(
    survey_id: str, token_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Revoke an active survey share link"""

    # TODO: Add proper permission checking for survey access
    if not can_edit_content(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions to revoke survey links"
        )

    try:
        # Revoke the share token
        shared_token_service = SharedTokenService(db)
        token_uuid = uuid.UUID(token_id)
        user_uuid = uuid.UUID(current_user.id)

        success = await shared_token_service.revoke_share_token(token_uuid, user_uuid)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Share token not found or already revoked"
            )

        return {
            "success": True,
            "message": "Survey link revoked successfully",
            "token_id": token_id,
            "revoked_at": datetime.now(timezone.utc).isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error revoking survey link: {str(e)}"
        )


# ============================================================================
# SURVEY RESPONSES
# ============================================================================


@router.get("/{survey_id}/responses", summary="Get survey responses")
async def get_survey_responses(
    survey_id: str,
    since: Optional[str] = Query(None, description="Start date in ISO format"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of responses"),
    ralph_service: RalphLRSService = Depends(get_ralph_lrs_service),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get detailed survey responses with follow-up text"""

    # TODO: Add proper permission checking for survey access
    if not can_view_analytics(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions to access survey responses"
        )

    try:
        # Use the enhanced Ralph LRS service method for survey responses
        responses = await ralph_service.get_survey_responses_with_followup(
            survey_id=survey_id, since=since, limit=limit
        )

        return {
            "success": True,
            "data": {"responses": responses, "total": len(responses), "survey_id": survey_id},
            "filters": {"since": since, "limit": limit},
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error retrieving survey responses: {str(e)}"
        )


# ============================================================================
# SURVEY INSIGHTS (PLACEHOLDERS)
# ============================================================================


@router.get("/{survey_id}/insights", summary="Get survey insights")
async def get_survey_insights(survey_id: str, current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    """Get AI-generated insights for survey responses (placeholder)"""

    if not can_view_analytics(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions to access survey insights"
        )

    # Placeholder for future LLM integration
    insights = {
        "sentiment_analysis": {
            "overall_sentiment": "positive",
            "sentiment_distribution": {"positive": 65, "neutral": 25, "negative": 10},
            "key_themes": ["satisfaction", "improvement", "experience"],
        },
        "response_patterns": {
            "completion_funnel": [100, 95, 90, 85, 80],
            "question_difficulty": {"easy": 70, "medium": 25, "hard": 5},
        },
        "recommendations": [
            "Consider adding more intermediate-level questions",
            "Follow up on negative feedback themes",
            "Survey length is optimal for completion rate",
        ],
    }

    return {
        "success": True,
        "data": insights,
        "survey_id": survey_id,
        "note": "AI-powered insights coming soon - this is placeholder data",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
