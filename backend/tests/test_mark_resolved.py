"""Автозакрытие отключений ANDE по scheduled_end — в местном времени Парагвая."""
from datetime import timedelta

import pytest
from sqlalchemy import select

import processor
from app.models import Outage, OutageSource, OutageStatus


@pytest.mark.asyncio
async def test_mark_resolved_uses_paraguay_time(db, monkeypatch):
    pushes = []

    async def fake_notify(session, lat, lon, title, body=None, push_title=None, resolved=False):
        pushes.append((title, resolved))

    monkeypatch.setattr("app.notifications.notify_users_near_outage", fake_notify)

    now_py = processor.paraguay_now()
    # Кончится через час по местному времени. По UTC это уже "прошлое" —
    # раньше такое отключение закрывалось на 3 часа раньше срока.
    ongoing = Outage(source=OutageSource.ande_official, status=OutageStatus.planned, title="Sigue",
                     latitude=-25.3, longitude=-57.6, scheduled_end=now_py + timedelta(hours=1))
    finished = Outage(source=OutageSource.ande_official, status=OutageStatus.planned, title="Terminó",
                      latitude=-25.3, longitude=-57.6, scheduled_end=now_py - timedelta(minutes=5))
    db.add_all([ongoing, finished])
    await db.commit()
    try:
        await processor.mark_resolved_outages()
        rows = {o.title: o.status for o in (await db.execute(
            select(Outage).where(Outage.id.in_([ongoing.id, finished.id])).execution_options(populate_existing=True)
        )).scalars()}
        assert rows == {"Sigue": OutageStatus.planned, "Terminó": OutageStatus.resolved}
        assert pushes == [("Terminó", True)]
    finally:
        for o in (ongoing, finished):
            await db.delete(o)
        await db.commit()
