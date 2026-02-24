import pytest
from httpx import AsyncClient

@pytest.fixture
async def seed_outages(db):
    from app.models import Outage, OutageSource, OutageStatus
    from geoalchemy2.elements import WKTElement
    import datetime

    # Outage 1 (Active, ASU01, Villa Morra)
    o1 = Outage(
        source=OutageSource.ande_official,
        status=OutageStatus.active,
        title="Corte en Villa Morra",
        barrio="Villa Morra",
        feeder_number="ASU01",
        location=WKTElement("POINT(-57.6333 -25.2866)", srid=4326),
        created_at=datetime.datetime.now()
    )
    
    # Outage 2 (Planned, ASU02, Carmelitas)
    o2 = Outage(
        source=OutageSource.twitter,
        status=OutageStatus.planned,
        title="Mantenimiento en Carmelitas",
        barrio="Carmelitas",
        feeder_number="ASU02",
        location=WKTElement("POINT(-57.6200 -25.2800)", srid=4326),
        created_at=datetime.datetime.now()
    )

    db.add_all([o1, o2])
    await db.commit()

@pytest.mark.asyncio
async def test_list_outages_no_filters(client: AsyncClient, seed_outages):
    res = await client.get("/outages/")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 2


@pytest.mark.asyncio
async def test_list_outages_filter_status(client: AsyncClient, seed_outages):
    res = await client.get("/outages/?status=active")
    assert res.status_code == 200
    data = res.json()
    for o in data:
        assert o["status"] == "active"


@pytest.mark.asyncio
async def test_list_outages_filter_feeder(client: AsyncClient, seed_outages):
    res = await client.get("/outages/?feeder=ASU02")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    for o in data:
        assert o["feeder_number"] == "ASU02"


@pytest.mark.asyncio
async def test_list_outages_spatial_filter(client: AsyncClient, seed_outages):
    # Latitude and longitude that are close to o1 (-25.2866, -57.6333)
    # but far from o2 (-25.2800, -57.6200) -- about 1.5km apart
    
    # 500m radius search around o1
    res = await client.get("/outages/?lat=-25.2860&lon=-57.6330&radius_m=500")
    assert res.status_code == 200
    data = res.json()
    
    # Ensure it found o1 (which could be duplicated by fixtures) but not o2
    assert len(data) > 0
    assert all(o["barrio"] == "Villa Morra" for o in data)
    assert data[0]["latitude"] is not None
    assert data[0]["longitude"] is not None
