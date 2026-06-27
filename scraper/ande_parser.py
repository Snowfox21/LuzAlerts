import asyncio
import io
import logging
import os
import random
import re

import pdfplumber
from bs4 import BeautifulSoup
from playwright.async_api import TimeoutError as PlaywrightTimeout
from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)

ANDE_URL = "https://www.ande.gov.py/noticias.php?tipo_nota=trabajo_programado"
BASE_URL = "https://www.ande.gov.py/"

# ande.gov.py sits behind Radware Bot Manager, which serves a JS challenge page
# (title "Radware Page", validate.perfdrive). TLS impersonation alone (curl_cffi)
# can't pass it because it never executes the challenge JS — so we drive a real
# headless Chromium via Playwright, which runs the JS, gets the clearance cookie,
# and then sees the real content. The same browser context (cookies) is reused to
# download the linked PDFs.
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# --- Webshare residential proxy (enable if Radware also blocks the VPS IP) ---
# The block is currently a JS challenge (handled by Playwright), NOT an IP block,
# so a proxy is usually unnecessary. Only enable if ANDE starts banning the
# datacenter IP outright. Set in docker-compose.yml (or .env):
#   WEBSHARE_PROXY=http://<user>:<password>@p.webshare.io:80
_PROXY = os.environ.get("WEBSHARE_PROXY")  # None → no proxy
# -----------------------------------------------------------------


async def _random_delay() -> None:
    await asyncio.sleep(random.uniform(2.0, 5.0))


async def parse_outages() -> list[dict]:
    """
    Drives a single Chromium context so the Radware clearance cookie is obtained
    once (via the JS challenge) and reused across all page/PDF fetches.

    Chromium runs *headed* (headless=False): Radware reliably detects headless
    Chromium and escalates to an unsolvable CAPTCHA, but a real GUI browser passes
    the JS challenge. On a headless server this requires a virtual display — the
    container starts Chromium under Xvfb (see Dockerfile).
    """
    launch_kwargs: dict = {
        "headless": False,
        "args": [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-blink-features=AutomationControlled",
        ],
    }
    if _PROXY:
        launch_kwargs["proxy"] = {"server": _PROXY}

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(**launch_kwargs)
        try:
            context = await browser.new_context(
                locale="es-PY",
                user_agent=_USER_AGENT,
                viewport={"width": 1366, "height": 768},
            )
            page = await context.new_page()
            return await _parse_outages_with_context(context, page)
        finally:
            await browser.close()


async def _fetch_page(page, url: str, referer: str | None = None) -> str:
    """Navigates to a page and waits out the Radware JS challenge if present.

    The challenge serves a placeholder page ("Radware Page") that runs JS, sets a
    clearance cookie, and reloads into the real content. We wait for the real
    content's container to appear — div.lista on the news list, div.col-sm-8 on
    detail pages — which only happens once the challenge has cleared. Waiting on
    the title alone is not enough: the title flips to the real one a beat before
    the body finishes loading, so we'd otherwise grab an empty page.

    A single page (tab) is reused across the whole run and a referer is sent on
    detail navigations so the traffic looks like a human clicking through from the
    news list rather than a bot opening fresh tabs — Radware otherwise escalates
    to an unsolvable CAPTCHA. If we still land on a challenge page, we reload a
    couple of times with backoff before giving up.
    """
    logger.info(f"Fetching {url}...")
    goto_kwargs = {"wait_until": "domcontentloaded", "timeout": 60000}
    if referer:
        goto_kwargs["referer"] = referer
    for attempt in range(3):
        if attempt == 0:
            await page.goto(url, **goto_kwargs)
        else:
            await page.reload(wait_until="domcontentloaded", timeout=60000)
        try:
            await page.wait_for_selector("div.lista, div.col-sm-8", timeout=40000)
            return await page.content()
        except PlaywrightTimeout:
            title = await page.title()
            if "Radware" not in title:
                # Real page that simply lacks those containers — nothing to retry.
                return await page.content()
            logger.warning(
                f"Radware challenge on {url} (attempt {attempt + 1}/3, title={title!r})"
            )
            await asyncio.sleep(random.uniform(6.0, 12.0))
    return await page.content()


async def _fetch_bytes(context, url: str) -> bytes:
    """Downloads a binary (PDF) reusing the context's Radware clearance cookies."""
    logger.info(f"Fetching binary {url}...")
    response = await context.request.get(url, timeout=60000)
    if not response.ok:
        raise RuntimeError(f"HTTP {response.status} for {url}")
    return await response.body()


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


async def _parse_outages_with_context(context, page) -> list[dict]:
    html_content = await _fetch_page(page, ANDE_URL)
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
            detail_html = await _fetch_page(page, link, referer=ANDE_URL)
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
                pdf_bytes = await _fetch_bytes(context, pdf_url)
            except Exception as e:
                logger.warning(f"Failed to download PDF {pdf_url}: {e}")
                continue
            pdf_outages = parse_pdf_bytes(pdf_bytes, title)
            if pdf_outages:
                logger.info(f"Extracted {len(pdf_outages)} zones from PDF {pdf_url}")
            outages.extend(pdf_outages)

    return outages
