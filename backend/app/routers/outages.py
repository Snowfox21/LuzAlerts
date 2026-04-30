import re

from fastapi import APIRouter, Depends, HTTPException, Query
from geoalchemy2.functions import ST_DWithin, ST_MakePoint, ST_SetSRID
from geoalchemy2.types import Geography
from sqlalchemy import select, cast
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.geocoding import forward_geocode
from app.models import Outage, OutageStatus
from app.schemas import OutageOut

router = APIRouter(prefix="/outages", tags=["outages"])


def _extract_coords(outage: Outage) -> tuple[float | None, float | None]:
    """Достаём lat/lon из WKB-геометрии (PostGIS возвращает bytes)."""
    if outage.latitude is not None and outage.longitude is not None:
        return outage.latitude, outage.longitude

    if outage.location is None:
        return None, None
    from geoalchemy2.shape import to_shape
    point = to_shape(outage.location)
    return point.y, point.x  # lat, lon


def _build_geocode_candidates(outage: Outage) -> list[str]:
    candidates: list[str] = []

    if outage.barrio:
        candidates.append(outage.barrio.strip())

    if outage.description:
        zone_match = re.search(r"ZONA\s*\d+\s*[:\-]?\s*(.+?)(?:\n|$)", outage.description, re.IGNORECASE)
        if zone_match:
            candidates.append(zone_match.group(1).strip())

    if outage.title:
        candidates.append(outage.title.strip())

    normalized: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        cleaned = re.sub(r"\s+", " ", candidate).strip(" ,.-")
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(cleaned)

    return normalized


async def _ensure_outage_coords(db: AsyncSession, outage: Outage) -> tuple[float | None, float | None]:
    lat_v, lon_v = _extract_coords(outage)
    if lat_v is not None and lon_v is not None:
        return lat_v, lon_v

    if outage.latitude is not None and outage.longitude is not None:
        return outage.latitude, outage.longitude

    for candidate in _build_geocode_candidates(outage):
        geo = await forward_geocode(f"{candidate}, Paraguay")
        lat = geo.get("lat")
        lon = geo.get("lon")
        if lat is None or lon is None:
            continue

        outage.latitude = lat
        outage.longitude = lon
        outage.location = f"SRID=4326;POINT({lon} {lat})"
        if not outage.barrio and geo.get("barrio"):
            outage.barrio = geo["barrio"]

        await db.commit()
        await db.refresh(outage)
        return lat, lon

    return None, None


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
        q = q.where(ST_DWithin(cast(Outage.location, Geography(srid=4326)), cast(point, Geography(srid=4326)), radius_m))

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


@router.get("/{outage_id}", response_model=OutageOut)
async def get_outage(
    outage_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Получить информацию о конкретном отключении по ID."""
    result = await db.execute(select(Outage).where(Outage.id == outage_id))
    o = result.scalar_one_or_none()

    if o is None:
        raise HTTPException(status_code=404, detail="Outage no encontrado")

    lat_v, lon_v = await _ensure_outage_coords(db, o)
    return OutageOut(
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
    )
