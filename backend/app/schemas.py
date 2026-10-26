import json
from typing import Literal
from datetime import datetime, timezone

from pydantic import BaseModel, Field, computed_field, field_serializer, field_validator

from app.sharing import outage_share_url
from app.sharing import share_url as build_share_url


def utc_iso(value: datetime | None) -> str | None:
    """Сериализовать datetime как ISO-8601 с суффиксом Z.

    В БД время хранится naive (timestamp without time zone), а сервер БД
    работает в UTC, поэтому naive-значение трактуем как UTC. Без этого
    клиент считает время локальным и неверно показывает "hace N minutos".
    """
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


# ---------- User ----------

class UserCreate(BaseModel):
    device_id: str = Field(..., description="Уникальный идентификатор устройства (UUID). Генерируется один раз и хранится в AsyncStorage.")
    nis_number: str | None = Field(default=None, description="Номер счета абонента (NIS). Пользователь вводит вручную в настройках.")
    fcm_token: str | None = Field(default=None, description="Expo Push Token устройства для отправки уведомлений.")
    web_push_subscription: str | None = Field(
        default=None,
        max_length=4096,
        description=(
            "Web Push подписка PWA (JSON.stringify(PushSubscription): endpoint + keys.p256dh + keys.auth). "
            "Отдельно от fcm_token, который остается за нативным приложением."
        ),
    )

    @field_validator("web_push_subscription")
    @classmethod
    def _check_web_push_subscription(cls, value: str | None) -> str | None:
        if value is None:
            return None
        try:
            data = json.loads(value)
        except ValueError as exc:
            raise ValueError("web_push_subscription debe ser JSON") from exc
        keys = data.get("keys") if isinstance(data, dict) else None
        endpoint = data.get("endpoint") if isinstance(data, dict) else None
        if (
            not isinstance(endpoint, str)
            or not endpoint.startswith("https://")
            or not isinstance(keys, dict)
            or not keys.get("p256dh")
            or not keys.get("auth")
        ):
            raise ValueError("web_push_subscription incompleta")
        return value
    latitude: float | None = Field(default=None, ge=-90, le=90, description="Широта устройства для геолокационных уведомлений.")
    longitude: float | None = Field(default=None, ge=-180, le=180, description="Долгота устройства для геолокационных уведомлений.")
    notify_outages: bool | None = Field(default=None, description="Пуш о новых отключениях рядом.")
    notify_resolved: bool | None = Field(default=None, description="Пуш, когда свет вернулся.")
    notify_radius_m: int | None = Field(default=None, ge=1000, le=20000, description="Радиус уведомлений в метрах (1–20 км).")


class UserOut(BaseModel):
    id: int
    device_id: str = Field(description="Уникальный ID устройства")
    role: str = Field(description="Роль пользователя: admin или user")
    nis_number: str | None = Field(description="Номер счета абонента (NIS)")
    feeder_number: str | None = Field(description="Уникальный номер линии (фидера), автоматически определяемый по NIS (пока пустое)")
    web_push_enabled: bool = Field(default=False, description="true, если у устройства сохранена Web Push подписка (PWA)")
    notify_outages: bool = True
    notify_resolved: bool = True
    notify_radius_m: int = 5000
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Tracked places ----------

# Та же рамка, что PARAGUAY_BOUNDS в mobile/src/utils/homeZone.ts:
# отключения бывают только в Парагвае, следить за Мадридом бессмысленно.
PY_LAT = (-27.7, -19.0)
PY_LON = (-62.9, -54.1)


PlaceRadius = Literal[1000, 2000, 5000, 10000]  # = models.PLACE_RADIUS_STEPS_M


class TrackedPlaceCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=128, description="Подпись: \"Casa de mamá\", barrio и т.п.")
    latitude: float = Field(..., ge=PY_LAT[0], le=PY_LAT[1])
    longitude: float = Field(..., ge=PY_LON[0], le=PY_LON[1])
    radius_m: PlaceRadius = Field(default=2000, description="Радиус пушей вокруг места, м")
    enabled: bool = True


class TrackedPlaceUpdate(BaseModel):
    """PATCH: None = не менять."""
    radius_m: PlaceRadius | None = None
    enabled: bool | None = None


class TrackedPlaceOut(BaseModel):
    id: int
    label: str
    latitude: float
    longitude: float
    radius_m: int
    enabled: bool

    model_config = {"from_attributes": True}


