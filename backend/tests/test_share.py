"""Публичный шеринг метки: код, страница /r/{code} и подтверждение соседом."""
import pytest
from httpx import AsyncClient

from app.config import settings
from app.sharing import ALPHABET, CODE_LENGTH


@pytest.fixture
def mock_geocoder(monkeypatch):
    async def mock_reverse_geocode(lat: float, lon: float):
        return {"barrio": "Villa Morra", "street": "Av. Mariscal Lopez", "city": "Asunción"}

    monkeypatch.setattr("app.routers.reports.reverse_geocode", mock_reverse_geocode)


async def _register(client: AsyncClient, device_id: str) -> str:
    await client.post("/users/", json={"device_id": device_id})
    return device_id


async def _create_report(client: AsyncClient, device_id: str, lat: float, lon: float):
    res = await client.post(
        "/reports/", json={"device_id": device_id, "latitude": lat, "longitude": lon}
    )
    assert res.status_code == 201, res.text
    return res.json()


# ---------- share_code ----------

@pytest.mark.asyncio
async def test_new_report_gets_share_code_and_url(client: AsyncClient, mock_geocoder):
    device_id = await _register(client, "device-share-code")
    report = await _create_report(client, device_id, -25.5101, -57.8101)

    code = report["share_code"]
    assert code is not None
    assert len(code) == CODE_LENGTH
    # Похожие символы (0/O/1/I/L) в коде недопустимы: его диктуют вслух.
    assert set(code) <= set(ALPHABET)
    assert report["share_url"] == f"{settings.PUBLIC_BASE_URL}/r/{code}"


@pytest.mark.asyncio
async def test_share_codes_are_unique(client: AsyncClient, mock_geocoder):
    codes = set()
    for i in range(5):
        device_id = await _register(client, f"device-share-uniq-{i}")
        report = await _create_report(client, device_id, -25.52 - i / 100, -57.82 - i / 100)
        codes.add(report["share_code"])
    assert len(codes) == 5


# ---------- GET /r/{code} ----------

@pytest.mark.asyncio
async def test_share_page_renders_og_tags(client: AsyncClient, mock_geocoder):
    device_id = await _register(client, "device-share-page")
    report = await _create_report(client, device_id, -25.5301, -57.8301)

    res = await client.get(f"/r/{report['share_code']}")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/html")
    html = res.text

    # Ровно то, что рисует краулер WhatsApp.
    assert 'property="og:title"' in html
    assert 'property="og:description"' in html
    assert 'property="og:image"' in html
    assert f'property="og:url" content="{settings.PUBLIC_BASE_URL}/r/{report["share_code"]}"' in html
    assert "Villa Morra" in html


@pytest.mark.asyncio
async def test_share_page_hides_home_address(client: AsyncClient, mock_geocoder):
    """Улица и дом автора не должны утекать на публичную страницу."""
    device_id = await _register(client, "device-share-privacy")
    res = await client.post(
        "/reports/",
        json={
            "device_id": device_id,
            "latitude": -25.5401,
            "longitude": -57.8401,
            "street": "Calle Secreta",
            "house": "1234",
        },
    )
    assert res.status_code == 201
    report = res.json()

    page = await client.get(f"/r/{report['share_code']}")
    assert page.status_code == 200
    assert "Calle Secreta" not in page.text
    assert "1234" not in page.text


@pytest.mark.asyncio
async def test_share_page_coordinates_are_coarse(client: AsyncClient, mock_geocoder):
    """Точные координаты = домашний адрес. Наружу идут огрубленные."""
    device_id = await _register(client, "device-share-coords")
    report = await _create_report(client, device_id, -25.556677, -57.887766)

    page = await client.get(f"/r/{report['share_code']}")
    assert "-25.556677" not in page.text
    assert "-57.887766" not in page.text


@pytest.mark.asyncio
async def test_share_page_unknown_code_404(client: AsyncClient):
    res = await client.get("/r/ZZZZZZZZ")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_share_page_counts_views(client: AsyncClient, db, mock_geocoder):
    from sqlalchemy import select

    from app.models import UserReport

    device_id = await _register(client, "device-share-views")
    report = await _create_report(client, device_id, -25.5501, -57.8501)

    await client.get(f"/r/{report['share_code']}")
    await client.get(f"/r/{report['share_code']}")

    row = await db.execute(select(UserReport.share_view_count).where(UserReport.id == report["id"]))
    assert row.scalar_one() == 2


# ---------- POST /reports/{id}/corroborate ----------

