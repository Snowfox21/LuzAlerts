import asyncio
import logging

from config import sys # Trigger import of backend path
from ande_parser import parse_outages
from processor import normalize_and_save_outages

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

async def run_scraper():
    logger.info("Starting ANDE Scraper run...")
    
    # 1. Fetch HTML from ANDE and parse
    raw_outages = await parse_outages()
    
    # 2. Normalize strings, geocode, and save to DB
    await normalize_and_save_outages(raw_outages)
    
    logger.info("Scraper run completed.")

if __name__ == "__main__":
    asyncio.run(run_scraper())
