from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class ChatMessageCreate(BaseModel):
    space_id: str
    recipient_id: Optional[str] = None
    room_key: str = Field(..., description="Unique room or pair identifier")
    content: str = Field(..., min_length=1, max_length=2000)
    message_type: str = Field("text", description="text, sticker, or system")


class ChatMessageResponse(BaseModel):
    id: str
    space_id: str
    sender_id: str
    sender_username: Optional[str] = None
    sender_display_name: Optional[str] = None
    sender_avatar: Optional[str] = None
    recipient_id: Optional[str] = None
    room_key: str
    content: str
    message_type: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
