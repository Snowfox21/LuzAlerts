import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_user(client: AsyncClient):
    payload = {"device_id": "test-device-1"}
    response = await client.post("/users/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["device_id"] == "test-device-1"
    assert data["role"] == "user"

@pytest.mark.asyncio
async def test_update_user(client: AsyncClient):
    payload = {"device_id": "test-device-1", "nis_number": "12345"}
    await client.post("/users/", json=payload)
    
    # Update token
    payload_update = {"device_id": "test-device-1", "fcm_token": "token123"}
    response = await client.post("/users/", json=payload_update)
    assert response.status_code == 201
    data = response.json()
    assert data["nis_number"] == "12345"

@pytest.mark.asyncio
async def test_get_user(client: AsyncClient):
    payload = {"device_id": "test-device-2"}
    await client.post("/users/", json=payload)
    
    response = await client.get("/users/test-device-2")
    assert response.status_code == 200
    assert response.json()["device_id"] == "test-device-2"

@pytest.mark.asyncio
async def test_get_user_not_found(client: AsyncClient):
    response = await client.get("/users/non_existent_id")
    assert response.status_code == 404
    assert response.json()["detail"] == "Usuario no encontrado"

ADMIN_HEADERS = {"X-Admin-Key": "test-admin-key"}


@pytest.mark.asyncio
async def test_list_all_users_admin(client: AsyncClient, admin_user, normal_user):
    response = await client.get("/users/", headers=ADMIN_HEADERS)
    assert response.status_code == 200
    assert len(response.json()) >= 2

@pytest.mark.asyncio
async def test_list_all_users_forbidden_without_key(client: AsyncClient):
    response = await client.get("/users/")
    assert response.status_code == 403
    assert response.json()["detail"] == "Prohibido: Se requiere acceso de administrador"

@pytest.mark.asyncio
async def test_list_all_users_forbidden_wrong_key(client: AsyncClient):
    response = await client.get("/users/", headers={"X-Admin-Key": "wrong"})
    assert response.status_code == 403

@pytest.mark.asyncio
async def test_delete_user(client: AsyncClient):
    payload = {"device_id": "test-device-3"}
    await client.post("/users/", json=payload)

    response = await client.delete("/users/test-device-3", headers=ADMIN_HEADERS)
    assert response.status_code == 204

    get_response = await client.get("/users/test-device-3")
    assert get_response.status_code == 404

@pytest.mark.asyncio
async def test_delete_user_forbidden_without_key(client: AsyncClient):
    payload = {"device_id": "test-device-4"}
    await client.post("/users/", json=payload)

    response = await client.delete("/users/test-device-4")
    assert response.status_code == 403


WEB_PUSH_SUB = (
    '{"endpoint": "https://web.push.apple.com/QGuQyavXutnMH8", '
    '"keys": {"p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA", "auth": "tBHItJI5svbpez7KI4CCXg"}}'
)


@pytest.mark.asyncio
async def test_register_web_push_subscription(client: AsyncClient):
    response = await client.post("/users/", json={"device_id": "pwa-device-1", "web_push_subscription": WEB_PUSH_SUB})
    assert response.status_code == 201
    assert response.json()["web_push_enabled"] is True


@pytest.mark.asyncio
async def test_web_push_does_not_touch_fcm_token(client: AsyncClient, db):
    from sqlalchemy import select
    from app.models import User

    await client.post("/users/", json={"device_id": "mixed-device", "fcm_token": "ExponentPushToken[abc]"})
    response = await client.post("/users/", json={"device_id": "mixed-device", "web_push_subscription": WEB_PUSH_SUB})
    assert response.status_code == 201

    user = (await db.execute(select(User).where(User.device_id == "mixed-device"))).scalar_one()
    assert user.fcm_token == "ExponentPushToken[abc]"
    assert user.web_push_subscription == WEB_PUSH_SUB

    # Повторная регистрация нативного клиента без web push не стирает подписку
    await client.post("/users/", json={"device_id": "mixed-device", "fcm_token": "ExponentPushToken[def]"})
    await db.refresh(user)
    assert user.web_push_subscription == WEB_PUSH_SUB


@pytest.mark.asyncio
async def test_delete_web_push_subscription(client: AsyncClient, db):
    from sqlalchemy import select
    from app.models import User

    await client.post("/users/", json={"device_id": "pwa-off", "fcm_token": "ExponentPushToken[keep]", "web_push_subscription": WEB_PUSH_SUB})
    response = await client.delete("/users/pwa-off/web-push")
    assert response.status_code == 204

    user = (await db.execute(select(User).where(User.device_id == "pwa-off"))).scalar_one()
    await db.refresh(user)
    assert user.web_push_subscription is None
    assert user.fcm_token == "ExponentPushToken[keep]"
    # Идемпотентно
    assert (await client.delete("/users/pwa-off/web-push")).status_code == 204


@pytest.mark.asyncio
async def test_delete_web_push_unknown_device(client: AsyncClient):
    assert (await client.delete("/users/nobody/web-push")).status_code == 404


@pytest.mark.asyncio
async def test_native_user_has_web_push_disabled(client: AsyncClient):
    response = await client.post("/users/", json={"device_id": "native-device", "fcm_token": "ExponentPushToken[x]"})
    assert response.status_code == 201
    assert response.json()["web_push_enabled"] is False


@pytest.mark.asyncio
@pytest.mark.parametrize("bad", [
    "not json",
    '{"endpoint": "http://insecure.example", "keys": {"p256dh": "a", "auth": "b"}}',
    '{"endpoint": "https://web.push.apple.com/x", "keys": {"p256dh": "a"}}',
    '["endpoint"]',
])
async def test_invalid_web_push_subscription_rejected(client: AsyncClient, bad: str):
    response = await client.post("/users/", json={"device_id": "pwa-bad", "web_push_subscription": bad})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_vapid_public_key(client: AsyncClient, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "VAPID_PUBLIC_KEY", "BPublicKeyForTests")
    response = await client.get("/config/vapid-public-key")
    assert response.status_code == 200
    assert response.json() == {"public_key": "BPublicKeyForTests"}


@pytest.mark.asyncio
async def test_vapid_public_key_not_configured(client: AsyncClient, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "VAPID_PUBLIC_KEY", None)
    response = await client.get("/config/vapid-public-key")
    assert response.status_code == 503


@pytest.mark.asyncio
async def test_cors_allows_pwa_origin(client: AsyncClient):
    response = await client.options(
        "/users/",
        headers={"Origin": "https://app.luzalerts.lat", "Access-Control-Request-Method": "POST"},
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://app.luzalerts.lat"


@pytest.mark.asyncio
async def test_cors_rejects_foreign_origin(client: AsyncClient):
    response = await client.get("/", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in response.headers


@pytest.mark.asyncio
async def test_notification_preferences_saved_and_kept(client: AsyncClient):
    res = await client.post("/users/", json={"device_id": "prefs-1"})
    data = res.json()
    assert (data["notify_outages"], data["notify_resolved"], data["notify_radius_m"]) == (True, True, 5000)

    res = await client.post("/users/", json={"device_id": "prefs-1", "notify_resolved": False, "notify_radius_m": 10000})
    assert res.status_code == 201
    # Регистрация при старте приложения шлет только токен/координаты —
    # настройки при этом не должны сбрасываться.
    res = await client.post("/users/", json={"device_id": "prefs-1", "fcm_token": "t"})
    data = res.json()
    assert (data["notify_outages"], data["notify_resolved"], data["notify_radius_m"]) == (True, False, 10000)


@pytest.mark.asyncio
async def test_notification_radius_validated(client: AsyncClient):
    res = await client.post("/users/", json={"device_id": "prefs-2", "notify_radius_m": 500})
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_delete_my_data(client: AsyncClient):
    device_id = "erase-me"
    await client.post("/users/", json={"device_id": device_id})
    sub = await client.post("/subscriptions/", json={"device_id": device_id, "barrio": "Villa Morra"})
    assert sub.status_code == 201
    rep = await client.post("/reports/", json={"device_id": device_id, "latitude": -25.71, "longitude": -57.71})
    assert rep.status_code == 201

    res = await client.delete(f"/users/{device_id}/data")
    assert res.status_code == 204
    assert (await client.get(f"/users/{device_id}")).status_code == 404
    assert (await client.get(f"/subscriptions/?device_id={device_id}")).status_code == 404
    nearby = await client.get("/reports/?latitude=-25.71&longitude=-57.71&radius_m=200")
    assert nearby.json() == []
    # Повторно — тоже 204, без админ-ключа.
    assert (await client.delete(f"/users/{device_id}/data")).status_code == 204
