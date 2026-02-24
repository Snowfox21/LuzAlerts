import asyncio
import logging

from config import sys # Trigger import of backend path
from ande_parser import fetch_ande_page, parse_html_for_outages
from processor import normalize_and_save_outages

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

async def run_scraper():
    logger.info("Starting ANDE Scraper run...")
    
    # 1. Fetch HTML from ANDE
    # html_content = await fetch_ande_page()
    
    # 2. Parse HTML into structured internal dictionaries
    # raw_outages = parse_html_for_outages(html_content)
    
    # 3. Normalize strings, geocode, and save to DB
    # await normalize_and_save_outages(raw_outages)
    
    logger.info("Scraper run completed.")

if __name__ == "__main__":
    asyncio.run(run_scraper())
