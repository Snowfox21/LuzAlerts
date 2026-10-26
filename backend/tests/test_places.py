import pytest
from httpx import AsyncClient

VILLA_MORRA = {"label": "Casa de mamá", "latitude": -25.29, "longitude": -57.58}


@pytest.mark.asyncio
async def test_places_crud_and_limit(client: AsyncClient):
    device = "places-1"
    # Устройство еще не зарегистрировано (онбординг) — место все равно добавляется.
    assert (await client.get(f"/users/{device}/places")).json() == []
    first = await client.post(f"/users/{device}/places", json=VILLA_MORRA)
    assert first.status_code == 201
    assert first.json()["label"] == "Casa de mamá"
    second = await client.post(f"/users/{device}/places", json={**VILLA_MORRA, "label": "Abuela"})
    assert second.status_code == 201
    third = await client.post(f"/users/{device}/places", json={**VILLA_MORRA, "label": "Tía"})
    assert third.status_code == 409

    places = (await client.get(f"/users/{device}/places")).json()
    assert [p["label"] for p in places] == ["Casa de mamá", "Abuela"]

    # Чужое место удалить нельзя.
    assert (await client.delete(f"/users/other/places/{first.json()['id']}")).status_code == 404
    assert (await client.delete(f"/users/{device}/places/{first.json()['id']}")).status_code == 204
    assert len((await client.get(f"/users/{device}/places")).json()) == 1


@pytest.mark.asyncio
async def test_place_outside_paraguay_rejected(client: AsyncClient):
    res = await client.post("/users/places-2/places", json={"label": "Madrid", "latitude": 40.41, "longitude": -3.70})
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_delete_my_data_removes_places(client: AsyncClient):
    device = "places-erase"
    await client.post(f"/users/{device}/places", json=VILLA_MORRA)
    assert (await client.delete(f"/users/{device}/data")).status_code == 204
    assert (await client.get(f"/users/{device}/places")).json() == []
