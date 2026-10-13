from fastapi import APIRouter, HTTPException, status

from app.config import settings

router = APIRouter(prefix="/config", tags=["config"])


@router.get("/vapid-public-key")
async def vapid_public_key():
    """Публичный VAPID-ключ для подписки PWA на Web Push.

    Отдается эндпоинтом, а не зашивается в бандл: ротация ключа не требует
    пересборки PWA. Ключ публичный по определению, авторизация не нужна.
    """
    if not settings.VAPID_PUBLIC_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Web Push no configurado",
        )
    return {"public_key": settings.VAPID_PUBLIC_KEY}
