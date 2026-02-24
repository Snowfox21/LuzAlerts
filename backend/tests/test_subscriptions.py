import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_subscription_missing_fields(client: AsyncClient, normal_user):
    payload = {"device_id": normal_user.device_id} # Missing barrio and feeder
    response = await client.post("/subscriptions/", json=payload)
    assert response.status_code == 422
    assert response.json()["detail"] == "Especifique al menos un barrio o número de alimentador."

@pytest.mark.asyncio
async def test_create_subscription(client: AsyncClient, normal_user):
    payload = {
        "device_id": normal_user.device_id,
        "barrio": "Carmelitas",
        "feeder_number": "ASU01"
    }
    response = await client.post("/subscriptions/", json=payload)
    assert response.status_code == 201
    
    # Duplicate subscription should return 200/201 without error
    response_dup = await client.post("/subscriptions/", json=payload)
    assert response_dup.status_code == 201
    assert response_dup.json()["id"] == response.json()["id"]

@pytest.mark.asyncio
async def test_list_subscriptions(client: AsyncClient, normal_user):
    res = await client.get(f"/subscriptions/?device_id={normal_user.device_id}")
    assert res.status_code == 200
    assert len(res.json()) >= 0

@pytest.mark.asyncio
async def test_delete_subscription(client: AsyncClient, normal_user):
    payload = {
        "device_id": normal_user.device_id,
        "barrio": "Sajonia"
    }
    create_res = await client.post("/subscriptions/", json=payload)
    sub_id = create_res.json()["id"]
    
    del_res = await client.delete(f"/subscriptions/{sub_id}?device_id={normal_user.device_id}")
    assert del_res.status_code == 204
    
    del_res_again = await client.delete(f"/subscriptions/{sub_id}?device_id={normal_user.device_id}")
    assert del_res_again.status_code == 404
