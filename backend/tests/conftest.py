import pytest
import pytest_asyncio
from app.db.init_db import init_db


@pytest_asyncio.fixture(autouse=True, scope="session")
async def setup_test_database():
    """Ensure database schema is created and initial seed data is loaded before running tests."""
    await init_db()
