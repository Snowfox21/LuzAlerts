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


def _photon_feature(name, osm_key="place", osm_value="city", country="PY", lon=-57.49, lat=-25.27, **props):
    return {
        "type": "Feature",
        "properties": {"name": name, "osm_key": osm_key, "osm_value": osm_value,
                       "countrycode": country, **props},
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
    }


class _FakePhotonResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


def _patch_photon(monkeypatch, features, calls):
    import app.geocoding as geocoding

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def get(self, url, params=None, headers=None):
            calls.append((url, params))
            return _FakePhotonResponse({"features": features})

    geocoding._SUGGEST_CACHE.clear()
    monkeypatch.setattr(geocoding.httpx, "AsyncClient", FakeClient)


@pytest.mark.asyncio
async def test_suggest_places_ranks_and_filters(client: AsyncClient, monkeypatch):
    calls = []
    features = [
        # Una calle que se llama igual va después de la ciudad.
        _photon_feature("Luque", osm_key="highway", osm_value="residential",
                        district="Villa Bonita", city="Villa Elisa", state="Departamento Central"),
        # Comercios y lugares de Argentina no sirven como zona.
        _photon_feature("Luque Farmacia", osm_key="shop", osm_value="chemist", city="Luque"),
        _photon_feature("Luque Automotores", osm_key="place", country="AR"),
        _photon_feature("Luque", state="Departamento Central"),
        # Duplicado exacto: se muestra una sola vez.
        _photon_feature("Luque", state="Departamento Central", lon=-57.5),
        _photon_feature("Villa Morra", osm_value="neighbourhood", city="Asunción",
                        state="Distrito Capital de Paraguay"),
    ]
    _patch_photon(monkeypatch, features, calls)

    res = await client.get("/geocode/suggest", params={"q": "Luq"})
    assert res.status_code == 200
    data = res.json()
    assert [(s["label"], s["detail"]) for s in data] == [
        ("Luque", "Central"),
        ("Villa Morra, Asunción", None),
        ("Luque, Villa Bonita, Villa Elisa", "Central"),
    ]
    assert data[0]["lat"] == -25.27 and data[0]["lon"] == -57.49
    assert len(calls) == 1 and calls[0][0].endswith("/api/")

    # La misma consulta (con otras mayúsculas y espacios) sale de la caché.
    res = await client.get("/geocode/suggest", params={"q": "  luq "})
    assert res.status_code == 200
    assert len(res.json()) == 3
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_suggest_places_photon_down(client: AsyncClient, monkeypatch):
    import app.geocoding as geocoding

    class BrokenClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            raise geocoding.httpx.ConnectError("sin red")

        async def __aexit__(self, *exc):
            return False

    geocoding._SUGGEST_CACHE.clear()
    monkeypatch.setattr(geocoding.httpx, "AsyncClient", BrokenClient)
    res = await client.get("/geocode/suggest", params={"q": "Villa Morra"})
    assert res.status_code == 200
    assert res.json() == []


@pytest.mark.asyncio
async def test_suggest_places_needs_three_chars(client: AsyncClient):
    res = await client.get("/geocode/suggest", params={"q": "Lu"})
    assert res.status_code == 422
