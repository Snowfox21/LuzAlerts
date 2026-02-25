from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Subscription, User
from app.schemas import SubscriptionCreate, SubscriptionOut

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


@router.post("/", response_model=SubscriptionOut, status_code=201)
async def create_subscription(payload: SubscriptionCreate, db: AsyncSession = Depends(get_db)):
    """Подписать пользователя на уведомления по barrio или feeder."""
    if not payload.barrio and not payload.feeder_number:
        raise HTTPException(status_code=422, detail="Especifique al menos un barrio o número de alimentador.")

    result = await db.execute(select(User).where(User.device_id == payload.device_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado. Regístrese primero.")

    # Не создавать дублирующую подписку
    dup_q = select(Subscription).where(
        Subscription.user_id == user.id,
        Subscription.barrio == payload.barrio,
        Subscription.feeder_number == payload.feeder_number,
    )
    existing = (await db.execute(dup_q)).scalar_one_or_none()
    if existing:
        return existing

    sub = Subscription(
        user_id=user.id,
        barrio=payload.barrio,
        feeder_number=payload.feeder_number,
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return sub


@router.get("/", response_model=list[SubscriptionOut])
async def list_subscriptions(device_id: str, db: AsyncSession = Depends(get_db)):
    """Получить все подписки пользователя."""
    result = await db.execute(select(User).where(User.device_id == device_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    subs = (await db.execute(select(Subscription).where(Subscription.user_id == user.id))).scalars().all()
    return subs


@router.delete("/{subscription_id}", status_code=204)
async def delete_subscription(subscription_id: int, device_id: str, db: AsyncSession = Depends(get_db)):
    """Удалить подписку."""
    result = await db.execute(select(User).where(User.device_id == device_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    sub = (await db.execute(
        select(Subscription).where(Subscription.id == subscription_id, Subscription.user_id == user.id)
    )).scalar_one_or_none()

    if sub is None:
        raise HTTPException(status_code=404, detail="Suscripción no encontrada.")

    await db.delete(sub)
    await db.commit()
