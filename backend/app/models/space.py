import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import relationship
from app.db.base import Base


class Space(Base):
    __tablename__ = "spaces"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    max_capacity = Column(Integer, default=150, nullable=False)
    proximity_radius = Column(Float, default=160.0, nullable=False)
    boundary_width = Column(Integer, default=3200, nullable=False)
    boundary_height = Column(Integer, default=2400, nullable=False)
    is_private = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    positions = relationship("UserPosition", back_populates="space", cascade="all, delete-orphan", lazy="selectin")
    messages = relationship("ChatMessage", back_populates="space", cascade="all, delete-orphan")
