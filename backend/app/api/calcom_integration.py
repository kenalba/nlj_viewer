"""
Cal.com integration API endpoints.
Handles webhooks from Cal.com and converts them to Kafka events for the NLJ platform.
"""

import hashlib
import hmac
import logging
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.deps import get_xapi_event_service
from app.services.kafka_service import XAPIEventService

logger = logging.getLogger(__name__)

router = APIRouter()


class CalcomBookingWebhook(BaseModel):
    """Cal.com booking webhook payload."""
    triggerEvent: str = Field(..., description="Type of webhook event")
    createdAt: str = Field(..., description="Timestamp when event was created")
    payload: Dict[str, Any] = Field(..., description="Event payload data")


class CalcomBookingPayload(BaseModel):
    """Cal.com booking data structure."""
    id: int = Field(..., description="Booking ID")
    uid: str = Field(..., description="Booking UID")
    title: str = Field(..., description="Booking title")
    description: Optional[str] = Field(None, description="Booking description")
    startTime: str = Field(..., description="Booking start time")
    endTime: str = Field(..., description="Booking end time")
    attendees: list[Dict[str, Any]] = Field(default_factory=list, description="Attendee list")
    organizer: Dict[str, Any] = Field(..., description="Organizer information")
    status: str = Field(..., description="Booking status")
    location: Optional[str] = Field(None, description="Meeting location")
    eventTypeId: int = Field(..., description="Event type ID")
    eventType: Optional[Dict[str, Any]] = Field(None, description="Event type details")


def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """
    Verify Cal.com webhook signature for security.
    
    Args:
        payload: Raw webhook payload
        signature: Signature from Cal.com
        secret: Webhook secret configured in Cal.com
        
    Returns:
        True if signature is valid, False otherwise
    """
    if not secret:
        logger.warning("Cal.com webhook secret not configured - skipping verification")
        return True
    
    try:
        # Cal.com uses SHA256 HMAC signature
        expected_signature = hmac.new(
            secret.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        # Remove 'sha256=' prefix if present
        if signature.startswith('sha256='):
            signature = signature[7:]
        
        return hmac.compare_digest(expected_signature, signature)
    except Exception as e:
        logger.error(f"Error verifying webhook signature: {e}")
        return False


@router.post("/webhooks/calcom/booking")
async def handle_calcom_booking_webhook(
    request: Request,
    webhook_data: CalcomBookingWebhook,
    xapi_service: XAPIEventService = Depends(get_xapi_event_service)
) -> Dict[str, str]:
    """
    Handle Cal.com booking webhooks and convert to xAPI events.
    
    Supported webhook events:
    - BOOKING_CREATED: New booking created
    - BOOKING_RESCHEDULED: Booking time changed
    - BOOKING_CANCELLED: Booking cancelled
    - BOOKING_CONFIRMED: Booking confirmed by attendee
    """
    
    # Verify webhook signature for security
    signature = request.headers.get("X-Cal-Signature", "")
    if settings.CAL_COM_WEBHOOK_SECRET:
        body = await request.body()
        if not verify_webhook_signature(body, signature, settings.CAL_COM_WEBHOOK_SECRET):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook signature"
            )
    
    try:
        # Extract booking data from payload
        booking_data = webhook_data.payload
        
        # Convert to internal booking format
        booking = CalcomBookingPayload(**booking_data)
        
        # Process different webhook events
        if webhook_data.triggerEvent == "BOOKING_CREATED":
            await _handle_booking_created(booking, xapi_service)
        elif webhook_data.triggerEvent == "BOOKING_RESCHEDULED":
            await _handle_booking_rescheduled(booking, xapi_service)
        elif webhook_data.triggerEvent == "BOOKING_CANCELLED":
            await _handle_booking_cancelled(booking, xapi_service)
        elif webhook_data.triggerEvent == "BOOKING_CONFIRMED":
            await _handle_booking_confirmed(booking, xapi_service)
        else:
            logger.warning(f"Unhandled webhook event: {webhook_data.triggerEvent}")
            
        logger.info(f"Processed Cal.com webhook: {webhook_data.triggerEvent} for booking {booking.uid}")
        
        return {"status": "success", "message": "Webhook processed successfully"}
        
    except Exception as e:
        logger.error(f"Error processing Cal.com webhook: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process webhook"
        )


