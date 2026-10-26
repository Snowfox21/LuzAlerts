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


@pytest.mark.asyncio
async def test_place_radius_and_toggle(client: AsyncClient):
    device = "places-patch"
    created = (await client.post(f"/users/{device}/places", json=VILLA_MORRA)).json()
    # Дефолт как в макете: 2 км, включено.
    assert (created["radius_m"], created["enabled"]) == (2000, True)

    res = await client.patch(f"/users/{device}/places/{created['id']}", json={"radius_m": 10000})
    assert res.status_code == 200
    assert (res.json()["radius_m"], res.json()["enabled"]) == (10000, True)
    res = await client.patch(f"/users/{device}/places/{created['id']}", json={"enabled": False})
    assert (res.json()["radius_m"], res.json()["enabled"]) == (10000, False)

    listed = (await client.get(f"/users/{device}/places")).json()
    assert (listed[0]["radius_m"], listed[0]["enabled"]) == (10000, False)

    # Радиус только из шагов 1/2/5/10 км; чужое место — 404.
    assert (await client.patch(f"/users/{device}/places/{created['id']}", json={"radius_m": 3000})).status_code == 422
    assert (await client.patch(f"/users/other/places/{created['id']}", json={"enabled": True})).status_code == 404

    # Выключенное место все равно занимает слот.
    await client.post(f"/users/{device}/places", json={**VILLA_MORRA, "label": "Dos", "radius_m": 5000})
    assert (await client.post(f"/users/{device}/places", json={**VILLA_MORRA, "label": "Tres"})).status_code == 409


@pytest.mark.asyncio
async def test_place_create_with_radius(client: AsyncClient):
    res = await client.post("/users/places-r/places", json={**VILLA_MORRA, "radius_m": 1000, "enabled": False})
    assert res.status_code == 201
    assert (res.json()["radius_m"], res.json()["enabled"]) == (1000, False)
    assert (await client.post("/users/places-r2/places", json={**VILLA_MORRA, "radius_m": 20000})).status_code == 422
