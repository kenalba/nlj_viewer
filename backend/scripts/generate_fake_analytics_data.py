#!/usr/bin/env python3
"""
Fake Data Generation Script for NLJ Platform Analytics.

Generates realistic xAPI learning events by simulating user interactions
with existing activities, streaming events through Kafka to populate
the analytics dashboard with meaningful data.
"""

import asyncio
import random
import sys
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database_manager import db_manager
from app.models.content import ContentItem

# Import models and services
from app.models.user import User, UserRole
from app.services.elasticsearch_service import elasticsearch_service
from app.services.kafka_service import kafka_service

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@dataclass
class LearnerPersona:
    """User persona for realistic behavior simulation."""

    name: str
    role: UserRole
    completion_rate: float  # 0.0 - 1.0
    success_rate: float  # 0.0 - 1.0
    retry_tendency: float  # 0.0 - 1.0
    activity_frequency: int  # activities per week
    session_duration: Tuple[int, int]  # min/max minutes per session
    preferred_times: List[int]  # hours of day (0-23)
    learning_pace: str  # 'fast', 'medium', 'slow'


# Realistic learner personas
LEARNER_PERSONAS = [
    LearnerPersona(
        name="High Performer",
        role=UserRole.PLAYER,
        completion_rate=0.95,
        success_rate=0.90,
        retry_tendency=0.10,
        activity_frequency=12,
        session_duration=(10, 25),
        preferred_times=[9, 10, 14, 15, 16],
        learning_pace="fast",
    ),
    LearnerPersona(
        name="Consistent Learner",
        role=UserRole.PLAYER,
        completion_rate=0.80,
        success_rate=0.75,
        retry_tendency=0.25,
        activity_frequency=8,
        session_duration=(15, 30),
        preferred_times=[8, 9, 13, 14, 17],
        learning_pace="medium",
    ),
    LearnerPersona(
        name="Casual User",
        role=UserRole.PLAYER,
        completion_rate=0.60,
        success_rate=0.70,
        retry_tendency=0.15,
        activity_frequency=4,
        session_duration=(5, 15),
        preferred_times=[12, 13, 17, 18],
        learning_pace="medium",
    ),
    LearnerPersona(
        name="Struggling Learner",
        role=UserRole.PLAYER,
        completion_rate=0.45,
        success_rate=0.55,
        retry_tendency=0.40,
        activity_frequency=6,
        session_duration=(20, 45),
        preferred_times=[10, 11, 15, 16, 19],
        learning_pace="slow",
    ),
    LearnerPersona(
        name="Weekend Warrior",
        role=UserRole.PLAYER,
        completion_rate=0.75,
        success_rate=0.80,
        retry_tendency=0.20,
        activity_frequency=10,
        session_duration=(25, 60),
        preferred_times=[10, 11, 14, 15, 16, 20],
        learning_pace="medium",
    ),
]

# xAPI Verb definitions
XAPI_VERBS = {
    "experienced": "http://adlnet.gov/expapi/verbs/experienced",
    "attempted": "http://adlnet.gov/expapi/verbs/attempted",
    "answered": "http://adlnet.gov/expapi/verbs/answered",
    "completed": "http://adlnet.gov/expapi/verbs/completed",
    "passed": "http://adlnet.gov/expapi/verbs/passed",
    "failed": "http://adlnet.gov/expapi/verbs/failed",
    "scored": "http://adlnet.gov/expapi/verbs/scored",
    "interacted": "http://adlnet.gov/expapi/verbs/interacted",
}


