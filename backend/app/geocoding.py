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
