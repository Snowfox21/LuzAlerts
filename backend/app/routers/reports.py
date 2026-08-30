from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from geoalchemy2.functions import ST_DWithin, ST_MakePoint, ST_SetSRID
from geoalchemy2.types import Geography
from sqlalchemy import Boolean, literal, select, cast, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.crowdsource import check_and_confirm_reports
from app.database import get_db
from app.geocoding import reverse_geocode, forward_geocode
from app.limiter import limiter
from app.models import User, UserReport
from app.report_lifecycle import (
    RESOLUTION_AUTHOR,
    active_report_clause,
    apply_auto_resolution,
)
from app.public_report import to_public_report
from app.schemas import (
    ReportCorroborate,
    ReportCreate,
    ReportOut,
    ReportPublicOut,
    ReportResolve,
    ReportsInAreaQuery,
)
from app.sharing import generate_share_code

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

    report = await _insert_report(
        db,
        user=user,
        lat=lat,
        lon=lon,
        department=payload.department,
        city=payload.city,
        barrio=payload.barrio,
        street=payload.street,
        house=payload.house,
        comment=payload.comment,
    )

    # Проверка на threshold — подтверждаем всех в радиусе
    await check_and_confirm_reports(db, lat, lon)
    await db.refresh(report)

    # Метку только что создало это устройство — она заведомо своя.
    return _attach_is_mine(report, True)


async def _insert_report(
    db: AsyncSession,
    *,
    user: User,
    lat: float,
    lon: float,
    department: Optional[str] = None,
    city: Optional[str] = None,
    barrio: Optional[str] = None,
    street: Optional[str] = None,
    house: Optional[str] = None,
    comment: Optional[str] = None,
) -> UserReport:
    """Вставить метку. Общее тело для create_report и corroborate_report.

    share_code выдается здесь же: у метки без кода нет публичной страницы,
    а значит нечего шарить — а шеринг сейчас основной канал роста.
    """
    point_wkt = f"SRID=4326;POINT({lon} {lat})"
    report = UserReport(
        user_id=user.id,
        latitude=lat,
        longitude=lon,
        location=point_wkt,
        department=department,
        city=city,
        barrio=barrio,
        street=street,
        house=house,
        comment=comment,
        share_code=generate_share_code(),
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


@router.post("/{report_id}/corroborate", response_model=ReportOut)
@limiter.limit("5/hour")
async def corroborate_report(
    request: Request,
    report_id: int,
    payload: ReportCorroborate,
    db: AsyncSession = Depends(get_db),
):
    """Сосед подтверждает чужую метку: "yo tambien estoy sin luz".

    Подтверждение — это собственная метка подтверждающего с его
    координатами, а не счетчик-лайк: порог REPORT_THRESHOLD решает, есть ли
    в квартале настоящее отключение, и накрутить его нажатиями нельзя.

    Идемпотентна по человеку: если у этого device_id уже есть активная
    метка в пределах REPORT_RADIUS_M, вторая не создается — иначе один
    пользователь дотянул бы метку до "confirmado" в одиночку.
    """
    result = await db.execute(select(UserReport).where(UserReport.id == report_id))
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")

    result = await db.execute(select(User).where(User.device_id == payload.device_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado. Regístrese primero.")

    if user.id == target.user_id:
        raise HTTPException(status_code=400, detail="No podés confirmar tu propio reporte")

    lat = payload.latitude
    lon = payload.longitude
    point = ST_SetSRID(ST_MakePoint(lon, lat), 4326)

    existing = await db.execute(
        select(UserReport.id).where(
            UserReport.user_id == user.id,
            active_report_clause(),
            ST_DWithin(
                cast(UserReport.location, Geography(srid=4326)),
                cast(point, Geography(srid=4326)),
                settings.REPORT_RADIUS_M,
            ),
        ).limit(1)
    )
    already_reported = existing.scalar_one_or_none() is not None

    if not already_reported:
        geo = await reverse_geocode(lat, lon)
        await _insert_report(
            db,
            user=user,
            lat=lat,
            lon=lon,
            city=geo.get("city"),
            barrio=geo.get("barrio"),
            street=geo.get("street"),
            comment="Confirmado desde un reporte compartido",
        )
        await check_and_confirm_reports(db, lat, lon)

    # Отдаем исходную метку: клиент показывает обновленный счетчик именно
    # на ней, на нее же он пришел по ссылке.
    await db.refresh(target)
    return _attach_is_mine(apply_auto_resolution(target), False)


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
        report.resolved_reason = RESOLUTION_AUTHOR
        report.is_active = False
        await db.commit()
        await db.refresh(report)

    # Закрывать может только автор, значит запрос пришел от него.
    return _attach_is_mine(report, True)


@router.get("/by-code/{share_code}", response_model=ReportPublicOut)
async def get_report_by_share_code(share_code: str, db: AsyncSession = Depends(get_db)):
    """Найти метку по публичному коду из ссылки /r/{code}.

    Нужна приложению: по диплинку с веб-страницы приходит код, а экран
    метки работает с id. Двух сегментов в пути хватает, чтобы не спорить
    с /reports/{report_id}.

    Отдает публичный срез, а не ReportOut: код уезжает в WhatsApp и живет
    дальше своей жизнью, поэтому по нему нельзя выдавать больше, чем
    показывает сама страница /r/{code} — то есть без street/house и с
    огрубленными координатами. Клиенту отсюда нужен только id, за
    остальным он идет на /reports/{id} со своим device_id.
    """
    result = await db.execute(select(UserReport).where(UserReport.share_code == share_code))
    report = result.scalar_one_or_none()
    if report is None:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    return to_public_report(apply_auto_resolution(report))


@router.post("/{report_id}/shared", status_code=204)
async def mark_report_shared(report_id: int, db: AsyncSession = Depends(get_db)):
    """Отметить, что метку отправили соседям.

    Счетчик нужен, чтобы понять, работает ли вирусная петля: сколько раз
    нажали "поделиться" против того, сколько раз открыли страницу метки.
    Тело ответа пустое — клиент этот вызов не ждет и ошибку глотает.
    """
    result = await db.execute(
        update(UserReport)
        .where(UserReport.id == report_id)
        .values(share_count=UserReport.share_count + 1)
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    await db.commit()
    return Response(status_code=204)


@router.get("/{report_id}", response_model=ReportOut)
async def get_report(
    report_id: int,
    device_id: Optional[str] = Query(
        None, description="ID устройства. Если совпадает с автором, вернется is_mine=true."
    ),
    db: AsyncSession = Depends(get_db),
):
    """Получить конкретный репорт по ID.

    Закрытые метки эта ручка не прячет — иначе диплинк на свою же закрытую
    метку отдавал бы 404. Просроченная метка отдается как resolved даже
    до того, как до нее дошла фоновая задача.
    """
    q = _with_is_mine(select(UserReport).where(UserReport.id == report_id), device_id)
    row = (await db.execute(q)).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    return _attach_is_mine(apply_auto_resolution(row[0]), row[1])


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

    Не отдаются: закрытые автором (resolved_at не пустой) и просроченные
    (старше REPORT_AUTO_RESOLVE_HOURS) — вторые отсекаются прямо здесь,
    чтобы не ждать очередного прогона фоновой задачи.
    """
    q = select(UserReport).where(active_report_clause())

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
