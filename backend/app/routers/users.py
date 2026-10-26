from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.limiter import limiter
from app.models import MAX_TRACKED_PLACES, OutageComment, Subscription, TrackedPlace, User, UserReport
from app.schemas import TrackedPlaceCreate, TrackedPlaceOut, TrackedPlaceUpdate, UserCreate, UserOut
from app.security import require_admin_key

router = APIRouter(prefix="/users", tags=["users"])

# Настройки уведомлений: None в запросе = "не менять".
_PREFERENCE_FIELDS = ("notify_outages", "notify_resolved", "notify_radius_m")


@router.post("/", response_model=UserOut, status_code=201)
@limiter.limit("20/hour")
async def create_or_update_user(request: Request, payload: UserCreate, db: AsyncSession = Depends(get_db)):
    """Регистрация устройства. Если device_id уже есть — обновляем токен / NIS."""
    result = await db.execute(select(User).where(User.device_id == payload.device_id))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            device_id=payload.device_id,
            nis_number=payload.nis_number,
            fcm_token=payload.fcm_token,
            web_push_subscription=payload.web_push_subscription,
            latitude=payload.latitude,
            longitude=payload.longitude,
        )
        for field in _PREFERENCE_FIELDS:
            value = getattr(payload, field)
            if value is not None:
                setattr(user, field, value)
        db.add(user)
    else:
        if payload.nis_number is not None:
            user.nis_number = payload.nis_number
        if payload.fcm_token is not None:
            user.fcm_token = payload.fcm_token
        if payload.web_push_subscription is not None:
            user.web_push_subscription = payload.web_push_subscription
        if payload.latitude is not None:
            user.latitude = payload.latitude
        if payload.longitude is not None:
            user.longitude = payload.longitude
        for field in _PREFERENCE_FIELDS:
            value = getattr(payload, field)
            if value is not None:
                setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return user


@router.get("/{device_id}", response_model=UserOut)
async def get_user(device_id: str, db: AsyncSession = Depends(get_db)):
    """Получить информацию о конкретном устройстве / пользователе."""
    result = await db.execute(select(User).where(User.device_id == device_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user


@router.delete("/{device_id}/web-push", status_code=204)
@limiter.limit("20/hour")
async def delete_web_push_subscription(request: Request, device_id: str, db: AsyncSession = Depends(get_db)):
    """Отключить Web Push для устройства (PWA): стираем подписку, остальное не трогаем.

    Без админ-ключа, как и остальные ручки устройства: device_id знает только
    само устройство. Идемпотентно: повторный вызов тоже отвечает 204.
    """
    result = await db.execute(select(User).where(User.device_id == device_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user.web_push_subscription = None
    await db.commit()


@router.delete("/{device_id}/data", status_code=204)
@limiter.limit("5/hour")
async def delete_my_data(request: Request, device_id: str, db: AsyncSession = Depends(get_db)):
    """"Eliminar mis datos": устройство стирает о себе все.

    Удаляются подписки, метки, комментарии и сама запись устройства (токены,
    координаты, настройки). Без админ-ключа: device_id знает только само
    устройство. Идемпотентно — неизвестный device_id тоже отвечает 204.
    """
    await db.execute(delete(OutageComment).where(OutageComment.device_id == device_id))
    user = (await db.execute(select(User).where(User.device_id == device_id))).scalar_one_or_none()
    if user is not None:
        await db.execute(delete(Subscription).where(Subscription.user_id == user.id))
        await db.execute(delete(TrackedPlace).where(TrackedPlace.user_id == user.id))
        await db.execute(delete(UserReport).where(UserReport.user_id == user.id))
        await db.execute(delete(User).where(User.id == user.id))
    await db.commit()


async def _get_or_create_user(db: AsyncSession, device_id: str) -> User:
    user = (await db.execute(select(User).where(User.device_id == device_id))).scalar_one_or_none()
    if user is None:
        # Онбординг добавляет места раньше, чем useDeviceSetup успевает
        # зарегистрировать устройство — регистрируем здесь же.
        user = User(device_id=device_id)
        db.add(user)
        await db.flush()
    return user


@router.get("/{device_id}/places", response_model=list[TrackedPlaceOut])
async def list_places(device_id: str, db: AsyncSession = Depends(get_db)):
    """Дополнительные места устройства. Неизвестное устройство — пустой список."""
    result = await db.execute(
        select(TrackedPlace)
        .join(User, User.id == TrackedPlace.user_id)
        .where(User.device_id == device_id)
        .order_by(TrackedPlace.id)
    )
    return result.scalars().all()


@router.post("/{device_id}/places", response_model=TrackedPlaceOut, status_code=201)
@limiter.limit("30/hour")
async def add_place(request: Request, device_id: str, payload: TrackedPlaceCreate, db: AsyncSession = Depends(get_db)):
    """Следить еще за одним местом (до MAX_TRACKED_PLACES)."""
    user = await _get_or_create_user(db, device_id)
    count = len((await db.execute(select(TrackedPlace.id).where(TrackedPlace.user_id == user.id))).all())
    if count >= MAX_TRACKED_PLACES:
        raise HTTPException(status_code=409, detail=f"Podés seguir hasta {MAX_TRACKED_PLACES} lugares además de tu zona.")
    place = TrackedPlace(
        user_id=user.id,
        label=payload.label.strip(),
        latitude=payload.latitude,
        longitude=payload.longitude,
        radius_m=payload.radius_m,
        enabled=payload.enabled,
    )
    db.add(place)
    await db.commit()
    await db.refresh(place)
    return place


async def _own_place(db: AsyncSession, device_id: str, place_id: int) -> TrackedPlace:
    place = (await db.execute(
        select(TrackedPlace)
        .join(User, User.id == TrackedPlace.user_id)
        .where(TrackedPlace.id == place_id, User.device_id == device_id)
    )).scalar_one_or_none()
    if place is None:
        raise HTTPException(status_code=404, detail="Lugar no encontrado")
    return place


@router.patch("/{device_id}/places/{place_id}", response_model=TrackedPlaceOut)
@limiter.limit("60/hour")
async def update_place(
    request: Request, device_id: str, place_id: int, payload: TrackedPlaceUpdate, db: AsyncSession = Depends(get_db)
):
    """Радиус и вкл/выкл места. Чужое или удаленное — 404."""
    place = await _own_place(db, device_id, place_id)
    if payload.radius_m is not None:
        place.radius_m = payload.radius_m
    if payload.enabled is not None:
        place.enabled = payload.enabled
    await db.commit()
    await db.refresh(place)
    return place


@router.delete("/{device_id}/places/{place_id}", status_code=204)
async def delete_place(device_id: str, place_id: int, db: AsyncSession = Depends(get_db)):
    """Перестать следить за местом. Чужое или уже удаленное — 404."""
    place = await _own_place(db, device_id, place_id)
    await db.delete(place)
    await db.commit()


@router.get("/", response_model=list[UserOut], dependencies=[Depends(require_admin_key)])
async def list_all_users(db: AsyncSession = Depends(get_db)):
    """Список всех пользователей. Требуется заголовок `X-Admin-Key`."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()


@router.delete("/{device_id}", status_code=204, dependencies=[Depends(require_admin_key)])
async def delete_user(device_id: str, db: AsyncSession = Depends(get_db)):
    """Удалить устройство. Требуется заголовок `X-Admin-Key`."""
    result = await db.execute(select(User).where(User.device_id == device_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    await db.delete(user)
    await db.commit()
