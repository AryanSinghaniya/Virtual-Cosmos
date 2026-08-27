import asyncio
import json
import logging
from typing import Any, Dict, List, Optional, Set
from fastapi import WebSocket
from app.services.spatial_service import SpatialService

logger = logging.getLogger("virtual_cosmos.ws")


class ConnectionManager:
    def __init__(self):
        # space_id -> { user_id: WebSocket }
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        # space_id -> { user_id: { "x": float, "y": float, "username": str, "display_name": str, "avatar_emoji": str, ... } }
        self.space_positions: Dict[str, Dict[str, Dict[str, Any]]] = {}
        # space_id -> radius
        self.space_radii: Dict[str, float] = {}
        # space_id -> user_id -> set of currently connected peer user_ids in proximity
        self.proximity_state: Dict[str, Dict[str, Set[str]]] = {}

    async def connect(
        self,
        websocket: WebSocket,
        space_id: str,
        user_id: str,
        user_info: Dict[str, Any],
        proximity_radius: float = 160.0
    ):
        """Accept WebSocket and register user in the space."""
        await websocket.accept()

        if space_id not in self.active_connections:
            self.active_connections[space_id] = {}
            self.space_positions[space_id] = {}
            self.space_radii[space_id] = proximity_radius
            self.proximity_state[space_id] = {}

        self.active_connections[space_id][user_id] = websocket
        self.space_radii[space_id] = proximity_radius

        initial_x = float(user_info.get("x", 400.0))
        initial_y = float(user_info.get("y", 300.0))

        self.space_positions[space_id][user_id] = {
            "user_id": user_id,
            "username": user_info.get("username", "Explorer"),
            "display_name": user_info.get("display_name", user_info.get("username", "Explorer")),
            "avatar_emoji": user_info.get("avatar_emoji", "🚀"),
            "x": initial_x,
            "y": initial_y,
            "interests": user_info.get("interests", []),
            "skills": user_info.get("skills", []),
        }
        self.proximity_state[space_id][user_id] = set()

        # Send initial world state to newly connected client
        await self.send_personal_message(
            {
                "type": "world:init",
                "space_id": space_id,
                "current_user_id": user_id,
                "proximity_radius": self.space_radii[space_id],
                "users": self.space_positions[space_id]
            },
            websocket
        )

        # Notify other users in the space
        await self.broadcast_to_space(
            space_id,
            {
                "type": "user:joined",
                "user": self.space_positions[space_id][user_id]
            },
            exclude_user_id=user_id
        )

        # Update proximity after joining
        await self.recalculate_and_broadcast_proximity(space_id)

    async def disconnect(self, space_id: str, user_id: str):
        """Handle socket disconnect, remove from state and broadcast to peers."""
        if space_id in self.active_connections:
            self.active_connections[space_id].pop(user_id, None)
            user_data = self.space_positions[space_id].pop(user_id, None)
            self.proximity_state[space_id].pop(user_id, None)

            # Cleanup empty space structures
            if not self.active_connections[space_id]:
                self.active_connections.pop(space_id, None)
                self.space_positions.pop(space_id, None)
                self.space_radii.pop(space_id, None)
                self.proximity_state.pop(space_id, None)
            else:
                await self.broadcast_to_space(
                    space_id,
                    {
                        "type": "user:left",
                        "user_id": user_id,
                        "username": user_data.get("username") if user_data else "User"
                    }
                )
                await self.recalculate_and_broadcast_proximity(space_id)

    async def update_position(self, space_id: str, user_id: str, x: float, y: float):
        """Update coordinates for user and sync with nearby cosmos peers."""
        if space_id in self.space_positions and user_id in self.space_positions[space_id]:
            self.space_positions[space_id][user_id]["x"] = x
            self.space_positions[space_id][user_id]["y"] = y

            # Broadcast position delta
            await self.broadcast_to_space(
                space_id,
                {
                    "type": "user:moved",
                    "user_id": user_id,
                    "x": x,
                    "y": y
                },
                exclude_user_id=user_id
            )

            # Recalculate proximity network
            await self.recalculate_and_broadcast_proximity(space_id)

    async def recalculate_and_broadcast_proximity(self, space_id: str):
        """Perform sub-millisecond proximity calculations for all users in the space."""
        if space_id not in self.space_positions:
            return

        positions = self.space_positions[space_id]
        radius = self.space_radii.get(space_id, 160.0)
        users = list(positions.keys())

        new_proximity: Dict[str, Set[str]] = {u: set() for u in users}

        for i in range(len(users)):
            u1 = users[i]
            p1 = positions[u1]
            for j in range(i + 1, len(users)):
                u2 = users[j]
                p2 = positions[u2]

                dist = SpatialService.calculate_distance(p1["x"], p1["y"], p2["x"], p2["y"])
                if dist <= radius:
                    new_proximity[u1].add(u2)
                    new_proximity[u2].add(u1)

        # Notify each user if their proximity roster has changed
        for uid in users:
            old_set = self.proximity_state[space_id].get(uid, set())
            current_set = new_proximity[uid]

            if old_set != current_set:
                self.proximity_state[space_id][uid] = current_set
                ws = self.active_connections[space_id].get(uid)
                if ws:
                    nearby_list = [
                        {
                            "user_id": peer_id,
                            "username": positions[peer_id]["username"],
                            "display_name": positions[peer_id]["display_name"],
                            "avatar_emoji": positions[peer_id]["avatar_emoji"],
                            "x": positions[peer_id]["x"],
                            "y": positions[peer_id]["y"],
                            "room_key": SpatialService.get_pair_room_key(uid, peer_id)
                        }
                        for peer_id in current_set if peer_id in positions
                    ]
                    await self.send_personal_message(
                        {
                            "type": "proximity:update",
                            "connections": nearby_list,
                            "active_count": len(nearby_list)
                        },
                        ws
                    )

    async def relay_chat_message(self, space_id: str, sender_id: str, message_payload: Dict[str, Any]):
        """Relay chat messages to proximity room or target peer."""
        room_key = message_payload.get("room_key", "")
        recipient_id = message_payload.get("recipient_id")

        if recipient_id and space_id in self.active_connections:
            target_ws = self.active_connections[space_id].get(recipient_id)
            if target_ws:
                await self.send_personal_message(message_payload, target_ws)
        elif room_key.startswith("proximity:"):
            # Extract user IDs from room key
            parts = room_key.split(":")
            if len(parts) == 3:
                u1, u2 = parts[1], parts[2]
                target_id = u2 if sender_id == u1 else u1
                if space_id in self.active_connections:
                    target_ws = self.active_connections[space_id].get(target_id)
                    if target_ws:
                        await self.send_personal_message(message_payload, target_ws)
        else:
            # Broadcast to space
            await self.broadcast_to_space(space_id, message_payload, exclude_user_id=sender_id)

    async def relay_webrtc_signal(self, space_id: str, sender_id: str, signal_payload: Dict[str, Any]):
        """Relay WebRTC offer, answer, or ICE candidate directly to the target peer socket."""
        target_user_id = signal_payload.get("target_user_id")
        if not target_user_id:
            return

        if space_id in self.active_connections:
            target_ws = self.active_connections[space_id].get(target_user_id)
            if target_ws:
                signal_payload["sender_id"] = sender_id
                await self.send_personal_message(signal_payload, target_ws)

    async def send_personal_message(self, message: Dict[str, Any], websocket: WebSocket):
        """Send JSON payload to specific websocket client."""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.debug(f"Failed to send personal message: {e}")

    async def broadcast_to_space(
        self,
        space_id: str,
        message: Dict[str, Any],
        exclude_user_id: Optional[str] = None
    ):
        """Broadcast JSON payload to all connected peers in space."""
        if space_id not in self.active_connections:
            return

        message_str = json.dumps(message)
        dead_connections = []

        for uid, ws in self.active_connections[space_id].items():
            if exclude_user_id and uid == exclude_user_id:
                continue
            try:
                await ws.send_text(message_str)
            except Exception:
                dead_connections.append(uid)

        for dead_uid in dead_connections:
            await self.disconnect(space_id, dead_uid)

    def get_online_users(self, space_id: Optional[str] = None) -> List[str]:
        """Return list of all currently connected online user IDs."""
        if space_id:
            return list(self.active_connections.get(space_id, {}).keys())
        all_online = []
        for space_conns in self.active_connections.values():
            all_online.extend(space_conns.keys())
        return all_online


# Singleton manager
manager = ConnectionManager()