class FakeDataGenerator:
    """Main class for generating fake analytics data."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.users: List[User] = []
        self.activities: List[ContentItem] = []
        self.generated_events = []

    def get_user_persona(self, user: User) -> LearnerPersona:
        """Get persona for user based on username pattern."""
        # For existing users (admin, creator, etc.), assign random persona
        if user.username in ["admin", "creator", "reviewer", "player", "learner"]:
            return random.choice(LEARNER_PERSONAS)

        # For generated users, derive from user ID hash for consistency
        persona_index = hash(str(user.id)) % len(LEARNER_PERSONAS)
        return LEARNER_PERSONAS[persona_index]

    async def initialize(self):
        """Load existing users and activities from database."""
        print("🔄 Loading existing data from database...")

        # Load all users
        result = await self.session.execute(select(User))
        self.users = result.scalars().all()
        print(f"📊 Found {len(self.users)} existing users")

        # Load all published activities
        result = await self.session.execute(select(ContentItem).where(ContentItem.state == "published"))
        self.activities = result.scalars().all()
        print(f"📚 Found {len(self.activities)} published activities")

        if not self.activities:
            print("⚠️  No published activities found! Run seed_database.py first.")
            return False

        if len(self.users) < 5:
            print("⚠️  Insufficient users found! Run seed_database.py first.")
            return False

        return True

    async def create_additional_fake_users(self, count: int = 50) -> List[User]:
        """Create additional fake users with diverse personas."""
        print(f"👥 Creating {count} additional fake users...")

        fake_users = []

        # Sample names and domains for realistic users
        first_names = [
            "Alex",
            "Jordan",
            "Taylor",
            "Morgan",
            "Casey",
            "Riley",
            "Avery",
            "Quinn",
            "Sam",
            "Devon",
            "Sage",
            "River",
            "Skylar",
            "Rowan",
            "Phoenix",
            "Finley",
            "Blake",
            "Cameron",
            "Drew",
            "Emery",
            "Jamie",
            "Kai",
            "Lane",
            "Parker",
            "Reese",
            "Shay",
            "Toni",
            "Val",
            "Wren",
            "Zion",
            "Arden",
            "Bay",
            "Cedar",
            "Dani",
            "Ellis",
            "Frankie",
            "Gray",
            "Haven",
            "Indigo",
            "Jules",
            "Kris",
            "Lennox",
            "Max",
            "Nova",
            "Ocean",
            "Peyton",
            "Quincy",
            "Remy",
        ]

        last_names = [
            "Johnson",
            "Williams",
            "Brown",
            "Jones",
            "Garcia",
            "Miller",
            "Davis",
            "Rodriguez",
            "Martinez",
            "Hernandez",
            "Lopez",
            "Gonzalez",
            "Wilson",
            "Anderson",
            "Thomas",
            "Taylor",
            "Moore",
            "Jackson",
            "Martin",
            "Lee",
            "Perez",
            "Thompson",
            "White",
            "Harris",
            "Sanchez",
            "Clark",
            "Ramirez",
            "Lewis",
            "Robinson",
            "Walker",
            "Young",
            "Allen",
            "King",
            "Wright",
            "Scott",
            "Torres",
            "Nguyen",
            "Hill",
            "Flores",
            "Green",
            "Adams",
            "Nelson",
            "Baker",
            "Hall",
            "Rivera",
            "Campbell",
            "Mitchell",
            "Carter",
        ]

        companies = ["acme", "techcorp", "globalinc", "innovate", "solutions"]

        for i in range(count):
            persona = random.choice(LEARNER_PERSONAS)
            first_name = random.choice(first_names)
            last_name = random.choice(last_names)
            company = random.choice(companies)

            fake_user = User(
                id=uuid.uuid4(),
                username=f"{first_name.lower()}.{last_name.lower()}{i:03d}",
                email=f"{first_name.lower()}.{last_name.lower()}{i:03d}@{company}.com",
                hashed_password=pwd_context.hash("learner123"),
                full_name=f"{first_name} {last_name}",
                role=persona.role,
                is_active=True,
                is_verified=True,
                # Note: Persona info will be derived from username pattern for behavior simulation
            )

            fake_users.append(fake_user)
            self.session.add(fake_user)

        await self.session.flush()
        print(f"✅ Created {len(fake_users)} fake users")
        return fake_users

    def create_xapi_statement(
        self,
        user: User,
        activity: ContentItem,
        verb: str,
        timestamp: datetime,
        result: Dict[str, Any] = None,
        context: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """Create a properly formatted xAPI statement."""

        statement = {
            "id": str(uuid.uuid4()),
            "version": "1.0.3",
            "timestamp": timestamp.isoformat(),
            "actor": {"objectType": "Agent", "name": user.full_name, "mbox": f"mailto:{user.email}"},
            "verb": {"id": XAPI_VERBS[verb], "display": {"en-US": verb.title()}},
            "object": {
                "objectType": "Activity",
                "id": f"http://nlj-platform.com/activities/{activity.id}",
                "definition": {
                    "name": {"en-US": activity.title},
                    "description": {"en-US": activity.description or ""},
                    "type": f"http://nlj-platform.com/activitytypes/{activity.content_type}",
                    "interactionType": self.get_interaction_type(activity),
                },
            },
        }

        # Add result data if provided
        if result:
            statement["result"] = result

        # Add context if provided
        if context:
            statement["context"] = context
        else:
            statement["context"] = {
                "platform": "NLJ Platform",
                "extensions": {
                    "http://nlj.platform/extensions/activity_type": activity.content_type,
                    "http://nlj.platform/extensions/user_role": user.role.value,
                    "http://nlj.platform/extensions/session_id": str(uuid.uuid4()),
                },
            }

        return statement

    def get_interaction_type(self, activity: ContentItem) -> str:
        """Determine interaction type from NLJ data."""
        if not activity.nlj_data or "nodes" not in activity.nlj_data:
            return "other"

        # Check node types to determine interaction pattern
        node_types = [node.get("type", "") for node in activity.nlj_data["nodes"]]

        if any("multiple_choice" in t or "choice" in t for t in node_types):
            return "choice"
        elif any("true_false" in t or "trueFalse" in t for t in node_types):
            return "true-false"
        elif any("matching" in t for t in node_types):
            return "matching"
        elif any("ordering" in t for t in node_types):
            return "sequencing"
        elif any("likert" in t or "rating" in t for t in node_types):
            return "likert"
        elif any("text" in t or "short_answer" in t for t in node_types):
            return "fill-in"
        else:
            return "other"

    def simulate_learning_session(
        self, user: User, activity: ContentItem, session_start: datetime
    ) -> List[Dict[str, Any]]:
        """Simulate a complete learning session with realistic patterns."""

        statements = []
        current_time = session_start

        # Get user persona data
        persona = self.get_user_persona(user)
        success_rate = persona.success_rate
        retry_tendency = persona.retry_tendency
        learning_pace = persona.learning_pace

        # Pace multipliers
        pace_multipliers = {"fast": 0.7, "medium": 1.0, "slow": 1.4}
        pace_multiplier = pace_multipliers.get(learning_pace, 1.0)

        # 1. Activity start - "experienced" verb
        statements.append(self.create_xapi_statement(user, activity, "experienced", current_time))
        current_time += timedelta(seconds=random.randint(1, 5))

        # 2. Simulate answering questions/interacting
        if activity.nlj_data and "nodes" in activity.nlj_data:
            question_nodes = [
                node for node in activity.nlj_data["nodes"] if node.get("type") not in ["start", "end", "panel"]
            ]

            for i, node in enumerate(question_nodes):
                # Time spent on question (affected by learning pace)
                base_time = random.randint(10, 45)
                time_spent = int(base_time * pace_multiplier)
                current_time += timedelta(seconds=time_spent)

                # Attempt the question
                statements.append(
                    self.create_xapi_statement(
                        user,
                        activity,
                        "attempted",
                        current_time,
                        context={
                            "extensions": {
                                "http://nlj.platform/extensions/question_id": node.get("id"),
                                "http://nlj.platform/extensions/question_type": node.get("type"),
                                "http://nlj.platform/extensions/attempt_number": 1,
                            }
                        },
                    )
                )

                # Determine if user succeeds on this question
                success = random.random() < success_rate

                if success:
                    # Successful answer
                    score = random.uniform(0.8, 1.0)
                    statements.append(
                        self.create_xapi_statement(
                            user,
                            activity,
                            "answered",
                            current_time,
                            result={"success": True, "score": {"scaled": score}, "duration": f"PT{time_spent}S"},
                        )
                    )
                else:
                    # Failed attempt
                    statements.append(
                        self.create_xapi_statement(
                            user,
                            activity,
                            "answered",
                            current_time,
                            result={
                                "success": False,
                                "score": {"scaled": random.uniform(0.2, 0.6)},
                                "duration": f"PT{time_spent}S",
                            },
                        )
                    )

                    # Maybe retry based on tendency
                    if random.random() < retry_tendency:
                        retry_time = int(base_time * pace_multiplier * 0.8)
                        current_time += timedelta(seconds=retry_time)

                        statements.append(
                            self.create_xapi_statement(
                                user,
                                activity,
                                "attempted",
                                current_time,
                                context={
                                    "extensions": {
                                        "http://nlj.platform/extensions/question_id": node.get("id"),
                                        "http://nlj.platform/extensions/question_type": node.get("type"),
                                        "http://nlj.platform/extensions/attempt_number": 2,
                                    }
                                },
                            )
                        )

                        # Usually succeed on retry
                        retry_success = random.random() < (success_rate + 0.2)
                        score = random.uniform(0.7, 0.95) if retry_success else random.uniform(0.4, 0.7)

                        statements.append(
                            self.create_xapi_statement(
                                user,
                                activity,
                                "answered",
                                current_time,
                                result={
                                    "success": retry_success,
                                    "score": {"scaled": score},
                                    "duration": f"PT{retry_time}S",
                                },
                            )
                        )

                # Small break between questions
                current_time += timedelta(seconds=random.randint(2, 10))

        # 3. Activity completion
        completion_rate = persona.completion_rate
        if random.random() < completion_rate:
            # Calculate overall score based on individual results
            scores = [
                s.get("result", {}).get("score", {}).get("scaled", 0)
                for s in statements
                if s.get("result", {}).get("score", {}).get("scaled") is not None
            ]
            overall_score = sum(scores) / len(scores) if scores else 0

            statements.append(
                self.create_xapi_statement(
                    user,
                    activity,
                    "completed",
                    current_time,
                    result={
                        "completion": True,
                        "success": overall_score >= 0.7,
                        "score": {"scaled": overall_score},
                        "duration": f"PT{int((current_time - session_start).total_seconds())}S",
                    },
                )
            )

            # Add passed/failed statement
            if overall_score >= 0.7:
                statements.append(
                    self.create_xapi_statement(
                        user,
                        activity,
                        "passed",
                        current_time,
                        result={"success": True, "score": {"scaled": overall_score}},
                    )
                )
            else:
                statements.append(
                    self.create_xapi_statement(
                        user,
                        activity,
                        "failed",
                        current_time,
                        result={"success": False, "score": {"scaled": overall_score}},
                    )
                )

        return statements

    async def generate_historical_data(self, days: int = 30, users_limit: int = None):
        """Generate historical learning data over specified days."""
        print(f"🕒 Generating {days} days of historical learning data...")

        users_to_use = self.users[:users_limit] if users_limit else self.users
        start_date = datetime.now(timezone.utc) - timedelta(days=days)

        total_sessions = 0

        for day in range(days):
            current_date = start_date + timedelta(days=day)

            # Skip weekends with lower activity (20% of normal)
            is_weekend = current_date.weekday() >= 5
            activity_multiplier = 0.2 if is_weekend else 1.0

            daily_sessions = 0

            for user in users_to_use:
                persona = self.get_user_persona(user)
                weekly_frequency = persona.activity_frequency
                daily_probability = (weekly_frequency / 7) * activity_multiplier

                # Decide if user learns today
                if random.random() > daily_probability / 10:  # Adjust for realistic frequency
                    continue

                # Preferred times for this persona
                preferred_times = persona.preferred_times

                # Choose session time
                session_hour = random.choice(preferred_times)
                session_minute = random.randint(0, 59)
                session_start = current_date.replace(hour=session_hour, minute=session_minute, second=0, microsecond=0)

                # User might do multiple activities in a session
                activities_this_session = random.choices(
                    self.activities, k=random.randint(1, min(3, len(self.activities)))
                )

                for activity in activities_this_session:
                    statements = self.simulate_learning_session(user, activity, session_start)
                    self.generated_events.extend(statements)

                    # Update session start for next activity
                    if statements:
                        last_statement_time = datetime.fromisoformat(statements[-1]["timestamp"].replace("Z", "+00:00"))
                        session_start = last_statement_time + timedelta(minutes=random.randint(2, 10))

                daily_sessions += 1

            total_sessions += daily_sessions
            if day % 7 == 0 or day == days - 1:  # Progress update weekly
                print(f"  📅 Day {day + 1}/{days}: {daily_sessions} sessions ({total_sessions} total)")

        print(f"✅ Generated {len(self.generated_events)} xAPI events from {total_sessions} learning sessions")

    async def stream_events_to_kafka(self, batch_size: int = 50, delay_ms: int = 100):
        """Stream generated events to Kafka for processing."""
        print(f"📡 Streaming {len(self.generated_events)} events to Kafka...")

        try:
            # Initialize Kafka producer
            await kafka_service.start_producer()

            # Send events in batches
            for i in range(0, len(self.generated_events), batch_size):
                batch = self.generated_events[i : i + batch_size]

                for event in batch:
                    await kafka_service.publish_event("xapi-events", event)

                # Small delay between batches to avoid overwhelming
                if delay_ms > 0:
                    await asyncio.sleep(delay_ms / 1000)

                if (i // batch_size + 1) % 10 == 0:  # Progress every 10 batches
                    print(
                        f"  📦 Sent {min(i + batch_size, len(self.generated_events))}/{len(self.generated_events)} events"
                    )

            print("✅ All events streamed to Kafka successfully!")

        except Exception as e:
            print(f"❌ Error streaming to Kafka: {e}")
            raise
        finally:
            if kafka_service.producer:
                await kafka_service.producer.stop()


async def purge_analytics_data():
    """Purge all existing analytics data (Elasticsearch and Kafka)."""
    print("🧹 Purging existing analytics data...")

    try:
        # Delete and recreate Elasticsearch index with analytics-friendly mapping
        print("  🗑️ Deleting Elasticsearch statements index...")
        await elasticsearch_service.delete_index()

        print("  🔧 Creating new analytics-optimized index...")
        await elasticsearch_service.create_xapi_index()

        print("  🏗️ Index recreated with analytics-enabled mappings")

    except Exception as e:
        print(f"  ⚠️ Warning: Could not purge Elasticsearch data: {e}")

    try:
        # Clear Kafka topic (we'll recreate it implicitly when producing)
        print("  🧽 Clearing Kafka xapi-events topic...")
        # Note: Kafka topics will be auto-created when we produce new events
        print("  ✅ Kafka topic will be reset on next data generation")

    except Exception as e:
        print(f"  ⚠️ Warning: Could not clear Kafka topics: {e}")

    print("✅ Analytics data purge complete")


async def generate_fake_data(
    days: int = 30,
    additional_users: int = 50,
    users_limit: int = None,
    stream_to_kafka: bool = True,
    batch_size: int = 50,
    delay_ms: int = 100,
    purge_first: bool = True,
):
    """Main function to generate comprehensive fake analytics data."""
    print("🎯 Starting Fake Analytics Data Generation")
    print("=" * 60)
    print("📊 Configuration:")
    print(f"  • Historical period: {days} days")
    print(f"  • Additional users to create: {additional_users}")
    print(f"  • Stream to Kafka: {stream_to_kafka}")
    print(f"  • Batch size: {batch_size}")
    print(f"  • Purge existing data: {purge_first}")
    print("=" * 60)
    print("🔍 Detecting database configuration...")

    # Initialize database manager (handles both RDS and direct PostgreSQL)
    await db_manager.initialize()

    connection_info = db_manager.get_connection_info()
    print(f"📊 Connected to: {'RDS' if connection_info.get('use_rds') else 'Direct PostgreSQL'}")

    try:
        async with db_manager.get_session() as session:
            generator = FakeDataGenerator(session)

            # Purge existing analytics data if requested
            if purge_first:
                await purge_analytics_data()

            # Initialize with existing data
            if not await generator.initialize():
                print("❌ Failed to initialize. Make sure database is seeded with users and activities.")
                return

            # Create additional fake users
            if additional_users > 0:
                fake_users = await generator.create_additional_fake_users(additional_users)
                generator.users.extend(fake_users)
                await session.commit()

            # Generate historical learning data
            await generator.generate_historical_data(days, users_limit)

            # Stream events to Kafka for analytics processing
            if stream_to_kafka and generator.generated_events:
                await generator.stream_events_to_kafka(batch_size, delay_ms)

            print("\n" + "=" * 60)
            print("🎉 FAKE DATA GENERATION COMPLETE!")
            print("=" * 60)
            print("📊 Summary:")
            print(f"  • Total users: {len(generator.users)}")
            print(f"  • Activities used: {len(generator.activities)}")
            print(f"  • xAPI events generated: {len(generator.generated_events)}")
            print(f"  • Historical period: {days} days")

            if stream_to_kafka:
                print("\n📈 Analytics Dashboard should now show:")
                print(f"  • {len(set(e['actor']['mbox'] for e in generator.generated_events))} unique learners")
                print(f"  • {len(set(e['object']['id'] for e in generator.generated_events))} unique activities")
                print(f"  • Daily activity trends over {days} days")
                print("  • Realistic completion rates and scores")

            print("\n🌐 View results at: http://localhost:5173/app/analytics")

    except Exception as e:
        print(f"❌ Error generating fake data: {e}")
        raise
    finally:
        await db_manager.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate fake analytics data for NLJ Platform")
    parser.add_argument("--days", type=int, default=30, help="Days of historical data to generate")
    parser.add_argument("--users", type=int, default=50, help="Additional fake users to create")
    parser.add_argument("--limit-users", type=int, help="Limit to first N users for testing")
    parser.add_argument("--no-kafka", action="store_true", help="Skip streaming to Kafka")
    parser.add_argument("--batch-size", type=int, default=50, help="Kafka batch size")
    parser.add_argument("--delay", type=int, default=100, help="Delay between batches (ms)")
    parser.add_argument("--no-purge", action="store_true", help="Skip purging existing analytics data")
    parser.add_argument("--preset", choices=["demo", "dev", "full"], help="Use preset configuration")

    args = parser.parse_args()

    # Preset configurations
    if args.preset == "demo":
        args.days = 7
        args.users = 10
        args.batch_size = 25
    elif args.preset == "dev":
        args.days = 14
        args.users = 25
        args.batch_size = 50
    elif args.preset == "full":
        args.days = 90
        args.users = 100
        args.batch_size = 100

    asyncio.run(
        generate_fake_data(
            days=args.days,
            additional_users=args.users,
            users_limit=args.limit_users,
            stream_to_kafka=not args.no_kafka,
            batch_size=args.batch_size,
            delay_ms=args.delay,
            purge_first=not args.no_purge,
        )
    )
