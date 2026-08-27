import asyncio
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.security import get_password_hash
from app.db.base import Base
from app.db.session import engine, AsyncSessionLocal
from app.models.profile import Profile
from app.models.space import Space
from app.models.user import User

logger = logging.getLogger("virtual_cosmos.init_db")


async def init_db():
    """Initialize database tables, extensions, and seed initial cosmos worlds."""
    async with engine.begin() as conn:
        # If running on PostgreSQL, enable pgvector and postgis extensions
        if not settings.DATABASE_URL.startswith("sqlite"):
            try:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
                logger.info("PostgreSQL extensions (vector, postgis) ensured.")
            except Exception as e:
                logger.warning(f"Could not enable PostgreSQL extensions (may need superuser permissions): {e}")

        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
        logger.info("Database schema tables created successfully.")

    # Seed initial data
    async with AsyncSessionLocal() as session:
        # Check if default space exists
        from sqlalchemy import select
        res = await session.execute(select(Space).where(Space.slug == "alpha-cosmos"))
        if not res.scalar_one_or_none():
            default_space = Space(
                id="default-alpha-cosmos",
                name="Alpha Cosmos Hub",
                slug="alpha-cosmos",
                description="The flagship 2D spatial realm for real-time proximity collaboration, video calls, and AI discovery.",
                max_capacity=150,
                proximity_radius=160.0,
                boundary_width=3200,
                boundary_height=2400,
                is_private=False
            )
            session.add(default_space)

            # Seed demo users for AI matchmaking and spatial demo
            demo_users = [
                {
                    "id": "user-demo-aryans",
                    "email": "aryan@cosmos.io",
                    "username": "aryan_lead",
                    "password": "Password123!",
                    "display_name": "Aryan Singhaniya",
                    "avatar": "👨‍🚀",
                    "bio": "Full-Stack Engineer building high-concurrency FastAPI backends, PostgreSQL pgvector systems, and React interactive interfaces.",
                    "interests": ["Python", "FastAPI", "PostgreSQL", "React", "AI", "pgvector", "WebSockets"],
                    "skills": ["FastAPI", "PostgreSQL", "React", "TypeScript", "Docker", "AWS", "WebSockets", "System Design"]
                },
                {
                    "id": "user-demo-elena",
                    "email": "elena@cosmos.io",
                    "username": "elena_ai",
                    "password": "Password123!",
                    "display_name": "Dr. Elena Rostova",
                    "avatar": "🤖",
                    "bio": "AI Researcher specializing in vector embeddings, semantic RAG systems, and real-time clustering algorithms.",
                    "interests": ["AI", "pgvector", "Machine Learning", "Python", "Vector Databases"],
                    "skills": ["Python", "pgvector", "PyTorch", "FastAPI", "Embeddings"]
                },
                {
                    "id": "user-demo-marcus",
                    "email": "marcus@cosmos.io",
                    "username": "marcus_spatial",
                    "password": "Password123!",
                    "display_name": "Marcus Chen",
                    "avatar": "🛰️",
                    "bio": "Spatial Computing & WebRTC engineer designing low-latency audio/video streaming mesh networks.",
                    "interests": ["WebRTC", "PostGIS", "Spatial Computing", "TypeScript", "React"],
                    "skills": ["React", "WebRTC", "PostGIS", "TypeScript", "TailwindCSS"]
                }
            ]

            for u_data in demo_users:
                user = User(
                    id=u_data["id"],
                    email=u_data["email"],
                    username=u_data["username"],
                    hashed_password=get_password_hash(u_data["password"]),
                    is_active=True
                )
                profile = Profile(
                    id=f"profile-{u_data['id']}",
                    user_id=user.id,
                    display_name=u_data["display_name"],
                    avatar_emoji=u_data["avatar"],
                    bio=u_data["bio"],
                    interests=u_data["interests"],
                    skills=u_data["skills"]
                )
                session.add(user)
                session.add(profile)

            await session.commit()
            logger.info("Default space and demo users seeded.")


if __name__ == "__main__":
    asyncio.run(init_db())
