import httpx

from app.config import settings


async def reverse_geocode(lat: float, lon: float) -> dict:
    """
    Запрашивает OSM Nominatim для получения адреса по координатам.
    Возвращает словарь с ключами: barrio, street, city.
    """
    params = {
        "lat": lat,
        "lon": lon,
        "format": "json",
        "addressdetails": 1,
        "zoom": 16,
    }
    headers = {
        "User-Agent": f"LuzParaguay/1.0 ({settings.NOMINATIM_EMAIL})",
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
            data = resp.json()
    except Exception:
        return {"barrio": None, "street": None, "city": None}

    address = data.get("address", {})
    barrio = (
        address.get("suburb")
        or address.get("neighbourhood")
        or address.get("quarter")
        or address.get("residential")
    )
    street = address.get("road") or address.get("pedestrian")
    city = address.get("city") or address.get("town") or address.get("municipality")

    return {"barrio": barrio, "street": street, "city": city}
