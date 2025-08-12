#!/usr/bin/env python3
"""
Setup Kafka topics for NLJ training scheduling event-driven architecture.
Creates all required topics with appropriate configurations.
"""

import asyncio
import logging
import sys

# Import Kafka libraries only when needed
try:
    from aiokafka.admin import AIOKafkaAdminClient
    from aiokafka.admin.new_topic import NewTopic
    from aiokafka.errors import TopicAlreadyExistsError

    KAFKA_AVAILABLE = True
except ImportError:
    KAFKA_AVAILABLE = False

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Topic configurations based on product specification
TRAINING_TOPICS = {
    # Program lifecycle events
    "nlj.training.programs": {
        "description": "Training program lifecycle events (created, published, updated)",
        "partitions": 3,
        "replication_factor": 1,
        "config": {"retention.ms": "2592000000", "cleanup.policy": "delete", "compression.type": "gzip"},  # 30 days
    },
    # Session scheduling events
    "nlj.training.sessions": {
        "description": "Training session lifecycle events (scheduled, cancelled, rescheduled)",
        "partitions": 6,  # Higher throughput for session operations
        "replication_factor": 1,
        "config": {"retention.ms": "2592000000", "cleanup.policy": "delete", "compression.type": "gzip"},  # 30 days
    },
    # Registration and booking events
    "nlj.training.bookings": {
        "description": "Learner registration and booking events (requested, confirmed, cancelled)",
        "partitions": 6,  # Higher throughput for booking operations
        "replication_factor": 1,
        "config": {"retention.ms": "2592000000", "cleanup.policy": "delete", "compression.type": "gzip"},  # 30 days
    },
    # Attendance and participation events
    "nlj.training.attendance": {
        "description": "Attendance tracking events (check-in, participation, completion)",
        "partitions": 3,
        "replication_factor": 1,
        "config": {"retention.ms": "2592000000", "cleanup.policy": "delete", "compression.type": "gzip"},  # 30 days
    },
    # Certificate and achievement events
    "nlj.training.certificates": {
        "description": "Certificate issuance and achievement events",
        "partitions": 2,
        "replication_factor": 1,
        "config": {"retention.ms": "2592000000", "cleanup.policy": "delete", "compression.type": "gzip"},  # 30 days
    },
    # User notifications (email, SMS, push)
    "nlj.training.notifications": {
        "description": "User communication and notification events",
        "partitions": 3,
        "replication_factor": 1,
        "config": {
            "retention.ms": "604800000",  # 7 days (shorter retention for notifications)
            "cleanup.policy": "delete",
            "compression.type": "gzip",
        },
    },
    # Scheduling conflicts and resolution
    "nlj.training.conflicts": {
        "description": "Scheduling conflict detection and resolution events",
        "partitions": 2,
        "replication_factor": 1,
        "config": {"retention.ms": "2592000000", "cleanup.policy": "delete", "compression.type": "gzip"},  # 30 days
    },
    # Analytics and reporting events
    "nlj.training.analytics": {
        "description": "Analytics aggregation and reporting events",
        "partitions": 2,
        "replication_factor": 1,
        "config": {
            "retention.ms": "7776000000",  # 90 days (longer for analytics)
            "cleanup.policy": "delete",
            "compression.type": "gzip",
        },
    },
    # Legacy topics (for backward compatibility)
    "nlj.training.scheduled": {
        "description": "Legacy training session scheduled events",
        "partitions": 2,
        "replication_factor": 1,
        "config": {"retention.ms": "2592000000", "cleanup.policy": "delete", "compression.type": "gzip"},  # 30 days
    },
    "nlj.training.registration": {
        "description": "Legacy learner registration events",
        "partitions": 2,
        "replication_factor": 1,
        "config": {"retention.ms": "2592000000", "cleanup.policy": "delete", "compression.type": "gzip"},  # 30 days
    },
}

# NLJ Activity topics (for activity events and content generation)
ACTIVITY_TOPICS = {
    "nlj.activities.completed": {
        "description": "NLJ activity completion events",
        "partitions": 3,
        "replication_factor": 1,
        "config": {
            "retention.ms": "7776000000",  # 90 days (learning analytics)
            "cleanup.policy": "delete",
            "compression.type": "gzip",
        },
    },
    "nlj.activities.reviews": {
        "description": "NLJ content review and approval events",
        "partitions": 2,
        "replication_factor": 1,
        "config": {
            "retention.ms": "7776000000",  # 90 days (audit trail)
            "cleanup.policy": "delete",
            "compression.type": "gzip",
        },
    },
    # Content Generation topic (single topic for all content generation events)
    "nlj.content.generation": {
        "description": "All content generation events (requested, started, progress, completed, failed, modified, imported, reviewed)",
        "partitions": 6,  # Higher throughput for all generation events
        "replication_factor": 1,
        "config": {
            "retention.ms": "7776000000",  # 90 days (long retention for audit trail)
            "cleanup.policy": "delete",
            "compression.type": "gzip",
        },
    },
}

# All topics combined
ALL_TOPICS = {**TRAINING_TOPICS, **ACTIVITY_TOPICS}


