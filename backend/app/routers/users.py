from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.limiter import limiter
from app.models import User
from app.schemas import UserCreate, UserOut
from app.security import require_admin_key

router = APIRouter(prefix="/users", tags=["users"])


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
            latitude=payload.latitude,
            longitude=payload.longitude,
        )
        db.add(user)
    else:
        if payload.nis_number is not None:
            user.nis_number = payload.nis_number
        if payload.fcm_token is not None:
            user.fcm_token = payload.fcm_token
        if payload.latitude is not None:
            user.latitude = payload.latitude
        if payload.longitude is not None:
            user.longitude = payload.longitude

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
