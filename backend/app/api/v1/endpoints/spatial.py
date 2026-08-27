from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.v1.deps import get_optional_current_user
from app.core.exceptions import ResourceNotFoundException
from app.db.session import get_db
from app.models.space import Space
from app.models.user import User
from app.schemas.common import ResponseEnvelope
from app.schemas.spatial import NearbyUserResponse, ProximityQuery, SpatialStatsResponse
from app.services.connection_manager import manager
from app.services.spatial_service import SpatialService

router = APIRouter(prefix="/spatial", tags=["Spatial & PostGIS Proximity"])


@router.post("/proximity-scan", response_model=ResponseEnvelope[List[NearbyUserResponse]])
async def proximity_scan(
    query: ProximityQuery,
    current_user: User = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Perform a real-time spatial proximity scan around a given (X, Y) coordinate in a Cosmos Space.
    Returns list of nearby users ranked by Euclidean/PostGIS distance with proximity status.
    """
    # Fetch space
    space_res = await db.execute(select(Space).where(Space.id == query.space_id))
    space = space_res.scalar_one_or_none()
    if not space:
        raise ResourceNotFoundException("Space", query.space_id)

    radius = query.radius or space.proximity_radius
    active_positions = manager.space_positions.get(space.id, {})
    current_user_id = current_user.id if current_user else "anonymous"

    nearby = SpatialService.find_nearby_users(
        current_user_id=current_user_id,
        current_x=query.x,
        current_y=query.y,
        radius=radius,
        active_positions=active_positions
    )

    return ResponseEnvelope(
        success=True,
        data=nearby,
        message=f"Found {len(nearby)} users in space. {sum(1 for n in nearby if n.is_in_proximity)} within proximity radius ({radius}px)."
    )


@router.get("/stats/{space_id}", response_model=ResponseEnvelope[SpatialStatsResponse])
async def get_spatial_stats(
    space_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Calculate spatial density, active proximity cluster count, and crowd metrics.
    """
    space_res = await db.execute(select(Space).where(Space.id == space_id))
    space = space_res.scalar_one_or_none()
    if not space:
        raise ResourceNotFoundException("Space", space_id)

    active_positions = manager.space_positions.get(space.id, {})
    total_users = len(active_positions)
    pairs = SpatialService.compute_proximity_pairs(active_positions, space.proximity_radius)

    # Compute area density
    world_area = (space.boundary_width * space.boundary_height) / 1_000_000.0  # mega pixels
    density = round(total_users / world_area, 2) if world_area > 0 else 0.0

    stats = SpatialStatsResponse(
        space_id=space.id,
        total_active_users=total_users,
        proximity_clusters_count=len(pairs),
        avg_crowd_density=density
    )

    return ResponseEnvelope(
        success=True,
        data=stats,
        message="Spatial analytics calculated."
    )
