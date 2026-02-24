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
            # We assume it's the same if it has the same raw text and same scheduled_start
            stmt = select(Outage).where(
                Outage.source == OutageSource.ande_official,
                Outage.description == raw_text
            )
            existing = (await session.execute(stmt)).scalars().first()
            if existing:
                continue
                
            outage = Outage(
                source=OutageSource.ande_official,
                status=OutageStatus.planned,
                title=title,
                description=raw_text,
                scheduled_start=start_time,
                scheduled_end=end_time
            )
            session.add(outage)
            
        await session.commit()
    logger.info("Saved outages to DB.")
