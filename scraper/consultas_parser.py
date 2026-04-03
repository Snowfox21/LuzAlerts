"""
Secondary ANDE data source: consultas.ande.gov.py

This module fetches emergency (unplanned) outages from ANDE's internal API.

TODO: Confirm the actual endpoint and response schema by inspecting
      network requests on https://consultas.ande.gov.py in browser DevTools.
      Current implementation is a skeleton based on known API patterns.
"""
import logging
import httpx

logger = logging.getLogger(__name__)

# TODO: Replace with confirmed endpoint after inspecting network requests
CONSULTAS_API_URL = "https://consultas.ande.gov.py/api/cortes"

# TODO: Add required headers/auth if the API needs them
DEFAULT_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0",
}


async def fetch_emergency_outages() -> list[dict]:
    """
    Fetches active emergency outages from consultas.ande.gov.py.

    Returns a list of normalized dicts compatible with normalize_and_save_outages():
        {
            "title":   str,
            "zona":    str,
            "horario": str,
            "raw":     str,
            "source":  "ande_emergency",   # distinguishes from planned
        }

    Returns an empty list on any error so the main scraper loop keeps running.
    """
    try:
        async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
            response = await client.get(CONSULTAS_API_URL, headers=DEFAULT_HEADERS)
            response.raise_for_status()
            data = response.json()

        outages = []
        # TODO: Adjust field names once actual API response schema is confirmed.
        # The block below assumes the API returns a list of objects like:
        # { "descripcion": "...", "zona": "...", "fechaInicio": "...", "fechaFin": "..." }
        for item in data if isinstance(data, list) else data.get("items", []):
            zona = item.get("zona") or item.get("sector") or item.get("barrio") or ""
            descripcion = item.get("descripcion") or item.get("detalle") or zona
            fecha_inicio = item.get("fechaInicio") or item.get("fecha_inicio") or ""
            fecha_fin = item.get("fechaFin") or item.get("fecha_fin") or ""
            horario = f"De {fecha_inicio} a {fecha_fin}" if fecha_inicio else ""

            outages.append({
                "title": f"Corte de emergencia: {zona}" if zona else "Corte de emergencia ANDE",
                "zona": zona,
                "horario": horario,
                "raw": descripcion,
                "source": "ande_emergency",
            })

        logger.info(f"Fetched {len(outages)} emergency outages from consultas.ande.gov.py")
        return outages

    except httpx.HTTPStatusError as e:
        logger.warning(f"consultas.ande.gov.py returned HTTP {e.response.status_code} — skipping.")
    except httpx.RequestError as e:
        logger.warning(f"consultas.ande.gov.py unreachable: {e} — skipping.")
    except Exception as e:
        logger.error(f"Unexpected error fetching emergency outages: {e}", exc_info=True)

    return []
