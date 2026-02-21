from fastapi import APIRouter, Depends, HTTPException
from geoalchemy2.functions import ST_DWithin, ST_MakePoint, ST_SetSRID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crowdsource import check_and_confirm_reports
from app.database import get_db
from app.geocoding import reverse_geocode
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
        raise HTTPException(status_code=404, detail="User not found. Register first via POST /users/")

    # Reverse geocode координат
    geo = await reverse_geocode(payload.latitude, payload.longitude)

    # Создать метку
    point_wkt = f"SRID=4326;POINT({payload.longitude} {payload.latitude})"
    report = UserReport(
        user_id=user.id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        location=point_wkt,
        barrio=geo["barrio"],
        street=geo["street"],
        city=geo["city"],
        comment=payload.comment,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    # Проверка на threshold — подтверждаем всех в радиусе
    await check_and_confirm_reports(db, payload.latitude, payload.longitude)

    return report


@router.get("/", response_model=list[ReportOut])
async def get_reports_in_area(
    latitude: float,
    longitude: float,
    radius_m: int = 1000,
    db: AsyncSession = Depends(get_db),
):
    """Получить все активные метки в заданном радиусе (по умолчанию 1 км)."""
    point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
    q = (
        select(UserReport)
        .where(
            UserReport.is_active == True,
            ST_DWithin(
                UserReport.location.cast("geography"),
                point.cast("geography"),
                radius_m,
            ),
        )
        .order_by(UserReport.created_at.desc())
    )
    result = await db.execute(q)
    return result.scalars().all()
