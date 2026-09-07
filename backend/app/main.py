from datetime import datetime, timedelta
from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from geoalchemy2.functions import ST_DWithin, ST_MakePoint, ST_SetSRID
from geoalchemy2.types import Geography
from sqlalchemy import cast, exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.limiter import limiter
from app.models import Outage, OutageSource, ScraperRun, UserReport
from app.routers import users, outages, reports, share, subscriptions, comments


app = FastAPI(
    title="LuzAlerts API",
    description="Monitoreo de cortes de energía en Paraguay",
    version="0.1.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(users.router)
app.include_router(outages.router)
app.include_router(reports.router)
app.include_router(subscriptions.router)
app.include_router(comments.router)
app.include_router(share.router)


@app.get("/", tags=["health"])
async def health_check():
    return {"status": "ok", "service": "LuzAlerts API"}


@app.get("/status", tags=["health"])
async def system_status(db: AsyncSession = Depends(get_db)):
    """Состояние системы: API жив + дата последних данных ANDE.

    Время попытки и время успешной проверки источника разделены намеренно:
    пустой результат успешной попытки не маскирует падение scraper.
    """
    attempt = (await db.execute(select(ScraperRun).order_by(ScraperRun.attempted_at.desc()).limit(1))).scalar_one_or_none()
    success = (await db.execute(select(ScraperRun).where(ScraperRun.success.is_(True)).order_by(ScraperRun.finished_at.desc()).limit(1))).scalar_one_or_none()
    latest_data = (await db.execute(select(func.max(Outage.created_at)).where(Outage.source == OutageSource.ande_official))).scalar_one()
    now = datetime.utcnow()
    nearby_official = exists(select(Outage.id).where(
        Outage.source == OutageSource.ande_official,
        Outage.latitude.is_not(None), Outage.longitude.is_not(None),
        UserReport.latitude.is_not(None), UserReport.longitude.is_not(None),
        ST_DWithin(
            cast(ST_SetSRID(ST_MakePoint(Outage.longitude, Outage.latitude), 4326), Geography(srid=4326)),
            cast(ST_SetSRID(ST_MakePoint(UserReport.longitude, UserReport.latitude), 4326), Geography(srid=4326)),
            500,
        ),
    ))
    # Keep the 30-day miss metric privacy-safe: it is an aggregate only.
    miss_query = select(func.count(UserReport.id)).where(
        UserReport.confirmed.is_(True), UserReport.created_at >= now - timedelta(days=30),
        ~nearby_official,
    )
    misses = (await db.execute(miss_query)).scalar_one()
    return {
        "status": "ok",
        "last_ande_data": latest_data.isoformat() if latest_data else None,
        "last_attempt": attempt.attempted_at.isoformat() if attempt else None,
        "last_success": success.finished_at.isoformat() if success and success.finished_at else None,
        "coverage_valid_when": success.finished_at.isoformat() if success and success.identity_valid and success.container_found else None,
        "misses_confirmados_30d": misses,
        "ande_ids": {
            "monotonic": success.ids_monotonic if success else None,
            "dense": success.ids_dense if success else None,
            "added": success.ids_added if success else [],
            "removed": success.ids_removed if success else [],
        },
    }


@app.get("/events.json", tags=["feed"])
async def events_feed(db: AsyncSession = Depends(get_db)):
    """Small, stable public feed for agents and downstream consumers."""
    result = await db.execute(select(Outage).order_by(Outage.created_at.desc()).limit(200))
    events = []
    for o in result.scalars():
        events.append({
            "id": o.id, "ande_id": o.ande_id, "source": o.source.value, "status": o.status.value,
            "title": o.title, "description": o.description, "barrio": o.barrio,
            "latitude": o.latitude, "longitude": o.longitude,
            "scheduled_start": o.scheduled_start.isoformat() if o.scheduled_start else None,
            "scheduled_end": o.scheduled_end.isoformat() if o.scheduled_end else None,
            "created_at": o.created_at.isoformat(), "resolved_at": o.resolved_at.isoformat() if o.resolved_at else None,
        })
    reports = await db.execute(
        select(UserReport).where(UserReport.is_active.is_(True)).order_by(UserReport.created_at.desc()).limit(200)
    )
    for report in reports.scalars():
        # User coordinates are intentionally coarsened in a public feed.
        events.append({
            "id": f"report-{report.id}", "source": "crowdsource", "status": "active",
            "title": report.comment or "Corte reportado por usuario", "description": None,
            "barrio": report.barrio or report.city, "latitude": round(report.latitude, 2),
            "longitude": round(report.longitude, 2), "scheduled_start": None,
            "scheduled_end": None, "created_at": report.created_at.isoformat(), "resolved_at": None,
        })
    return JSONResponse({"version": 1, "generated_at": datetime.utcnow().isoformat() + "Z", "events": events})
