from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class SpaceCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: str = Field(..., min_length=2, max_length=100, pattern=r"^[a-z0-9-]+$")
    description: Optional[str] = Field(None, max_length=500)
    max_capacity: int = Field(default=150, ge=2, le=1000)
    proximity_radius: float = Field(default=160.0, ge=30.0, le=800.0)
    boundary_width: int = Field(default=3200, ge=800, le=10000)
    boundary_height: int = Field(default=2400, ge=600, le=10000)
    is_private: bool = False


class SpaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    proximity_radius: Optional[float] = None
    is_private: Optional[bool] = None


class SpaceResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    max_capacity: int
    proximity_radius: float
    boundary_width: int
    boundary_height: int
    is_private: bool
    active_users_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SpaceMemberResponse(BaseModel):
    user_id: str
    username: str
    display_name: str
    avatar_emoji: str
    x: float
    y: float
    last_seen: datetime
