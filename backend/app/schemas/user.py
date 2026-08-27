from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr


class ProfileResponse(BaseModel):
    id: str
    user_id: str
    display_name: str
    avatar_emoji: str
    bio: Optional[str] = None
    interests: List[str] = []
    skills: List[str] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    avatar_emoji: Optional[str] = None
    bio: Optional[str] = None
    interests: Optional[List[str]] = None
    skills: Optional[List[str]] = None


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    username: str
    is_active: bool
    created_at: datetime
    profile: Optional[ProfileResponse] = None

    model_config = ConfigDict(from_attributes=True)