async def create_topics(bootstrap_servers: str = "localhost:9092") -> None:
    """Create all required Kafka topics."""

    if not KAFKA_AVAILABLE:
        logger.error("aiokafka not available. Install with: pip install aiokafka")
        return

    admin_client = AIOKafkaAdminClient(bootstrap_servers=bootstrap_servers, client_id="nlj-topic-setup")

    try:
        await admin_client.start()
        logger.info(f"Connected to Kafka at {bootstrap_servers}")

        # Create topics
        topics_to_create = []

        for topic_name, config in ALL_TOPICS.items():
            topic = NewTopic(
                name=topic_name,
                num_partitions=config["partitions"],
                replication_factor=config["replication_factor"],
                topic_configs=config["config"],
            )
            topics_to_create.append(topic)

        # Create topics in batch
        try:
            result = await admin_client.create_topics(topics_to_create)
            logger.info("Topics creation initiated")

            # Wait for topic creation to complete
            for topic_name, future in result.items():
                try:
                    await future  # This will raise an exception if creation failed
                    logger.info(f"✓ Created topic: {topic_name}")
                except TopicAlreadyExistsError:
                    logger.info(f"✓ Topic already exists: {topic_name}")
                except Exception as e:
                    logger.error(f"✗ Failed to create topic {topic_name}: {e}")

        except Exception as e:
            logger.error(f"Failed to create topics: {e}")
            return

        # List all topics to verify
        logger.info("\nListing all topics:")
        await admin_client.describe_cluster()
        topics_metadata = await admin_client.list_topics()

        for topic_name in sorted(topics_metadata):
            if topic_name.startswith("nlj."):
                description = ALL_TOPICS.get(topic_name, {}).get("description", "Unknown topic")
                logger.info(f"  • {topic_name}: {description}")

        logger.info(f"\n✓ Successfully set up {len(ALL_TOPICS)} topics for NLJ event-driven architecture")

    finally:
        await admin_client.close()


async def verify_topics(bootstrap_servers: str = "localhost:9092") -> bool:
    """Verify that all required topics exist and are properly configured."""

    if not KAFKA_AVAILABLE:
        logger.error("aiokafka not available. Install with: pip install aiokafka")
        return False

    admin_client = AIOKafkaAdminClient(bootstrap_servers=bootstrap_servers, client_id="nlj-topic-verify")

    try:
        await admin_client.start()

        # Get existing topics
        existing_topics = await admin_client.list_topics()

        missing_topics = []
        for topic_name in ALL_TOPICS.keys():
            if topic_name not in existing_topics:
                missing_topics.append(topic_name)

        if missing_topics:
            logger.warning(f"Missing topics: {missing_topics}")
            return False

        logger.info("✓ All required topics exist")
        return True

    finally:
        await admin_client.close()


async def delete_all_topics(bootstrap_servers: str = "localhost:9092") -> None:
    """Delete all NLJ topics (use with caution - for development only)."""

    if not KAFKA_AVAILABLE:
        logger.error("aiokafka not available. Install with: pip install aiokafka")
        return

    admin_client = AIOKafkaAdminClient(bootstrap_servers=bootstrap_servers, client_id="nlj-topic-cleanup")

    try:
        await admin_client.start()

        # Get existing NLJ topics
        existing_topics = await admin_client.list_topics()
        nlj_topics = [topic for topic in existing_topics if topic.startswith("nlj.")]

        if not nlj_topics:
            logger.info("No NLJ topics found to delete")
            return

        logger.warning(f"Deleting {len(nlj_topics)} NLJ topics...")

        # Delete topics
        result = await admin_client.delete_topics(nlj_topics)

        for topic_name, future in result.items():
            try:
                await future
                logger.info(f"✓ Deleted topic: {topic_name}")
            except Exception as e:
                logger.error(f"✗ Failed to delete topic {topic_name}: {e}")

    finally:
        await admin_client.close()


def print_topic_summary():
    """Print a summary of all topics that will be created."""

    print("NLJ Training Scheduling - Kafka Topic Architecture")
    print("=" * 60)

    print(f"\nTotal Topics: {len(ALL_TOPICS)}")
    print("Event Retention: 30 days (analytics: 90 days, notifications: 7 days)")
    print("Compression: gzip")

    print("\n📋 TRAINING LIFECYCLE TOPICS:")
    for topic_name, config in TRAINING_TOPICS.items():
        print(f"  • {topic_name}")
        print(f"    {config['description']}")
        print(
            f"    Partitions: {config['partitions']}, Retention: {int(config['config']['retention.ms'])//86400000} days"
        )

    print("\n🎯 ACTIVITY, REVIEW & CONTENT GENERATION TOPICS:")
    for topic_name, config in ACTIVITY_TOPICS.items():
        print(f"  • {topic_name}")
        print(f"    {config['description']}")
        print(
            f"    Partitions: {config['partitions']}, Retention: {int(config['config']['retention.ms'])//86400000} days"
        )


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="NLJ Kafka Topics Management")
    parser.add_argument("--bootstrap-servers", default="localhost:9092", help="Kafka bootstrap servers")
    parser.add_argument(
        "--action", choices=["create", "verify", "delete", "summary"], default="create", help="Action to perform"
    )

    args = parser.parse_args()

    if args.action == "summary":
        print_topic_summary()
        sys.exit(0)

    if args.action == "create":
        print("Creating NLJ Kafka topics...")
        asyncio.run(create_topics(args.bootstrap_servers))
    elif args.action == "verify":
        print("Verifying NLJ Kafka topics...")
        success = asyncio.run(verify_topics(args.bootstrap_servers))
        sys.exit(0 if success else 1)
    elif args.action == "delete":
        print("⚠️  WARNING: This will delete ALL NLJ topics!")
        response = input("Type 'DELETE' to confirm: ")
        if response == "DELETE":
            asyncio.run(delete_all_topics(args.bootstrap_servers))
        else:
            print("Cancelled.")
