import math
import uuid
import time
from typing import Dict, Any, Set, List, Optional
import socketio
from app.services.spatial_service import SpatialService

# Socket.IO Async Server instance
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    ping_interval=25,
    ping_timeout=30,
    logger=False,
    engineio_logger=False
)

WORLD_WIDTH = 1800
WORLD_HEIGHT = 1200
PROXIMITY_RADIUS = 180
EFFECTIVE_PROXIMITY_RADIUS = 240
SERVER_WORLD_BROADCAST_INTERVAL_SEC = 0.033

ALLOWED_AVATARS = {"🧑‍🚀", "👩‍🚀", "🛸", "🤖", "🐱", "🦊", "🐼", "🐸", "🚀", "👨‍🚀"}
ALLOWED_STICKERS = {"😀", "😎", "🔥", "✨", "💯", "👋", "🎉", "🚀", "💫", "❤️"}
ALLOWED_CHANNELS = {"general-chat", "doubts-discussion", "design-room"}

ROOM_ZONES = [
    {"id": "room-main", "name": "🏛️ Main Stage & Keynote", "x": 60, "y": 60, "w": 760, "h": 540},
    {"id": "room-1", "name": "🎨 Design & AI Hub", "x": 880, "y": 60, "w": 420, "h": 260},
    {"id": "room-2", "name": "💻 Dev & Engineering", "x": 1340, "y": 60, "w": 400, "h": 260},
    {"id": "room-3", "name": "☕ Networking Lounge", "x": 880, "y": 350, "w": 860, "h": 250},
    {"id": "room-plaza", "name": "🌟 Community Plaza & Roundtable", "x": 60, "y": 640, "w": 1680, "h": 500},
]

users_by_sid: Dict[str, Dict[str, Any]] = {}
last_world_broadcast_at: float = 0.0


def clamp(value: float, min_val: float, max_val: float) -> float:
    return max(min_val, min(max_val, value))


def normalize_name(name: Optional[str]) -> str:
    cleaned = (name or "").strip()
    if not cleaned:
        import random
        return f"Pilot-{random.randint(1000, 9999)}"
    return cleaned[:24]


def normalize_avatar(value: Optional[str]) -> str:
    cand = (value or "").strip()
    if cand in ALLOWED_AVATARS:
        return cand
    return "🧑‍🚀"


def normalize_position(pos: Optional[Dict[str, Any]]) -> Dict[str, float]:
    import random
    cx = WORLD_WIDTH / 2
    cy = WORLD_HEIGHT / 2
    rx = cx + (random.random() - 0.5) * 300
    ry = cy + (random.random() - 0.5) * 220
    px = pos.get("x", rx) if pos else rx
    py = pos.get("y", ry) if pos else ry
    return {
        "x": clamp(float(px), 20, WORLD_WIDTH - 20),
        "y": clamp(float(py), 20, WORLD_HEIGHT - 20)
    }


def serialize_user(u: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "socketId": u["socketId"],
        "userId": u["userId"],
        "name": u["name"],
        "avatarEmoji": u["avatarEmoji"],
        "x": u["x"],
        "y": u["y"],
        "roomId": u.get("roomId", ""),
        "roomName": u.get("roomName", ""),
    }


def list_users() -> List[Dict[str, Any]]:
    return [serialize_user(u) for u in users_by_sid.values()]


def pair_key(u1: str, u2: str) -> str:
    return ":".join(sorted([u1, u2]))


def socket_room_for_pair(u1: str, u2: str) -> str:
    return f"pair:{pair_key(u1, u2)}"


def socket_room_for_zone(zone_id: str) -> str:
    return f"room:{zone_id}"


def resolve_room_from_position(x: float, y: float) -> Optional[Dict[str, Any]]:
    for zone in ROOM_ZONES:
        if zone["x"] <= x <= zone["x"] + zone["w"] and zone["y"] <= y <= zone["y"] + zone["h"]:
            return zone
    return None


def get_user_by_user_id(uid: str) -> Optional[Dict[str, Any]]:
    for u in users_by_sid.values():
        if u["userId"] == uid:
            return u
    return None


def distance_between(u1: Dict[str, Any], u2: Dict[str, Any]) -> float:
    return math.hypot(u1["x"] - u2["x"], u1["y"] - u2["y"])


async def emit_world_update(force: bool = False):
    global last_world_broadcast_at
    now = time.time()
    if not force and (now - last_world_broadcast_at < SERVER_WORLD_BROADCAST_INTERVAL_SEC):
        return
    last_world_broadcast_at = now
    await sio.emit("world:update", {"users": list_users()})


