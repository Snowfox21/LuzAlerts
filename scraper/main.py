import asyncio
import logging
import os
import time
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# Residential SOCKS tunnel used only as a fallback when direct (datacenter) egress
# gets flagged by Radware — parse_outages returns [] in that case. Empty → no
# fallback. Keeps direct egress as the primary path (no tunnel dependency in normal
# operation) while surviving an IP flag.
ANDE_FALLBACK_PROXY = os.environ.get("ANDE_FALLBACK_PROXY") or None

from config import sys # Trigger import of backend path
from ande_parser import parse_outages
from news_sources import fetch_news_outages, merge_with_ande
from processor import normalize_and_save_outages, cleanup_old_data, mark_resolved_outages

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Heartbeat file touched at the end of every run (success or failure). The
# container healthcheck reads its mtime to detect a silently dead/hung scraper —
# the process once died while the xvfb-run wrapper kept the container "Up", so a
# plain restart policy never triggered. See docker-compose.yml healthcheck.
HEARTBEAT_FILE = os.environ.get("SCRAPER_HEARTBEAT", "/tmp/scraper_heartbeat")

async def run_scraper():
    logger.info("Starting ANDE Scraper run...")
    try:
        # 1. Fetch planned outages from ANDE (authoritative, structured source).
        #    parse_outages returns [] when Radware blocks the egress IP; if that
        #    happens and a fallback tunnel is configured, retry through it.
        raw_outages = await parse_outages()
        if not raw_outages and ANDE_FALLBACK_PROXY:
            logger.warning("ANDE returned nothing on direct egress (Radware block?) — retrying via fallback proxy")
            raw_outages = await parse_outages(proxy_override=ANDE_FALLBACK_PROXY)

        # 2. Fetch outages reported by Paraguayan news outlets (RSS). Redundancy:
        #    surfaces outages that ANDE missed or is down for. merge_with_ande drops
        #    media stories ANDE already covers and keeps only the media-only ones.
        news_outages = await fetch_news_outages()
        all_outages = merge_with_ande(raw_outages, news_outages)

        # 3. Normalize, geocode, and save all to DB
        await normalize_and_save_outages(all_outages)

        # 4. Mark expired outages as resolved + notify users
        await mark_resolved_outages()

        # 5. Remove data older than 7 days
        await cleanup_old_data(days=7)

        logger.info("Scraper run completed.")
    except Exception as e:
        logger.error(f"Error during scraper run: {e}", exc_info=True)
    finally:
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
