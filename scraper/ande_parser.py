import asyncio
import io
import logging
import re

import httpx
import pdfplumber
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

ANDE_URL = "https://www.ande.gov.py/noticias.php?tipo_nota=trabajo_programado"
BASE_URL = "https://www.ande.gov.py/"


_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-PY,es;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}


async def fetch_page(url: str) -> str:
    """Fetches a specific URL."""
    logger.info(f"Fetching {url}...")
    async with httpx.AsyncClient(timeout=30.0, verify=False, follow_redirects=False, headers=_HEADERS) as client:
        response = await client.get(url)
        if response.status_code == 302 and "perfdrive.com" in response.headers.get("location", ""):
            logger.warning(f"Bot protection triggered for {url}, retrying with delay...")
            await asyncio.sleep(5)
            response = await client.get(url)
        response.raise_for_status()
        return response.text


async def fetch_bytes(url: str) -> bytes:
    """Fetches raw bytes for a URL (used for PDF downloads)."""
    logger.info(f"Fetching binary {url}...")
    async with httpx.AsyncClient(timeout=60.0, verify=False, headers=_HEADERS) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.content


_ZONA_RE = re.compile(r"^\s*ZONA\s*\d+", re.IGNORECASE)
_HORARIO_RE = re.compile(r"^\s*HORARIO\b", re.IGNORECASE)
_ACTIVIDAD_RE = re.compile(r"^\s*ACTIVIDAD\b", re.IGNORECASE)


def _zones_from_lines(lines: list[str], title: str) -> list[dict]:
    """
    Applies the ZONA/HORARIO/ACTIVIDAD state machine to a list of text lines.
    Markers are matched only as line *prefixes* — otherwise paragraphs like
    "RECOMENDACIÓN: ... en el horario y zona mencionada" would clobber the real
    HORARIO field.
    Shared between HTML paragraph parsing and PDF text parsing.
    """
    outages: list[dict] = []
    current_zone: dict = {}

    for text in lines:
        text = text.strip()
        if not text:
            continue

        if _ZONA_RE.match(text):
            if current_zone.get("zona"):
                current_zone["title"] = title
                outages.append(current_zone)
            current_zone = {"zona": text, "horario": "", "actividad": "", "raw": text}
        elif _HORARIO_RE.match(text) and current_zone:
            current_zone["horario"] = text
            current_zone["raw"] += f"\n{text}"
        elif _ACTIVIDAD_RE.match(text) and current_zone:
            current_zone["actividad"] = text
            current_zone["raw"] += f"\n{text}"
        elif current_zone:
            current_zone["raw"] += f"\n{text}"

    if current_zone.get("zona"):
        current_zone["title"] = title
        outages.append(current_zone)

    return outages


def parse_pdf_bytes(pdf_bytes: bytes, title: str) -> list[dict]:
    """Extracts zones from an ANDE PDF. Returns [] on failure."""
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            text_parts = [page.extract_text() or "" for page in pdf.pages]
        full_text = "\n".join(text_parts)
    except Exception as e:
        logger.warning(f"Failed to extract text from PDF: {e}")
        return []

    lines = full_text.splitlines()
    return _zones_from_lines(lines, title)


async def parse_outages() -> list[dict]:
    """
    1. Fetches the main list page.
    2. Extracts links to daily outages.
    3. Fetches each detail page and extracts zones from HTML paragraphs.
    4. If detail page links to a PDF, fetches and parses it as well.
    """
    html_content = await fetch_page(ANDE_URL)
    soup = BeautifulSoup(html_content, "lxml")

    outages: list[dict] = []

    list_items = soup.find_all("div", class_="lista")

    detail_links: list[str] = []
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

    for link in detail_links:
        try:
            detail_html = await fetch_page(link)
        except httpx.HTTPError as e:
            logger.warning(f"Failed to fetch detail page {link}: {e}")
            continue

        detail_soup = BeautifulSoup(detail_html, "lxml")

        main_col = detail_soup.find("div", class_="col-sm-8")
        if not main_col:
            continue

        title_h1 = main_col.find("h1")
        title = title_h1.text.strip() if title_h1 else "Sin titulo"

        paragraphs = main_col.find_all("p")
        line_texts = [p.get_text(separator=" ", strip=True) for p in paragraphs]
        outages.extend(_zones_from_lines(line_texts, title))

        pdf_links = [
            a["href"] for a in main_col.find_all("a", href=True)
            if a["href"].lower().endswith(".pdf")
        ]
        for pdf_href in pdf_links:
            pdf_url = pdf_href if pdf_href.startswith("http") else BASE_URL + pdf_href
            try:
                pdf_bytes = await fetch_bytes(pdf_url)
            except httpx.HTTPError as e:
                logger.warning(f"Failed to download PDF {pdf_url}: {e}")
                continue
            pdf_outages = parse_pdf_bytes(pdf_bytes, title)
            if pdf_outages:
                logger.info(f"Extracted {len(pdf_outages)} zones from PDF {pdf_url}")
            outages.extend(pdf_outages)

    return outages
