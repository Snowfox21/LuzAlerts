"""Zonas de confirmación: la ciudad entera, salvo en Asunción (barrio y vecinos)."""
import pytest
from httpx import AsyncClient
from sqlalchemy import select, update

from app.config import settings
from app.crowdsource import recount_active_reports
from app.models import UserReport
from app.report_zones import ZoneAnchor, in_same_zone, normalize_place

# Puntos reales aproximados. Las distancias importan: dentro de Luque están
# a varios km, mucho más que REPORT_RADIUS_M.
LUQUE_LAS_MISIONES = (-25.2480, -57.5230)
LUQUE_CORONEL_OVIEDO = (-25.2790, -57.4700)
LUQUE_CENTRO = (-25.2690, -57.4870)
SAN_LORENZO = (-25.3400, -57.5090)
ASU_VILLA_MORRA = (-25.2930, -57.5780)
ASU_RECOLETA = (-25.2990, -57.5880)  # ~1.2 km de Villa Morra
ASU_SAJONIA = (-25.2900, -57.6600)  # ~8 km de Villa Morra


async def _report(client: AsyncClient, device_id: str, point, city, barrio):
    await client.post("/users/", json={"device_id": device_id})
    res = await client.post(
        "/reports/",
        json={
            "device_id": device_id,
            "latitude": point[0],
            "longitude": point[1],
            "city": city,
            "barrio": barrio,
            "street": "Calle",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


async def _get(client: AsyncClient, report_id: int):
    return (await client.get(f"/reports/{report_id}")).json()


@pytest.fixture
def pushes(monkeypatch):
    sent = []

    async def fake_notify(db, lat, lon, title, *args, **kwargs):
        sent.append((title, kwargs))

    monkeypatch.setattr("app.crowdsource.notify_users_near_outage", fake_notify)
    return sent


# ---------- reglas puras ----------

def test_normalize_place_ignores_accents_and_case():
    assert normalize_place("  Asunción ") == normalize_place("ASUNCION") == "asuncion"
    assert normalize_place("San  Lorenzo") == "san lorenzo"
    assert normalize_place(None) is None
    assert normalize_place("   ") is None


def _row(city, barrio):
    return UserReport(city=city, barrio=barrio)


@pytest.mark.parametrize(
    "a, b, distance_m, expected",
    [
        # Ciudad común: toda la ciudad, a cualquier distancia.
        (("Luque", "Las Misiones"), ("Luque", "Coronel Oviedo"), 6000, True),
        # Ciudades distintas no se juntan aunque estén pegadas.
        (("Luque", "Centro"), ("San Lorenzo", "Centro"), 300, False),
        # Asunción: mismo barrio a cualquier distancia...
        (("Asunción", "Villa Morra"), ("Asuncion", "villa morra"), 3000, True),
        # ...barrio vecino dentro del radio...
        (("Asunción", "Villa Morra"), ("Asunción", "Recoleta"), 1200, True),
        # ...y barrio lejano no.
        (("Asunción", "Villa Morra"), ("Asunción", "Sajonia"), 8000, False),
        # Sin ciudad queda solo el radio.
        ((None, None), ("Luque", "Centro"), 400, True),
        ((None, None), ("Luque", "Centro"), 4000, False),
    ],
)
def test_in_same_zone_is_symmetric(a, b, distance_m, expected):
    forward = in_same_zone(ZoneAnchor(0, 0, *a), _row(*b), distance_m)
    backward = in_same_zone(ZoneAnchor(0, 0, *b), _row(*a), distance_m)
    assert forward is expected
    assert backward is expected


# ---------- reportes ----------

@pytest.mark.asyncio
async def test_luque_counts_whole_city(client: AsyncClient, pushes):
    """El caso del screenshot: dos vecinos de Luque en barrios lejanos suman 2/3."""
    first = await _report(client, "zone-luque-1", LUQUE_CORONEL_OVIEDO, "Luque", "Coronel Oviedo")
    second = await _report(client, "zone-luque-2", LUQUE_LAS_MISIONES, "Luque", "Loma Merlo")

    assert second["confirmation_count"] == 2
    assert (await _get(client, first["id"]))["confirmation_count"] == 2
    assert second["confirmed"] is False

    third = await _report(client, "zone-luque-3", LUQUE_CENTRO, "Luque", "Centro")
    assert third["confirmed"] is True
    assert (await _get(client, first["id"]))["confirmed"] is True
    assert len(pushes) == 1


@pytest.mark.asyncio
async def test_neighbouring_city_is_another_zone(client: AsyncClient, pushes):
    luque = await _report(client, "zone-city-1", LUQUE_CENTRO, "Luque", "Centro")
    san_lorenzo = await _report(client, "zone-city-2", SAN_LORENZO, "San Lorenzo", "Centro")

    assert san_lorenzo["confirmation_count"] == 1
    assert (await _get(client, luque["id"]))["confirmation_count"] == 1


@pytest.mark.asyncio
async def test_asuncion_groups_barrio_and_neighbours_only(client: AsyncClient, pushes):
    villa_morra = await _report(client, "zone-asu-1", ASU_VILLA_MORRA, "Asunción", "Villa Morra")
    sajonia = await _report(client, "zone-asu-2", ASU_SAJONIA, "Asunción", "Sajonia")
    assert sajonia["confirmation_count"] == 1

    recoleta = await _report(client, "zone-asu-3", ASU_RECOLETA, "Asuncion", "Recoleta")
    assert recoleta["confirmation_count"] == 2
    assert (await _get(client, villa_morra["id"]))["confirmation_count"] == 2
    assert (await _get(client, sajonia["id"]))["confirmation_count"] == 1


@pytest.mark.asyncio
async def test_same_person_counts_once(client: AsyncClient, pushes):
    """Con zonas del tamaño de una ciudad, contar reportes en vez de personas
    dejaría que una sola persona confirme un corte desde tres esquinas."""
    for point in (LUQUE_CENTRO, LUQUE_LAS_MISIONES, LUQUE_CORONEL_OVIEDO):
        last = await _report(client, "zone-same-person", point, "Luque", "X")
    assert last["confirmation_count"] == 1
    assert last["confirmed"] is False
    assert pushes == []


@pytest.mark.asyncio
async def test_push_reaches_every_part_of_the_zone_once(client: AsyncClient, db, monkeypatch):
    """La zona es toda la ciudad: el aviso llega a quien esté cerca de
    cualquiera de los reportes confirmados, y a cada uno una sola vez."""
    from app import notifications
    from app.models import User

    far_corner = (-25.3100, -57.4200)  # a más de 5 km de los otros dos puntos
    listeners = [
        User(device_id="zone-listen-east", fcm_token="tok-east",
             latitude=LUQUE_CORONEL_OVIEDO[0], longitude=LUQUE_CORONEL_OVIEDO[1]),
        User(device_id="zone-listen-west", fcm_token="tok-west",
             latitude=LUQUE_LAS_MISIONES[0], longitude=LUQUE_LAS_MISIONES[1]),
        User(device_id="zone-listen-far", fcm_token="tok-far",
             latitude=far_corner[0], longitude=far_corner[1]),
    ]
    db.add_all(listeners)
    await db.commit()

    sent: list[list[str]] = []

    async def fake_expo(tokens, title, body, data=None):
        sent.append(sorted(tokens))

    monkeypatch.setattr(notifications, "_send_expo_push", fake_expo)

    try:
        # Dos reportes al este y el tercero al oeste: se confirma la ciudad y
        # se enteran los dos lados, no solo el del último reporte.
        await _report(client, "zone-push-0", LUQUE_CORONEL_OVIEDO, "Luque", "Coronel Oviedo")
        await _report(client, "zone-push-1", LUQUE_CORONEL_OVIEDO, "Luque", "Coronel Oviedo")
        assert sent == []
        await _report(client, "zone-push-2", LUQUE_LAS_MISIONES, "Luque", "Loma Merlo")
        assert sent == [["tok-east", "tok-west"]]

        # Un cuarto vecino en la misma cuadra no vuelve a avisar a nadie.
        await _report(client, "zone-push-3", LUQUE_CORONEL_OVIEDO, "Luque", "Coronel Oviedo")
        assert sent == [["tok-east", "tok-west"]]

        # Uno en otra punta de la ciudad avisa solo a los que no sabían.
        await _report(client, "zone-push-4", far_corner, "Luque", "Otro")
        assert sent == [["tok-east", "tok-west"], ["tok-far"]]
    finally:
        for user in listeners:
            user.fcm_token = None
            user.latitude = None
            user.longitude = None
        await db.commit()


# ---------- corroborate ----------

@pytest.fixture
def luque_geocoder(monkeypatch):
    async def fake_reverse_geocode(lat: float, lon: float):
        return {"barrio": "Loma Merlo", "street": "Las Misiones", "city": "Luque", "department": "Central"}

    monkeypatch.setattr("app.routers.reports.reverse_geocode", fake_reverse_geocode)


@pytest.mark.asyncio
async def test_corroborate_from_other_side_of_luque(client: AsyncClient, luque_geocoder, pushes):
    target = await _report(client, "zone-corr-author", LUQUE_CORONEL_OVIEDO, "Luque", "Coronel Oviedo")
    await client.post("/users/", json={"device_id": "zone-corr-neighbour"})

    res = await client.post(
        f"/reports/{target['id']}/corroborate",
        json={
            "device_id": "zone-corr-neighbour",
            "latitude": LUQUE_LAS_MISIONES[0],
            "longitude": LUQUE_LAS_MISIONES[1],
        },
    )
    assert res.status_code == 200, res.text
    assert res.json()["id"] == target["id"]
    assert res.json()["confirmation_count"] == 2


@pytest.mark.asyncio
async def test_corroborate_reuses_own_report_in_same_city(
    client: AsyncClient, db, luque_geocoder, pushes
):
    """El vecino ya tenía un reporte suyo en Luque que no había sumado: no se
    crea otro, pero la confirmación igual cuenta para el reporte original."""
    target = await _report(client, "zone-reuse-author", LUQUE_CORONEL_OVIEDO, "Luque", "Coronel Oviedo")
    own = await _report(client, "zone-reuse-neighbour", LUQUE_LAS_MISIONES, "Luque", "Loma Merlo")
    # Simula un reporte creado con la regla vieja de 500 m: contador en 1.
    await db.execute(
        update(UserReport)
        .where(UserReport.id.in_([target["id"], own["id"]]))
        .values(confirmation_count=1)
    )
    await db.commit()

    res = await client.post(
        f"/reports/{target['id']}/corroborate",
        json={
            "device_id": "zone-reuse-neighbour",
            "latitude": LUQUE_CENTRO[0],
            "longitude": LUQUE_CENTRO[1],
        },
    )
    assert res.status_code == 200, res.text
    assert res.json()["confirmation_count"] == 2

    active = (
        await db.execute(
            select(UserReport.id).where(UserReport.is_active.is_(True), UserReport.city == "Luque")
        )
    ).scalars().all()
    assert sorted(active) == sorted([target["id"], own["id"]])


# ---------- recálculo periódico ----------

@pytest.mark.asyncio
async def test_recount_fixes_stale_counters(client: AsyncClient, db, pushes):
    reports = [
        await _report(client, f"zone-recount-{i}", point, "Luque", "X")
        for i, point in enumerate((LUQUE_CENTRO, LUQUE_LAS_MISIONES, LUQUE_CORONEL_OVIEDO))
    ]
    ids = [r["id"] for r in reports]
    await db.execute(
        update(UserReport).where(UserReport.id.in_(ids)).values(confirmation_count=1, confirmed=False)
    )
    await db.commit()
    pushes.clear()

    changed = await recount_active_reports(db)
    assert changed == 3
    for report_id in ids:
        data = await _get(client, report_id)
        assert data["confirmation_count"] == 3
        assert data["confirmed"] is True
    assert len(pushes) == 1

    # Una segunda pasada no cambia nada ni vuelve a avisar.
    assert await recount_active_reports(db) == 0
    assert len(pushes) == 1
