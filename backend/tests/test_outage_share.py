"""Шеринг официального отключения: share_url и страница /o/{id}."""
from datetime import datetime

import pytest
from httpx import AsyncClient

from app.config import settings
from app.models import Outage, OutageSource, OutageStatus


@pytest.mark.asyncio
async def test_outage_share_url_and_page(client: AsyncClient, db):
    outage = Outage(
        source=OutageSource.ande_official,
        status=OutageStatus.planned,
        title="Trabajos en línea de media tensión",
        barrio="Barrio Obrero",
        latitude=-25.30,
        longitude=-57.62,
        scheduled_start=datetime(2026, 10, 27, 11, 0),
        scheduled_end=datetime(2026, 10, 27, 15, 0),
    )
    db.add(outage)
    await db.commit()
    await db.refresh(outage)
    try:
        detail = (await client.get(f"/outages/{outage.id}")).json()
        assert detail["share_url"] == f"{settings.PUBLIC_BASE_URL}/o/{outage.id}"
        listed = [o for o in (await client.get("/outages/")).json() if o["id"] == outage.id]
        assert listed and listed[0]["share_url"] == detail["share_url"]

        page = await client.get(f"/o/{outage.id}")
        assert page.status_code == 200
        html = page.text
        assert 'property="og:title" content="🗓️ Corte programado en Barrio Obrero"' in html
        assert f'luzalerts://outage/{outage.id}' in html
        assert f'/app/outage/{outage.id}' in html
        assert "2026-10-27T11:00:00Z" in html
    finally:
        await db.delete(outage)
        await db.commit()


@pytest.mark.asyncio
async def test_outage_share_page_404(client: AsyncClient):
    assert (await client.get("/o/999999")).status_code == 404
