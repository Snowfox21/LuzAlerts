import logging

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
NOTIFY_RADIUS_M = 5000  # 5 km


async def notify_users_near_outage(
    session: AsyncSession,
    lat: float,
    lon: float,
    title: str,
    body: str | None = None,
) -> None:
    """Find users within NOTIFY_RADIUS_M of (lat, lon) and send them a push notification."""
    result = await session.execute(
        text("""
            SELECT fcm_token FROM users
            WHERE fcm_token IS NOT NULL
              AND latitude IS NOT NULL
              AND longitude IS NOT NULL
              AND ST_DWithin(
                ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                :radius_m
              )
        """),
        {"lat": lat, "lon": lon, "radius_m": NOTIFY_RADIUS_M},
    )
    tokens = [row[0] for row in result if row[0]]

    if not tokens:
        logger.info("No users to notify near (%.4f, %.4f)", lat, lon)
        return

    logger.info("Sending push to %d users near (%.4f, %.4f)", len(tokens), lat, lon)
    await _send_expo_push(
        tokens=tokens,
        title="⚡ Corte de luz cercano",
        body=body or title,
    )


async def _send_expo_push(tokens: list[str], title: str, body: str) -> None:
    messages = [
        {"to": token, "title": title, "body": body, "sound": "default"}
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
