import pytest
import pytest_asyncio
from httpx import AsyncClient


@pytest_asyncio.fixture
async def seed_outage(db):
    from app.models import Outage, OutageSource, OutageStatus

    outage = Outage(
        source=OutageSource.ande_official,
        status=OutageStatus.active,
        title="Corte para test de comentarios",
    )
    db.add(outage)
    await db.commit()
    await db.refresh(outage)
    return outage


@pytest.mark.asyncio
async def test_add_comment_ok(client: AsyncClient, seed_outage):
    payload = {"device_id": "device-comment-1", "text": "Sigue sin luz aquí"}
    res = await client.post(f"/outages/{seed_outage.id}/comments", json=payload)

    assert res.status_code == 201
    data = res.json()
    assert data["text"] == "Sigue sin luz aquí"
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_add_comment_outage_not_found(client: AsyncClient):
    payload = {"device_id": "device-comment-2", "text": "test"}
    res = await client.post("/outages/999999/comments", json=payload)

    assert res.status_code == 404
    assert res.json()["detail"] == "Corte no encontrado."


@pytest.mark.asyncio
async def test_list_comments_empty(client: AsyncClient, seed_outage):
    res = await client.get(f"/outages/{seed_outage.id}/comments")
    assert res.status_code == 200
    assert res.json() == []


@pytest.mark.asyncio
async def test_list_comments_order(client: AsyncClient, seed_outage):
    for i in range(2):
        await client.post(
            f"/outages/{seed_outage.id}/comments",
            json={"device_id": f"device-order-{i}", "text": f"comment {i}"},
        )

    res = await client.get(f"/outages/{seed_outage.id}/comments")
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 2
    assert items[0]["text"] == "comment 0"
    assert items[1]["text"] == "comment 1"


@pytest.mark.asyncio
async def test_comment_max_length(client: AsyncClient, seed_outage):
    payload = {"device_id": "device-too-long", "text": "x" * 501}
    res = await client.post(f"/outages/{seed_outage.id}/comments", json=payload)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_comment_empty_text(client: AsyncClient, seed_outage):
    payload = {"device_id": "device-empty", "text": ""}
    res = await client.post(f"/outages/{seed_outage.id}/comments", json=payload)
    assert res.status_code == 422
