#!/usr/bin/env python3
"""
Database Seeding Script - Clean Architecture Implementation.

Modernized seeding script that uses our Clean Architecture seed services.
Provides comprehensive database initialization with proper error handling.

Usage:
    python scripts/seed_database.py [--mode essential|demo|full] [--clear-first]

Examples:
    python scripts/seed_database.py                    # Demo mode (default)
    python scripts/seed_database.py --mode essential   # Essential users only
    python scripts/seed_database.py --mode full        # Full demo with static files
    python scripts/seed_database.py --clear-first      # Clear existing data first
    python scripts/seed_database.py --status-only      # Show current status
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.seed_database_modern import main as modern_main


async def main():
    """Main seeding script entry point - delegates to modern implementation."""
    # Simply delegate to our modern seeder with all the same functionality
    return await modern_main()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)