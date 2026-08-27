import pytest
from httpx import ASGITransport, AsyncClient
from app.main import fastapi_app
from app.services.spatial_service import SpatialService


def test_spatial_math_and_pair_generation():
    dist = SpatialService.calculate_distance(0, 0, 3, 4)
    assert dist == 5.0
    key1 = SpatialService.get_pair_room_key("user_a", "user_b")
    key2 = SpatialService.get_pair_room_key("user_b", "user_a")
    assert key1 == key2 == "proximity:user_a:user_b"


@pytest.mark.asyncio
async def test_spaces_api():
    async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/spaces")
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert len(data["items"]) >= 1

        res_space = await ac.get("/api/v1/spaces/alpha-cosmos")
        assert res_space.status_code == 200
        assert res_space.json()["data"]["slug"] == "alpha-cosmos"
