from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/", response_model=UserOut, status_code=201)
async def create_or_update_user(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    """Регистрация устройства. Если device_id уже есть — обновляем токен / NIS."""
    result = await db.execute(select(User).where(User.device_id == payload.device_id))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            device_id=payload.device_id,
            nis_number=payload.nis_number,
            fcm_token=payload.fcm_token,
        )
        db.add(user)
    else:
        if payload.nis_number is not None:
            user.nis_number = payload.nis_number
        if payload.fcm_token is not None:
            user.fcm_token = payload.fcm_token

    await db.commit()
    await db.refresh(user)
    return user
