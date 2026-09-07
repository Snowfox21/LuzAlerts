import asyncio
import logging
import os
import time
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

# Residential SOCKS tunnel used only as a fallback when direct (datacenter) egress
# gets flagged by Radware — parse_outages returns [] in that case. Empty → no
# fallback. Keeps direct egress as the primary path (no tunnel dependency in normal
# operation) while surviving an IP flag.
ANDE_FALLBACK_PROXY = os.environ.get("ANDE_FALLBACK_PROXY") or None

from config import sys # Trigger import of backend path
from ande_parser import parse_outages
from news_sources import fetch_news_outages, merge_with_ande
from processor import (
    auto_resolve_expired_reports,
    cleanup_old_data,
    normalize_and_save_outages,
    mark_resolved_outages,
)
from ande_parser import analyze_ande_ids

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Heartbeat file touched at the end of every run (success or failure). The
# container healthcheck reads its mtime to detect a silently dead/hung scraper —
# the process once died while the xvfb-run wrapper kept the container "Up", so a
# plain restart policy never triggered. See docker-compose.yml healthcheck.
HEARTBEAT_FILE = os.environ.get("SCRAPER_HEARTBEAT", "/tmp/scraper_heartbeat")

async def run_scraper():
    logger.info("Starting ANDE Scraper run...")
    from app.database import AsyncSessionLocal
    from app.models import ScraperRun
    run = ScraperRun(ande_ids=[], ids_added=[], ids_removed=[])
    async with AsyncSessionLocal() as session:
        session.add(run)
        await session.commit()
        await session.refresh(run)
    metrics = {"source_reachable": False, "identity_valid": False, "container_found": False, "ande_ids": []}
    run_error = None
    run_success = False
    # Ingestion (steps 1-3) reaches out to the network and fails regularly:
    # Radware blocks, ANDE downtime, a DNS hiccup right after container start.
    # It gets its own try/except so a failed fetch cannot skip the maintenance
    # steps below, which only touch our own database and must run on schedule.
    try:
        # 1. Fetch planned outages from ANDE (authoritative, structured source).
        #    parse_outages returns [] when Radware blocks the egress IP; if that
        #    happens and a fallback tunnel is configured, retry through it.
        raw_outages = await parse_outages(metrics=metrics)
        if not raw_outages and ANDE_FALLBACK_PROXY:
            logger.warning("ANDE returned nothing on direct egress (Radware block?) — retrying via fallback proxy")
            raw_outages = await parse_outages(proxy_override=ANDE_FALLBACK_PROXY, metrics=metrics)

        # 2. Fetch outages reported by Paraguayan news outlets (RSS). Redundancy:
        #    surfaces outages that ANDE missed or is down for. merge_with_ande drops
        #    media stories ANDE already covers and keeps only the media-only ones.
        news_outages = await fetch_news_outages()
        all_outages = merge_with_ande(raw_outages, news_outages)

        # 3. Normalize, geocode, and save all to DB
        process_stats = await normalize_and_save_outages(all_outages)
        run_success = bool(metrics.get("identity_valid") and metrics.get("container_found"))
    except Exception as e:
        run_error = str(e)[:1000]
        logger.error(f"Error during ANDE ingestion: {e}", exc_info=True)

    try:
        # 4. Mark expired outages as resolved + notify users
        await mark_resolved_outages()

        # 5. Auto-close user reports past their lifetime (see
        #    REPORT_AUTO_RESOLVE_HOURS). This container is the single scheduled
        #    maintenance runner, so the job never double-fires the way a
        #    background task inside a multi-worker backend would.
        await auto_resolve_expired_reports()

        # 6. Keep the official window long enough to calculate the 30-day
        # confirmed-report miss metric exposed by /status.
        await cleanup_old_data(days=30)

        logger.info("Scraper run completed.")
    except Exception as e:
        run_error = run_error or str(e)[:1000]
        logger.error(f"Error during scraper maintenance: {e}", exc_info=True)
        run_success = False
    finally:
        ids = sorted(set(metrics.get("ande_ids", [])))
        async with AsyncSessionLocal() as session:
            previous = (await session.execute(
                select(ScraperRun)
                .where(ScraperRun.id != run.id, ScraperRun.success.is_(True))
                .order_by(ScraperRun.id.desc()).limit(1)
            )).scalar_one_or_none()
            previous_ids = set(previous.ande_ids or []) if previous else set()
            sequence = analyze_ande_ids(metrics.get("ande_ids", []))
            db_run = await session.get(ScraperRun, run.id)
            db_run.finished_at = datetime.utcnow()
            db_run.success = run_success
            db_run.source_reachable = bool(metrics.get("source_reachable"))
            db_run.identity_valid = bool(metrics.get("identity_valid"))
            db_run.container_found = bool(metrics.get("container_found"))
            db_run.ande_ids = ids
            db_run.ids_added = sorted(set(ids) - previous_ids)
            db_run.ids_removed = sorted(previous_ids - set(ids))
            db_run.ids_monotonic = sequence["monotonic"]
            db_run.ids_dense = sequence["dense"]
            db_run.error = run_error
            for key in ("rows_seen", "rows_parsed_ok", "rows_after_filter", "events_written"):
                if key in locals().get("process_stats", {}):
                    setattr(db_run, key, process_stats[key])
            await session.commit()
        try:
            with open(HEARTBEAT_FILE, "w") as f:
                f.write(str(int(time.time())))
        except OSError as e:
            logger.warning(f"Could not write heartbeat file: {e}")

async def main():
    logger.info("Initializing Scraper Scheduler...")
    
    # Run once immediately on startup
    await run_scraper()
    
    # 60 minutes default
    interval = int(os.environ.get("POLL_INTERVAL_MINUTES", "60"))
    
    scheduler = AsyncIOScheduler()
    scheduler.add_job(run_scraper, 'interval', minutes=interval)
    scheduler.start()
    
    logger.info(f"Scheduler started. Polling every {interval} minutes.")
    
    try:
        # Keep the event loop running
        while True:
            await asyncio.sleep(3600)
    except (KeyboardInterrupt, SystemExit):
        logger.info("Shutting down scraper...")

if __name__ == "__main__":
    asyncio.run(main())
