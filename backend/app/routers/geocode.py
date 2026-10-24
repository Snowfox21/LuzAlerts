from fastapi import APIRouter, HTTPException, Query, Request

from app.geocoding import reverse_geocode
from app.limiter import limiter
from app.schemas import ReverseGeocodeOut

router = APIRouter(prefix="/geocode", tags=["geocode"])


@router.get("/reverse", response_model=ReverseGeocodeOut)
@limiter.limit("30/hour")
async def reverse(
    request: Request,
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
):
    """Адрес по координатам — для PWA.

    В браузере у expo-location нет reverseGeocodeAsync, поэтому PWA спрашивает
    адрес здесь, через тот же Nominatim, что и бэкенд. Лимит по IP: у
    Nominatim жесткая политика использования (1 запрос/с на весь сервер),
    а запрос идет только по нажатию кнопки, не на каждый экран.
    """
    geo = await reverse_geocode(lat, lon)
    if not any(geo.values()):
        raise HTTPException(status_code=503, detail="No se pudo determinar la dirección")
    return geo
