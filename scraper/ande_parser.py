import asyncio
import glob
import io
import logging
import os
import random
import re

import pdfplumber
from bs4 import BeautifulSoup
from patchright.async_api import TimeoutError as PlaywrightTimeout
from patchright.async_api import async_playwright

logger = logging.getLogger(__name__)

ANDE_URL = "https://www.ande.gov.py/noticias.php?tipo_nota=trabajo_programado"
BASE_URL = "https://www.ande.gov.py/"

# ande.gov.py sits behind Radware Bot Manager (the site resolves to
# radwarecloud.net). It serves a JS challenge page — title "Radware Page", then
# "Radware Captcha Page" on escalation — that runs JS to set a clearance cookie
# and only then lets the real content load. Stock Playwright, even headed, leaks
# automation signals (the CDP Runtime.enable probe, the --enable-automation flag)
# that Radware fingerprints, so it escalates to an unsolvable CAPTCHA. We instead
# drive Chromium through **patchright** (a drop-in Playwright fork that patches
# those leaks), which passes the JS challenge. Chromium still runs *headed*
# (headless=False) under Xvfb — Radware also flags headless Chromium — see
# Dockerfile. A single persistent context is reused so the clearance cookie is
# obtained once and reused across every page and PDF fetch.

# Residential egress proxy. ande.gov.py's Radware also rate-limits / challenges
# the datacenter IP harder, so the scraper egresses through a residential SOCKS
# tunnel (see docker-compose.yml: WEBSHARE_PROXY=socks5://172.18.0.1:1080).
# Empty → direct connection.
_PROXY = os.environ.get("WEBSHARE_PROXY") or None

# Persistent browser profile: keeps the Radware clearance cookie between the
# 4-hourly runs within a container's lifetime, so most runs skip the challenge.
_USER_DATA_DIR = os.environ.get("ANDE_PROFILE_DIR", "/tmp/ande_profile")


def _chromium_path() -> str | None:
    """Path to the full (headed-capable) Chromium bundled by playwright/patchright.

    We glob for the `chrome` binary specifically so the headless-shell build
    (chrome-linux/headless_shell, which cannot run headed) is never matched.
    """
    hits = sorted(glob.glob("/ms-playwright/chromium-*/chrome-linux/chrome"))
    return hits[-1] if hits else None


async def _random_delay() -> None:
    await asyncio.sleep(random.uniform(2.0, 5.0))


async def parse_outages(proxy_override: str | None = None) -> list[dict]:
    """
    Drives a single persistent Chromium context so the Radware clearance cookie is
    obtained once (via the JS challenge) and reused across all page/PDF fetches.

    proxy_override lets the caller force egress through a specific proxy (the
    residential-tunnel fallback) when the default (direct) egress gets flagged by
    Radware. Each egress keeps its own browser profile because Radware clearance
    cookies are bound to the originating IP — mixing them in one profile would
    invalidate the cookie on every switch.
    """
    proxy = proxy_override or _PROXY
    user_data_dir = f"{_USER_DATA_DIR}_fallback" if proxy_override else _USER_DATA_DIR
    launch_kwargs: dict = {
        "user_data_dir": user_data_dir,
        "headless": False,
        # No fixed viewport / spoofed user-agent: patchright presents the real
        # Chromium fingerprint, and a mismatched UA is itself a detection vector.
        "no_viewport": True,
        "locale": "es-PY",
        "args": ["--no-sandbox", "--disable-dev-shm-usage"],
    }
    exe = _chromium_path()
    if exe:
        launch_kwargs["executable_path"] = exe
    else:
        launch_kwargs["channel"] = "chromium"
    if proxy:
        launch_kwargs["proxy"] = {"server": proxy}

    async with async_playwright() as pw:
        context = await pw.chromium.launch_persistent_context(**launch_kwargs)
        try:
            page = context.pages[0] if context.pages else await context.new_page()
            return await _parse_outages_with_context(context, page)
        finally:
            await context.close()


async def _fetch_page(page, url: str, referer: str | None = None) -> str:
    """Navigates to a page and clears the Radware JS challenge if present.

    The challenge serves a placeholder ("Radware Page" / "Radware Captcha Page" /
    a transient "Loading …" title) that runs JS to set a clearance cookie; the
    page must then be *re-requested* for the real content to load — it does not
    reliably self-redirect. So we poll the title and, while it still looks like a
    challenge, sleep briefly (to let the JS set the cookie) and reload. Reloading
    frequently races the challenge's own auto-navigation and raises ERR_ABORTED or
    a timeout — that is expected, so we swallow it and keep polling. Once the real
    title shows we wait for the content container (div.lista on the news list,
    div.col-sm-8 on detail pages) before returning.

    A single page (tab) is reused across the whole run and a referer is sent on
    detail navigations so the traffic looks like a human clicking through from the
    news list rather than a bot opening fresh tabs.
    """
    logger.info(f"Fetching {url}...")
    goto_kwargs = {"wait_until": "domcontentloaded", "timeout": 60000}
    if referer:
        goto_kwargs["referer"] = referer
    try:
        await page.goto(url, **goto_kwargs)
    except PlaywrightTimeout:
        pass

    for attempt in range(8):
        try:
            title = await page.title()
        except Exception:
            title = ""
        challenged = (not title.strip()) or "Radware" in title or title.startswith("Loading")
        if not challenged:
            # Real title showing. Wait for the content container to actually
            # render. Both ANDE content pages carry one of these: div.lista on the
            # news list, div.col-sm-8 on detail pages. If it renders we're done.
            # If it does NOT appear, the reload landed on a transient shell (the
            # challenge auto-navigation can flip the title to the real one a beat
            # before the body is populated) — so fall through and reload again
            # rather than returning an empty page.
            try:
                await page.wait_for_selector("div.lista, div.col-sm-8", timeout=20000)
                try:
                    await page.wait_for_load_state("networkidle", timeout=8000)
                except PlaywrightTimeout:
                    pass
                return await page.content()
            except PlaywrightTimeout:
                logger.warning(
                    f"Real title but no content container on {url} "
                    f"(attempt {attempt + 1}/8) — reloading"
                )
        else:
            logger.warning(
                f"Radware challenge on {url} (attempt {attempt + 1}/8, title={title!r})"
            )

        await asyncio.sleep(random.uniform(4.0, 7.0))
        # Re-issue the navigation rather than page.reload(): a reload fired mid
        # challenge can get wedged on a transient "Loading <referer>" state, while
        # a fresh goto deterministically re-requests the URL (now carrying the
        # clearance cookie the challenge JS just set).
        try:
            await page.goto(url, **goto_kwargs)
        except Exception as e:
            logger.debug(f"re-goto during Radware challenge: {str(e)[:60]}")

    logger.error(f"Failed to load real content for {url} after 8 attempts")
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
