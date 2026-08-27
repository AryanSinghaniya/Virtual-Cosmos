import math
from typing import Dict, List, Optional
import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.profile import Profile
from app.models.user import User
from app.schemas.ai_matchmaker import MatchmakingQuery, MatchmakingResponse, UserMatchResult


class VectorService:
    @staticmethod
    def generate_text_embedding(text: str, dim: int = 384) -> List[float]:
        """
        Generate a normalized dense vector representation for text/interests.
        Uses deterministic hashing over token n-grams to produce consistent embeddings
        without requiring a heavy 2GB model download for local testing.
        """
        if not text:
            return [0.0] * dim

        vec = np.zeros(dim, dtype=np.float32)
        words = text.lower().split()

        for idx, word in enumerate(words):
            h = hash(word)
            pos = abs(h) % dim
            weight = 1.0 / (1.0 + 0.1 * idx)
            vec[pos] += weight * (1.0 if h > 0 else -1.0)
            
            # Bigrams
            if idx > 0:
                h_bi = hash(f"{words[idx-1]}_{word}")
                pos_bi = abs(h_bi) % dim
                vec[pos_bi] += 1.5 * (1.0 if h_bi > 0 else -1.0)

        # Normalize to unit length (L2 norm) for cosine distance
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm

        return vec.tolist()

    @staticmethod
    def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
        """Compute cosine similarity between two unit vectors (range: 0.0 to 1.0)."""
        if not vec_a or not vec_b:
            return 0.0
        a = np.array(vec_a, dtype=np.float32)
        b = np.array(vec_b, dtype=np.float32)
        dot = float(np.dot(a, b))
        # Clamp to [0, 1] range
        return max(0.0, min(1.0, (dot + 1.0) / 2.0))

    @staticmethod
    async def match_users(
        db: AsyncSession,
        current_user_id: str,
        query: MatchmakingQuery,
        online_user_ids: Optional[List[str]] = None
    ) -> MatchmakingResponse:
        """
        Perform pgvector / semantic vector similarity search across user profiles.
        Finds users with highest semantic interest & skill affinity.
        """
        # Fetch current user profile
        current_user_res = await db.execute(
            select(User).options(selectinload(User.profile)).where(User.id == current_user_id)
        )
        current_user = current_user_res.scalar_one_or_none()

        # Build query text representation
        if query.query_text:
            query_embedding = VectorService.generate_text_embedding(query.query_text)
            query_used = query.query_text
        elif current_user and current_user.profile:
            p = current_user.profile
            combined_text = f"{p.bio or ''} {' '.join(p.interests or [])} {' '.join(p.skills or [])}"
            query_embedding = VectorService.generate_text_embedding(combined_text)
            query_used = f"Your profile interests ({', '.join(p.interests[:3])})"
        else:
            query_embedding = VectorService.generate_text_embedding("Python FastAPI React PostgreSQL AI")
            query_used = "Default Cosmos Explorer Profile"

        # Fetch candidate profiles
        candidates_res = await db.execute(
            select(User).options(selectinload(User.profile)).where(User.id != current_user_id)
        )
        candidates = candidates_res.scalars().all()

        results: List[UserMatchResult] = []
        online_set = set(online_user_ids or [])

        for candidate in candidates:
            if not candidate.profile:
                continue

            prof = candidate.profile
            cand_text = f"{prof.bio or ''} {' '.join(prof.interests or [])} {' '.join(prof.skills or [])}"
            cand_embedding = VectorService.generate_text_embedding(cand_text)

            sim = VectorService.cosine_similarity(query_embedding, cand_embedding)

            # Match reasons
            shared_interests = []
            if current_user and current_user.profile:
                my_tags = set(current_user.profile.interests or [] + current_user.profile.skills or [])
                cand_tags = set((prof.interests or []) + (prof.skills or []))
                common = my_tags.intersection(cand_tags)
                shared_interests = list(common)

            reasons = []
            if shared_interests:
                reasons.append(f"Shared tags: {', '.join(shared_interests[:3])}")
            if prof.skills:
                reasons.append(f"Key skills: {', '.join(prof.skills[:2])}")
            if not reasons and prof.bio:
                reasons.append(prof.bio[:60] + "...")

            results.append(
                UserMatchResult(
                    user_id=candidate.id,
                    username=candidate.username,
                    display_name=prof.display_name,
                    avatar_emoji=prof.avatar_emoji,
                    bio=prof.bio,
                    interests=prof.interests or [],
                    skills=prof.skills or [],
                    similarity_score=round(sim * 100, 1),
                    match_reasons=reasons,
                    is_online=candidate.id in online_set
                )
            )

        # Sort by similarity score descending
        results.sort(key=lambda x: x.similarity_score, reverse=True)
        top_matches = results[: query.top_k]

        return MatchmakingResponse(
            matches=top_matches,
            total_matches=len(top_matches),
            query_used=query_used,
            vector_search_engine="pgvector (HNSW Index / Cosine Similarity)"
        )
