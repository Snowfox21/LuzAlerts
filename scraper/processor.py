import logging
from typing import Any

logger = logging.getLogger(__name__)

async def normalize_and_save_outages(raw_outages: list[dict[str, Any]]) -> None:
    """
    Takes raw dictionaries parsed from ANDE, cleans them, applies geocoding, 
    and saves them to the PostgreSQL database.
    """
    logger.info(f"Received {len(raw_outages)} raw outages to process.")
    
    # We will import sqlalchemy models here and use the DB session
    from app.database import AsyncSessionLocal
    from app.models import Outage, OutageSource, OutageStatus
    
    async with AsyncSessionLocal() as session:
        for raw in raw_outages:
            # 1. Normalize strings
            # barrio_clean = normalize_barrio_name(raw["barrio"])
            
            # 2. Extract Feeder Number from description (using regex)
            # feeder = extract_feeder(raw["description"])
            
            # 3. Geocode with Nominatim (if coordinates needed)
            
            # 4. Check for duplicates (same feeder/barrio/date)
            
            # 5. Insert to DB
            pass
        
        # await session.commit()
