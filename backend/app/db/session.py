import os
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool, QueuePool
from app.core.config import settings
import logging

logger = logging.getLogger("virtual_cosmos.db")

# Determine DB URI
db_url = settings.DATABASE_URL
is_sqlite = db_url.startswith("sqlite")

# Engine options
engine_kwargs = {
    "echo": settings.DEBUG,
    "future": True,
}

if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    engine_kwargs["poolclass"] = NullPool
else:
    engine_kwargs["pool_size"] = 20
    engine_kwargs["max_overflow"] = 10
    engine_kwargs["pool_pre_ping"] = True

try:
    engine = create_async_engine(db_url, **engine_kwargs)
except Exception as e:
    logger.warning(f"Failed to initialize primary database '{db_url}': {e}. Falling back to SQLite.")
    db_url = settings.DATABASE_URL_FALLBACK
    engine = create_async_engine(
        db_url,
        echo=settings.DEBUG,
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=NullPool
    )

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for yielding asynchronous database sessions."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