async def _handle_booking_created(
    booking: CalcomBookingPayload, 
    xapi_service: XAPIEventService
) -> None:
    """Handle BOOKING_CREATED webhook event."""
    
    # Extract attendee information
    if booking.attendees:
        attendee = booking.attendees[0]  # Primary attendee
        attendee_email = attendee.get("email", "")
        attendee_name = attendee.get("name", "")
        
        if attendee_email and attendee_name:
            await xapi_service.publish_learner_registration(
                learner_email=attendee_email,
                learner_name=attendee_name,
                session_id=booking.uid,
                session_name=booking.title,
                cal_booking_id=str(booking.id),
                scheduled_time=datetime.fromisoformat(booking.startTime.replace('Z', '+00:00')),
                registration_method="online"
            )
    
    # Publish Cal.com specific event to Kafka
    await xapi_service.kafka.publish_event(
        topic="cal.booking.created",
        event={
            "booking_id": booking.id,
            "booking_uid": booking.uid,
            "title": booking.title,
            "start_time": booking.startTime,
            "end_time": booking.endTime,
            "status": booking.status,
            "location": booking.location,
            "event_type_id": booking.eventTypeId,
            "attendee_count": len(booking.attendees),
            "organizer_email": booking.organizer.get("email", ""),
            "organizer_name": booking.organizer.get("name", "")
        },
        key=booking.uid
    )


async def _handle_booking_rescheduled(
    booking: CalcomBookingPayload, 
    xapi_service: XAPIEventService
) -> None:
    """Handle BOOKING_RESCHEDULED webhook event."""
    
    await xapi_service.kafka.publish_event(
        topic="cal.booking.rescheduled",
        event={
            "booking_id": booking.id,
            "booking_uid": booking.uid,
            "title": booking.title,
            "new_start_time": booking.startTime,
            "new_end_time": booking.endTime,
            "status": booking.status,
            "location": booking.location,
            "event_type_id": booking.eventTypeId,
            "attendee_count": len(booking.attendees)
        },
        key=booking.uid
    )


async def _handle_booking_cancelled(
    booking: CalcomBookingPayload, 
    xapi_service: XAPIEventService
) -> None:
    """Handle BOOKING_CANCELLED webhook event."""
    
    await xapi_service.kafka.publish_event(
        topic="cal.booking.cancelled",
        event={
            "booking_id": booking.id,
            "booking_uid": booking.uid,
            "title": booking.title,
            "cancelled_at": datetime.utcnow().isoformat(),
            "original_start_time": booking.startTime,
            "original_end_time": booking.endTime,
            "event_type_id": booking.eventTypeId,
            "attendee_count": len(booking.attendees)
        },
        key=booking.uid
    )


async def _handle_booking_confirmed(
    booking: CalcomBookingPayload, 
    xapi_service: XAPIEventService
) -> None:
    """Handle BOOKING_CONFIRMED webhook event."""
    
    await xapi_service.kafka.publish_event(
        topic="cal.booking.confirmed",
        event={
            "booking_id": booking.id,
            "booking_uid": booking.uid,
            "title": booking.title,
            "confirmed_at": datetime.utcnow().isoformat(),
            "start_time": booking.startTime,
            "end_time": booking.endTime,
            "status": booking.status,
            "event_type_id": booking.eventTypeId,
            "attendee_count": len(booking.attendees)
        },
        key=booking.uid
    )


@router.get("/calcom/health")
async def calcom_health_check(
    xapi_service: XAPIEventService = Depends(get_xapi_event_service)
) -> Dict[str, str]:
    """Health check endpoint for Cal.com integration."""
    return {
        "status": "healthy",
        "service": "calcom-integration",
        "kafka_connected": str(xapi_service.kafka.is_connected)
    }


@router.get("/calcom/topics")
async def list_calcom_topics() -> Dict[str, list[str]]:
    """List available Kafka topics for Cal.com integration."""
    return {
        "topics": [
            "nlj.training.scheduled",
            "nlj.training.registration", 
            "nlj.training.attendance",
            "nlj.training.completion",
            "cal.booking.created",
            "cal.booking.cancelled",
            "cal.booking.rescheduled",
            "cal.booking.confirmed"
        ]
    }