async def emit_connections_for_user(user: Dict[str, Any]):
    sid = user["socketId"]
    active_connections_by_peer: Dict[str, Dict[str, Any]] = {}

    # Room zone connections
    if user.get("roomId"):
        room_members = [
            c for c in users_by_sid.values()
            if c["socketId"] != user["socketId"] and c.get("roomId") == user["roomId"]
        ]
        for peer in room_members:
            active_connections_by_peer[peer["userId"]] = {
                "roomId": socket_room_for_zone(user["roomId"]),
                "roomName": user.get("roomName", ""),
                "peerUserId": peer["userId"],
                "peerName": peer["name"],
                "peerAvatarEmoji": peer["avatarEmoji"],
                "roomMemberCount": len(room_members) + 1,
                "linkType": "room"
            }

    # Proximity radius connections
    for peer_uid in user["proximityPeerIds"]:
        if peer_uid in active_connections_by_peer:
            continue
        peer = get_user_by_user_id(peer_uid)
        if not peer:
            continue
        active_connections_by_peer[peer_uid] = {
            "roomId": socket_room_for_pair(user["userId"], peer_uid),
            "roomName": "Nearby",
            "peerUserId": peer["userId"],
            "peerName": peer["name"],
            "peerAvatarEmoji": peer["avatarEmoji"],
            "roomMemberCount": 2,
            "linkType": "radius"
        }

    await sio.emit(
        "connections:update",
        {"activeConnections": list(active_connections_by_peer.values())},
        to=sid
    )


async def connect_proximity_pair(user_a: Dict[str, Any], user_b: Dict[str, Any]) -> bool:
    if user_b["userId"] in user_a["proximityPeerIds"]:
        return False
    user_a["proximityPeerIds"].add(user_b["userId"])
    user_b["proximityPeerIds"].add(user_a["userId"])

    pair_room = socket_room_for_pair(user_a["userId"], user_b["userId"])
    await sio.enter_room(user_a["socketId"], pair_room)
    await sio.enter_room(user_b["socketId"], pair_room)
    return True


async def disconnect_proximity_pair(user_a: Dict[str, Any], user_b: Dict[str, Any]) -> bool:
    if user_b["userId"] not in user_a["proximityPeerIds"]:
        return False
    user_a["proximityPeerIds"].remove(user_b["userId"])
    user_b["proximityPeerIds"].remove(user_a["userId"])

    pair_room = socket_room_for_pair(user_a["userId"], user_b["userId"])
    await sio.leave_room(user_a["socketId"], pair_room)
    await sio.leave_room(user_b["socketId"], pair_room)
    return True


async def sync_proximity_for_user(user: Dict[str, Any]) -> bool:
    did_change = False
    for other in list(users_by_sid.values()):
        if other["socketId"] == user["socketId"]:
            continue
        in_range = distance_between(user, other) < EFFECTIVE_PROXIMITY_RADIUS
        if in_range:
            changed = await connect_proximity_pair(user, other)
            if changed:
                did_change = True
        else:
            changed = await disconnect_proximity_pair(user, other)
            if changed:
                did_change = True
    return did_change


async def sync_room_membership(user: Dict[str, Any]) -> bool:
    sid = user["socketId"]
    next_room = resolve_room_from_position(user["x"], user["y"])
    next_room_id = next_room["id"] if next_room else ""
    prev_room_id = user.get("roomId", "")

    if prev_room_id and prev_room_id != next_room_id:
        await sio.leave_room(sid, socket_room_for_zone(prev_room_id))

    if next_room_id and next_room_id != prev_room_id:
        await sio.enter_room(sid, socket_room_for_zone(next_room_id))

    room_changed = prev_room_id != next_room_id
    user["roomId"] = next_room_id
    user["roomName"] = next_room["name"] if next_room else ""
    return room_changed


async def emit_connections_for_all_users():
    for u in list(users_by_sid.values()):
        await emit_connections_for_user(u)


async def relay_rtc_event(event_name: str, sid: str, payload: Dict[str, Any]):
    sender = users_by_sid.get(sid)
    if not sender:
        return

    room_id = str(payload.get("roomId") or "")
    target_uid = str(payload.get("targetUserId") or "")
    if not room_id or not target_uid:
        return

    target_user = get_user_by_user_id(target_uid)
    if not target_user:
        return

    await sio.emit(
        event_name,
        {
            "roomId": room_id,
            "fromUserId": sender["userId"],
            "fromName": sender["name"],
            "fromAvatarEmoji": sender["avatarEmoji"],
            "sdp": payload.get("sdp"),
            "candidate": payload.get("candidate"),
        },
        to=target_user["socketId"]
    )


# =========================================================
# Socket.IO Event Handlers
# =========================================================

@sio.event
async def connect(sid, environ, auth=None):
    pass


@sio.event
async def disconnect(sid, *args):
    user = users_by_sid.pop(sid, None)
    if not user:
        return

    # Clean up proximity
    for peer_uid in list(user.get("proximityPeerIds", set())):
        peer = get_user_by_user_id(peer_uid)
        if peer:
            peer.get("proximityPeerIds", set()).discard(user["userId"])
            pair_room = socket_room_for_pair(user["userId"], peer["userId"])
            await sio.leave_room(peer["socketId"], pair_room)

    await emit_connections_for_all_users()
    await emit_world_update(force=True)


