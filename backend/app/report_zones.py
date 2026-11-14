"""Zonas de confirmación de los reportes vecinales.

Un corte se confirma cuando REPORT_THRESHOLD vecinos distintos lo reportan en
la misma zona. Qué es "la misma zona" depende de la ciudad:

- En una ciudad común (Luque, San Lorenzo, Lambaré...) la zona es la ciudad
  entera: dos vecinos de Luque sin luz cuentan para el mismo corte aunque
  vivan en barrios opuestos.
- En las ciudades grandes de REPORT_BARRIO_LEVEL_CITIES (Asunción) la ciudad
  entera sería demasiado: ahí la zona es el mismo barrio más los barrios de
  al lado, aproximados con un radio de REPORT_RADIUS_M alrededor del reporte.
- Si el geocoder no devolvió la ciudad, queda solo el radio.

La ciudad se compara normalizada (sin tildes ni mayúsculas): el nombre llega
a veces de Nominatim y a veces del celular, y "Asunción" / "asuncion" tienen
que caer en la misma zona. Para no juntar ciudades homónimas de otros
departamentos, la búsqueda se limita además a REPORT_CITY_MAX_DISTANCE_M.
"""
import unicodedata
from dataclasses import dataclass

from geoalchemy2.functions import ST_Distance, ST_DWithin, ST_MakePoint, ST_SetSRID
from geoalchemy2.types import Geography
from sqlalchemy import cast, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import UserReport
from app.report_lifecycle import active_report_clause


def normalize_place(name: str | None) -> str | None:
    """Nombre de ciudad o barrio listo para comparar: sin tildes, en minúsculas."""
    if not name:
        return None
    decomposed = unicodedata.normalize("NFKD", name)
    plain = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    normalized = " ".join(plain.lower().split())
    return normalized or None


def barrio_level_cities() -> set[str]:
    """Ciudades donde la zona es el barrio y sus vecinos, no la ciudad entera."""
    return {
        n
        for n in (normalize_place(c) for c in settings.REPORT_BARRIO_LEVEL_CITIES.split(","))
        if n
    }


@dataclass(frozen=True)
class ZoneAnchor:
    """El punto desde el que se arma la zona: un reporte nuevo o uno existente."""

    latitude: float
    longitude: float
    city: str | None = None
    barrio: str | None = None

    @classmethod
    def from_report(cls, report: UserReport) -> "ZoneAnchor":
        return cls(report.latitude, report.longitude, report.city, report.barrio)


def in_same_zone(anchor: ZoneAnchor, other: UserReport, distance_m: float) -> bool:
    """¿El reporte `other`, a `distance_m` del ancla, es de la misma zona?

    La relación es simétrica: si A está en la zona de B, B está en la de A.
    Gracias a eso alcanza con recalcular la zona del reporte nuevo para que
    el contador del reporte original también suba.
    """
    city = normalize_place(anchor.city)
    other_city = normalize_place(other.city)

    if city and other_city and city != other_city:
        return False

    if city and city not in barrio_level_cities():
        # Ciudad común: toda la ciudad es una sola zona. Un reporte sin
        # ciudad cerca del límite entra solo por el radio.
        return other_city == city or distance_m <= settings.REPORT_RADIUS_M

    # Ciudad grande o ciudad desconocida: mismo barrio o barrio vecino.
    barrio = normalize_place(anchor.barrio)
    if city and other_city == city and barrio and barrio == normalize_place(other.barrio):
        return True
    return distance_m <= settings.REPORT_RADIUS_M


async def reports_in_zone(db: AsyncSession, anchor: ZoneAnchor) -> list[UserReport]:
    """Reportes activos de la misma zona que el ancla (incluido el propio, si ya existe)."""
    point = cast(ST_SetSRID(ST_MakePoint(anchor.longitude, anchor.latitude), 4326), Geography(srid=4326))
    location = cast(UserReport.location, Geography(srid=4326))
    search_radius = max(settings.REPORT_CITY_MAX_DISTANCE_M, settings.REPORT_RADIUS_M)

    rows = (
        await db.execute(
            select(UserReport, ST_Distance(location, point).label("distance_m")).where(
                active_report_clause(),
                ST_DWithin(location, point, search_radius),
            )
        )
    ).all()
    return [report for report, distance_m in rows if in_same_zone(anchor, report, distance_m)]
