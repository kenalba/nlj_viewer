#!/usr/bin/env python3
"""
Create Enhanced Survey with Follow-up Questions

Creates a survey with follow-up verbatim response capability to test our new survey infrastructure.
"""

import asyncio
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
import sys

# Add the app directory to Python path
sys.path.append(str(Path(__file__).parent.parent))

from app.core.database import AsyncSessionLocal
from app.models.content import ContentItem, ContentState, ContentType, LearningStyle
from app.models.user import User, UserRole
from sqlalchemy import select

async def create_enhanced_survey():
    """Create an enhanced survey with follow-up questions."""
    
    # Define the enhanced survey data with follow-up capability
    survey_data = {
        "id": "enhanced-employee-feedback-survey",
        "name": "Enhanced Employee Feedback Survey (with Follow-up)",
        "description": "Employee feedback survey demonstrating follow-up verbatim response capability",
        "orientation": "vertical",
        "activityType": "survey",
        "surveyMetadata": {
            "anonymous": True,
            "allowSkip": False,
            "showProgress": True,
            "allowReview": True,
            "collectDemographics": False,
            "targetAudience": "All Employees",
            "industry": "Cross-Industry"
        },
        "activityMetadata": {
            "category": "employee-feedback",
            "estimatedDuration": 5,
            "language": "en-US",
            "author": "Survey Dashboard Test",
            "tags": ["employee-feedback", "follow-up", "verbatim", "testing"]
        },
        "sections": [
            {
                "id": "job-satisfaction",
                "title": "Job Satisfaction",
                "description": "Questions about your job satisfaction with follow-up responses",
                "type": "survey",
                "nodeIds": ["q1", "q2", "q3"]
            }
        ],
        "nodes": [
            {
                "id": "start",
                "type": "start",
                "x": 100,
                "y": 100,
                "width": 200,
                "height": 100,
                "data": {
                    "title": "Enhanced Employee Feedback Survey",
                    "content": "This survey demonstrates follow-up verbatim response capability. Some questions will ask for additional details about your responses."
                }
            },
            {
                "id": "q1",
                "type": "LikertScaleNode",
                "x": 100,
                "y": 300,
                "width": 600,
                "height": 400,
                "text": "Overall, I am satisfied with my job",
                "content": "Please rate your overall job satisfaction level.",
                "scale": {
                    "min": 1,
                    "max": 5,
                    "labels": {
                        "min": "Strongly Disagree",
                        "max": "Strongly Agree"
                    }
                },
                "required": True,
                "showNumbers": True,
                "showLabels": True,
                "followUp": {
                    "enabled": True,
                    "prompt": "What specific aspects of your job contribute most to your satisfaction level?",
                    "required": False,
                    "placeholder": "Please share what makes your job satisfying or unsatisfying...",
                    "maxLength": 500
                },
                "tags": ["job-satisfaction", "overall"]
            },
            {
                "id": "q2",
                "type": "RatingNode",
                "x": 100,
                "y": 750,
                "width": 600,
                "height": 400,
                "text": "How likely are you to recommend this company as a great place to work?",
                "content": "Rate on a scale of 0-10 (Net Promoter Score format).",
                "ratingType": "numeric",
                "range": {
                    "min": 0,
                    "max": 10,
                    "step": 1
                },
                "required": True,
                "showValue": True,
                "followUp": {
                    "enabled": True,
                    "prompt": "What is the primary reason for your score? What would need to change to improve your recommendation?",
                    "required": True,
                    "placeholder": "Please explain your reasoning...",
                    "maxLength": 300
                },
                "tags": ["nps", "recommendation"]
            },
            {
                "id": "q3",
                "type": "TextAreaNode",
                "x": 100,
                "y": 1200,
                "width": 600,
                "height": 300,
                "text": "What suggestions do you have for improving our workplace?",
                "content": "Please share any ideas, concerns, or suggestions you have.",
                "required": False,
                "rows": 4,
                "placeholder": "Share your ideas for workplace improvements...",
                "maxLength": 1000,
                "wordCount": True,
                "followUp": {
                    "enabled": True,
                    "prompt": "How important is this suggestion to you personally, and why?",
                    "required": False,
                    "placeholder": "Please explain the importance of your suggestion...",
                    "maxLength": 200
                },
                "tags": ["suggestions", "improvements"]
            },
            {
                "id": "end",
                "type": "end",
                "x": 100,
                "y": 1550,
                "width": 200,
                "height": 100,
                "data": {
                    "title": "Thank You",
                    "content": "Thank you for your feedback! Your responses help us improve our workplace."
                }
            }
        ],
        "links": [
            {
                "id": "start-q1",
                "type": "link",
                "sourceNodeId": "start",
                "targetNodeId": "q1"
            },
            {
                "id": "q1-q2",
                "type": "link",
                "sourceNodeId": "q1",
                "targetNodeId": "q2"
            },
            {
                "id": "q2-q3",
                "type": "link",
                "sourceNodeId": "q2",
                "targetNodeId": "q3"
            },
            {
                "id": "q3-end",
                "type": "link",
                "sourceNodeId": "q3",
                "targetNodeId": "end"
            }
        ],
        "variableDefinitions": []
    }
    
    async with AsyncSessionLocal() as session:
        try:
            # Get admin user
            result = await session.execute(
                select(User).where(User.role == UserRole.ADMIN).limit(1)
            )
            admin_user = result.scalar_one_or_none()
            
            if not admin_user:
                print("❌ No admin user found. Please run seed_users_and_basic_content.py first.")
                return False
            
            # Check if enhanced survey already exists
            existing = await session.execute(
                select(ContentItem).where(
                    ContentItem.title == "Enhanced Employee Feedback Survey (with Follow-up)"
                )
            )
            
            if existing.scalar_one_or_none():
                print("ℹ️  Enhanced survey already exists. Updating...")
                existing_survey = existing.scalar_one()
                existing_survey.nlj_data = survey_data
                existing_survey.updated_at = datetime.now(timezone.utc)
            else:
                # Create new enhanced survey
                content_item = ContentItem(
                    title="Enhanced Employee Feedback Survey (with Follow-up)",
                    description="Employee feedback survey demonstrating follow-up verbatim response capability",
                    nlj_data=survey_data,
                    content_type=ContentType.SURVEY,
                    learning_style=LearningStyle.KINESTHETIC,
                    is_template=False,  # This is a live survey, not a template
                    template_category=None,
                    created_by=admin_user.id,
                    state=ContentState.PUBLISHED,  # Published for immediate testing
                    published_at=datetime.now(timezone.utc)
                )
                session.add(content_item)
            
            await session.commit()
            
            print("✅ Enhanced Employee Feedback Survey created successfully!")
            print("📝 Features included:")
            print("   • Likert Scale question with optional follow-up")
            print("   • NPS Rating question with required follow-up")
            print("   • Text Area question with optional follow-up")
            print("   • All questions use new node type format (LikertScaleNode, RatingNode, etc.)")
            print("   • Published state for immediate testing")
            print("")
            print("🧪 Test Instructions:")
            print("1. Navigate to /app/surveys in the frontend")
            print("2. Look for 'Enhanced Employee Feedback Survey (with Follow-up)' in the Live tab")
            print("3. Use the Preview button to test survey taking")
            print("4. Try the Send/Results buttons to test distribution and analytics")
            
            return True
            
        except Exception as e:
            print(f"❌ Error creating enhanced survey: {e}")
            await session.rollback()
            return False

if __name__ == "__main__":
    success = asyncio.run(create_enhanced_survey())
    if success:
        print("\n🎉 Enhanced survey creation completed successfully!")
    else:
        print("\n❌ Enhanced survey creation failed!")
        sys.exit(1)