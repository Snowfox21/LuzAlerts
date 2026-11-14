import logging

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import UserReport
from app.notifications import notify_users_near_outage
from app.report_lifecycle import (
    RESOLUTION_AUTO,
    active_report_clause,
    expiry_cutoff,
)
from app.report_zones import ZoneAnchor, reports_in_zone

logger = logging.getLogger(__name__)


async def check_and_confirm_reports(db: AsyncSession, anchor: UserReport) -> int:
    """Recalcular el contador de la zona del reporte `anchor` y confirmarla.

    La zona la define app.report_zones: la ciudad entera en una ciudad
    común, el barrio y los de al lado en Asunción. Cuenta vecinos distintos,
    no reportes: una misma persona con dos reportes en la zona suma uno,
    si no podría confirmar un corte ella sola.

    Devuelve cuántos vecinos distintos reportaron en la zona.
    """
    reports = await reports_in_zone(db, ZoneAnchor.from_report(anchor))
    count = len({r.user_id for r in reports})
    reached = count >= settings.REPORT_THRESHOLD
    # Antes de marcar: quiénes ya estaban confirmados y quiénes se suman ahora.
    already = [(r.latitude, r.longitude) for r in reports if r.confirmed]
    joining = [(r.latitude, r.longitude) for r in reports if not r.confirmed]

    # El contador se guarda también por debajo del umbral: la pantalla del
    # reporte muestra "2 de 3" y sin esto siempre diría 0. Nunca lo bajamos,
    # para no restarle a un reporte que ya sumó en otro grupo.
    for r in reports:
        r.confirmation_count = max(r.confirmation_count or 0, count)
        if reached:
            r.confirmed = True
    await db.commit()

    # La zona puede ser una ciudad entera, así que se avisa a quien esté
    # cerca de cualquiera de los reportes que se confirman ahora, no solo del
    # último. Quien ya recibió el aviso por un reporte confirmado antes no lo
    # recibe de nuevo: el cuarto vecino de la misma cuadra no dispara otro
    # push, pero uno en la otra punta de la ciudad sí avisa a los suyos.
    if reached and joining:
        place = anchor.barrio or anchor.city
        body = f"Corte confirmado en {place}" if place else "Corte confirmado por usuarios cercanos"
        # El punto principal viaja en el push (data.lat/lon): el del reporte
        # que disparó la confirmación, si es uno de los que se suman.
        main = (anchor.latitude, anchor.longitude)
        if main not in joining:
            main = joining[0]
        others = [p for p in joining if p != main]
        await notify_users_near_outage(
            db, main[0], main[1], body, extra_points=others, exclude_points=already
        )

    return count


async def recount_active_reports(db: AsyncSession) -> int:
    """Recalcular las zonas de todos los reportes activos.

    Corre en el mantenimiento periódico del scraper. Arregla los contadores
    que quedaron cortos: reportes anteriores a las zonas por ciudad, o
    reportes que se crearon cuando el geocoder no devolvió la ciudad.
    Devuelve cuántos reportes cambiaron de contador o de estado.
    """
    reports = (await db.execute(select(UserReport).where(active_report_clause()))).scalars().all()
    before = {r.id: (r.confirmation_count or 0, r.confirmed) for r in reports}
    for report in reports:
        await check_and_confirm_reports(db, report)
    return sum(1 for r in reports if (r.confirmation_count or 0, r.confirmed) != before[r.id])


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
