from typing import List, Optional
from pydantic import BaseModel, Field


class MatchmakingQuery(BaseModel):
    query_text: Optional[str] = Field(None, description="Free-text query or topic of interest")
    interests_filter: Optional[List[str]] = Field(default=None, description="Optional filter tags")
    top_k: int = Field(default=5, ge=1, le=20, description="Top K most semantically aligned users")
    space_id: Optional[str] = Field(None, description="Filter for users active in specific space")


class UserMatchResult(BaseModel):
    user_id: str
    username: str
    display_name: str
    avatar_emoji: str
    bio: Optional[str] = None
    interests: List[str] = []
    skills: List[str] = []
    similarity_score: float = Field(..., description="Cosine similarity score between 0.0 and 1.0")
    match_reasons: List[str] = Field(default_factory=list)
    current_space_id: Optional[str] = None
    is_online: bool = False


class MatchmakingResponse(BaseModel):
    matches: List[UserMatchResult]
    total_matches: int
    query_used: str
    vector_search_engine: str = "pgvector (HNSW Index)"
