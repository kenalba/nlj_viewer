#!/usr/bin/env python3
"""
Database Reseed Script - Complete Clean Architecture Implementation.

Clears all existing seeded data and recreates everything from scratch.
Perfect for resetting development environments.

Usage:
    python scripts/reseed_database.py [--mode essential|demo|full]
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
    """Reseed entry point."""
    logger.info("🔄 Starting Database Reseed Operation")
    
    # Extract mode from arguments or default to demo
    mode = "demo"
    if "--mode" in sys.argv:
        mode_index = sys.argv.index("--mode")
        if mode_index + 1 < len(sys.argv):
            mode = sys.argv[mode_index + 1]
    
    # Override args to clear first and use specified mode
    sys.argv = ["reseed_database.py", "--mode", mode, "--clear-first"]
    
    logger.info(f"🧹 Will clear existing data and reseed with mode: {mode}")
    
    # Use the modern seeder with clear-first flag
    return await modern_main()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)