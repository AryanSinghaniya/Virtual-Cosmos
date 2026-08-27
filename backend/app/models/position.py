import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, String
from sqlalchemy.orm import relationship
from app.db.base import Base


class UserPosition(Base):
    __tablename__ = "user_positions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    space_id = Column(String(36), ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False, index=True)
    x = Column(Float, default=400.0, nullable=False)
    y = Column(Float, default=300.0, nullable=False)
    last_seen = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", back_populates="positions")
    space = relationship("Space", back_populates="positions")

    __table_args__ = (
        Index("idx_user_space_pos", "space_id", "user_id", unique=True),
        Index("idx_spatial_coords", "space_id", "x", "y"),
    )
