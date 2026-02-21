from fastapi import APIRouter, Depends, Query
from geoalchemy2.functions import ST_DWithin, ST_MakePoint, ST_SetSRID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Outage, OutageStatus
from app.schemas import OutageOut

router = APIRouter(prefix="/outages", tags=["outages"])


def _extract_coords(outage: Outage) -> tuple[float | None, float | None]:
    """Достаём lat/lon из WKB-геометрии (PostGIS возвращает bytes)."""
    if outage.location is None:
        return None, None
    from geoalchemy2.shape import to_shape
    point = to_shape(outage.location)
    return point.y, point.x  # lat, lon


@router.get("/", response_model=list[OutageOut])
async def list_outages(
    status: str | None = Query(None, description="active | planned | resolved"),
    barrio: str | None = Query(None),
    feeder: str | None = Query(None),
    lat: float | None = Query(None),
    lon: float | None = Query(None),
    radius_m: int = Query(5000, ge=100, le=50000),
    db: AsyncSession = Depends(get_db),
):
    """
    Список отключений с опциональной фильтрацией по статусу, барrio, фидеру
    и/или радиусу вокруг координат пользователя.
    """
    q = select(Outage)

    if status:
        try:
            q = q.where(Outage.status == OutageStatus(status))
        except ValueError:
            pass

    if barrio:
        q = q.where(Outage.barrio.ilike(f"%{barrio}%"))

    if feeder:
        q = q.where(Outage.feeder_number == feeder)

    if lat is not None and lon is not None:
        point = ST_SetSRID(ST_MakePoint(lon, lat), 4326)
        q = q.where(ST_DWithin(Outage.location.cast("geography"), point.cast("geography"), radius_m))

    q = q.order_by(Outage.created_at.desc()).limit(200)
    result = await db.execute(q)
    outages = result.scalars().all()

    items = []
    for o in outages:
        lat_v, lon_v = _extract_coords(o)
        items.append(OutageOut(
            id=o.id,
            source=o.source.value,
            status=o.status.value,
            title=o.title,
            description=o.description,
            barrio=o.barrio,
            feeder_number=o.feeder_number,
            latitude=lat_v,
            longitude=lon_v,
            scheduled_start=o.scheduled_start,
            scheduled_end=o.scheduled_end,
            created_at=o.created_at,
            resolved_at=o.resolved_at,
        ))
    return items
