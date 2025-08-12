#!/usr/bin/env python3
"""
Simple test to verify migration script can process files.
"""

import asyncio
import json

# Set PYTHONPATH
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

from scripts.migrate_sample_content import ContentMigrator


async def test_simple():
    migrator = ContentMigrator(dry_run=True)

    print("🧪 Testing content discovery...")
    print(f"Frontend static path: {migrator.frontend_static_path}")

    # Test file discovery
    nlj_dir = migrator.frontend_static_path / "sample_nljs"
    if nlj_dir.exists():
        json_files = list(nlj_dir.glob("*.json"))
        print(f"Found {len(json_files)} NLJ files:")
        for f in json_files:
            print(f"  - {f.name}")

    # Test metadata extraction for one file
    if json_files:
        test_file = json_files[0]
        with open(test_file, "r") as f:
            content_data = json.load(f)

        metadata = migrator.extract_content_metadata(content_data, test_file)
        print(f"\n📋 Sample metadata for {test_file.name}:")
        for key, value in metadata.items():
            print(f"  {key}: {value}")

    print("\n✅ Content discovery test complete!")


if __name__ == "__main__":
    asyncio.run(test_simple())
