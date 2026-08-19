import logging

from geoalchemy2.functions import ST_DWithin, ST_MakePoint, ST_SetSRID
from geoalchemy2.types import Geography
from sqlalchemy import func, select, text, cast, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import UserReport
from app.notifications import notify_users_near_outage
from app.report_lifecycle import (
    RESOLUTION_AUTO,
    active_report_clause,
    expiry_cutoff,
)

logger = logging.getLogger(__name__)


async def check_and_confirm_reports(db: AsyncSession, lat: float, lon: float) -> int:
    """
    Считает активные метки в радиусе REPORT_RADIUS_M вокруг точки.
    Если >= REPORT_THRESHOLD — помечает их как confirmed.
    Возвращает количество соседних меток.
    """
    point = ST_SetSRID(ST_MakePoint(lon, lat), 4326)

    count_q = select(func.count(UserReport.id)).where(
        active_report_clause(),
        ST_DWithin(
            cast(UserReport.location, Geography(srid=4326)),
            cast(point, Geography(srid=4326)),
            settings.REPORT_RADIUS_M,
        ),
    )
    result = await db.execute(count_q)
    count = result.scalar_one()

    if count >= settings.REPORT_THRESHOLD:
        update_q = (
            select(UserReport)
            .where(
                active_report_clause(),
                ST_DWithin(
                    cast(UserReport.location, Geography(srid=4326)),
                    cast(point, Geography(srid=4326)),
                    settings.REPORT_RADIUS_M,
                ),
            )
        )
        reports = (await db.execute(update_q)).scalars().all()
        for r in reports:
            r.confirmed = True
            r.confirmation_count = count
        await db.commit()

        barrio = reports[0].barrio if reports else None
        body = f"Corte confirmado en {barrio}" if barrio else "Corte confirmado por usuarios cercanos"
        await notify_users_near_outage(db, lat, lon, body)

    return count


async def auto_resolve_expired_reports(db: AsyncSession) -> int:
    """Закрыть метки, которым больше REPORT_AUTO_RESOLVE_HOURS часов.

    resolved_at ставится равным моменту истечения срока (created_at + срок),
    а не моменту прогона: дата показывается пользователю строкой
    "La luz volvio el ...", и она не должна зависеть от того, когда именно
    проснулся планировщик. Плюс ровно это же значение считает читающая
    сторона, так что БД и выдача не расходятся.

    Идемпотентна: берет только метки с resolved_at IS NULL, поэтому закрытые
    вручную не перезаписываются, а повторный прогон ничего не меняет.
    """
    stmt = (
        update(UserReport)
        .where(
            UserReport.resolved_at.is_(None),
            UserReport.created_at <= expiry_cutoff(),
        )
        .values(
            # make_interval(years, months, weeks, days, hours) — срок берется
            # из настройки, литерала 96 в SQL нет.
            resolved_at=UserReport.created_at
            + func.make_interval(0, 0, 0, 0, settings.REPORT_AUTO_RESOLVE_HOURS),
            resolved_reason=RESOLUTION_AUTO,
            is_active=False,
        )
    )
    result = await db.execute(stmt)
    await db.commit()
    closed = result.rowcount or 0
    if closed:
        logger.info(
            "Auto-resolved %s user reports older than %sh",
            closed,
            settings.REPORT_AUTO_RESOLVE_HOURS,
        )
    return closed
