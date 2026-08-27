import math
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.api.v1.deps import get_current_user
from app.core.config import settings
from app.core.rate_limiter import limiter
from app.db.session import get_db
from app.models.chat import ChatMessage
from app.models.user import User
from app.schemas.chat import ChatMessageCreate, ChatMessageResponse
from app.schemas.common import PaginatedResponse, PaginationMeta, ResponseEnvelope

router = APIRouter(prefix="/chat", tags=["Chat & Message History"])


@router.get("/history", response_model=PaginatedResponse[ChatMessageResponse])
async def get_chat_history(
    room_key: str = Query(..., description="Proximity room key or space channel"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(30, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve paginated chat message history for a proximity room or space.
    Uses composite index on (room_key, created_at) for sub-millisecond queries.
    """
    # Count total
    count_query = select(func.count(ChatMessage.id)).where(ChatMessage.room_key == room_key)
    count_res = await db.execute(count_query)
    total_items = count_res.scalar_one()

    # Query items ordered by created_at desc, then reversed for timeline
    offset = (page - 1) * limit
    msg_query = (
        select(ChatMessage)
        .options(selectinload(ChatMessage.sender).selectinload(User.profile))
        .where(ChatMessage.room_key == room_key)
        .order_by(ChatMessage.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    res = await db.execute(msg_query)
    messages = res.scalars().all()

    items = []
    for m in messages:
        sender_p = m.sender.profile if m.sender and m.sender.profile else None
        items.append(
            ChatMessageResponse(
                id=m.id,
                space_id=m.space_id,
                sender_id=m.sender_id,
                sender_username=m.sender.username if m.sender else "Unknown",
                sender_display_name=sender_p.display_name if sender_p else (m.sender.username if m.sender else "User"),
                sender_avatar=sender_p.avatar_emoji if sender_p else "🚀",
                recipient_id=m.recipient_id,
                room_key=m.room_key,
                content=m.content,
                message_type=m.message_type,
                created_at=m.created_at
            )
        )

    # Sort chronological
    items.reverse()
    total_pages = math.ceil(total_items / limit) if total_items > 0 else 1

    return PaginatedResponse(
        items=items,
        meta=PaginationMeta(
            total_items=total_items,
            total_pages=total_pages,
            current_page=page,
            limit=limit,
            has_next=page < total_pages,
            has_prev=page > 1
        )
    )


@router.post("", response_model=ResponseEnvelope[ChatMessageResponse], status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.RATE_LIMIT_CHAT)
async def send_message(
    request: Request,
    msg_in: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Store and persist a proximity or space chat message."""
    chat_msg = ChatMessage(
        id=str(uuid.uuid4()),
        space_id=msg_in.space_id,
        sender_id=current_user.id,
        recipient_id=msg_in.recipient_id,
        room_key=msg_in.room_key,
        content=msg_in.content,
        message_type=msg_in.message_type
    )
    db.add(chat_msg)
    await db.commit()
    await db.refresh(chat_msg)

    profile = current_user.profile
    resp = ChatMessageResponse(
        id=chat_msg.id,
        space_id=chat_msg.space_id,
        sender_id=chat_msg.sender_id,
        sender_username=current_user.username,
        sender_display_name=profile.display_name if profile else current_user.username,
        sender_avatar=profile.avatar_emoji if profile else "🚀",
        recipient_id=chat_msg.recipient_id,
        room_key=chat_msg.room_key,
        content=chat_msg.content,
        message_type=chat_msg.message_type,
        created_at=chat_msg.created_at
    )

    return ResponseEnvelope(
        success=True,
        data=resp,
        message="Message stored successfully."
    )
