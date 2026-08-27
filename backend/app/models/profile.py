import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, String, Text, JSON
from sqlalchemy.orm import relationship
from app.db.base import Base


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    display_name = Column(String(100), nullable=False)
    avatar_emoji = Column(String(10), default="🚀", nullable=False)
    bio = Column(Text, nullable=True)
    interests = Column(JSON, default=list, nullable=False)  # e.g., ["Python", "FastAPI", "React", "AI", "PostgreSQL"]
    skills = Column(JSON, default=list, nullable=False)
    # Vector embedding representation for pgvector semantic matchmaking (stored as JSON/Vector)
    embedding_json = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", back_populates="profile")
