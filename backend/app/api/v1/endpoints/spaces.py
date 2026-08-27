import math
import uuid
from typing import List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.api.v1.deps import get_current_user
from app.core.exceptions import ConflictException, ResourceNotFoundException
from app.db.session import get_db
from app.models.space import Space
from app.models.user import User
from app.schemas.common import PaginatedResponse, PaginationMeta, ResponseEnvelope
from app.schemas.space import SpaceCreate, SpaceMemberResponse, SpaceResponse, SpaceUpdate
from app.services.connection_manager import manager

router = APIRouter(prefix="/spaces", tags=["Cosmos Spaces"])


@router.get("", response_model=PaginatedResponse[SpaceResponse])
async def list_spaces(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve paginated list of active Virtual Cosmos spaces."""
    # Count total spaces
    count_query = select(func.count(Space.id))
    total_result = await db.execute(count_query)
    total_items = total_result.scalar_one()

    # Query with offset & limit
    offset = (page - 1) * limit
    spaces_query = select(Space).order_by(Space.created_at.desc()).offset(offset).limit(limit)
    res = await db.execute(spaces_query)
    spaces = res.scalars().all()

    # Populate live active users count from WebSocket connection manager
    space_responses = []
    for s in spaces:
        active_count = len(manager.get_online_users(s.id))
        resp = SpaceResponse(
            id=s.id,
            name=s.name,
            slug=s.slug,
            description=s.description,
            max_capacity=s.max_capacity,
            proximity_radius=s.proximity_radius,
            boundary_width=s.boundary_width,
            boundary_height=s.boundary_height,
            is_private=s.is_private,
            active_users_count=active_count,
            created_at=s.created_at
        )
        space_responses.append(resp)

    total_pages = math.ceil(total_items / limit) if total_items > 0 else 1

    return PaginatedResponse(
        items=space_responses,
        meta=PaginationMeta(
            total_items=total_items,
            total_pages=total_pages,
            current_page=page,
            limit=limit,
            has_next=page < total_pages,
            has_prev=page > 1
        )
    )


@router.post("", response_model=ResponseEnvelope[SpaceResponse], status_code=status.HTTP_201_CREATED)
async def create_space(
    space_in: SpaceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new virtual cosmos world/space with custom boundaries and proximity radius."""
    # Check if slug exists
    res = await db.execute(select(Space).where(Space.slug == space_in.slug))
    if res.scalar_one_or_none():
        raise ConflictException(f"A space with slug '{space_in.slug}' already exists.")

    space = Space(
        id=str(uuid.uuid4()),
        name=space_in.name,
        slug=space_in.slug,
        description=space_in.description,
        max_capacity=space_in.max_capacity,
        proximity_radius=space_in.proximity_radius,
        boundary_width=space_in.boundary_width,
        boundary_height=space_in.boundary_height,
        is_private=space_in.is_private
    )
    db.add(space)
    await db.commit()
    await db.refresh(space)

    return ResponseEnvelope(
        success=True,
        data=SpaceResponse.model_validate(space),
        message="Space created successfully."
    )


@router.get("/{space_id_or_slug}", response_model=ResponseEnvelope[SpaceResponse])
async def get_space(
    space_id_or_slug: str,
    db: AsyncSession = Depends(get_db)
):
    """Get space metadata and dimensions by ID or URL slug."""
    query = select(Space).where((Space.id == space_id_or_slug) | (Space.slug == space_id_or_slug))
    res = await db.execute(query)
    space = res.scalar_one_or_none()

    if not space:
        raise ResourceNotFoundException("Space", space_id_or_slug)

    active_count = len(manager.get_online_users(space.id))
    resp = SpaceResponse(
        id=space.id,
        name=space.name,
        slug=space.slug,
        description=space.description,
        max_capacity=space.max_capacity,
        proximity_radius=space.proximity_radius,
        boundary_width=space.boundary_width,
        boundary_height=space.boundary_height,
        is_private=space.is_private,
        active_users_count=active_count,
        created_at=space.created_at
    )

    return ResponseEnvelope(
        success=True,
        data=resp,
        message="Space retrieved."
    )
