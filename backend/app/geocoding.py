import time

import httpx

from app.config import settings


async def reverse_geocode(lat: float, lon: float) -> dict:
    """
    Запрашивает OSM Nominatim для получения адреса по координатам.
    Возвращает словарь с ключами: barrio, street, city, department, house,
    country_code. При ошибке все значения None.
    """
    params = {
        "lat": lat,
        "lon": lon,
        "format": "json",
        "addressdetails": 1,
        "zoom": 16,
    }
    headers = {
        "User-Agent": f"LuzAlerts/1.0 ({settings.NOMINATIM_EMAIL})",
        "Accept-Language": "es",
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.NOMINATIM_URL}/reverse",
                params=params,
                headers=headers,
            )
            resp.raise_for_status()
            # Nominatim can return a list or a dict, but /reverse usually returns a dict
            data = resp.json()
    except Exception:
        return dict.fromkeys(("barrio", "street", "city", "department", "house", "country_code"))

    address = data.get("address", {})
    barrio = (
        address.get("suburb")
        or address.get("neighbourhood")
        or address.get("quarter")
        or address.get("residential")
    )
    street = address.get("road") or address.get("pedestrian")
    city = address.get("city") or address.get("town") or address.get("municipality")

    return {
        "barrio": barrio,
        "street": street,
        "city": city,
        "department": address.get("state"),
        "house": address.get("house_number"),
        "country_code": (address.get("country_code") or "").upper() or None,
    }


async def forward_geocode(address: str, country: str | None = None) -> dict:
    """
    Запрашивает OSM Nominatim для получения координат по адресу.
    Возвращает словарь с ключами: lat, lon, display_name, barrio.
    country — ISO-код (например "py"), чтобы искать только в этой стране.
    """
    params = {
        "q": address,
        "format": "json",
        "limit": 1,
        "addressdetails": 1,
    }
    if country:
        params["countrycodes"] = country
    headers = {
        "User-Agent": f"LuzAlerts/1.0 ({settings.NOMINATIM_EMAIL})",
        "Accept-Language": "es",
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.NOMINATIM_URL}/search",
                params=params,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            if not data:
                return {"lat": None, "lon": None, "display_name": None, "barrio": None}

            best_match = data[0]
            address_details = best_match.get("address", {})
            barrio = (
                address_details.get("suburb")
                or address_details.get("neighbourhood")
                or address_details.get("quarter")
                or address_details.get("residential")
            )

            return {
                "lat": float(best_match["lat"]),
                "lon": float(best_match["lon"]),
                "display_name": best_match.get("display_name"),
                "barrio": barrio
            }
    except Exception:
        return {"lat": None, "lon": None, "display_name": None, "barrio": None}


# Paraguay entero (con un poco de los vecinos, que después se filtra por país).
PARAGUAY_BBOX = "-62.65,-27.61,-54.25,-19.29"
# Qué objetos de OSM sirven para elegir una zona: ciudades, barrios y calles.
# Comercios, paradas y arroyos con el mismo nombre solo ensucian la lista.
_SUGGEST_KEYS = {"place", "highway", "boundary"}
_PLACE_RANK = {"city": 0, "town": 0, "village": 1, "suburb": 1, "neighbourhood": 1,
               "quarter": 1, "hamlet": 2, "locality": 2}

# Caché en memoria: la misma consulta ("luq", "luqu"...) la escriben muchos.
_SUGGEST_CACHE: dict[str, tuple[float, list[dict]]] = {}
_SUGGEST_TTL_S = 6 * 3600
_SUGGEST_CACHE_MAX = 2000


def _clean_state(state: str | None) -> str | None:
    if not state:
        return None
    for prefix in ("Departamento de ", "Departamento del ", "Departamento "):
        if state.startswith(prefix):
            return state[len(prefix):]
    if state.startswith("Distrito Capital"):
        return "Asunción"
    return state


def _feature_to_suggestion(feature: dict) -> tuple[int, dict] | None:
    props = feature.get("properties") or {}
    if (props.get("countrycode") or "").upper() != "PY":
        return None
    if props.get("osm_key") not in _SUGGEST_KEYS:
        return None
    name = (props.get("name") or "").strip()
    coords = (feature.get("geometry") or {}).get("coordinates") or []
    if not name or len(coords) != 2:
        return None

    # "Villa Morra, Asunción"; para una calle, también el barrio.
    parts = [name]
    for key in ("district", "city"):
        value = props.get(key)
        if value and value.lower() not in (p.lower() for p in parts):
            parts.append(value)
    label = ", ".join(parts[:3])
    state = _clean_state(props.get("state"))
    detail = state if state and state.lower() not in label.lower() else None

    if props.get("osm_key") == "highway":
        rank = 3
    else:
        rank = _PLACE_RANK.get(props.get("osm_value"), 2)
    return rank, {"lat": float(coords[1]), "lon": float(coords[0]), "label": label, "detail": detail}


async def suggest_places(query: str, limit: int = 5) -> list[dict]:
    """
    Sugerencias mientras se escribe ("Luq" -> "Luque, Central"), solo en
    Paraguay. Va a Photon, no a Nominatim. Ciudades y barrios primero,
    después calles. Si Photon no responde, devuelve lista vacía: el botón
    Buscar (Nominatim) sigue funcionando.
    """
    key = " ".join(query.lower().split())
    now = time.monotonic()
    cached = _SUGGEST_CACHE.get(key)
    if cached and now - cached[0] < _SUGGEST_TTL_S:
        return cached[1][:limit]

    params = {"q": query, "limit": 15, "bbox": PARAGUAY_BBOX}
    headers = {"User-Agent": f"LuzAlerts/1.0 ({settings.NOMINATIM_EMAIL})"}
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(f"{settings.PHOTON_URL}/api/", params=params, headers=headers)
            resp.raise_for_status()
            features = resp.json().get("features") or []
    except Exception:
        return []

    ranked = []
    for index, feature in enumerate(features):
        item = _feature_to_suggestion(feature)
        if item:
            # El orden de Photon (relevancia) desempata dentro del mismo rango.
            ranked.append((item[0], index, item[1]))
    ranked.sort(key=lambda r: (r[0], r[1]))

    results: list[dict] = []
    seen: set[str] = set()
    for _, _, suggestion in ranked:
        dedupe = f"{suggestion['label']}|{suggestion['detail']}".lower()
        if dedupe in seen:
            continue
        seen.add(dedupe)
        results.append(suggestion)
        if len(results) >= 8:
            break

    if len(_SUGGEST_CACHE) >= _SUGGEST_CACHE_MAX:
        _SUGGEST_CACHE.clear()
    _SUGGEST_CACHE[key] = (now, results)
    return results[:limit]
