"""
Email notification API endpoints for surveys, training, and system notifications.
Integrates with SES email service for reliable message delivery.
"""

import uuid
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database_manager import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services.email_service import email_service, EmailRecipient
from app.core.config import settings

router = APIRouter(prefix="/notifications", tags=["notifications"])


class EmailRecipientRequest(BaseModel):
    """Email recipient for API requests."""
    email: EmailStr
    name: Optional[str] = None


class SurveyInvitationRequest(BaseModel):
    """Request model for survey invitation emails."""
    survey_title: str = Field(..., description="Title of the survey")
    survey_url: str = Field(..., description="Public URL for the survey")
    recipients: List[EmailRecipientRequest] = Field(..., min_items=1, max_items=100)
    sender_name: Optional[str] = Field(None, description="Name of sender (defaults to user's name)")
    custom_message: Optional[str] = Field(None, description="Custom message to include")
    reminder: bool = Field(False, description="Whether this is a reminder email")
    days_remaining: Optional[int] = Field(None, description="Days until survey closes (for reminders)")


class TrainingNotificationRequest(BaseModel):
    """Request model for training notification emails."""
    training_title: str = Field(..., description="Title of the training session")
    training_date: datetime = Field(..., description="Date and time of training")
    training_url: Optional[str] = Field(None, description="URL for training details")
    recipients: List[EmailRecipientRequest] = Field(..., min_items=1, max_items=100)
    notification_type: str = Field("registration_confirmation", description="Type of notification")
    additional_info: Optional[dict] = Field(None, description="Additional information to include")


class EmailResponse(BaseModel):
    """Response model for email operations."""
    success: bool
    message: str
    recipient_count: int
    failed_recipients: List[str] = []
    message_id: Optional[str] = None
    timestamp: datetime


@router.post("/send-survey-invitation", response_model=EmailResponse)
async def send_survey_invitation(
    request: SurveyInvitationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Send survey invitation emails to multiple recipients.
    
    This endpoint allows sending survey invitations with customizable content
    including reminders with countdown timers.
    """
    # Check if email notifications are enabled
    if not settings.ENABLE_EMAIL_NOTIFICATIONS:
        raise HTTPException(
            status_code=503,
            detail="Email notifications are currently disabled. Please contact your administrator."
        )
    
    try:
        # Convert request recipients to service recipients
        recipients = [
            EmailRecipient(
                email=r.email,
                name=r.name,
                user_id=None  # External survey recipients don't have user accounts
            )
            for r in request.recipients
        ]
        
        # Use sender name or current user's name
        sender_name = request.sender_name or getattr(current_user, 'name', None) or 'NLJ Platform'
        
        # Send emails via background task to avoid timeout
        def send_emails():
            # Note: This would need proper async handling in a production setup
            # For now, we'll call the async function directly
            import asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            result = loop.run_until_complete(
                email_service.send_survey_invitation(
                    survey_title=request.survey_title,
                    survey_url=request.survey_url,
                    recipients=recipients,
                    sender_name=sender_name,
                    custom_message=request.custom_message,
                    reminder=request.reminder,
                    days_remaining=request.days_remaining
                )
            )
            return result
        
        # For immediate feedback, we'll send synchronously
        # In production, consider using Celery or similar for background processing
        result = await email_service.send_survey_invitation(
            survey_title=request.survey_title,
            survey_url=request.survey_url,
            recipients=recipients,
            sender_name=sender_name,
            custom_message=request.custom_message,
            reminder=request.reminder,
            days_remaining=request.days_remaining
        )
        
        # Convert service result to API response
        response = EmailResponse(
            success=result.success,
            message=f"Survey {'reminder' if request.reminder else 'invitation'} sent successfully" if result.success else f"Failed to send emails: {result.error_message}",
            recipient_count=result.recipient_count,
            failed_recipients=result.failed_recipients,
            message_id=result.message_id,
            timestamp=result.timestamp
        )
        
        if not result.success and result.failed_recipients:
            # Partial failure - some emails sent
            response.message = f"Emails sent to {result.recipient_count} recipients, {len(result.failed_recipients)} failed"
        
        return response
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process survey invitation request: {str(e)}"
        )


@router.post("/send-training-notification", response_model=EmailResponse)
async def send_training_notification(
    request: TrainingNotificationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Send training-related notification emails.
    
    Supports various notification types including registration confirmations,
    reminders, and cancellation notices.
    """
    if not settings.ENABLE_EMAIL_NOTIFICATIONS:
        raise HTTPException(
            status_code=503,
            detail="Email notifications are currently disabled"
        )
    
    try:
        # Convert request recipients to service recipients
        recipients = [
            EmailRecipient(email=r.email, name=r.name)
            for r in request.recipients
        ]
        
        # Send training notifications
        result = await email_service.send_training_notification(
            training_title=request.training_title,
            training_date=request.training_date,
            training_url=request.training_url,
            recipients=recipients,
            notification_type=request.notification_type,
            additional_info=request.additional_info
        )
        
        return EmailResponse(
            success=result.success,
            message="Training notification sent successfully" if result.success else f"Failed to send notifications: {result.error_message}",
            recipient_count=result.recipient_count,
            failed_recipients=result.failed_recipients,
            message_id=result.message_id,
            timestamp=result.timestamp
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send training notification: {str(e)}"
        )


@router.post("/send-admin-notification")
async def send_admin_notification(
    subject: str,
    message: str,
    notification_type: str = "system",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Send notification to system administrators.
    
    Used for system alerts, errors, or important user actions that need admin attention.
    """
    try:
        # Include user info in additional data
        additional_data = {
            "triggered_by_user": current_user.email,
            "user_id": str(current_user.id),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        result = await email_service.send_admin_notification(
            subject=subject,
            message=message,
            notification_type=notification_type,
            additional_data=additional_data
        )
        
        return {
            "success": result.success,
            "message": "Admin notification sent" if result.success else "Failed to send admin notification",
            "timestamp": result.timestamp
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send admin notification: {str(e)}"
        )


@router.get("/health")
async def get_email_service_health():
    """
    Get email service health status.
    
    Useful for monitoring and debugging email functionality.
    """
    try:
        health_status = email_service.health_check()
        
        return {
            "email_service": health_status,
            "notifications_enabled": settings.ENABLE_EMAIL_NOTIFICATIONS,
            "ses_endpoint": settings.SES_ENDPOINT_URL or "AWS SES",
            "from_email": settings.SES_FROM_EMAIL
        }
        
    except Exception as e:
        return {
            "email_service": {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            },
            "notifications_enabled": settings.ENABLE_EMAIL_NOTIFICATIONS
        }


@router.get("/templates/survey-preview")
async def preview_survey_email_template(
    survey_title: str,
    survey_url: str = "https://example.com/survey/123",
    sender_name: str = "Survey Team",
    custom_message: Optional[str] = None,
    reminder: bool = False,
    days_remaining: Optional[int] = None
):
    """
    Preview survey email template without sending.
    
    Useful for testing email content and formatting before sending to recipients.
    """
    try:
        # Create a test template
        from app.services.email_service import SESEmailService
        service = SESEmailService()
        
        template = service._create_survey_invitation_template(
            survey_title=survey_title,
            survey_url=survey_url,
            sender_name=sender_name,
            custom_message=custom_message,
            reminder=reminder,
            days_remaining=days_remaining
        )
        
        return {
            "subject": template.subject,
            "html_body": template.html_body,
            "text_body": template.text_body,
            "preview_url": f"data:text/html;base64,{template.html_body.encode('utf-8').hex()}"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate email preview: {str(e)}"
        )