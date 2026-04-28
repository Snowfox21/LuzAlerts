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
