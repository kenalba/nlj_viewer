#!/usr/bin/env python3
"""
Generate realistic fake survey responses for loaded surveys.
Creates xAPI statements that simulate users completing surveys with realistic response patterns.
"""

import asyncio
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database_manager import db_manager
from app.models.content import ContentItem, ContentType
from app.models.user import User, UserRole
from app.services.elasticsearch_service import elasticsearch_service
from app.services.kafka_service import kafka_service

# xAPI verb definitions
XAPI_VERBS = {
    "experienced": "http://adlnet.gov/expapi/verbs/experienced",
    "answered": "http://adlnet.gov/expapi/verbs/answered", 
    "completed": "http://adlnet.gov/expapi/verbs/completed",
    "attempted": "http://adlnet.gov/expapi/verbs/attempted",
    "suspended": "http://adlnet.gov/expapi/verbs/suspended",
    "resumed": "http://adlnet.gov/expapi/verbs/resumed"
}

# Demographics for realistic data generation
DEMOGRAPHICS = {
    "departments": ["Sales", "Service", "Parts", "Finance", "Management", "HR", "IT", "Marketing"],
    "locations": ["Downtown", "North Side", "South Side", "East Side", "West Side", "Suburban", "Corporate"],
    "job_levels": ["Entry Level", "Experienced", "Senior", "Lead", "Manager", "Director"],
    "tenure_ranges": ["0-6 months", "6-12 months", "1-2 years", "2-5 years", "5+ years"],
    "generations": ["Gen Z", "Millennial", "Gen X", "Baby Boomer"]
}


