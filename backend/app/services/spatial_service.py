import math
from typing import Dict, List, Optional, Set, Tuple
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.position import UserPosition
from app.models.space import Space
from app.models.user import User
from app.schemas.spatial import NearbyUserResponse


class SpatialService:
    @staticmethod
    def calculate_distance(x1: float, y1: float, x2: float, y2: float) -> float:
        """Calculate 2D Euclidean distance."""
        return math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)

    @staticmethod
    def get_pair_room_key(user1_id: str, user2_id: str) -> str:
        """Generate deterministic room key for any pair of proximate users."""
        sorted_ids = sorted([user1_id, user2_id])
        return f"proximity:{sorted_ids[0]}:{sorted_ids[1]}"

    @staticmethod
    def is_within_bounds(x: float, y: float, max_width: int, max_height: int) -> bool:
        """Verify if coordinates reside inside the cosmos boundary."""
        return 0 <= x <= max_width and 0 <= y <= max_height

    @staticmethod
    def find_nearby_users(
        current_user_id: str,
        current_x: float,
        current_y: float,
        radius: float,
        active_positions: Dict[str, Dict]
    ) -> List[NearbyUserResponse]:
        """Compute nearby users in memory for real-time sub-millisecond proximity."""
        nearby = []
        for uid, data in active_positions.items():
            if uid == current_user_id:
                continue

            px = data.get("x", 0.0)
            py = data.get("y", 0.0)
            dist = SpatialService.calculate_distance(current_x, current_y, px, py)
            is_near = dist <= radius

            nearby.append(
                NearbyUserResponse(
                    user_id=uid,
                    username=data.get("username", "Unknown"),
                    display_name=data.get("display_name", data.get("username", "Unknown")),
                    avatar_emoji=data.get("avatar_emoji", "👤"),
                    x=px,
                    y=py,
                    distance=round(dist, 2),
                    is_in_proximity=is_near
                )
            )

        # Sort by distance ascending
        nearby.sort(key=lambda item: item.distance)
        return nearby

    @staticmethod
    def compute_proximity_pairs(
        active_positions: Dict[str, Dict],
        radius: float
    ) -> Set[str]:
        """
        Compute active proximity pairs for a cosmos space.
        Returns a set of pair room keys that meet the proximity condition.
        """
        user_ids = list(active_positions.keys())
        active_pairs = set()

        for i in range(len(user_ids)):
            u1 = user_ids[i]
            p1 = active_positions[u1]
            for j in range(i + 1, len(user_ids)):
                u2 = user_ids[j]
                p2 = active_positions[u2]

                dist = SpatialService.calculate_distance(
                    p1.get("x", 0.0), p1.get("y", 0.0),
                    p2.get("x", 0.0), p2.get("y", 0.0)
                )
                if dist <= radius:
                    active_pairs.add(SpatialService.get_pair_room_key(u1, u2))

        return active_pairs
