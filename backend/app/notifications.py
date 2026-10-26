import asyncio
import json
import logging

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
NOTIFY_RADIUS_M = 5000  # 5 km, радиус по умолчанию (users.notify_radius_m)


DEFAULT_PUSH_TITLE = "⚡ Corte de luz cercano"
RESOLVED_PUSH_TITLE = "✅ Luz restaurada en tu zona"
RESOLVED_PUSH_BODY = "La energía ha sido restaurada en tu área."


async def notify_users_near_outage(
    session: AsyncSession,
    lat: float,
    lon: float,
    title: str,
    body: str | None = None,
    push_title: str = DEFAULT_PUSH_TITLE,
    resolved: bool = False,
) -> None:
    """Find users within their notify radius of (lat, lon) and send them a push notification.

    Радиус и типы пушей — личные настройки устройства (notify_radius_m,
    notify_outages / notify_resolved). resolved=True — пуш "вернулся свет".

    Два канала параллельно: Expo Push (нативный Android, fcm_token) и
    Web Push (PWA на iOS, web_push_subscription). Один SELECT на оба.
    """
    # Колонка выбирается кодом, не из ввода — f-string здесь безопасен.
    pref_column = "notify_resolved" if resolved else "notify_outages"
    # Устройство получает пуш, если отключение в его радиусе от основной
    # точки ИЛИ от любого включенного отслеживаемого места (у места свой
    # радиус, tracked_places.radius_m). Выборка
    # идет по users, поэтому при нескольких совпадениях пуш все равно один.
    result = await session.execute(
        text(f"""
            SELECT u.fcm_token, u.web_push_subscription FROM users u
            WHERE (u.fcm_token IS NOT NULL OR u.web_push_subscription IS NOT NULL)
              AND u.{pref_column}
              AND (
                (
                  u.latitude IS NOT NULL
                  AND u.longitude IS NOT NULL
                  AND ST_DWithin(
                    ST_SetSRID(ST_MakePoint(u.longitude, u.latitude), 4326)::geography,
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                    COALESCE(u.notify_radius_m, :default_radius_m)
                  )
                )
                OR EXISTS (
                  SELECT 1 FROM tracked_places p
                  WHERE p.user_id = u.id
                    AND p.enabled
                    AND ST_DWithin(
                      ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)::geography,
                      ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                      p.radius_m
                    )
                )
              )
        """),
        {"lat": lat, "lon": lon, "default_radius_m": NOTIFY_RADIUS_M},
    )
    rows = result.all()
    tokens = [row[0] for row in rows if row[0]]
    web_subs = [row[1] for row in rows if row[1]]

    if not tokens and not web_subs:
        logger.info("No users to notify near (%.4f, %.4f)", lat, lon)
        return

    data = {"lat": lat, "lon": lon}
    if tokens:
        logger.info("Sending push to %d users near (%.4f, %.4f)", len(tokens), lat, lon)
        await _send_expo_push(
            tokens=tokens,
            title=push_title,
            body=body or title,
            data=data,
        )
    if web_subs:
        logger.info("Sending web push to %d PWA users near (%.4f, %.4f)", len(web_subs), lat, lon)
        expired = await _send_web_push(
            subscriptions=web_subs,
            title=push_title,
            body=body or title,
            data=data,
        )
        if expired:
            await _drop_web_push_subscriptions(session, expired)


async def _send_expo_push(
    tokens: list[str],
    title: str,
    body: str,
    data: dict | None = None,
) -> None:
    messages = [
        {"to": token, "title": title, "body": body, "sound": "default", "data": data or {}}
        for token in tokens
        if token.startswith("ExponentPushToken[")
    ]
    if not messages:
        return

    async with httpx.AsyncClient(timeout=15) as client:
        # Expo accepts up to 100 messages per request
        for i in range(0, len(messages), 100):
            batch = messages[i : i + 100]
            try:
                resp = await client.post(
                    EXPO_PUSH_URL,
                    json=batch,
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                    },
                )
                resp.raise_for_status()
                logger.debug("Expo push response: %s", resp.json())
            except Exception as exc:
                logger.error("Failed to send push batch: %s", exc)


async def _send_web_push(
    subscriptions: list[str],
    title: str,
    body: str,
    data: dict | None = None,
) -> list[str]:
    """Отправить Web Push каждой подписке. Возвращает протухшие (404/410).

    pywebpush синхронный (requests), поэтому каждый вызов уходит в поток,
    чтобы не блокировать event loop.
    """
    if not settings.VAPID_PRIVATE_KEY:
        logger.warning("VAPID_PRIVATE_KEY not set, skipping %d web push", len(subscriptions))
        return []
    # Ленивый импорт: этот модуль тянет и scraper. Если в его образе
    # pywebpush не окажется, упасть должна только web push ветка, а не
    # весь импорт вместе с рабочим Expo Push.
    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        logger.error("pywebpush not installed, skipping %d web push", len(subscriptions))
        return []

    payload = json.dumps({"title": title, "body": body, "data": data or {}})
    expired: list[str] = []

    async def send_one(raw: str) -> None:
        try:
            subscription_info = json.loads(raw)
        except ValueError:
            expired.append(raw)
            return
        try:
            await asyncio.to_thread(
                webpush,
                subscription_info=subscription_info,
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.VAPID_SUBJECT},
                ttl=60 * 60,
                timeout=15,
            )
        except WebPushException as exc:
            status = exc.response.status_code if exc.response is not None else None
            if status in (404, 410):
                expired.append(raw)
            else:
                logger.error("Failed to send web push (status %s): %s", status, exc)
        except Exception as exc:
            logger.error("Failed to send web push: %s", exc)

    await asyncio.gather(*(send_one(raw) for raw in subscriptions))
    return expired


async def _drop_web_push_subscriptions(session: AsyncSession, subscriptions: list[str]) -> None:
    """Удалить подписки, которые push-сервис объявил несуществующими."""
    try:
        await session.execute(
            text("UPDATE users SET web_push_subscription = NULL WHERE web_push_subscription = ANY(:subs)"),
            {"subs": subscriptions},
        )
        await session.commit()
        logger.info("Dropped %d expired web push subscriptions", len(subscriptions))
    except Exception as exc:
        logger.error("Failed to drop expired web push subscriptions: %s", exc)
