import logging
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# Temporary mock URL until ANDE URL is confirmed
ANDE_URL = "https://www.ande.gov.py/" 

import asyncio
import re

logger = logging.getLogger(__name__)

ANDE_URL = "https://www.ande.gov.py/noticias.php?tipo_nota=trabajo_programado"
BASE_URL = "https://www.ande.gov.py/"

async def fetch_page(url: str) -> str:
    """Fetches a specific URL."""
    logger.info(f"Fetching {url}...")
    async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.text

async def parse_outages() -> list[dict]:
    """
    1. Fetches the main list page.
    2. Extracts links to daily outages.
    3. Fetches each detail page and extracts zones.
    """
    html_content = await fetch_page(ANDE_URL)
    soup = BeautifulSoup(html_content, "lxml")
    
    outages = []
    
    # 1. Find all outage reports in the list
    list_items = soup.find_all("div", class_="lista")
    
    detail_links = []
    for item in list_items:
        h1 = item.find("h1")
        if not h1:
            continue
        a_tag = h1.find("a")
        if not a_tag or not a_tag.get("href"):
            continue
            
        href = a_tag["href"]
        if not href.startswith("http"):
            href = BASE_URL + href
        detail_links.append(href)
        
    logger.info(f"Found {len(detail_links)} detail pages to process.")
    
    # 2. Process each detail page
    for link in detail_links:
        detail_html = await fetch_page(link)
        detail_soup = BeautifulSoup(detail_html, "lxml")
        
        main_col = detail_soup.find("div", class_="col-sm-8")
        if not main_col:
            continue
            
        title_h1 = main_col.find("h1")
        title = title_h1.text.strip() if title_h1 else "Sin titulo"
        
        # We need to extract zones. 
        # Usually they are grouped by ZONA XX, HORARIO, ACTIVIDAD
        paragraphs = main_col.find_all("p")
        
        current_zone = {}
        for p in paragraphs:
            text = p.get_text(separator=" ", strip=True)
            
            if re.search(r"ZONA\s*\d+", text, re.IGNORECASE):
                if current_zone.get("zona"):
                    # Save previous zone
                    current_zone["title"] = title
                    outages.append(current_zone)
                
                current_zone = {"zona": text, "horario": "", "actividad": "", "raw": text}
            elif "HORARIO" in text.upper() and current_zone:
                current_zone["horario"] = text
                current_zone["raw"] += f"\n{text}"
            elif "ACTIVIDAD" in text.upper() and current_zone:
                current_zone["actividad"] = text
                current_zone["raw"] += f"\n{text}"
            elif current_zone and text:
                current_zone["raw"] += f"\n{text}"
                
        if current_zone.get("zona"):
            current_zone["title"] = title
            outages.append(current_zone)
            
    return outages
