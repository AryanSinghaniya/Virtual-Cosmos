import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import relationship
from app.db.base import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    space_id = Column(String(36), ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    recipient_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # room_key is e.g. "proximity:user1_id:user2_id" or "space:space_id:global"
    room_key = Column(String(100), nullable=False, index=True)
    content = Column(Text, nullable=False)
    message_type = Column(String(20), default="text", nullable=False)  # "text", "sticker", "system"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    # Relationships
    space = relationship("Space", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_messages")
    recipient = relationship("User", foreign_keys=[recipient_id])

    __table_args__ = (
        Index("idx_room_created", "room_key", "created_at"),
        Index("idx_space_room", "space_id", "room_key"),
    )
