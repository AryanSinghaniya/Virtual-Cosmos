import pytest
from httpx import ASGITransport, AsyncClient
from app.main import fastapi_app
from app.services.vector_service import VectorService


def test_vector_service_embeddings():
    vec1 = VectorService.generate_text_embedding("FastAPI PostgreSQL React AI", dim=384)
    vec2 = VectorService.generate_text_embedding("FastAPI PostgreSQL React AI", dim=384)
    vec3 = VectorService.generate_text_embedding("Gardening Cooking History", dim=384)

    assert len(vec1) == 384
    sim_identical = VectorService.cosine_similarity(vec1, vec2)
    assert sim_identical >= 0.99
    sim_different = VectorService.cosine_similarity(vec1, vec3)
    assert sim_different < sim_identical


@pytest.mark.asyncio
async def test_ai_matchmaker_endpoint():
    async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as ac:
        login_res = await ac.post("/api/v1/auth/login", json={
            "email": "aryan@cosmos.io",
            "password": "Password123!"
        })
        assert login_res.status_code == 200
        token = login_res.json()["data"]["tokens"]["access_token"]

        headers = {"Authorization": f"Bearer {token}"}
        match_res = await ac.post(
            "/api/v1/ai/match",
            headers=headers,
            json={"query_text": "Machine learning vector embeddings", "top_k": 3}
        )
        assert match_res.status_code == 200
        data = match_res.json()["data"]
        assert "matches" in data
        assert len(data["matches"]) > 0
