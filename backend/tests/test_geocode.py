import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_reverse_geocode(client: AsyncClient, monkeypatch):
    calls = []

    async def fake_reverse(lat, lon):
        calls.append((lat, lon))
        return {"barrio": "Villa Morra", "street": "Av. Mcal. López", "city": "Asunción",
                "department": "Asunción", "house": None, "country_code": "PY"}

    monkeypatch.setattr("app.routers.geocode.reverse_geocode", fake_reverse)
    res = await client.get("/geocode/reverse?lat=-25.2637&lon=-57.5759")
    assert res.status_code == 200
    assert res.json()["barrio"] == "Villa Morra"
    assert res.json()["country_code"] == "PY"
    assert calls == [(-25.2637, -57.5759)]


@pytest.mark.asyncio
async def test_reverse_geocode_unavailable(client: AsyncClient, monkeypatch):
    async def fake_reverse(lat, lon):
        return dict.fromkeys(("barrio", "street", "city", "department", "house", "country_code"))

    monkeypatch.setattr("app.routers.geocode.reverse_geocode", fake_reverse)
    res = await client.get("/geocode/reverse?lat=-25.2637&lon=-57.5759")
    assert res.status_code == 503


@pytest.mark.asyncio
async def test_reverse_geocode_validates_coords(client: AsyncClient):
    res = await client.get("/geocode/reverse?lat=-125&lon=-57.5")
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_search_address_in_paraguay(client: AsyncClient, monkeypatch):
    calls = []

    async def fake_forward(address, country=None):
        calls.append((address, country))
        return {"lat": -25.29, "lon": -57.58, "display_name": "Villa Morra, Asunción, Paraguay", "barrio": "Villa Morra"}

    monkeypatch.setattr("app.routers.geocode.forward_geocode", fake_forward)
    res = await client.get("/geocode/search", params={"q": "Villa Morra, Asunción"})
    assert res.status_code == 200
    assert res.json()["barrio"] == "Villa Morra"
    assert calls == [("Villa Morra, Asunción", "py")]


@pytest.mark.asyncio
async def test_search_address_not_found(client: AsyncClient, monkeypatch):
    async def fake_forward(address, country=None):
        return {"lat": None, "lon": None, "display_name": None, "barrio": None}

    monkeypatch.setattr("app.routers.geocode.forward_geocode", fake_forward)
    res = await client.get("/geocode/search", params={"q": "Calle inexistente 999"})
    assert res.status_code == 404
