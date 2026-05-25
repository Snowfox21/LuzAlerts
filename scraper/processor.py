import logging
import re
from datetime import datetime, time, timedelta
from typing import Any

logger = logging.getLogger(__name__)

MESES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12
}

ZONA_PREFIX_RE = re.compile(r"^\s*ZONA\s*\d+\s*[:\-]?\s*", re.IGNORECASE)
BARRIO_RE = re.compile(r"Barrio\s+([^-–,.]+)(?:[-–,]\s*([^-–,.]+))?", re.IGNORECASE)
CIUDAD_RE = re.compile(r"Ciudad\s+de\s+([^-–,.]+)", re.IGNORECASE)
DEPT_PREFIX_RE = re.compile(r"^Departamentos?\s+de\s+", re.IGNORECASE)
EMDASH_SPLIT_RE = re.compile(r"\s*[–-]\s*")
MAX_GEOCODE_ATTEMPTS = 3


def _clean_segment(s: str) -> str:
    s = s.strip().strip(".,;:")
    s = DEPT_PREFIX_RE.sub("", s).strip()
    if "," in s:
        s = s.split(",", 1)[0].strip()
    return s


def build_geocode_queries(zona: str) -> list[str]:
    """
    Build a priority-ordered list of geocoding search queries for an ANDE zona string.
    Tries specific (Barrio + City) first, broadest (city only) last. Caller iterates
    until forward_geocode returns coordinates.
    """
    if not zona:
        return []
    stripped = ZONA_PREFIX_RE.sub("", zona).strip()
    if not stripped:
        return []

    candidates: list[str] = []

    m = BARRIO_RE.search(stripped)
    if m:
        b, c = m.groups()
        b = b.strip()
        c = c.strip() if c else None
        candidates.append(f"{b}, {c}" if c else b)

    m = CIUDAD_RE.search(stripped)
    if m:
        candidates.append(m.group(1).strip())

    # Many zonas put city + department at the end, after a period or em-dash chain.
    # Take the tail after the last period (if any) and split by em-dash for City/Dept.
    tail = stripped.rsplit(".", 1)[-1].strip()
    tail_segs = [s.strip() for s in EMDASH_SPLIT_RE.split(tail) if s.strip()]
    if len(tail_segs) >= 2:
        city_seg = _clean_segment(tail_segs[-2])
        dept_seg = _clean_segment(tail_segs[-1])
        if city_seg and dept_seg:
            candidates.append(f"{city_seg}, {dept_seg}")
        if city_seg:
            candidates.append(city_seg)
    elif len(tail_segs) == 1:
        only = _clean_segment(tail_segs[0])
        if only:
            candidates.append(only)

    seen: set[str] = set()
    result: list[str] = []
    for c in candidates:
        c = c.strip()
        if not c or len(c) < 3 or len(c) > 80:
            continue
        key = c.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(c)

    return result

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

            # Skip historical outages — ANDE keeps old articles on their site.
            # Allow 1-day grace period to cover Paraguay's UTC-4 offset.
            if end_time and end_time < datetime.utcnow() - timedelta(days=1):
                logger.info("Skipping historical outage '%s' (ended %s)", title, end_time)
                continue

            # Check if this exact outage is already reported (deduplication)
            stmt = select(Outage).where(
                Outage.source == OutageSource.ande_official,
                Outage.description == raw_text
            )
            existing = (await session.execute(stmt)).scalars().first()
            if existing:
                continue

            # Geocoding: try a priority-ordered chain of progressively simpler
            # queries derived from the zona string, stop at the first hit.
            queries = build_geocode_queries(zona) or [zona]
            geo_data: dict[str, Any] = {"lat": None, "lon": None, "display_name": None, "barrio": None}
            for q in queries[:MAX_GEOCODE_ATTEMPTS]:
                geo_data = await forward_geocode(f"{q}, Paraguay")
                if geo_data.get("lat"):
                    break
            
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
    await warn_if_no_upcoming_outages()


async def warn_if_no_upcoming_outages(stale_after_days: int = 2) -> None:
    """
    Emits a WARNING if ANDE has not published any outage scheduled for the future
    within the last `stale_after_days` days. Helps surface cases where ANDE stops
    publishing trabajos programados (data gap, not a scraper bug).
    """
    from app.database import AsyncSessionLocal
    from app.models import Outage, OutageSource
    from sqlalchemy import func, select

    now = datetime.utcnow()
    async with AsyncSessionLocal() as session:
        upcoming_stmt = select(func.count()).select_from(Outage).where(
            Outage.source == OutageSource.ande_official,
            Outage.scheduled_end > now,
        )
        upcoming = (await session.execute(upcoming_stmt)).scalar_one()
        if upcoming > 0:
            return

        latest_stmt = select(func.max(Outage.scheduled_start)).where(
            Outage.source == OutageSource.ande_official,
        )
        latest = (await session.execute(latest_stmt)).scalar_one()

    if latest is None:
        logger.warning(
            "ANDE staleness alert: no official outages in DB and none upcoming. "
            "ANDE may have stopped publishing 'trabajos programados' or the page structure changed."
        )
        return

    age_days = (now - latest).days
    if age_days >= stale_after_days:
        logger.warning(
            "ANDE staleness alert: no upcoming outages — latest published outage is %d days old (%s). "
            "ANDE may have stopped publishing 'trabajos programados' or the page structure changed.",
            age_days, latest.isoformat(timespec="minutes"),
        )
