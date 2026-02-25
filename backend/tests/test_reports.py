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
