from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from geoalchemy2.functions import ST_DWithin, ST_MakePoint, ST_SetSRID
from geoalchemy2.types import Geography
from sqlalchemy import select, cast
from sqlalchemy.ext.asyncio import AsyncSession

from app.crowdsource import check_and_confirm_reports
from app.database import get_db
from app.geocoding import reverse_geocode, forward_geocode
from app.models import User, UserReport
from app.schemas import ReportCreate, ReportOut, ReportsInAreaQuery

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("/", response_model=ReportOut, status_code=201)
async def create_report(payload: ReportCreate, db: AsyncSession = Depends(get_db)):
    """Принять геометку 'У меня нет света' от пользователя."""
    # Найти пользователя
    result = await db.execute(select(User).where(User.device_id == payload.device_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado. Regístrese primero.")

    lat = payload.latitude
    lon = payload.longitude

    if lat is None or lon is None:
        # Пытаемся получить координаты по адресу (Forward Geocoding)
        address_parts = [
            payload.street, payload.house, payload.barrio, payload.city, payload.department, "Paraguay"
        ]
        address_str = ", ".join([p for p in address_parts if p])
        geo = await forward_geocode(address_str)
        if geo["lat"] is None or geo["lon"] is None:
            raise HTTPException(status_code=400, detail="No se pudo determinar la ubicación desde la dirección proporcionada. Intente ser más específico.")
        lat = geo["lat"]
        lon = geo["lon"]
    else:
        # Если есть координаты, но нет адреса, можно сделать reverse geocode, но так как 
        # фронтенд теперь сам будет делать reverse geocoding, мы просто используем то, что пришло,
        # либо дозаполняем пустые поля
        if not payload.city or not payload.street:
            geo = await reverse_geocode(lat, lon)
            payload.city = payload.city or geo.get("city")
            payload.street = payload.street or geo.get("street")
            payload.barrio = payload.barrio or geo.get("barrio")

    # Создать метку
    point_wkt = f"SRID=4326;POINT({lon} {lat})"
    report = UserReport(
        user_id=user.id,
        latitude=lat,
        longitude=lon,
        location=point_wkt,
        department=payload.department,
        city=payload.city,
        barrio=payload.barrio,
        street=payload.street,
        house=payload.house,
        comment=payload.comment,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    # Проверка на threshold — подтверждаем всех в радиусе
    await check_and_confirm_reports(db, lat, lon)

    return report


@router.get("/{report_id}", response_model=ReportOut)
async def get_report(report_id: int, db: AsyncSession = Depends(get_db)):
    """Получить конкретный репорт по ID."""
    result = await db.execute(select(UserReport).where(UserReport.id == report_id))
    report = result.scalar_one_or_none()
    if report is None:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    return report


@router.get("/", response_model=list[ReportOut])
async def get_reports_in_area(
    latitude: Optional[float] = Query(None),
    longitude: Optional[float] = Query(None),
    radius_m: int = Query(1000),
    db: AsyncSession = Depends(get_db),
):
    """Получить активные метки. Если заданы lat/lon, фильтровать по радиусу."""
    q = select(UserReport).where(UserReport.is_active == True)

    if latitude is not None and longitude is not None:
        point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
        q = q.where(
            ST_DWithin(
                cast(UserReport.location, Geography(srid=4326)),
                cast(point, Geography(srid=4326)),
                radius_m,
            )
        )

    q = q.order_by(UserReport.created_at.desc()).limit(200)
    result = await db.execute(q)
    return result.scalars().all()
