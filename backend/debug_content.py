#!/usr/bin/env python3
"""
Debug script to test content API directly.
"""

import asyncio
import uuid
import sys
import os

# Add app to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.services.content import ContentService


async def debug_content():
    """Debug content retrieval."""
    
    # Create database connection
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as db:
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
                    response = ContentResponse.model_validate(content)
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


if __name__ == "__main__":
    asyncio.run(debug_content())