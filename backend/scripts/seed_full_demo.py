#!/usr/bin/env python3
"""
Full Demo Seeding Script - Comprehensive Clean Architecture Implementation.

Creates comprehensive demo data including all static files, demo users,
training programs, and sample content. Perfect for development and testing.

Usage:
    python scripts/seed_full_demo.py [--clear-first]
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
    """Full demo seeding entry point."""
    logger.info("🚀 Starting Full Demo Data Seeding")
    
    # Check if clear-first was requested
    clear_flag = "--clear-first" if "--clear-first" in sys.argv else ""
    
    # Override args to use full mode
    args = ["seed_full_demo.py", "--mode", "full"]
    if clear_flag:
        args.append(clear_flag)
    
    sys.argv = args
    
    # Use the modern seeder with full mode
    return await modern_main()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)