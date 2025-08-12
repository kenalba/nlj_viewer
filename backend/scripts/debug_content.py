#!/usr/bin/env python3
"""
Debug script to test content API directly.
"""

import asyncio
import os
import sys
import uuid

# Add app to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from app.core.database_manager import db_manager
from app.services.content import ContentService


async def debug_content():
    """Debug content retrieval."""
    print("🔍 Detecting database configuration...")

    # Initialize database manager (handles both RDS and direct PostgreSQL)
    await db_manager.initialize()

    connection_info = db_manager.get_connection_info()
    print(f"📊 Connected to: {'RDS' if connection_info.get('use_rds') else 'Direct PostgreSQL'}")

    async with db_manager.get_session() as db:
        service = ContentService(db)

        # Test ID that was failing
        content_id = uuid.UUID("90e722b1-9a47-4df0-8e87-2bb74a28eb30")

        try:
            print(f"Fetching content with ID: {content_id}")
            content = await service.get_content_by_id(content_id)

            if content:
                print("Content found!")
                print(f"Title: {content.title}")
                print(f"Description: {content.description}")
                print(f"Content Type: {content.content_type}")
                print(f"State: {content.state}")
                print(f"NLJ Data Keys: {list(content.nlj_data.keys()) if content.nlj_data else 'None'}")

                # Try to create response model
                from app.schemas.content import ContentResponse

                try:
                    ContentResponse.model_validate(content)
                    print("Schema validation successful!")
                except Exception as e:
                    print(f"Schema validation failed: {e}")
                    print(f"Content attributes: {dir(content)}")

            else:
                print("Content not found!")

        except Exception as e:
            print(f"Error fetching content: {e}")
            import traceback

            traceback.print_exc()
        finally:
            await db_manager.close()


if __name__ == "__main__":
    asyncio.run(debug_content())