@sio.on("user:register")
async def handle_user_register(sid, payload=None):
    payload = payload or {}
    name = normalize_name(payload.get("name"))
    avatar = normalize_avatar(payload.get("avatarEmoji"))
    pos = normalize_position(payload.get("position"))

    user = {
        "socketId": sid,
        "userId": str(uuid.uuid4()),
        "name": name,
        "avatarEmoji": avatar,
        "x": pos["x"],
        "y": pos["y"],
        "roomId": "",
        "roomName": "",
        "proximityPeerIds": set(),
    }

    users_by_sid[sid] = user
    await sync_room_membership(user)
    await sync_proximity_for_user(user)

    await sio.emit(
        "world:init",
        {
            "you": serialize_user(user),
            "users": list_users(),
            "world": {"width": WORLD_WIDTH, "height": WORLD_HEIGHT},
            "radius": EFFECTIVE_PROXIMITY_RADIUS,
            "roomZones": ROOM_ZONES,
        },
        to=sid
    )

    await emit_connections_for_all_users()
    await emit_world_update(force=True)
    return {"ok": True, "userId": user["userId"]}


@sio.on("user:move")
async def handle_user_move(sid, payload=None):
    user = users_by_sid.get(sid)
    if not user or not payload:
        return

    x = clamp(float(payload.get("x", user["x"])), 20, WORLD_WIDTH - 20)
    y = clamp(float(payload.get("y", user["y"])), 20, WORLD_HEIGHT - 20)

    if math.hypot(x - user["x"], y - user["y"]) < 0.05:
        return

    user["x"] = x
    user["y"] = y

    room_changed = await sync_room_membership(user)
    prox_changed = await sync_proximity_for_user(user)

    if room_changed or prox_changed:
        await emit_connections_for_all_users()

    await emit_world_update()


@sio.on("chat:send")
async def handle_chat_send(sid, payload=None):
    user = users_by_sid.get(sid)
    if not user or not payload:
        return

    room_id = str(payload.get("roomId", ""))
    channel = str(payload.get("channel", "general-chat"))
    if channel not in ALLOWED_CHANNELS:
        channel = "general-chat"

    msg_type = "sticker" if payload.get("type") == "sticker" else "text"
    text = str(payload.get("text", "")).strip()[:280]

    if not room_id or not text:
        return

    from datetime import datetime, timezone
    await sio.emit(
        "chat:message",
        {
            "roomId": room_id,
            "channel": channel,
            "type": msg_type,
            "text": text,
            "senderUserId": user["userId"],
            "senderName": user["name"],
            "senderAvatarEmoji": user["avatarEmoji"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        room=room_id
    )


@sio.on("rtc:offer")
async def handle_rtc_offer(sid, payload=None):
    await relay_rtc_event("rtc:offer", sid, payload or {})


@sio.on("rtc:call-request")
async def handle_rtc_call_request(sid, payload=None):
    await relay_rtc_event("rtc:call-request", sid, payload or {})


@sio.on("rtc:call-accept")
async def handle_rtc_call_accept(sid, payload=None):
    await relay_rtc_event("rtc:call-accept", sid, payload or {})


@sio.on("rtc:call-reject")
async def handle_rtc_call_reject(sid, payload=None):
    await relay_rtc_event("rtc:call-reject", sid, payload or {})


@sio.on("rtc:answer")
async def handle_rtc_answer(sid, payload=None):
    await relay_rtc_event("rtc:answer", sid, payload or {})


@sio.on("rtc:ice-candidate")
async def handle_rtc_ice_candidate(sid, payload=None):
    await relay_rtc_event("rtc:ice-candidate", sid, payload or {})


@sio.on("rtc:hangup")
async def handle_rtc_hangup(sid, payload=None):
    await relay_rtc_event("rtc:hangup", sid, payload or {})


@sio.on("rtc:group-join")
async def handle_rtc_group_join(sid, payload=None):
    user = users_by_sid.get(sid)
    if not user or not payload:
        return
    room_id = str(payload.get("roomId", ""))
    if not room_id:
        return

    await sio.emit(
        "rtc:user-joined",
        {
            "roomId": room_id,
            "userId": user["userId"],
            "name": user["name"],
            "avatarEmoji": user["avatarEmoji"],
        },
        room=room_id,
        skip_sid=sid
    )


@sio.on("rtc:group-leave")
async def handle_rtc_group_leave(sid, payload=None):
    user = users_by_sid.get(sid)
    if not user or not payload:
        return
    room_id = str(payload.get("roomId", ""))
    if not room_id:
        return

    await sio.emit(
        "rtc:user-left",
        {
            "roomId": room_id,
            "userId": user["userId"],
        },
        room=room_id,
        skip_sid=sid
    )
