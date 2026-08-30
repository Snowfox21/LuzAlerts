"""Публичный срез метки — то, что можно показать кому угодно.

Живет отдельно от роутеров, потому что нужен двоим: HTML-странице
/r/{code} и ручке /reports/by-code/{code}. Оба конца работают с публичным
кодом, который уезжает в WhatsApp и дальше живет своей жизнью, поэтому
отдавать по нему полный ReportOut нельзя.
"""
from app.models import UserReport
from app.schemas import ReportPublicOut

# Точность координат на публичной стороне. 2 знака — это ~1.1 км: квартал
# на карте виден, конкретный дом автора — нет.
PUBLIC_COORD_PRECISION = 2


def to_public_report(report: UserReport) -> ReportPublicOut:
    """Срез метки без домашнего адреса автора.

    street и house не попадают сюда никогда: это адрес человека, который
    сам же и рассылает ссылку в WhatsApp-группу квартала.
    """
    return ReportPublicOut(
        id=report.id,
        share_code=report.share_code,
        barrio=report.barrio,
        city=report.city,
        department=report.department,
        latitude=round(report.latitude, PUBLIC_COORD_PRECISION),
        longitude=round(report.longitude, PUBLIC_COORD_PRECISION),
        confirmation_count=report.confirmation_count,
        confirmed=report.confirmed,
        created_at=report.created_at,
        resolved=report.resolved_at is not None,
    )
