#!/usr/bin/env python3
"""
Start Kafka Consumer Immediately
Runs the consumer to process the 1,550 survey events we generated.
"""

import asyncio
import logging
import signal
import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.append(str(backend_dir))

from app.services.kafka_ralph_consumer import KafkaRalphConsumer
from app.services.kafka_service import KafkaService
from app.services.ralph_lrs_service import RalphLRSService

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


async def run_consumer_with_timeout():
    """Run the consumer for a limited time to process existing events"""
    
    logger.info("🚀 Starting Kafka Consumer for Survey Event Processing")
    logger.info("=" * 60)
    logger.info("Processing 1,550 survey events → Ralph LRS → ElasticSearch")
    
    consumer = None
    try:
        # Initialize services
        kafka_service = KafkaService()
        ralph_service = RalphLRSService()
        
        # Create and start consumer
        consumer = KafkaRalphConsumer(kafka_service, ralph_service)
        
        logger.info("📊 Consumer starting...")
        logger.info("   Source: RedPanda topics")
        logger.info("   Target: Ralph LRS → ElasticSearch")
        logger.info("   Expected: 1,550 survey events to process")
        
        # Start consuming
        consumer_task = asyncio.create_task(consumer.start_consuming())
        
        # Let it run for 60 seconds to process events
        logger.info("⏱️  Processing events for 60 seconds...")
        
        try:
            await asyncio.wait_for(consumer_task, timeout=60.0)
        except asyncio.TimeoutError:
            logger.info("⏰ 60 second timeout reached, stopping consumer")
            
        await consumer.stop_consuming()
        logger.info("✅ Consumer stopped successfully")
        
    except KeyboardInterrupt:
        logger.info("👋 Consumer stopped by user")
        if consumer:
            await consumer.stop_consuming()
    except Exception as e:
        logger.error(f"❌ Consumer error: {e}")
        import traceback
        traceback.print_exc()
        if consumer:
            try:
                await consumer.stop_consuming()
            except:
                pass


async def check_processing_results():
    """Check if the events were processed into ElasticSearch"""
    
    logger.info("\n🔍 Checking Processing Results")
    logger.info("=" * 35)
    
    try:
        from app.services.ralph_lrs_service import RalphLRSService
        
        ralph_service = RalphLRSService()
        survey_id = "00da59a8-af17-4843-8e10-c1827c81e97d"
        
        # Check if our survey data is now available
        analytics_result = await ralph_service.get_survey_analytics(
            survey_id=survey_id,
            limit=100
        )
        
        if analytics_result.get("success"):
            data = analytics_result["data"]
            total_responses = analytics_result.get("total_responses", 0)
            unique_respondents = data.get("overview", {}).get("unique_respondents", 0)
            questions = data.get("questions", {})
            
            logger.info(f"✅ Survey analytics now working!")
            logger.info(f"   Total responses: {total_responses}")
            logger.info(f"   Unique respondents: {unique_respondents}")
            logger.info(f"   Questions analyzed: {len(questions)}")
            
            if questions:
                logger.info(f"   Sample questions processed:")
                for q_id, q_data in list(questions.items())[:3]:
                    logger.info(f"     • {q_id}: {q_data.get('response_count', 0)} responses")
            
            # Test demographics
            dept_result = await ralph_service.get_survey_analytics(
                survey_id=survey_id,
                group_by="department",
                limit=100
            )
            
            if dept_result.get("success"):
                demographics = dept_result["data"].get("demographics", {})
                logger.info(f"   Demographics: {len(demographics)} department groups")
                for dept, stats in list(demographics.items())[:3]:
                    logger.info(f"     • {dept}: {stats.get('total_responses', 0)} responses")
        else:
            logger.info("⚠️  No survey data found yet - events may still be processing")
            
        await ralph_service.close()
        
    except Exception as e:
        logger.error(f"❌ Error checking results: {e}")


async def main():
    """Main execution"""
    
    # Run consumer to process events
    await run_consumer_with_timeout()
    
    # Wait a moment for ElasticSearch indexing
    logger.info("⏳ Waiting 5 seconds for ElasticSearch indexing...")
    await asyncio.sleep(5)
    
    # Check results
    await check_processing_results()
    
    logger.info("\n🎉 Consumer processing completed!")


if __name__ == "__main__":
    asyncio.run(main())