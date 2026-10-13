"""Web Push (PWA): отправка и чистка протухших подписок. Сеть не трогаем."""
import json

import pytest
import pytest_asyncio
from sqlalchemy import select

from app import notifications
from app.config import settings
from app.models import User

SUB_OK = json.dumps({"endpoint": "https://web.push.apple.com/ok", "keys": {"p256dh": "p", "auth": "a"}})
SUB_GONE = json.dumps({"endpoint": "https://web.push.apple.com/gone", "keys": {"p256dh": "p", "auth": "a"}})


class _Resp:
    def __init__(self, status_code):
        self.status_code = status_code


@pytest.fixture
def fake_webpush(monkeypatch):
    import pywebpush

    calls = []

    def fake(subscription_info, data, vapid_private_key, vapid_claims, **kwargs):
        calls.append((subscription_info, json.loads(data), vapid_claims))
        if subscription_info["endpoint"].endswith("/gone"):
            raise pywebpush.WebPushException("gone", response=_Resp(410))

    monkeypatch.setattr(pywebpush, "webpush", fake)
    monkeypatch.setattr(settings, "VAPID_PRIVATE_KEY", "test-private-key")
    return calls


@pytest_asyncio.fixture
async def pwa_users(db):
    users = [
        User(device_id="wp-ok", web_push_subscription=SUB_OK, latitude=-25.2637, longitude=-57.5759),
        User(device_id="wp-gone", web_push_subscription=SUB_GONE, latitude=-25.2640, longitude=-57.5760),
        # далеко (Encarnación) — не должен получить пуш
        User(device_id="wp-far", web_push_subscription=SUB_OK.replace("/ok", "/far"), latitude=-27.33, longitude=-55.86),
    ]
    db.add_all(users)
    await db.commit()
    yield users
    for u in users:
        await db.delete(u)
    await db.commit()


@pytest.mark.asyncio
async def test_notify_sends_web_push_and_drops_expired(db, pwa_users, fake_webpush, monkeypatch):
    expo_calls = []

    async def fake_expo(tokens, title, body, data=None):
        expo_calls.append(tokens)

    monkeypatch.setattr(notifications, "_send_expo_push", fake_expo)

    await notifications.notify_users_near_outage(db, -25.2637, -57.5759, "Corte en Villa Morra")

    endpoints = sorted(c[0]["endpoint"] for c in fake_webpush)
    assert endpoints == ["https://web.push.apple.com/gone", "https://web.push.apple.com/ok"]
    payload = fake_webpush[0][1]
    assert payload["title"] == notifications.DEFAULT_PUSH_TITLE
    assert payload["body"] == "Corte en Villa Morra"
    assert payload["data"] == {"lat": -25.2637, "lon": -57.5759}
    assert fake_webpush[0][2] == {"sub": settings.VAPID_SUBJECT}
    # у этих юзеров нет fcm_token — Expo не зовется
    assert expo_calls == []

    rows = {u.device_id: u.web_push_subscription for u in (await db.execute(
        select(User).where(User.device_id.in_(["wp-ok", "wp-gone", "wp-far"])).execution_options(populate_existing=True)
    )).scalars()}
    assert rows["wp-ok"] == SUB_OK
    assert rows["wp-gone"] is None
    assert rows["wp-far"] is not None


@pytest.mark.asyncio
async def test_web_push_skipped_without_private_key(monkeypatch):
    monkeypatch.setattr(settings, "VAPID_PRIVATE_KEY", None)
    assert await notifications._send_web_push([SUB_OK], "t", "b") == []
