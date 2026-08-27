import json
import logging
from typing import Optional
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from app.core.security import decode_token
from app.services.connection_manager import manager

logger = logging.getLogger("virtual_cosmos.ws_router")
router = APIRouter(tags=["Real-Time WebSockets & Multiplayer"])


@router.websocket("/ws/cosmos/{space_id}")
async def cosmos_websocket_endpoint(
    websocket: WebSocket,
    space_id: str,
    token: Optional[str] = Query(None),
    guest_name: Optional[str] = Query(None),
    guest_avatar: Optional[str] = Query("🚀"),
    x: Optional[float] = Query(400.0),
    y: Optional[float] = Query(300.0)
):
    """
    Asynchronous WebSocket endpoint for real-time Cosmos multiplayer:
    - Live 60fps avatar movement synchronization
    - Sub-millisecond proximity detection and peer roster updates
    - Peer-to-peer WebRTC video/audio call signaling (offers, answers, ICE candidates)
    - Proximity-based chat message streaming
    """
    user_id = None
    user_info = {
        "x": x,
        "y": y,
        "username": guest_name or "Guest Explorer",
        "display_name": guest_name or "Guest Explorer",
        "avatar_emoji": guest_avatar or "🚀",
        "interests": ["Python", "FastAPI", "React", "Spatial Computing"],
        "skills": ["Fullstack", "WebSockets"]
    }

    # Authenticate token if present
    if token:
        payload = decode_token(token)
        if payload and payload.get("sub"):
            user_id = payload.get("sub")
            user_info["username"] = payload.get("username", user_info["username"])
            user_info["display_name"] = payload.get("display_name", user_info["display_name"])
            user_info["avatar_emoji"] = payload.get("avatar_emoji", user_info["avatar_emoji"])

    if not user_id:
        import uuid
        user_id = f"guest_{str(uuid.uuid4())[:8]}"

    await manager.connect(
        websocket=websocket,
        space_id=space_id,
        user_id=user_id,
        user_info=user_info
    )

    try:
        while True:
            raw_text = await websocket.receive_text()
            data = json.loads(raw_text)
            event_type = data.get("type")

            if event_type == "user:move":
                new_x = float(data.get("x", 400.0))
                new_y = float(data.get("y", 300.0))
                await manager.update_position(space_id, user_id, new_x, new_y)

            elif event_type == "chat:send":
                payload = {
                    "type": "chat:message",
                    "id": data.get("id"),
                    "space_id": space_id,
                    "sender_id": user_id,
                    "sender_username": user_info.get("username"),
                    "sender_display_name": user_info.get("display_name"),
                    "sender_avatar": user_info.get("avatar_emoji"),
                    "recipient_id": data.get("recipient_id"),
                    "room_key": data.get("room_key", "space:global"),
                    "content": data.get("content", ""),
                    "message_type": data.get("message_type", "text"),
                    "created_at": data.get("created_at")
                }
                await manager.relay_chat_message(space_id, user_id, payload)

            elif event_type in ("webrtc:offer", "webrtc:answer", "webrtc:candidate", "webrtc:call-user", "webrtc:hangup"):
                # Forward WebRTC signaling to recipient peer
                await manager.relay_webrtc_signal(space_id, user_id, data)

            elif event_type == "ping":
                await manager.send_personal_message({"type": "pong"}, websocket)

    except WebSocketDisconnect:
        await manager.disconnect(space_id, user_id)
        logger.info(f"User {user_id} disconnected from space {space_id}")
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        await manager.disconnect(space_id, user_id)
