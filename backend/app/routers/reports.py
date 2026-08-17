from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from geoalchemy2.functions import ST_DWithin, ST_MakePoint, ST_SetSRID
from geoalchemy2.types import Geography
from sqlalchemy import Boolean, literal, select, cast
from sqlalchemy.ext.asyncio import AsyncSession

from app.crowdsource import check_and_confirm_reports
from app.database import get_db
from app.geocoding import reverse_geocode, forward_geocode
from app.limiter import limiter
from app.models import User, UserReport
from app.schemas import ReportCreate, ReportOut, ReportResolve, ReportsInAreaQuery

router = APIRouter(prefix="/reports", tags=["reports"])


def _with_is_mine(q, device_id: Optional[str]):
    """Добавить в SELECT вычисляемую колонку is_mine.

    Авторство считает сервер: device_id наружу не отдается никогда, клиент
    узнает только булев признак. Сравнение делается тем же запросом через
    JOIN users, поэтому список отдается без N+1.
    """
    if not device_id:
        return q.add_columns(literal(False, Boolean).label("is_mine"))
    return q.add_columns((User.device_id == device_id).label("is_mine")).outerjoin(
        User, User.id == UserReport.user_id
    )


def _attach_is_mine(report: UserReport, is_mine) -> UserReport:
    """Проставить не-mapped атрибут, который подхватит ReportOut."""
    report.is_mine = bool(is_mine)
    return report


@router.post("/", response_model=ReportOut, status_code=201)
@limiter.limit("5/hour")
async def create_report(request: Request, payload: ReportCreate, db: AsyncSession = Depends(get_db)):
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

    # Метку только что создало это устройство — она заведомо своя.
    return _attach_is_mine(report, True)


@router.post("/{report_id}/resolve", response_model=ReportOut)
async def resolve_report(
    report_id: int,
    payload: ReportResolve,
    db: AsyncSession = Depends(get_db),
):
    """Закрыть свою метку: "ya volvio la luz".

    Закрывать можно только собственные метки — device_id должен совпадать
    с автором. Повторный вызов идемпотентен и возвращает ту же метку.
    """
    result = await db.execute(select(UserReport).where(UserReport.id == report_id))
    report = result.scalar_one_or_none()
    if report is None:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")

    owner = await db.get(User, report.user_id)
    if owner is None or owner.device_id != payload.device_id:
        raise HTTPException(status_code=403, detail="Solo el autor puede cerrar este reporte")

    if report.resolved_at is None:
        # В БД колонка timestamp without time zone, сервер БД в UTC —
        # пишем naive UTC, наружу отдаем ISO с суффиксом Z.
        report.resolved_at = datetime.now(timezone.utc).replace(tzinfo=None)
        report.is_active = False
        await db.commit()
        await db.refresh(report)

    # Закрывать может только автор, значит запрос пришел от него.
    return _attach_is_mine(report, True)


@router.get("/{report_id}", response_model=ReportOut)
async def get_report(
    report_id: int,
    device_id: Optional[str] = Query(
        None, description="ID устройства. Если совпадает с автором, вернется is_mine=true."
    ),
    db: AsyncSession = Depends(get_db),
):
    """Получить конкретный репорт по ID."""
    q = _with_is_mine(select(UserReport).where(UserReport.id == report_id), device_id)
    row = (await db.execute(q)).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    return _attach_is_mine(row[0], row[1])


@router.get("/", response_model=list[ReportOut])
async def get_reports_in_area(
    latitude: Optional[float] = Query(None),
    longitude: Optional[float] = Query(None),
    radius_m: int = Query(1000),
    device_id: Optional[str] = Query(
        None, description="ID устройства. Свои метки вернутся с is_mine=true."
    ),
    db: AsyncSession = Depends(get_db),
):
    """Получить активные метки. Если заданы lat/lon, фильтровать по радиусу.

    Закрытые автором метки (resolved_at не пустой) в выдачу не попадают.
    """
    q = select(UserReport).where(
        UserReport.is_active == True,
        UserReport.resolved_at.is_(None),
    )

    if latitude is not None and longitude is not None:
        point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
        q = q.where(
            ST_DWithin(
                cast(UserReport.location, Geography(srid=4326)),
                cast(point, Geography(srid=4326)),
                radius_m,
            )
        )

    q = _with_is_mine(q.order_by(UserReport.created_at.desc()).limit(200), device_id)
    result = await db.execute(q)
    return [_attach_is_mine(report, is_mine) for report, is_mine in result.all()]
