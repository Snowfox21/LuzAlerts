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


@pytest_asyncio.fixture
async def pref_users(db):
    sub = lambda name: SUB_OK.replace("/ok", f"/{name}")
    users = [
        # ~3 км от точки: попадает в 5 км, но не в 1 км
        User(device_id="pref-default", web_push_subscription=sub("default"), latitude=-25.29, longitude=-57.60),
        User(device_id="pref-1km", web_push_subscription=sub("1km"), latitude=-25.29, longitude=-57.60, notify_radius_m=1000),
        User(device_id="pref-no-outages", web_push_subscription=sub("no-outages"), latitude=-25.29, longitude=-57.60, notify_outages=False),
        User(device_id="pref-no-resolved", web_push_subscription=sub("no-resolved"), latitude=-25.29, longitude=-57.60, notify_resolved=False),
    ]
    db.add_all(users)
    await db.commit()
    yield users
    for u in users:
        await db.delete(u)
    await db.commit()


@pytest.mark.asyncio
async def test_notify_respects_user_preferences(db, pref_users, fake_webpush):
    await notifications.notify_users_near_outage(db, -25.30, -57.62, "Corte")
    got = sorted(c[0]["endpoint"].rsplit("/", 1)[1] for c in fake_webpush)
    assert got == ["default", "no-resolved"]

    fake_webpush.clear()
    await notifications.notify_users_near_outage(db, -25.30, -57.62, "Volvió", resolved=True)
    got = sorted(c[0]["endpoint"].rsplit("/", 1)[1] for c in fake_webpush)
    assert got == ["default", "no-outages"]


@pytest.mark.asyncio
async def test_notify_via_tracked_place(db, fake_webpush):
    from app.models import TrackedPlace

    # Человек в Мадриде (основная точка далеко), но следит за домом мамы.
    abroad = User(device_id="abroad", web_push_subscription=SUB_OK.replace("/ok", "/abroad"), latitude=40.41, longitude=-3.70)
    db.add(abroad)
    await db.commit()
    db.add(TrackedPlace(user_id=abroad.id, label="Casa de mamá", latitude=-25.2637, longitude=-57.5759))
    # Два места рядом с отключением — пуш все равно один.
    db.add(TrackedPlace(user_id=abroad.id, label="Abuela", latitude=-25.2640, longitude=-57.5760))
    await db.commit()
    try:
        await notifications.notify_users_near_outage(db, -25.2637, -57.5759, "Corte")
        endpoints = [c[0]["endpoint"] for c in fake_webpush]
        assert endpoints.count("https://web.push.apple.com/abroad") == 1
    finally:
        await db.delete(abroad)
        await db.commit()
