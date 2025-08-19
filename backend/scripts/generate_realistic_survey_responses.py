#!/usr/bin/env python3
"""
Generate realistic survey responses with proper xAPI event flows.

This script creates a complete, realistic dataset with:
1. Survey started events
2. Individual question answered events
3. Survey completed events (with realistic drop-off)
4. Responses distributed over time
5. Unique respondents (no duplicates)
6. Proper xAPI grammar and structure
"""

import asyncio
import logging
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any
from uuid import uuid4

# Add the parent directory to the path so we can import our modules
sys.path.append(str(Path(__file__).parent.parent))

from app.services.kafka_service import KafkaService
from app.core.database_manager import db_manager

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class RealisticSurveyResponseGenerator:
    """Generate realistic survey responses with proper xAPI event flows."""
    
    def __init__(self):
        self.survey_id = "36221c4a-9e9b-49e6-88ca-37734bbfc7dd"
        self.survey_title = "Survey"  # Will be updated when loaded from database
        self.survey_description = "Survey"  # Will be updated when loaded from database
        
        # Timing configuration
        self.start_date = datetime.now(timezone.utc) - timedelta(days=30)  # Responses over last 30 days
        self.end_date = datetime.now(timezone.utc)
        
        # Response configuration
        self.total_invites = 250  # Total people invited
        self.completion_rate = 0.72  # 72% completion rate (realistic for exit surveys)
        self.drop_off_stages = {
            "after_start": 0.15,      # 15% drop off after starting
            "mid_survey": 0.08,       # 8% drop off mid-way
            "near_end": 0.05,         # 5% drop off near end
        }
        
        # Load actual survey questions (will be loaded async in main)
        self.survey_questions = []
    
    async def load_survey_questions(self):
        """Load actual survey questions from the database."""
        try:
            # Import here to avoid circular imports
            from app.services.content_service import ContentService
            
            content_service = ContentService()
            
            # Fetch survey from database
            survey_result = await content_service.get_content(content_id=self.survey_id)
            
            if not survey_result or not survey_result.content_data:
                raise ValueError(f"Survey {self.survey_id} not found in database")
            
            survey_data = survey_result.content_data
            
            # Update survey metadata
            self.survey_title = survey_result.title
            self.survey_description = survey_result.description or "Survey"
            
            logger.info(f"Loaded survey from database: {survey_result.title}")
            
            # Extract questions from nodes
            for node in survey_data.get("nodes", []):
                if node.get("type") in ["likert_scale", "multiple_choice", "text_area", "nps", "rating", "matrix", "slider"]:
                    question_data = {
                        "id": node["id"],
                        "type": node["type"],
                        "text": node.get("text", ""),
                        "scale": node.get("scale", {}),
                        "choices": node.get("choices", [])
                    }
                    self.survey_questions.append(question_data)
            
            logger.info(f"Loaded {len(self.survey_questions)} questions from survey: {survey_result.title}")
            
        except Exception as e:
            logger.error(f"Failed to load survey questions from database: {e}")
            # Fallback to basic questions
            await self.create_fallback_questions()
    
    async def create_fallback_questions(self):
        """Create fallback questions if we can't load from database."""
        self.survey_questions = [
            {"id": f"q{i:03d}", "type": "likert_scale", "text": f"Question {i}", "scale": {"min": 1, "max": 5}}
            for i in range(1, 30)
        ]
    
    def generate_respondent_email(self, index: int) -> str:
        """Generate a realistic respondent email."""
        domains = ["penske.com", "pag.com", "penskeautomotive.com"]
        first_names = ["John", "Jane", "Mike", "Sarah", "David", "Lisa", "Chris", "Amy", "Tom", "Anna"]
        last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Wilson", "Moore"]
        
        first = random.choice(first_names)
        last = random.choice(last_names)
        domain = random.choice(domains)
        
        return f"{first.lower()}.{last.lower()}{random.randint(1, 99)}@{domain}"
    
    def generate_response_timestamp(self, base_time: datetime, question_index: int, total_questions: int) -> datetime:
        """Generate a realistic timestamp for a question response."""
        # Add some randomness to question timing (30 seconds to 3 minutes per question)
        base_duration = timedelta(seconds=random.randint(30, 180))
        # Earlier questions might take longer (reading instructions)
        if question_index < 3:
            base_duration += timedelta(seconds=random.randint(30, 90))
        
        return base_time + (base_duration * question_index)
    
    def generate_likert_response(self, scale: Dict) -> Dict[str, Any]:
        """Generate a realistic Likert scale response."""
        min_val = scale.get("min", 1)
        max_val = scale.get("max", 5)
        
        # Weight responses toward middle-negative for exit surveys
        weights = []
        for val in range(min_val, max_val + 1):
            if val <= 2:  # Negative responses more common in exit surveys
                weights.append(0.25)
            elif val == 3:  # Neutral
                weights.append(0.20)
            else:  # Positive responses less common
                weights.append(0.15)
        
        return {
            "response": random.choices(range(min_val, max_val + 1), weights=weights)[0],
            "scale_min": min_val,
            "scale_max": max_val
        }
    
    def create_xapi_statement(self, 
                             verb: str,
                             actor_email: str, 
                             object_id: str, 
                             object_name: str,
                             timestamp: datetime,
                             result: Optional[Dict] = None,
                             extensions: Optional[Dict] = None) -> Dict[str, Any]:
        """Create a properly formatted xAPI statement."""
        
        verb_map = {
            "started": "http://adlnet.gov/expapi/verbs/experienced",
            "answered": "http://adlnet.gov/expapi/verbs/answered", 
            "completed": "http://adlnet.gov/expapi/verbs/completed"
        }
        
        statement = {
            "id": str(uuid4()),
            "timestamp": timestamp.isoformat(),
            "actor": {
                "mbox": f"mailto:{actor_email}",
                "name": actor_email.split('@')[0].replace('.', ' ').title()
            },
            "verb": {
                "id": verb_map[verb],
                "display": {
                    "en-US": verb.title()
                }
            },
            "object": {
                "id": object_id,
                "definition": {
                    "name": {
                        "en-US": object_name
                    },
                    "type": "http://adlnet.gov/expapi/activities/assessment" if "survey" in object_name.lower() else "http://adlnet.gov/expapi/activities/question"
                }
            },
            "context": {
                "extensions": {
                    "http://nlj.platform/extensions/parent_survey": f"http://nlj.platform/content/{self.survey_id}",
                    "http://nlj.platform/extensions/platform": "nlj-viewer",
                    **(extensions or {})
                }
            }
        }
        
        if result:
            statement["result"] = result
            
        return statement
    
    async def generate_survey_response_flow(self, respondent_email: str, response_start_time: datetime) -> List[Dict[str, Any]]:
        """Generate complete xAPI event flow for a single respondent."""
        statements = []
        current_time = response_start_time
        
        # 1. Survey Started Event
        survey_started_stmt = self.create_xapi_statement(
            verb="started",
            actor_email=respondent_email,
            object_id=f"http://nlj.platform/content/{self.survey_id}",
            object_name=self.survey_title,
            timestamp=current_time,
            extensions={
                "http://nlj.platform/extensions/session_id": str(uuid4()),
                "http://nlj.platform/extensions/survey_type": "exit"
            }
        )
        statements.append(survey_started_stmt)
        
        # Determine if this respondent will complete the survey
        will_complete = random.random() < self.completion_rate
        
        # Determine drop-off point if they won't complete
        drop_off_point = len(self.survey_questions)  # Complete by default
        if not will_complete:
            if random.random() < self.drop_off_stages["after_start"]:
                drop_off_point = random.randint(1, 3)  # Drop off early
            elif random.random() < self.drop_off_stages["mid_survey"]:
                drop_off_point = random.randint(4, len(self.survey_questions) // 2)  # Drop off mid-way
            elif random.random() < self.drop_off_stages["near_end"]:
                drop_off_point = random.randint(len(self.survey_questions) - 5, len(self.survey_questions) - 1)  # Drop off near end
        
        # 2. Question Answered Events
        questions_to_answer = min(drop_off_point, len(self.survey_questions))
        
        for i, question in enumerate(self.survey_questions[:questions_to_answer]):
            current_time = self.generate_response_timestamp(response_start_time, i + 1, len(self.survey_questions))
            
            # Generate response based on question type
            if question["type"] == "likert_scale":
                response_data = self.generate_likert_response(question.get("scale", {"min": 1, "max": 5}))
                result = {
                    "response": str(response_data["response"]),
                    "score": {
                        "scaled": (response_data["response"] - response_data["scale_min"]) / 
                                (response_data["scale_max"] - response_data["scale_min"])
                    },
                    "completion": True
                }
            elif question["type"] == "nps":
                nps_score = random.choices(range(0, 11), weights=[0.15, 0.10, 0.10, 0.10, 0.08, 0.07, 0.05, 0.05, 0.10, 0.10, 0.10])[0]
                result = {
                    "response": str(nps_score),
                    "score": {"scaled": nps_score / 10},
                    "completion": True
                }
            else:
                # Text or multiple choice
                result = {
                    "response": "Sample response text",
                    "completion": True
                }
            
            question_stmt = self.create_xapi_statement(
                verb="answered",
                actor_email=respondent_email,
                object_id=f"http://nlj.platform/content/{self.survey_id}/question/{question['id']}",
                object_name=f"Question: {question['text'][:50]}...",
                timestamp=current_time,
                result=result,
                extensions={
                    "http://nlj.platform/extensions/question_id": question["id"],
                    "http://nlj.platform/extensions/question_type": question["type"]
                }
            )
            statements.append(question_stmt)
        
        # 3. Survey Completed Event (only if they completed all questions)
        if will_complete and questions_to_answer == len(self.survey_questions):
            completion_time = current_time + timedelta(seconds=random.randint(30, 120))  # Time to submit
            
            survey_completed_stmt = self.create_xapi_statement(
                verb="completed",
                actor_email=respondent_email,
                object_id=f"http://nlj.platform/content/{self.survey_id}",
                object_name=self.survey_title,
                timestamp=completion_time,
                result={
                    "completion": True,
                    "duration": f"PT{int((completion_time - response_start_time).total_seconds())}S"
                },
                extensions={
                    "http://nlj.platform/extensions/questions_answered": len(self.survey_questions),
                    "http://nlj.platform/extensions/completion_status": "completed"
                }
            )
            statements.append(survey_completed_stmt)
        
        return statements
    
    async def generate_all_responses(self) -> List[Dict[str, Any]]:
        """Generate responses for all invited respondents."""
        all_statements = []
        
        # Generate unique respondent emails
        respondents = [self.generate_respondent_email(i) for i in range(self.total_invites)]
        respondents = list(set(respondents))  # Ensure uniqueness
        
        logger.info(f"Generating responses for {len(respondents)} unique respondents")
        
        # Distribute response times over the date range
        for i, respondent_email in enumerate(respondents):
            # Distribute responses over time with realistic patterns
            # More responses during weekdays, fewer on weekends
            days_range = (self.end_date - self.start_date).days
            response_day = self.start_date + timedelta(days=random.randint(0, days_range))
            
            # Adjust for weekday patterns (more responses Tuesday-Thursday)
            weekday = response_day.weekday()
            if weekday in [0, 6]:  # Monday, Sunday - less likely
                if random.random() > 0.7:
                    continue
            elif weekday in [1, 2, 3]:  # Tue, Wed, Thu - peak times
                pass  # Normal probability
            else:  # Fri, Sat - moderate
                if random.random() > 0.8:
                    continue
            
            # Random time during work hours (9 AM to 5 PM)
            hour = random.randint(9, 17)
            minute = random.randint(0, 59)
            response_start_time = response_day.replace(hour=hour, minute=minute, second=0, microsecond=0)
            
            # Generate complete event flow for this respondent
            respondent_statements = await self.generate_survey_response_flow(respondent_email, response_start_time)
            all_statements.extend(respondent_statements)
            
            if (i + 1) % 10 == 0:
                logger.info(f"Generated responses for {i + 1}/{len(respondents)} respondents")
        
        # Sort all statements by timestamp
        all_statements.sort(key=lambda x: x["timestamp"])
        
        logger.info(f"Generated {len(all_statements)} total xAPI statements")
        return all_statements
    
    async def send_statements_to_kafka(self, statements: List[Dict[str, Any]]):
        """Send xAPI statements to Kafka topics for unified consumer processing."""
        logger.info(f"Sending {len(statements)} statements to Kafka topics...")
        
        try:
            # Initialize Kafka service
            kafka_service = KafkaService()
            await kafka_service.start_producer()
            
            for i, statement in enumerate(statements):
                # Send directly to xapi-events topic which the unified consumer monitors
                await kafka_service.publish_event(
                    topic="xapi-events",
                    event=statement,
                    key=statement.get("id", str(uuid4())),
                    validate=False  # Skip validation since we know our xAPI statements are properly formatted
                )
                
                if (i + 1) % 100 == 0:
                    logger.info(f"Sent {i + 1}/{len(statements)} statements to Kafka")
                    # Small delay to avoid overwhelming the system
                    await asyncio.sleep(0.1)
            
            await kafka_service.stop()
            logger.info("✅ All statements sent to Kafka successfully")
            logger.info("📊 The unified consumer will now process these events → Ralph LRS → ElasticSearch")
            
        except Exception as e:
            logger.error(f"Failed to send statements to Kafka: {e}")
            raise


async def main():
    """Main execution function."""
    logger.info("🎯 Generating Realistic Survey Responses")
    logger.info("=" * 50)
    
    try:
        # Initialize database manager
        await db_manager.initialize()
        
        # Create generator
        generator = RealisticSurveyResponseGenerator()
        
        # Load survey questions from database
        logger.info("🔍 Loading survey from database...")
        await generator.load_survey_questions()
        
        # Generate all xAPI statements
        logger.info("📊 Generating xAPI statements...")
        statements = await generator.generate_all_responses()
        
        # Send to Kafka for unified consumer processing
        logger.info("📤 Sending statements to Kafka for unified consumer processing...")
        await generator.send_statements_to_kafka(statements)
        
        # Summary
        completed_surveys = len([s for s in statements if s["verb"]["id"] == "http://adlnet.gov/expapi/verbs/completed"])
        started_surveys = len([s for s in statements if s["verb"]["id"] == "http://adlnet.gov/expapi/verbs/experienced"])
        answered_questions = len([s for s in statements if s["verb"]["id"] == "http://adlnet.gov/expapi/verbs/answered"])
        
        logger.info("📈 Generation Summary:")
        logger.info(f"   🚀 Survey Started Events: {started_surveys}")
        logger.info(f"   ✅ Survey Completed Events: {completed_surveys}")
        logger.info(f"   💬 Question Answered Events: {answered_questions}")
        logger.info(f"   📊 Completion Rate: {(completed_surveys/started_surveys)*100:.1f}%")
        logger.info(f"   📅 Date Range: {generator.start_date.date()} to {generator.end_date.date()}")
        
        logger.info("🎉 Realistic survey response generation completed!")
        
    except Exception as e:
        logger.error(f"❌ Generation failed: {e}")
        raise
    finally:
        await db_manager.close()


if __name__ == "__main__":
    asyncio.run(main())