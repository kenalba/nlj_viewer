#!/usr/bin/env python3
"""
Essential Data Seeding Script - Minimal Clean Architecture Implementation.

Creates only the essential users and basic content required for system operation.
Perfect for production environments or minimal development setups.

Usage:
    python scripts/seed_essential_only.py
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.seed_database_modern import main as modern_main
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


async def main():
    """Essential seeding entry point."""
    logger.info("🌱 Starting Essential Data Seeding")
    
    # Override args to use essential mode
    sys.argv = ["seed_essential_only.py", "--mode", "essential"]
    
    # Use the modern seeder with essential mode
    return await modern_main()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)