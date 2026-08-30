from fastapi import Depends, FastAPI
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.limiter import limiter
from app.models import Outage, OutageSource
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

    last_ande_data — created_at последнего official-корта; null, если данных нет.
    Фронт показывает по этому полю плашку "Datos de ANDE sin novedades desde DD/MM".
    """
    result = await db.execute(
        select(func.max(Outage.created_at)).where(Outage.source == OutageSource.ande_official)
    )
    last = result.scalar()
    return {
        "status": "ok",
        "last_ande_data": last.isoformat() if last else None,
    }
