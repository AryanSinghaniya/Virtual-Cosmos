from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.v1.deps import get_current_user
from app.core.config import settings
from app.core.rate_limiter import limiter
from app.db.session import get_db
from app.models.user import User
from app.schemas.ai_matchmaker import MatchmakingQuery, MatchmakingResponse
from app.schemas.common import ResponseEnvelope
from app.services.connection_manager import manager
from app.services.vector_service import VectorService

router = APIRouter(prefix="/ai", tags=["AI Vector Semantic Matchmaker (pgvector)"])


@router.post("/match", response_model=ResponseEnvelope[MatchmakingResponse])
@limiter.limit(settings.RATE_LIMIT_AI_MATCH)
async def match_peers(
    request: Request,
    query: MatchmakingQuery,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Perform semantic vector similarity search across Cosmos explorers using pgvector.
    Finds peers with highest affinity based on technical interests, bio embeddings, and active presence.
    """
    online_users = manager.get_online_users(query.space_id)
    match_response = await VectorService.match_users(
        db=db,
        current_user_id=current_user.id,
        query=query,
        online_user_ids=online_users
    )

    return ResponseEnvelope(
        success=True,
        data=match_response,
        message=f"Found {len(match_response.matches)} semantically aligned cosmos peers."
    )
