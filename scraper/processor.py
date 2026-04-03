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

async def cleanup_old_data(days: int = 7) -> None:
    """Deletes outages and user reports older than `days` days."""
    from app.database import AsyncSessionLocal
    from app.models import Outage, UserReport
    from sqlalchemy import delete

    cutoff = datetime.utcnow() - timedelta(days=days)
    async with AsyncSessionLocal() as session:
        r1 = await session.execute(
            delete(Outage).where(
                (Outage.scheduled_end < cutoff) |
                ((Outage.scheduled_end == None) & (Outage.created_at < cutoff))
            )
        )
        r2 = await session.execute(
            delete(UserReport).where(UserReport.created_at < cutoff)
        )
        await session.commit()
    logger.info(f"Cleanup done: removed {r1.rowcount} outages, {r2.rowcount} user reports older than {days} days.")


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
    from sqlalchemy.future import select
    
    async with AsyncSessionLocal() as session:
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
            outage = Outage(
                source=OutageSource.ande_official,
                status=OutageStatus.active if is_emergency else OutageStatus.planned,
                title=title,
                description=raw_text,
                scheduled_start=start_time,
                scheduled_end=end_time,
                latitude=geo_data.get("lat"),
                longitude=geo_data.get("lon"),
                location=f"POINT({geo_data.get('lon')} {geo_data.get('lat')})" if geo_data.get("lat") else None,
                barrio=geo_data.get("barrio") or (zona if "ZONA" not in zona.upper() else None)
            )
            session.add(outage)
            
        await session.commit()
    logger.info("Saved outages to DB.")
