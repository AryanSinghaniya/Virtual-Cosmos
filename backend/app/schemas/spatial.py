from typing import List, Optional
from pydantic import BaseModel, Field


class PositionUpdate(BaseModel):
    space_id: str
    x: float = Field(..., ge=0)
    y: float = Field(..., ge=0)


class ProximityQuery(BaseModel):
    space_id: str
    x: float
    y: float
    radius: Optional[float] = None


class NearbyUserResponse(BaseModel):
    user_id: str
    username: str
    display_name: str
    avatar_emoji: str
    x: float
    y: float
    distance: float
    is_in_proximity: bool


class SpatialStatsResponse(BaseModel):
    space_id: str
    total_active_users: int
    proximity_clusters_count: int
    avg_crowd_density: float