# ---------- Geocode ----------

class ReverseGeocodeOut(BaseModel):
    barrio: str | None = None
    street: str | None = None
    city: str | None = None
    department: str | None = None
    house: str | None = None
    country_code: str | None = Field(default=None, description="ISO 3166-1 alpha-2, например PY")


class ForwardGeocodeOut(BaseModel):
    lat: float
    lon: float
    display_name: str | None = None
    barrio: str | None = None


# ---------- Outage ----------

class OutageOut(BaseModel):
    id: int
    ande_id: int | None = None
    source: str
    status: str
    title: str
    description: str | None
    barrio: str | None
    feeder_number: str | None
    latitude: float | None = None
    longitude: float | None = None
    scheduled_start: datetime | None
    scheduled_end: datetime | None
    created_at: datetime
    resolved_at: datetime | None

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def share_url(self) -> str:
        """Ссылка для WhatsApp: страница /o/{id} с og-тегами для превью."""
        return outage_share_url(self.id)


# ---------- UserReport ----------

class ReportCreate(BaseModel):
    device_id: str
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    department: str | None = None
    city: str | None = None
    barrio: str | None = None
    street: str | None = None
    house: str | None = None
    comment: str | None = None


class ReportResolve(BaseModel):
    device_id: str = Field(..., description="ID устройства автора метки. Чужие метки закрывать нельзя.")


class ReportCorroborate(BaseModel):
    """Сосед подтверждает чужую метку своей геопозицией.

    Подтверждение — это не лайк, а собственная метка с координатами
    подтверждающего: только так порог REPORT_THRESHOLD остается честным.
    """
    device_id: str
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class ReportOut(BaseModel):
    id: int
    latitude: float
    longitude: float
    department: str | None
    city: str | None
    barrio: str | None
    street: str | None
    house: str | None
    comment: str | None
    confirmation_count: int
    confirmed: bool
    created_at: datetime
    resolved_at: datetime | None = Field(default=None, description="Когда метка была закрыта. null — метка активна.")
    resolved_reason: str | None = Field(
        default=None,
        description=(
            '"author" — автор закрыл метку сам; "auto" — метка протухла по сроку '
            "и закрыта автоматически (resolved_at = момент истечения срока, а не "
            "реальный момент возврата света); null — метка активна."
        ),
    )
    is_mine: bool = Field(
        default=False,
        description=(
            "true, если метка создана этим устройством. Вычисляется по query-параметру "
            "device_id; без него всегда false. Поле присутствует всегда."
        ),
    )
    share_code: str | None = Field(
        default=None,
        description="Публичный код метки. null у меток, созданных до миграции 0005.",
    )

    model_config = {"from_attributes": True}

    @computed_field(description="true, если метка закрыта (автором или по сроку)")
    @property
    def resolved(self) -> bool:
        return self.resolved_at is not None

    @computed_field(description="Ссылка на публичную страницу метки для шеринга")
    @property
    def share_url(self) -> str | None:
        return build_share_url(self.share_code)

    @field_serializer("created_at", "resolved_at")
    def _serialize_dt(self, value: datetime | None) -> str | None:
        return utc_iso(value)


class ReportPublicOut(BaseModel):
    """То, что можно показать кому угодно на странице /r/{code}.

    Намеренно отдельная схема, а не срез ReportOut: street и house — это
    домашний адрес человека, который сам же и разошлет ссылку в WhatsApp.
    Наружу уходят только barrio/city и координаты, огрубленные до ~1 км.
    """
    id: int
    share_code: str
    barrio: str | None
    city: str | None
    department: str | None
    latitude: float
    longitude: float
    confirmation_count: int
    confirmed: bool
    created_at: datetime
    resolved: bool

    @field_serializer("created_at")
    def _serialize_dt(self, value: datetime | None) -> str | None:
        return utc_iso(value)


class ReportsInAreaQuery(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    radius_m: int = Field(default=1000, ge=100, le=10000)


# ---------- OutageComment ----------

class CommentCreate(BaseModel):
    device_id: str
    text: str = Field(..., min_length=1, max_length=500)


class CommentOut(BaseModel):
    id: int
    text: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Subscription ----------

class SubscriptionCreate(BaseModel):
    device_id: str
    barrio: str | None = None
    feeder_number: str | None = None


class SubscriptionOut(BaseModel):
    id: int
    barrio: str | None
    feeder_number: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