class SurveyResponseGenerator:
    """Generates realistic survey responses with proper xAPI formatting."""

    def __init__(self):
        self.response_patterns = {
            # Response tendencies for different types of employees
            "satisfied_employee": {
                "satisfaction_bias": 1.5,  # Positive bias
                "consistency": 0.8,  # High consistency
                "completion_rate": 0.95
            },
            "neutral_employee": {
                "satisfaction_bias": 0.0,  # No bias
                "consistency": 0.6,  # Medium consistency
                "completion_rate": 0.85
            },
            "dissatisfied_employee": {
                "satisfaction_bias": -1.2,  # Negative bias
                "consistency": 0.7,  # Medium-high consistency
                "completion_rate": 0.75
            }
        }

    def generate_response_for_question(self, node: Dict[str, Any], employee_type: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a realistic response for a specific survey question."""
        node_type = node.get("type")
        node_id = node.get("id")
        question_text = node.get("text", "")
        
        pattern = self.response_patterns[employee_type]
        bias = pattern["satisfaction_bias"]
        consistency = pattern["consistency"]
        
        if node_type == "likert_scale":
            return self._generate_likert_response(node, bias, consistency, context)
        elif node_type == "true_false":
            return self._generate_binary_response(node, bias, consistency, context)
        elif node_type == "rating":
            return self._generate_rating_response(node, bias, consistency, context)
        elif node_type == "text_area":
            return self._generate_text_response(node, employee_type, context)
        elif node_type == "multiple_choice":
            return self._generate_choice_response(node, bias, consistency, context)
        else:
            # Default response for unsupported types
            return {
                "response": "completed",
                "raw_score": 1,
                "scaled_score": 1.0
            }

    def _generate_likert_response(self, node: Dict[str, Any], bias: float, consistency: float, context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate Likert scale response (1-5 or similar)."""
        scale = node.get("scale", {})
        min_val = scale.get("min", 1)
        max_val = scale.get("max", 5)
        range_size = max_val - min_val
        
        # Start with middle value
        middle = min_val + (range_size // 2)
        
        # Apply bias (positive = higher scores, negative = lower scores)
        target = middle + (bias * range_size * 0.3)
        
        # Add some randomness based on consistency
        randomness = (1 - consistency) * range_size * 0.4
        actual_response = target + random.uniform(-randomness, randomness)
        
        # Clamp to valid range
        response_value = max(min_val, min(max_val, round(actual_response)))
        
        # Calculate normalized score (0.0 to 1.0)
        normalized_score = (response_value - min_val) / range_size
        
        return {
            "response": str(response_value),
            "raw_score": response_value,
            "scaled_score": normalized_score,
            "min": min_val,
            "max": max_val
        }

    def _generate_binary_response(self, node: Dict[str, Any], bias: float, consistency: float, context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate true/false response."""
        # Determine probability of "true" based on bias and question sentiment
        question_text = node.get("text", "").lower()
        
        base_probability = 0.5
        
        # Adjust based on bias
        if bias > 0:
            probability = 0.6 + min(0.3, bias * 0.2)  # More likely to answer positively
        elif bias < 0:
            probability = 0.4 + max(-0.3, bias * 0.2)  # More likely to answer negatively
        else:
            probability = base_probability
            
        # Add consistency factor
        if consistency > 0.8:
            # High consistency - stick closer to bias
            if bias != 0:
                probability = 0.5 + (probability - 0.5) * 1.2
                probability = max(0.1, min(0.9, probability))
        
        response_bool = random.random() < probability
        response_value = response_bool
        
        return {
            "response": str(response_value).lower(),
            "raw_score": 1 if response_bool else 0,
            "scaled_score": 1.0 if response_bool else 0.0
        }

    def _generate_rating_response(self, node: Dict[str, Any], bias: float, consistency: float, context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate rating response (stars, numeric, etc.)."""
        rating_range = node.get("range", {})
        min_val = rating_range.get("min", 1)
        max_val = rating_range.get("max", 5)
        
        # Use similar logic to Likert scale
        return self._generate_likert_response({
            "scale": {"min": min_val, "max": max_val}
        }, bias, consistency, context)

    def _generate_text_response(self, node: Dict[str, Any], employee_type: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate text area response."""
        responses = {
            "satisfied_employee": [
                "I really enjoyed my time here and learned a lot. Great team environment.",
                "The company provided excellent opportunities for growth and development.",
                "Management was supportive and the work environment was positive.",
                "I appreciated the benefits package and work-life balance offered.",
                "My colleagues were professional and helpful throughout my tenure."
            ],
            "neutral_employee": [
                "It was an okay experience overall. Some good aspects, some areas for improvement.",
                "The role had its challenges but also provided valuable experience.",
                "Mixed feelings about the position. Good learning opportunities but limited advancement.",
                "The work was interesting but the environment could be improved.",
                "Decent company with room for growth in several areas."
            ],
            "dissatisfied_employee": [
                "Management needs significant improvement in communication and support.",
                "Limited opportunities for career advancement despite strong performance.",
                "Work-life balance was challenging and expectations were often unclear.",
                "Compensation did not align with responsibilities and market standards.",
                "The work environment was stressful with insufficient resources provided."
            ]
        }
        
        # Sometimes employees skip optional text questions
        if random.random() < 0.3:  # 30% skip rate for text questions
            return {
                "response": "",
                "raw_score": 0,
                "scaled_score": 0.0,
                "skipped": True
            }
        
        response_text = random.choice(responses.get(employee_type, responses["neutral_employee"]))
        
        return {
            "response": response_text,
            "raw_score": len(response_text),
            "scaled_score": min(1.0, len(response_text) / 200.0),  # Normalize by typical length
            "word_count": len(response_text.split())
        }

    def _generate_choice_response(self, node: Dict[str, Any], bias: float, consistency: float, context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate multiple choice response."""
        choices = node.get("choices", [])
        if not choices:
            return {"response": "", "raw_score": 0, "scaled_score": 0.0}
        
        # For exit surveys, certain choices are more likely based on bias
        question_text = node.get("text", "").lower()
        
        if "reason" in question_text and "leaving" in question_text:
            # Primary reason for leaving - weight based on employee satisfaction
            if bias < -0.5:  # Dissatisfied
                preferred_reasons = ["management", "compensation", "work-life-balance", "company-culture"]
            elif bias > 0.5:  # Satisfied (leaving for positive reasons)
                preferred_reasons = ["better-opportunity", "career-change", "personal", "location"]
            else:  # Neutral
                preferred_reasons = ["better-opportunity", "compensation", "personal"]
            
            # Try to find matching choice
            for choice in choices:
                choice_id = choice.get("id", "")
                if any(reason in choice_id for reason in preferred_reasons):
                    return {
                        "response": choice_id,
                        "raw_score": 1,
                        "scaled_score": 1.0,
                        "choice_text": choice.get("text", "")
                    }
        
        # Default: random choice with slight bias toward middle options
        choice_weights = []
        for i, choice in enumerate(choices):
            if len(choices) > 3:
                # Weight middle choices slightly higher
                if 1 <= i <= len(choices) - 2:
                    weight = 1.2
                else:
                    weight = 0.8
            else:
                weight = 1.0
            choice_weights.append(weight)
        
        selected_choice = random.choices(choices, weights=choice_weights)[0]
        
        return {
            "response": selected_choice.get("id", ""),
            "raw_score": 1,
            "scaled_score": 1.0,
            "choice_text": selected_choice.get("text", "")
        }

    def create_xapi_statement(self, user: User, survey: ContentItem, verb: str, timestamp: datetime, 
                             result: Dict[str, Any] = None, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Create a properly formatted xAPI statement for survey interaction."""
        
        statement = {
            "id": str(uuid.uuid4()),
            "version": "1.0.3",
            "timestamp": timestamp.isoformat(),
            "actor": {
                "objectType": "Agent",
                "name": user.full_name or user.username,
                "mbox": f"mailto:{user.email}"
            },
            "verb": {
                "id": XAPI_VERBS[verb],
                "display": {"en-US": verb.title()}
            },
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj-platform.com/activities/{survey.id}",
                "definition": {
                    "name": {"en-US": survey.title},
                    "description": {"en-US": survey.description or ""},
                    "type": f"http://nlj-platform.com/activitytypes/{survey.content_type}",
                    "interactionType": "other"
                }
            }
        }
        
        # Add result data if provided
        if result:
            statement["result"] = result
            
        # Add context with demographics and extensions
        if context:
            statement["context"] = context
        else:
            statement["context"] = {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/activity_type": survey.content_type,
                    "http://nlj.platform/extensions/user_role": user.role.value,
                    "http://nlj.platform/extensions/session_id": str(uuid.uuid4())
                }
            }
            
        return statement

    async def generate_survey_session(self, user: User, survey: ContentItem, employee_type: str, 
                                    session_start: datetime) -> List[Dict[str, Any]]:
        """Generate a complete survey session with multiple xAPI statements."""
        statements = []
        current_time = session_start
        
        # Get survey questions
        nlj_data = survey.nlj_data
        nodes = nlj_data.get("nodes", [])
        question_nodes = [node for node in nodes if node.get("type") in 
                         ["likert_scale", "true_false", "rating", "text_area", "multiple_choice"]]
        
        if not question_nodes:
            print(f"No question nodes found in survey: {survey.title}")
            return statements
        
        # Generate demographics for this user session
        demographics = {
            "http://nlj.platform/extensions/department": random.choice(DEMOGRAPHICS["departments"]),
            "http://nlj.platform/extensions/location": random.choice(DEMOGRAPHICS["locations"]),
            "http://nlj.platform/extensions/job_level": random.choice(DEMOGRAPHICS["job_levels"]),
            "http://nlj.platform/extensions/tenure": random.choice(DEMOGRAPHICS["tenure_ranges"]),
            "http://nlj.platform/extensions/generation": random.choice(DEMOGRAPHICS["generations"])
        }
        
        # Survey start event
        start_context = {
            "platform": "NLJ Platform",
            "extensions": {
                **demographics,
                "http://nlj.platform/extensions/activity_type": survey.content_type,
                "http://nlj.platform/extensions/user_role": user.role.value,
                "http://nlj.platform/extensions/session_id": str(uuid.uuid4()),
                "http://nlj.platform/extensions/survey_type": nlj_data.get("surveyMetadata", {}).get("surveyType", "survey")
            }
        }
        
        statements.append(self.create_xapi_statement(
            user, survey, "attempted", current_time, 
            context=start_context
        ))
        
        # Generate responses for each question
        total_score = 0
        total_possible = 0
        completed_questions = 0
        
        pattern = self.response_patterns[employee_type]
        completion_rate = pattern["completion_rate"]
        
        for i, node in enumerate(question_nodes):
            # Some users may not complete all questions
            if random.random() > completion_rate:
                # User abandoned survey
                statements.append(self.create_xapi_statement(
                    user, survey, "suspended", current_time,
                    result={"completion": False, "progress": i / len(question_nodes)},
                    context=start_context
                ))
                return statements
            
            # Time between questions (realistic pacing)
            time_per_question = random.uniform(10, 45)  # 10-45 seconds per question
            current_time += timedelta(seconds=time_per_question)
            
            # Generate response for this question
            response_data = self.generate_response_for_question(node, employee_type, demographics)
            
            # Create question-specific xAPI statement with question-level activity ID
            # This matches the format expected by our analytics: http://nlj.platform/questions/{question_id}
            question_statement = {
                "id": str(uuid.uuid4()),
                "version": "1.0.3", 
                "timestamp": current_time.isoformat(),
                "actor": {
                    "objectType": "Agent",
                    "name": user.full_name or user.username,
                    "mbox": f"mailto:{user.email}"
                },
                "verb": {
                    "id": XAPI_VERBS["answered"],
                    "display": {"en-US": "Answered"}
                },
                "object": {
                    "objectType": "Activity",
                    "id": f"http://nlj.platform/questions/{node.get('id')}",
                    "definition": {
                        "name": {"en-US": node.get("text", f"Question {node.get('id')}")},
                        "description": {"en-US": f"Question {i+1} from survey: {survey.title}"},
                        "type": "http://adlnet.gov/expapi/activities/cmi.interaction",
                        "interactionType": "choice" if node.get("type") in ["likert_scale", "multiple_choice"] else "other"
                    }
                },
                "result": {
                    "score": {"raw": response_data["raw_score"], "scaled": response_data["scaled_score"]},
                    "response": response_data["response"],
                    "completion": True
                },
                "context": {
                    "platform": "NLJ Platform",
                    "extensions": {
                        **demographics,
                        "http://nlj.platform/extensions/parent_survey": str(survey.id),
                        "http://nlj.platform/extensions/question_id": node.get("id"),
                        "http://nlj.platform/extensions/question_type": node.get("type"),
                        "http://nlj.platform/extensions/question_order": i + 1,
                        "http://nlj.platform/extensions/user_role": user.role.value,
                        "http://nlj.platform/extensions/session_id": start_context["extensions"]["http://nlj.platform/extensions/session_id"]
                    }
                }
            }
            
            # Add additional metadata based on question type
            if "min" in response_data and "max" in response_data:
                question_statement["result"]["score"]["min"] = response_data["min"]
                question_statement["result"]["score"]["max"] = response_data["max"]
            
            statements.append(question_statement)
            
            # Track overall progress
            total_score += response_data["scaled_score"]
            total_possible += 1.0
            completed_questions += 1
        
        # Survey completion event
        current_time += timedelta(seconds=random.uniform(5, 15))
        
        final_score = total_score / total_possible if total_possible > 0 else 0
        completion_result = {
            "score": {"raw": total_score, "scaled": final_score},
            "completion": True,
            "duration": f"PT{int((current_time - session_start).total_seconds())}S",
            "questions_completed": completed_questions,
            "total_questions": len(question_nodes)
        }
        
        statements.append(self.create_xapi_statement(
            user, survey, "completed", current_time,
            result=completion_result,
            context=start_context
        ))
        
        return statements


async def generate_fake_survey_responses(num_responses_per_survey: int = 50):
    """Generate fake survey responses for all loaded surveys."""
    print("🎯 Generating Fake Survey Responses")
    print("=" * 50)
    
    # Initialize database and services
    await db_manager.ensure_initialized()
    db = db_manager.get_session()
    
    # Initialize Kafka and Elasticsearch services
    await kafka_service.initialize()
    
    try:
        # Get all survey content
        survey_query = select(ContentItem).where(ContentItem.content_type == ContentType.SURVEY)
        result = await db.execute(survey_query)
        surveys = result.scalars().all()
        
        if not surveys:
            print("❌ No surveys found in database")
            return
        
        print(f"📊 Found {len(surveys)} surveys")
        
        # Get all users for response generation
        user_query = select(User).where(User.role == UserRole.PLAYER)
        result = await db.execute(user_query)
        users = result.scalars().all()
        
        if not users:
            print("❌ No player users found")
            return
            
        print(f"👥 Found {len(users)} users")
        
        # Generate responses
        generator = SurveyResponseGenerator()
        total_statements = 0
        
        for survey in surveys:
            print(f"\n📋 Generating responses for: {survey.title}")
            
            survey_statements = []
            
            for i in range(num_responses_per_survey):
                # Select random user and employee type
                user = random.choice(users)
                employee_type = random.choices(
                    list(generator.response_patterns.keys()),
                    weights=[0.4, 0.4, 0.2]  # 40% satisfied, 40% neutral, 20% dissatisfied
                )[0]
                
                # Generate random session start time (last 30 days)
                days_ago = random.randint(1, 30)
                hours_offset = random.randint(8, 18)  # Business hours
                session_start = datetime.now(timezone.utc) - timedelta(days=days_ago, hours=hours_offset)
                
                # Generate complete survey session
                session_statements = await generator.generate_survey_session(
                    user, survey, employee_type, session_start
                )
                
                survey_statements.extend(session_statements)
                
                if (i + 1) % 10 == 0:
                    print(f"  Generated {i + 1}/{num_responses_per_survey} responses")
            
            # Send statements to Kafka and Elasticsearch
            for statement in survey_statements:
                try:
                    # Send to Kafka
                    await kafka_service.send_xapi_statement(statement)
                    
                    # Send directly to Elasticsearch for immediate availability
                    await elasticsearch_service.store_xapi_statement(statement)
                    
                except Exception as e:
                    print(f"❌ Error sending statement: {e}")
                    continue
            
            total_statements += len(survey_statements)
            print(f"✅ Generated {len(survey_statements)} statements for {survey.title}")
        
        print(f"\n🎉 Generated {total_statements} total xAPI statements")
        print(f"📊 Average {total_statements // len(surveys)} statements per survey")
        
    except Exception as e:
        print(f"❌ Error generating responses: {e}")
        raise
    finally:
        await db.close()
        await kafka_service.close()


if __name__ == "__main__":
    print("🚀 Starting Survey Response Generation")
    
    try:
        # Generate 50 responses per survey by default
        num_responses = int(sys.argv[1]) if len(sys.argv) > 1 else 50
        asyncio.run(generate_fake_survey_responses(num_responses))
        print("\n✅ Survey response generation completed successfully!")
        
    except KeyboardInterrupt:
        print("\n⏹️ Generation cancelled by user")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)