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
from app.models import Outage, OutageStatus, UserReport
from app.public_report import to_public_report
from app.report_lifecycle import apply_auto_resolution
from app.sharing import outage_share_url, share_url

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


@router.get("/o/{outage_id}", response_class=HTMLResponse)
async def outage_share_page(
    outage_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Страница отключения для того, кому переслали ссылку в WhatsApp.

    Тон другой, чем у /r/: это не "сосед зовет соседей подтвердить", а
    "пересылаю семье, что у них отключение". Подтверждать тут нечего —
    отключения ANDE официальные.
    """
    outage = await db.get(Outage, outage_id)
    if outage is None:
        raise HTTPException(status_code=404, detail="Corte no encontrado")

    place = outage.barrio or outage.title or "tu zona"
    status = outage.status.value if isinstance(outage.status, OutageStatus) else str(outage.status)
    if status == OutageStatus.resolved.value:
        og_title = f"La luz ya volvió en {place}"
        og_description = "Mirá en LuzAlerts si hay otros cortes cerca."
    elif status == OutageStatus.planned.value:
        og_title = f"🗓️ Corte programado en {place}"
        og_description = "La ANDE anunció un corte. Mirá el horario en LuzAlerts."
    else:
        og_title = f"⚡ Corte de luz en {place}"
        og_description = "Seguí el estado del corte en LuzAlerts y enterate cuando vuelva la luz."

    site_url = settings.PUBLIC_BASE_URL.rstrip("/")
    return templates.TemplateResponse(
        request,
        "outage_share.html",
        {
            "outage": outage,
            "status": status,
            "place": place,
            "og_title": og_title,
            "og_description": og_description,
            "og_image": f"{site_url}/og-report.png",
            "page_url": outage_share_url(outage.id),
            "deep_link": f"{settings.APP_SCHEME}://outage/{outage.id}",
            # iPhone: нативного приложения нет, открываем PWA.
            "pwa_url": f"{site_url}/app/outage/{outage.id}",
            "download_url": f"{site_url}/dl/",
            "site_url": site_url,
            "start_label": _py_time_label(outage.scheduled_start),
            "end_label": _py_time_label(outage.scheduled_end),
        },
    )


_WEEKDAYS_ES = ("lun", "mar", "mié", "jue", "vie", "sáb", "dom")


def _py_time_label(value) -> str | None:
    """"lun 27/10 11:00" — как есть, без перевода в пояс читателя.

    Время отключений ANDE хранится так, как его публикует ANDE: местное
    время Парагвая без пояса (в отличие от created_at, который UTC).
    Переводить нечего, а ссылку часто открывают родные за границей —
    поэтому страница подписывает "hora de Paraguay".
    """
    if value is None:
        return None
    return f"{_WEEKDAYS_ES[value.weekday()]} {value:%d/%m %H:%M}"
