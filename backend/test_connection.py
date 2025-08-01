#!/usr/bin/env python3
import asyncio
import asyncpg

async def test_connection():
    try:
        conn = await asyncpg.connect('postgresql://nlj_user:nlj_pass@localhost:5432/nlj_platform')
        print("✅ Connection successful!")
        await conn.close()
    except Exception as e:
        print(f"❌ Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_connection())