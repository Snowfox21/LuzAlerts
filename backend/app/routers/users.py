from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, UserRole
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


@router.get("/", response_model=list[UserOut])
async def list_all_users(
    admin_device_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Получить список всех пользователей. 
    Доступно только пользователям с ролью `admin`.
    `admin_device_id` передается для проверки прав (в будущем заменить на JWT/Auth).
    """
    # Проверка прав администратора
    admin_result = await db.execute(select(User).where(User.device_id == admin_device_id))
    admin_user = admin_result.scalar_one_or_none()
    
    if admin_user is None or admin_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Prohibido: Se requiere acceso de administrador")

    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()


@router.delete("/{device_id}", status_code=204)
async def delete_user(device_id: str, db: AsyncSession = Depends(get_db)):
    """Удалить устройство и все связанные с ним данные (метрики, подписки удалятся каскадно)."""
    result = await db.execute(select(User).where(User.device_id == device_id))
    user = result.scalar_one_or_none()
    
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    await db.delete(user)
    await db.commit()
