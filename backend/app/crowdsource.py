from geoalchemy2.functions import ST_DWithin, ST_MakePoint, ST_SetSRID
from geoalchemy2.types import Geography
from sqlalchemy import func, select, text, cast
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import UserReport


async def check_and_confirm_reports(db: AsyncSession, lat: float, lon: float) -> int:
    """
    Считает активные метки в радиусе REPORT_RADIUS_M вокруг точки.
    Если >= REPORT_THRESHOLD — помечает их как confirmed.
    Возвращает количество соседних меток.
    """
    point = ST_SetSRID(ST_MakePoint(lon, lat), 4326)

    count_q = select(func.count(UserReport.id)).where(
        UserReport.is_active == True,
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
                UserReport.is_active == True,
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
        await db.commit()

    return count
