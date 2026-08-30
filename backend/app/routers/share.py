"""Публичная страница метки: https://luzalerts.lat/r/{share_code}

Страница серверная, а не статика с фетчем, по одной причине: превью ссылки
в WhatsApp рисует краулер, который не исполняет JS. Без готовых og-тегов в
HTML ссылка приходит соседу голым текстом и не открывается.

Facebook вдобавок вырезает предзаполненный текст шеринга, так что для него
og-теги — единственный способ хоть что-то сказать о метке.
"""
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from app.config import settings
from app.database import get_db
from app.models import UserReport
from app.public_report import to_public_report
from app.report_lifecycle import apply_auto_resolution
from app.sharing import share_url

router = APIRouter(tags=["share"])

templates = Jinja2Templates(directory=str(Path(__file__).resolve().parent.parent / "templates"))

@router.get("/r/{share_code}", response_class=HTMLResponse)
async def report_share_page(
    share_code: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Страница метки для соседа, пришедшего по ссылке из WhatsApp."""
    result = await db.execute(select(UserReport).where(UserReport.share_code == share_code))
    report = result.scalar_one_or_none()
    if report is None:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")

    apply_auto_resolution(report)
    public = to_public_report(report)

    # Счетчик просмотров: единственный способ понять, доходят ли ссылки до
    # людей. Отдельным UPDATE, чтобы не гонять всю метку через ORM.
    await db.execute(
        update(UserReport)
        .where(UserReport.id == report.id)
        .values(share_view_count=UserReport.share_view_count + 1)
    )
    await db.commit()

    place = public.barrio or public.city or "tu zona"
    if public.resolved:
        og_title = f"La luz ya volvió en {place}"
        og_description = "Mirá en LuzAlerts si hay otros cortes cerca tuyo."
    elif public.confirmed:
        og_title = f"⚡ Corte de luz confirmado en {place}"
        og_description = (
            f"{public.confirmation_count} vecinos ya confirmaron el corte. "
            "¿Vos también estás sin luz?"
        )
    else:
        og_title = f"⚡ Sin luz en {place}"
        og_description = "Un vecino reportó un corte. ¿A vos también se te cortó la luz?"

    return templates.TemplateResponse(
        request,
        "report_share.html",
        {
            "report": public,
            "place": place,
            "og_title": og_title,
            "og_description": og_description,
            "og_image": f"{settings.PUBLIC_BASE_URL.rstrip('/')}/og-report.png",
            "page_url": share_url(public.share_code),
            "deep_link": f"{settings.APP_SCHEME}://report/{report.id}",
            "download_url": f"{settings.PUBLIC_BASE_URL.rstrip('/')}/dl/",
            "site_url": settings.PUBLIC_BASE_URL.rstrip("/"),
        },
    )
