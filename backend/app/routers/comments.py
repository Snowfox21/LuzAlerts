from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.limiter import limiter
from app.models import Outage, OutageComment
from app.schemas import CommentCreate, CommentOut

router = APIRouter(prefix="/outages", tags=["comments"])


@router.get("/{outage_id}/comments", response_model=list[CommentOut])
async def list_comments(outage_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(OutageComment)
        .where(OutageComment.outage_id == outage_id)
        .order_by(OutageComment.created_at.asc())
        .limit(100)
    )
    return result.scalars().all()


@router.post("/{outage_id}/comments", response_model=CommentOut, status_code=201)
@limiter.limit("10/hour")
async def add_comment(
    request: Request,
    outage_id: int,
    payload: CommentCreate,
    db: AsyncSession = Depends(get_db),
):
    outage = (await db.execute(select(Outage).where(Outage.id == outage_id))).scalar_one_or_none()
    if outage is None:
        raise HTTPException(status_code=404, detail="Corte no encontrado.")

    comment = OutageComment(
        outage_id=outage_id,
        device_id=payload.device_id,
        text=payload.text.strip(),
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment
