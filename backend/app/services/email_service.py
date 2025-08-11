"""
Email service using AWS SES or LocalStack for survey distribution and notifications.
Provides templates and tracking for NLJ Platform email communications.
"""

import uuid
import boto3
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from botocore.exceptions import ClientError
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailTemplate(BaseModel):
    """Email template configuration."""
    subject: str
    html_body: str
    text_body: str
    sender_name: Optional[str] = None


class EmailRecipient(BaseModel):
    """Email recipient with metadata."""
    email: str
    name: Optional[str] = None
    user_id: Optional[uuid.UUID] = None


class EmailSendResult(BaseModel):
    """Result of email sending operation."""
    success: bool
    message_id: Optional[str] = None
    recipient_count: int
    failed_recipients: List[str] = []
    error_message: Optional[str] = None
    timestamp: datetime


class SESEmailService:
    """
    AWS SES-based email service for survey distribution and notifications.
    Works with both LocalStack (development) and AWS SES (production).
    """
    
    def __init__(self):
        """Initialize SES client with LocalStack or AWS configuration."""
        try:
            self.ses_client = boto3.client(
                'ses',
                endpoint_url=settings.SES_ENDPOINT_URL,  # None for AWS, http://localhost:4566 for LocalStack
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION
            )
            
            self.from_email = settings.SES_FROM_EMAIL
            self.admin_email = settings.SES_ADMIN_EMAIL
            self.configuration_set = settings.SES_CONFIGURATION_SET
            
            logger.info(f"SESEmailService initialized with from_email: {self.from_email}")
            
        except Exception as e:
            logger.error(f"Failed to initialize SESEmailService: {e}")
            raise
    
    async def send_survey_invitation(
        self,
        survey_title: str,
        survey_url: str,
        recipients: List[EmailRecipient],
        sender_name: Optional[str] = None,
        custom_message: Optional[str] = None,
        reminder: bool = False,
        days_remaining: Optional[int] = None
    ) -> EmailSendResult:
        """
        Send survey invitation emails to multiple recipients.
        
        Args:
            survey_title: Title of the survey
            survey_url: Public URL for the survey
            recipients: List of email recipients
            sender_name: Name of the person sending the survey
            custom_message: Optional custom message to include
            reminder: Whether this is a reminder email
            days_remaining: Days until survey closes (for reminders)
            
        Returns:
            EmailSendResult with success status and details
        """
        try:
            # Generate email template
            template = self._create_survey_invitation_template(
                survey_title=survey_title,
                survey_url=survey_url,
                sender_name=sender_name or "NLJ Platform",
                custom_message=custom_message,
                reminder=reminder,
                days_remaining=days_remaining
            )
            
            # Send emails in batches (SES limit is 50 destinations per call)
            return await self._send_bulk_email(
                template=template,
                recipients=recipients,
                email_type="survey_invitation"
            )
            
        except Exception as e:
            logger.error(f"Failed to send survey invitations: {e}")
            return EmailSendResult(
                success=False,
                recipient_count=len(recipients),
                error_message=str(e),
                timestamp=datetime.utcnow()
            )
    
    async def send_training_notification(
        self,
        training_title: str,
        training_date: datetime,
        training_url: Optional[str],
        recipients: List[EmailRecipient],
        notification_type: str = "registration_confirmation",
        additional_info: Optional[Dict[str, Any]] = None
    ) -> EmailSendResult:
        """
        Send training-related notification emails.
        
        Args:
            training_title: Title of the training session
            training_date: Date and time of training
            training_url: Optional URL for training details
            recipients: List of email recipients
            notification_type: Type of notification (registration_confirmation, reminder, cancellation)
            additional_info: Additional information to include
            
        Returns:
            EmailSendResult with success status and details
        """
        try:
            template = self._create_training_notification_template(
                training_title=training_title,
                training_date=training_date,
                training_url=training_url,
                notification_type=notification_type,
                additional_info=additional_info or {}
            )
            
            return await self._send_bulk_email(
                template=template,
                recipients=recipients,
                email_type="training_notification"
            )
            
        except Exception as e:
            logger.error(f"Failed to send training notifications: {e}")
            return EmailSendResult(
                success=False,
                recipient_count=len(recipients),
                error_message=str(e),
                timestamp=datetime.utcnow()
            )
    
    async def send_admin_notification(
        self,
        subject: str,
        message: str,
        notification_type: str = "system",
        additional_data: Optional[Dict[str, Any]] = None
    ) -> EmailSendResult:
        """
        Send notification email to administrators.
        
        Args:
            subject: Email subject
            message: Email message content
            notification_type: Type of admin notification
            additional_data: Additional data to include
            
        Returns:
            EmailSendResult with success status and details
        """
        try:
            admin_recipient = EmailRecipient(email=self.admin_email, name="NLJ Admin")
            
            template = EmailTemplate(
                subject=f"[NLJ Platform] {subject}",
                html_body=self._create_admin_html_template(message, notification_type, additional_data),
                text_body=self._create_admin_text_template(message, notification_type, additional_data)
            )
            
            return await self._send_bulk_email(
                template=template,
                recipients=[admin_recipient],
                email_type="admin_notification"
            )
            
        except Exception as e:
            logger.error(f"Failed to send admin notification: {e}")
            return EmailSendResult(
                success=False,
                recipient_count=1,
                error_message=str(e),
                timestamp=datetime.utcnow()
            )
    
    async def _send_bulk_email(
        self,
        template: EmailTemplate,
        recipients: List[EmailRecipient],
        email_type: str
    ) -> EmailSendResult:
        """
        Send bulk emails using SES with proper batching and error handling.
        """
        try:
            recipient_emails = [r.email for r in recipients]
            failed_recipients = []
            message_ids = []
            
            # Send in batches of 50 (SES limit)
            batch_size = 50
            for i in range(0, len(recipient_emails), batch_size):
                batch = recipient_emails[i:i + batch_size]
                
                try:
                    # Build email
                    email_kwargs = {
                        'Source': self.from_email,
                        'Destination': {
                            'ToAddresses': batch[:1],  # First recipient in To field
                            'BccAddresses': batch[1:] if len(batch) > 1 else []  # Others in BCC for privacy
                        },
                        'Message': {
                            'Subject': {'Data': template.subject, 'Charset': 'UTF-8'},
                            'Body': {
                                'Text': {'Data': template.text_body, 'Charset': 'UTF-8'},
                                'Html': {'Data': template.html_body, 'Charset': 'UTF-8'}
                            }
                        }
                    }
                    
                    # Add configuration set if available
                    if self.configuration_set:
                        email_kwargs['ConfigurationSetName'] = self.configuration_set
                    
                    # Send email
                    response = self.ses_client.send_email(**email_kwargs)
                    message_ids.append(response['MessageId'])
                    
                    logger.info(f"Successfully sent {email_type} email to {len(batch)} recipients")
                    
                except ClientError as e:
                    error_code = e.response['Error']['Code']
                    logger.error(f"SES error sending batch: {error_code} - {e}")
                    failed_recipients.extend(batch)
                
                except Exception as e:
                    logger.error(f"Unexpected error sending email batch: {e}")
                    failed_recipients.extend(batch)
            
            success = len(failed_recipients) == 0
            successful_count = len(recipient_emails) - len(failed_recipients)
            
            return EmailSendResult(
                success=success,
                message_id=message_ids[0] if message_ids else None,
                recipient_count=successful_count,
                failed_recipients=failed_recipients,
                timestamp=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Failed to send bulk email: {e}")
            return EmailSendResult(
                success=False,
                recipient_count=0,
                failed_recipients=[r.email for r in recipients],
                error_message=str(e),
                timestamp=datetime.utcnow()
            )
    
    def _create_survey_invitation_template(
        self,
        survey_title: str,
        survey_url: str,
        sender_name: str,
        custom_message: Optional[str] = None,
        reminder: bool = False,
        days_remaining: Optional[int] = None
    ) -> EmailTemplate:
        """Create email template for survey invitations."""
        
        # Subject line
        if reminder and days_remaining:
            subject = f"Reminder: {survey_title} - {days_remaining} days remaining"
        elif reminder:
            subject = f"Reminder: {survey_title}"
        else:
            subject = f"Survey Invitation: {survey_title}"
        
        # HTML body
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>{subject}</title>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }}
                .header {{ background-color: #1976d2; color: white; padding: 20px; text-align: center; }}
                .content {{ padding: 20px; }}
                .cta-button {{ 
                    display: inline-block; 
                    background-color: #1976d2; 
                    color: white; 
                    padding: 12px 24px; 
                    text-decoration: none; 
                    border-radius: 4px; 
                    margin: 20px 0;
                }}
                .footer {{ background-color: #f5f5f5; padding: 15px; font-size: 12px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>{'Survey Reminder' if reminder else 'Survey Invitation'}</h1>
            </div>
            <div class="content">
                <p>Hello,</p>
                
                {'<p>This is a friendly reminder about the survey:</p>' if reminder else '<p>You have been invited to participate in a survey:</p>'}
                
                <h2>{survey_title}</h2>
                
                {f'<p>{custom_message}</p>' if custom_message else ''}
                
                {'<p><strong>Time remaining: ' + str(days_remaining) + ' days</strong></p>' if reminder and days_remaining else ''}
                
                <p>This survey should take approximately 5-10 minutes to complete. Your feedback is valuable and will help us improve our services.</p>
                
                <div style="text-align: center;">
                    <a href="{survey_url}" class="cta-button">
                        {'Complete Survey Now' if reminder else 'Take Survey'}
                    </a>
                </div>
                
                <p>Or copy and paste this link into your browser:<br>
                   <a href="{survey_url}">{survey_url}</a>
                </p>
                
                <p>Thank you for your participation!</p>
                
                <p>Best regards,<br>{sender_name}</p>
            </div>
            <div class="footer">
                <p>This email was sent by the NLJ Platform. If you have any questions, please contact your administrator.</p>
            </div>
        </body>
        </html>
        """
        
        # Text body
        text_body = f"""
        {'Survey Reminder' if reminder else 'Survey Invitation'}
        
        Hello,
        
        {'This is a friendly reminder about the survey:' if reminder else 'You have been invited to participate in a survey:'}
        
        {survey_title}
        
        {custom_message if custom_message else ''}
        
        {'Time remaining: ' + str(days_remaining) + ' days' if reminder and days_remaining else ''}
        
        This survey should take approximately 5-10 minutes to complete. Your feedback is valuable and will help us improve our services.
        
        Survey Link: {survey_url}
        
        Thank you for your participation!
        
        Best regards,
        {sender_name}
        
        ---
        This email was sent by the NLJ Platform. If you have any questions, please contact your administrator.
        """
        
        return EmailTemplate(
            subject=subject,
            html_body=html_body,
            text_body=text_body,
            sender_name=sender_name
        )
    
    def _create_training_notification_template(
        self,
        training_title: str,
        training_date: datetime,
        training_url: Optional[str],
        notification_type: str,
        additional_info: Dict[str, Any]
    ) -> EmailTemplate:
        """Create email template for training notifications."""
        
        date_str = training_date.strftime("%B %d, %Y at %I:%M %p %Z")
        
        if notification_type == "registration_confirmation":
            subject = f"Training Registration Confirmed: {training_title}"
            greeting = "Your registration has been confirmed for the following training session:"
        elif notification_type == "reminder":
            subject = f"Training Reminder: {training_title} - Tomorrow"
            greeting = "This is a reminder about your upcoming training session:"
        elif notification_type == "cancellation":
            subject = f"Training Cancelled: {training_title}"
            greeting = "We regret to inform you that the following training session has been cancelled:"
        else:
            subject = f"Training Update: {training_title}"
            greeting = "This is an update about your training session:"
        
        # HTML and text bodies would be similar to survey template but training-focused
        html_body = f"<p>{greeting}</p><h2>{training_title}</h2><p>Date: {date_str}</p>"
        text_body = f"{greeting}\n\n{training_title}\nDate: {date_str}"
        
        return EmailTemplate(
            subject=subject,
            html_body=html_body,
            text_body=text_body
        )
    
    def _create_admin_html_template(
        self,
        message: str,
        notification_type: str,
        additional_data: Optional[Dict[str, Any]]
    ) -> str:
        """Create HTML template for admin notifications."""
        return f"""
        <h2>NLJ Platform Admin Notification</h2>
        <p><strong>Type:</strong> {notification_type}</p>
        <p><strong>Time:</strong> {datetime.utcnow().isoformat()}</p>
        <hr>
        <p>{message}</p>
        {f'<pre>{additional_data}</pre>' if additional_data else ''}
        """
    
    def _create_admin_text_template(
        self,
        message: str,
        notification_type: str,
        additional_data: Optional[Dict[str, Any]]
    ) -> str:
        """Create text template for admin notifications."""
        text = f"NLJ Platform Admin Notification\n"
        text += f"Type: {notification_type}\n"
        text += f"Time: {datetime.utcnow().isoformat()}\n"
        text += f"---\n{message}\n"
        if additional_data:
            text += f"\nAdditional Data:\n{additional_data}"
        return text
    
    def health_check(self) -> Dict[str, Any]:
        """
        Perform health check on SES service.
        
        Returns:
            Health status dictionary
        """
        try:
            # Try to get send quota (minimal SES operation)
            response = self.ses_client.get_send_quota()
            
            return {
                'status': 'healthy',
                'service': 'SESEmailService',
                'send_quota': response.get('Max24HourSend'),
                'sent_count': response.get('SentLast24Hours'),
                'endpoint': settings.SES_ENDPOINT_URL or 'AWS SES',
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            return {
                'status': 'unhealthy',
                'service': 'SESEmailService',
                'error': error_code,
                'timestamp': datetime.utcnow().isoformat()
            }
        except Exception as e:
            return {
                'status': 'error',
                'service': 'SESEmailService',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }


# Global service instance
email_service = SESEmailService()