@pytest.mark.asyncio
async def test_corroborate_creates_neighbour_report(client: AsyncClient, mock_geocoder):
    author = await _register(client, "device-corr-author")
    report = await _create_report(client, author, -25.6101, -57.9101)

    neighbour = await _register(client, "device-corr-neighbour")
    res = await client.post(
        f"/reports/{report['id']}/corroborate",
        json={"device_id": neighbour, "latitude": -25.6102, "longitude": -57.9102},
    )
    assert res.status_code == 200, res.text
    # Возвращается исходная метка, а не метка соседа.
    assert res.json()["id"] == report["id"]
    assert res.json()["is_mine"] is False

    # У соседа появилась собственная метка рядом.
    nearby = await client.get("/reports/?latitude=-25.6101&longitude=-57.9101&radius_m=500")
    assert len(nearby.json()) == 2


@pytest.mark.asyncio
async def test_corroborate_reaches_threshold(client: AsyncClient, mock_geocoder):
    """Третье подтверждение переводит метку в confirmed."""
    author = await _register(client, "device-corr-th-author")
    report = await _create_report(client, author, -25.6201, -57.9201)
    assert report["confirmed"] is False

    for i in range(settings.REPORT_THRESHOLD - 1):
        neighbour = await _register(client, f"device-corr-th-{i}")
        res = await client.post(
            f"/reports/{report['id']}/corroborate",
            json={"device_id": neighbour, "latitude": -25.6202 - i / 10000, "longitude": -57.9202},
        )
        assert res.status_code == 200, res.text

    assert res.json()["confirmed"] is True


@pytest.mark.asyncio
async def test_corroborate_is_idempotent_per_device(client: AsyncClient, mock_geocoder):
    """Один человек не должен в одиночку дотягивать метку до порога."""
    author = await _register(client, "device-corr-idem-author")
    report = await _create_report(client, author, -25.6301, -57.9301)

    neighbour = await _register(client, "device-corr-idem-neighbour")
    body = {"device_id": neighbour, "latitude": -25.6302, "longitude": -57.9302}
    for _ in range(4):
        res = await client.post(f"/reports/{report['id']}/corroborate", json=body)
        assert res.status_code == 200, res.text

    nearby = await client.get("/reports/?latitude=-25.6301&longitude=-57.9301&radius_m=500")
    # Автор + один сосед, сколько бы раз он ни нажал.
    assert len(nearby.json()) == 2
    assert res.json()["confirmed"] is False


@pytest.mark.asyncio
async def test_corroborate_own_report_rejected(client: AsyncClient, mock_geocoder):
    author = await _register(client, "device-corr-self")
    report = await _create_report(client, author, -25.6401, -57.9401)

    res = await client.post(
        f"/reports/{report['id']}/corroborate",
        json={"device_id": author, "latitude": -25.6402, "longitude": -57.9402},
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_corroborate_unregistered_device_404(client: AsyncClient, mock_geocoder):
    author = await _register(client, "device-corr-unreg-author")
    report = await _create_report(client, author, -25.6501, -57.9501)

    res = await client.post(
        f"/reports/{report['id']}/corroborate",
        json={"device_id": "never-registered", "latitude": -25.6502, "longitude": -57.9502},
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_corroborate_missing_report_404(client: AsyncClient):
    res = await client.post(
        "/reports/99999999/corroborate",
        json={"device_id": "whatever", "latitude": -25.1, "longitude": -57.1},
    )
    assert res.status_code == 404


# ---------- GET /reports/by-code/{code} ----------

@pytest.mark.asyncio
async def test_by_code_returns_id_without_home_address(client: AsyncClient, mock_geocoder):
    """Код уезжает в WhatsApp, поэтому по нему нельзя выдать адрес автора."""
    device_id = await _register(client, "device-bycode-privacy")
    res = await client.post(
        "/reports/",
        json={
            "device_id": device_id,
            "latitude": -25.7101,
            "longitude": -58.0101,
            "street": "Calle Reservada",
            "house": "4321",
        },
    )
    report = res.json()

    lookup = await client.get(f"/reports/by-code/{report['share_code']}")
    assert lookup.status_code == 200
    data = lookup.json()

    # Приложению отсюда нужен только id — за остальным оно идет на /reports/{id}.
    assert data["id"] == report["id"]
    assert "street" not in data
    assert "house" not in data
    assert "comment" not in data
    # Координаты огрублены до ~1 км
    assert data["latitude"] != -25.7101


@pytest.mark.asyncio
async def test_by_code_unknown_404(client: AsyncClient):
    assert (await client.get("/reports/by-code/ZZZZZZZZ")).status_code == 404
