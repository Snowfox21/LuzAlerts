import logging
import re
from datetime import datetime, time, timedelta
from typing import Any

logger = logging.getLogger(__name__)

MESES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12
}

def parse_spanish_date(title: str) -> datetime | None:
    """Extracts date from 'Trabajos programados en la Región... para el Martes, 24 de febrero de 2026'."""
    match = re.search(r"(\d{1,2})\s+de\s+([a-zA-Z]+)\s+de\s+(\d{4})", title, re.IGNORECASE)
    if not match:
        return None
    day, month_str, year = match.groups()
    month = MESES.get(month_str.lower())
    if not month:
        return None
    return datetime(int(year), month, int(day))

def parse_time_range(horario_str: str, base_date: datetime) -> tuple[datetime | None, datetime | None]:
    """Extracts start and end times from 'De 07:00 a 17:00 horas'."""
    match = re.search(r"De\s+(\d{1,2}):(\d{2})\s+a\s+(\d{1,2}):(\d{2})", horario_str, re.IGNORECASE)
    if not match:
        return None, None
    h1, m1, h2, m2 = map(int, match.groups())
    start = datetime.combine(base_date.date(), time(h1, m1))
    end = datetime.combine(base_date.date(), time(h2, m2))
    
    # Handle overnight planned outages just in case
    if end < start:
        end += timedelta(days=1)
        
    return start, end

async def mark_resolved_outages() -> None:
    """
    Finds outages whose scheduled_end has passed and status is still active/planned,
    marks them resolved, and notifies users within 5 km that power has been restored.
    """
    from app.database import AsyncSessionLocal
    from app.models import Outage, OutageStatus
    from app.notifications import (
        RESOLVED_PUSH_BODY,
        RESOLVED_PUSH_TITLE,
        notify_users_near_outage,
    )
    from sqlalchemy import select

    now = datetime.utcnow()
    async with AsyncSessionLocal() as session:
        stmt = select(Outage).where(
            Outage.scheduled_end != None,
            Outage.scheduled_end < now,
            Outage.status.in_([OutageStatus.active, OutageStatus.planned]),
        )
        candidates = (await session.execute(stmt)).scalars().all()

        if not candidates:
            return

        notify_targets: list[tuple[float, float, str]] = []
        for outage in candidates:
            outage.status = OutageStatus.resolved
            outage.resolved_at = now
            if outage.latitude is not None and outage.longitude is not None:
                notify_targets.append((outage.latitude, outage.longitude, outage.title))

        await session.commit()

        for lat, lon, title in notify_targets:
            await notify_users_near_outage(
                session,
                lat,
                lon,
                title=title,
                body=RESOLVED_PUSH_BODY,
                push_title=RESOLVED_PUSH_TITLE,
            )

    logger.info(f"Marked {len(candidates)} outages as resolved.")


async def cleanup_old_data(outage_days: int = 30, report_days: int = 7) -> None:
    """Deletes old outages and user reports using independent retention windows."""
    from app.database import AsyncSessionLocal
    from app.models import Outage, UserReport
    from sqlalchemy import delete

    outage_cutoff = datetime.utcnow() - timedelta(days=outage_days)
    report_cutoff = datetime.utcnow() - timedelta(days=report_days)
    async with AsyncSessionLocal() as session:
        r1 = await session.execute(
            delete(Outage).where(
                (Outage.scheduled_end < outage_cutoff) |
                ((Outage.scheduled_end == None) & (Outage.created_at < outage_cutoff))
            )
        )
        r2 = await session.execute(
            delete(UserReport).where(UserReport.created_at < report_cutoff)
        )
        await session.commit()
    logger.info(
        "Cleanup done: removed %s outages older than %s days, %s user reports older than %s days.",
        r1.rowcount,
        outage_days,
        r2.rowcount,
        report_days,
    )


async def normalize_and_save_outages(raw_outages: list[dict[str, Any]]) -> None:
    """
    Takes raw dictionaries parsed from ANDE, cleans them, applies geocoding,
    and saves them to the PostgreSQL database.
    """
    logger.info(f"Received {len(raw_outages)} raw outages to process.")
    if not raw_outages:
        return

    from app.database import AsyncSessionLocal
    from app.models import Outage, OutageSource, OutageStatus
    from app.geocoding import forward_geocode
    from app.notifications import notify_users_near_outage
    from sqlalchemy.future import select

    async with AsyncSessionLocal() as session:
        new_outage_coords: list[tuple[float, float, str]] = []  # (lat, lon, title)

        for raw in raw_outages:
            title = raw.get("title", "")
            zona = raw.get("zona", "")
            horario = raw.get("horario", "")
            raw_text = raw.get("raw", "")
            
            base_date = parse_spanish_date(title)
            start_time, end_time = None, None
            if base_date:
                start_time, end_time = parse_time_range(horario, base_date)
            
            # Check if this exact outage is already reported (deduplication)
            stmt = select(Outage).where(
                Outage.source == OutageSource.ande_official,
                Outage.description == raw_text
            )
            existing = (await session.execute(stmt)).scalars().first()
            if existing:
                continue

            # Geocoding: Try to find coordinates for the zone
            # Clean the string: remove "ZONA XX :" prefix if it exists
            search_query = re.sub(r"ZONA\s*\d+\s*[:\-]?\s*", "", zona, flags=re.IGNORECASE).strip()
            
            # Aggressive cleaning: if it contains "Barrio ... - [City]" or "Ciudad de [City]"
            # Example: "Barrio San Jorge – Asunción" -> "San Jorge, Asunción"
            # Example: "Ciudad de San Bernardino" -> "San Bernardino"
            match_barrio = re.search(r"Barrio\s+([^-–,.]+)(?:[-–,]\s*([^-–,.]+))?", search_query, re.IGNORECASE)
            match_ciudad = re.search(r"Ciudad\s+de\s+([^-–,.]+)", search_query, re.IGNORECASE)
            
            if match_barrio:
                b, c = match_barrio.groups()
                search_query = f"{b.strip()}" + (f", {c.strip()}" if c else "")
            elif match_ciudad:
                search_query = match_ciudad.group(1).strip()
                
            if not search_query: # fallback to original if regex failed or emptied it
                search_query = zona
                
            geo_data = await forward_geocode(f"{search_query}, Paraguay")
            
            is_emergency = raw.get("source") == "ande_emergency"
            outage_lat = geo_data.get("lat")
            outage_lon = geo_data.get("lon")
            outage = Outage(
                source=OutageSource.ande_official,
                status=OutageStatus.active if is_emergency else OutageStatus.planned,
                title=title,
                description=raw_text,
                scheduled_start=start_time,
                scheduled_end=end_time,
                latitude=outage_lat,
                longitude=outage_lon,
                location=f"POINT({outage_lon} {outage_lat})" if outage_lat else None,
                barrio=geo_data.get("barrio") or (zona if "ZONA" not in zona.upper() else None)
            )
            session.add(outage)

            if outage_lat and outage_lon:
                new_outage_coords.append((outage_lat, outage_lon, title))

        await session.commit()

        for lat, lon, outage_title in new_outage_coords:
            await notify_users_near_outage(session, lat, lon, outage_title)

    logger.info("Saved outages to DB.")
