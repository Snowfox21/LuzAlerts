import asyncio
import io
import logging
import random
import re

import pdfplumber
from bs4 import BeautifulSoup
from curl_cffi.requests import AsyncSession

logger = logging.getLogger(__name__)

ANDE_URL = "https://www.ande.gov.py/noticias.php?tipo_nota=trabajo_programado"
BASE_URL = "https://www.ande.gov.py/"

_CHROME_VERSIONS = ["chrome120", "chrome124", "chrome123", "chrome119"]


_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "es-PY,es;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}


async def _random_delay() -> None:
    await asyncio.sleep(random.uniform(5.0, 12.0))


async def parse_outages() -> list[dict]:
    """
    Uses a single persistent session so Radware cookies are retained across all page fetches.
    """
    impersonate = random.choice(_CHROME_VERSIONS)
    async with AsyncSession(impersonate=impersonate, headers=_HEADERS) as session:
        return await _parse_outages_with_session(session)


async def _fetch_page(session: AsyncSession, url: str) -> str:
    logger.info(f"Fetching {url}...")
    response = await session.get(url, timeout=30)
    response.raise_for_status()
    return response.text


async def _fetch_bytes(session: AsyncSession, url: str) -> bytes:
    logger.info(f"Fetching binary {url}...")
    response = await session.get(url, timeout=60)
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


async def _parse_outages_with_session(session: AsyncSession) -> list[dict]:
    html_content = await _fetch_page(session, ANDE_URL)
    soup = BeautifulSoup(html_content, "lxml")

    outages: list[dict] = []
    detail_links: list[str] = []

    for item in soup.find_all("div", class_="lista"):
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
        await _random_delay()
        try:
            detail_html = await _fetch_page(session, link)
        except Exception as e:
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

        for pdf_href in [a["href"] for a in main_col.find_all("a", href=True) if a["href"].lower().endswith(".pdf")]:
            pdf_url = pdf_href if pdf_href.startswith("http") else BASE_URL + pdf_href
            try:
                pdf_bytes = await _fetch_bytes(session, pdf_url)
            except Exception as e:
                logger.warning(f"Failed to download PDF {pdf_url}: {e}")
                continue
            pdf_outages = parse_pdf_bytes(pdf_bytes, title)
            if pdf_outages:
                logger.info(f"Extracted {len(pdf_outages)} zones from PDF {pdf_url}")
            outages.extend(pdf_outages)

    return outages
