import asyncio
import logging
import os
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from config import sys # Trigger import of backend path
from ande_parser import parse_outages
from processor import normalize_and_save_outages

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

async def run_scraper():
    logger.info("Starting ANDE Scraper run...")
    try:
        # 1. Fetch HTML from ANDE and parse
        raw_outages = await parse_outages()
        
        # 2. Normalize strings, geocode, and save to DB
        await normalize_and_save_outages(raw_outages)
        
        logger.info("Scraper run completed.")
    except Exception as e:
        logger.error(f"Error during scraper run: {e}", exc_info=True)

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
