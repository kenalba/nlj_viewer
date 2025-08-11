"""
Survey Analytics API endpoints for survey-specific data and statistics.
Provides comprehensive survey analytics leveraging existing xAPI infrastructure.
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.database_manager import get_db
from app.models.user import User
from app.utils.permissions import can_view_analytics, can_edit_content
from app.services.ralph_lrs_service import RalphLRSService, get_ralph_lrs_service
from app.services.shared_token_service import SharedTokenService
from app.schemas.shared_token import SharedTokenCreate

router = APIRouter()


# ============================================================================
# SURVEY STATISTICS ENDPOINTS
# ============================================================================

@router.get("/{survey_id}/stats", summary="Get survey statistics")
async def get_survey_stats(
    survey_id: str,
    since: Optional[str] = Query(None, description="Start date in ISO format"),
    ralph_service: RalphLRSService = Depends(get_ralph_lrs_service),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get comprehensive statistics for a specific survey"""
    
    # TODO: Add proper permission checking for survey access
    if not can_view_analytics(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access survey analytics"
        )
    
    try:
        # Use the enhanced Ralph LRS service method for survey statistics
        survey_stats = await ralph_service.get_survey_statistics(
            survey_id=survey_id,
            since=since
        )
        
        # Get survey questions count (placeholder - would need to parse nlj_data)
        total_questions = 10  # TODO: Parse actual survey structure from content API
        
        # Combine stats
        stats = {
            "total_questions": total_questions,
            **survey_stats
        }
        
        return {
            "success": True,
            "data": stats,
            "filters": {
                "survey_id": survey_id,
                "since": since
            },
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving survey statistics: {str(e)}"
        )


# ============================================================================
# SURVEY LINKS MANAGEMENT
# ============================================================================

@router.get("/{survey_id}/links", summary="Get survey share links")
async def get_survey_links(
    survey_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get all share links generated for this survey"""
    
    # TODO: Add proper permission checking for survey access
    if not can_view_analytics(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access survey links"
        )
    
    try:
        # Get share tokens for this survey
        shared_token_service = SharedTokenService(db)
        survey_uuid = uuid.UUID(survey_id)
        share_tokens = await shared_token_service.get_content_shares(survey_uuid)
        
        # Format response
        links = []
        for token in share_tokens:
            links.append({
                "id": str(token.id),
                "token": token.token,
                "url": f"https://callcoach.training/shared/{token.token}",
                "created_at": token.created_at.isoformat(),
                "expires_at": token.expires_at.isoformat() if token.expires_at else None,
                "is_active": token.is_active and (not token.expires_at or token.expires_at > datetime.now(timezone.utc)),
                "views": token.access_count,
                "completions": 0,  # TODO: Calculate from xAPI statements
                "description": getattr(token, 'description', None)
            })
        
        return {
            "success": True,
            "data": {
                "links": links,
                "total": len(links),
                "active_links": len([l for l in links if l["is_active"]])
            },
            "survey_id": survey_id,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving survey links: {str(e)}"
        )


@router.post("/{survey_id}/links", summary="Create new survey share link")
async def create_survey_link(
    survey_id: str,
    request_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Create a new public share link for the survey"""
    
    # TODO: Add proper permission checking for survey access
    if not can_edit_content(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create survey links"
        )
    
    try:
        # Extract request parameters
        description = request_data.get('description')
        expires_at_str = request_data.get('expires_at')
        
        # Parse expiration date if provided
        expires_at = None
        if expires_at_str:
            try:
                expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid expires_at format. Use ISO 8601 format."
                )
        
        # Create SharedTokenCreate object
        token_data = SharedTokenCreate(
            description=description,
            expires_at=expires_at
        )
        
        # Create share token
        shared_token_service = SharedTokenService(db)
        survey_uuid = uuid.UUID(survey_id)
        user_uuid = uuid.UUID(current_user.id)
        
        share_token = await shared_token_service.create_share_token(
            content_id=survey_uuid,
            user_id=user_uuid,
            token_data=token_data
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
            "description": getattr(share_token, 'description', None)
        }
        
        return {
            "success": True,
            "data": link_data,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating survey link: {str(e)}"
        )


@router.delete("/{survey_id}/links/{token_id}", summary="Revoke survey share link")
async def revoke_survey_link(
    survey_id: str,
    token_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Revoke an active survey share link"""
    
    # TODO: Add proper permission checking for survey access
    if not can_edit_content(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to revoke survey links"
        )
    
    try:
        # Revoke the share token
        shared_token_service = SharedTokenService(db)
        token_uuid = uuid.UUID(token_id)
        user_uuid = uuid.UUID(current_user.id)
        
        success = await shared_token_service.revoke_share_token(token_uuid, user_uuid)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Share token not found or already revoked"
            )
        
        return {
            "success": True,
            "message": "Survey link revoked successfully",
            "token_id": token_id,
            "revoked_at": datetime.now(timezone.utc).isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error revoking survey link: {str(e)}"
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
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get detailed survey responses with follow-up text"""
    
    # TODO: Add proper permission checking for survey access
    if not can_view_analytics(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access survey responses"
        )
    
    try:
        # Use the enhanced Ralph LRS service method for survey responses
        responses = await ralph_service.get_survey_responses_with_followup(
            survey_id=survey_id,
            since=since,
            limit=limit
        )
        
        return {
            "success": True,
            "data": {
                "responses": responses,
                "total": len(responses),
                "survey_id": survey_id
            },
            "filters": {
                "since": since,
                "limit": limit
            },
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving survey responses: {str(e)}"
        )


# ============================================================================
# SURVEY INSIGHTS (PLACEHOLDERS)
# ============================================================================

@router.get("/{survey_id}/insights", summary="Get survey insights")
async def get_survey_insights(
    survey_id: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get AI-generated insights for survey responses (placeholder)"""
    
    if not can_view_analytics(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access survey insights"
        )
    
    # Placeholder for future LLM integration
    insights = {
        "sentiment_analysis": {
            "overall_sentiment": "positive",
            "sentiment_distribution": {
                "positive": 65,
                "neutral": 25,
                "negative": 10
            },
            "key_themes": ["satisfaction", "improvement", "experience"]
        },
        "response_patterns": {
            "completion_funnel": [100, 95, 90, 85, 80],
            "question_difficulty": {
                "easy": 70,
                "medium": 25,
                "hard": 5
            }
        },
        "recommendations": [
            "Consider adding more intermediate-level questions",
            "Follow up on negative feedback themes",
            "Survey length is optimal for completion rate"
        ]
    }
    
    return {
        "success": True,
        "data": insights,
        "survey_id": survey_id,
        "note": "AI-powered insights coming soon - this is placeholder data",
        "generated_at": datetime.now(timezone.utc).isoformat()
    }