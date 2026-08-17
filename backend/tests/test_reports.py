import pytest
from httpx import AsyncClient

@pytest.fixture
def mock_geocoder(monkeypatch):
    async def mock_reverse_geocode(lat: float, lon: float):
        # Если координаты Асунсьона, возвращаем мок
        if -26.0 < lat < -25.0 and -58.0 < lon < -57.0:
            return {"barrio": "Villa Morra", "street": "Av. Mariscal Lopez", "city": "Asunción"}
        return {"barrio": None, "street": None, "city": None}
    
    monkeypatch.setattr("app.routers.reports.reverse_geocode", mock_reverse_geocode)


@pytest.mark.asyncio
async def test_create_report_unregistered_user(client: AsyncClient, mock_geocoder):
    payload = {
        "device_id": "unregistered_device",
        "latitude": -25.2866,
        "longitude": -57.6333,
        "comment": "Sin luz!"
    }
    response = await client.post("/reports/", json=payload)
    assert response.status_code == 404
    assert response.json()["detail"] == "Usuario no encontrado. Regístrese primero."


@pytest.mark.asyncio
async def test_create_report(client: AsyncClient, normal_user, mock_geocoder):
    payload = {
        "device_id": normal_user.device_id,
        "latitude": -25.2866,
        "longitude": -57.6333,
        "comment": "Sin luz!"
    }
    response = await client.post("/reports/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["latitude"] == -25.2866
    assert data["barrio"] == "Villa Morra"
    assert data["confirmed"] is False


@pytest.mark.asyncio
async def test_crowdsource_validation(client: AsyncClient, db, mock_geocoder):
    # Создать 3 пользователей
    users = []
    for i in range(3):
        res = await client.post("/users/", json={"device_id": f"device-test-cs-{i}"})
        users.append(res.json()["device_id"])
    
    # 1-й репорт (не подтвержден)
    p1 = {"device_id": users[0], "latitude": -25.3001, "longitude": -57.6501}
    r1 = await client.post("/reports/", json=p1)
    assert r1.json()["confirmed"] is False
    
    # 2-й репорт (не подтвержден)
    p2 = {"device_id": users[1], "latitude": -25.3002, "longitude": -57.6502} # Рядом
    r2 = await client.post("/reports/", json=p2)
    assert r2.json()["confirmed"] is False
    
    # 3-й репорт (трешхолд достигнут -> все должны стать confirmed)
    p3 = {"device_id": users[2], "latitude": -25.3003, "longitude": -57.6503}
    r3 = await client.post("/reports/", json=p3)
    
    # Этот репорт уже возвращается как confirmed = True
    assert r3.json()["confirmed"] is True
    
    # Проверим через GET /reports
    res_get = await client.get("/reports/?latitude=-25.3001&longitude=-57.6501&radius_m=1000")
    reports = res_get.json()
    assert len(reports) >= 3
    for rep in reports:
        if rep["latitude"] in [-25.3001, -25.3002, -25.3003]:
            assert rep["confirmed"] is True


# ---------- Cerrar reporte propio: POST /reports/{id}/resolve ----------

async def _create_user_and_report(client: AsyncClient, suffix: str, lat: float, lon: float):
    device_id = f"device-resolve-{suffix}"
    await client.post("/users/", json={"device_id": device_id})
    res = await client.post("/reports/", json={"device_id": device_id, "latitude": lat, "longitude": lon})
    assert res.status_code == 201, res.text
    return device_id, res.json()


@pytest.mark.asyncio
async def test_report_out_has_resolved_fields(client: AsyncClient, mock_geocoder):
    _, report = await _create_user_and_report(client, "fields", -25.4101, -57.7101)
    assert report["resolved"] is False
    assert report["resolved_at"] is None
    # created_at отдается как tz-aware ISO с суффиксом Z
    assert report["created_at"].endswith("Z")
    assert "device_id" not in report


@pytest.mark.asyncio
async def test_resolve_own_report(client: AsyncClient, mock_geocoder):
    device_id, report = await _create_user_and_report(client, "own", -25.4201, -57.7201)

    res = await client.post(f"/reports/{report['id']}/resolve", json={"device_id": device_id})
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["id"] == report["id"]
    assert data["resolved"] is True
    assert data["resolved_at"] is not None
    assert data["resolved_at"].endswith("Z")


@pytest.mark.asyncio
async def test_resolve_foreign_report_forbidden(client: AsyncClient, mock_geocoder):
    _, report = await _create_user_and_report(client, "victim", -25.4301, -57.7301)
    await client.post("/users/", json={"device_id": "device-resolve-attacker"})

    res = await client.post(f"/reports/{report['id']}/resolve", json={"device_id": "device-resolve-attacker"})
    assert res.status_code == 403

    # Метка осталась активной
    check = await client.get(f"/reports/{report['id']}")
    assert check.json()["resolved"] is False


@pytest.mark.asyncio
async def test_resolve_unknown_device_forbidden(client: AsyncClient, mock_geocoder):
    _, report = await _create_user_and_report(client, "unknown", -25.4351, -57.7351)
    res = await client.post(f"/reports/{report['id']}/resolve", json={"device_id": "device-never-registered"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_resolve_missing_report_404(client: AsyncClient):
    res = await client.post("/reports/99999999/resolve", json={"device_id": "whatever"})
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_resolve_is_idempotent(client: AsyncClient, mock_geocoder):
    device_id, report = await _create_user_and_report(client, "idem", -25.4401, -57.7401)

    first = await client.post(f"/reports/{report['id']}/resolve", json={"device_id": device_id})
    assert first.status_code == 200
    second = await client.post(f"/reports/{report['id']}/resolve", json={"device_id": device_id})
    assert second.status_code == 200
    assert second.json()["resolved"] is True
    assert second.json()["resolved_at"] == first.json()["resolved_at"]


@pytest.mark.asyncio
async def test_resolved_report_disappears_from_list(client: AsyncClient, mock_geocoder):
    device_id, report = await _create_user_and_report(client, "list", -25.4501, -57.7501)

    before = await client.get("/reports/?latitude=-25.4501&longitude=-57.7501&radius_m=500")
    assert report["id"] in [r["id"] for r in before.json()]

    res = await client.post(f"/reports/{report['id']}/resolve", json={"device_id": device_id})
    assert res.status_code == 200

    after = await client.get("/reports/?latitude=-25.4501&longitude=-57.7501&radius_m=500")
    assert report["id"] not in [r["id"] for r in after.json()]

    # По прямой ссылке метка по-прежнему доступна, но помечена закрытой
    detail = await client.get(f"/reports/{report['id']}")
    assert detail.status_code == 200
    assert detail.json()["resolved"] is True
