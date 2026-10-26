from fastapi import APIRouter, HTTPException, Query, Request

from app.geocoding import forward_geocode, reverse_geocode
from app.limiter import limiter
from app.schemas import ForwardGeocodeOut, ReverseGeocodeOut

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


@router.get("/search", response_model=ForwardGeocodeOut)
@limiter.limit("30/hour")
async def search(request: Request, q: str = Query(..., min_length=3, max_length=200)):
    """Координаты по адресу — только в Парагвае.

    Для "Mi zona": человек за границей (или его родные) задает дом
    словами, GPS тут бесполезен. Ищем через тот же Nominatim.
    """
    geo = await forward_geocode(q, country="py")
    if geo.get("lat") is None or geo.get("lon") is None:
        raise HTTPException(status_code=404, detail="No encontramos esa dirección en Paraguay")
    return geo
