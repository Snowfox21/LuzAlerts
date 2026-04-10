from datetime import datetime

from pydantic import BaseModel, Field


# ---------- User ----------

class UserCreate(BaseModel):
    device_id: str = Field(..., description="Уникальный идентификатор устройства (UUID). Генерируется один раз и хранится в AsyncStorage.")
    nis_number: str | None = Field(default=None, description="Номер счета абонента (NIS). Пользователь вводит вручную в настройках.")
    fcm_token: str | None = Field(default=None, description="Expo Push Token устройства для отправки уведомлений.")
    latitude: float | None = Field(default=None, ge=-90, le=90, description="Широта устройства для геолокационных уведомлений.")
    longitude: float | None = Field(default=None, ge=-180, le=180, description="Долгота устройства для геолокационных уведомлений.")


class UserOut(BaseModel):
    id: int
    device_id: str = Field(description="Уникальный ID устройства")
    role: str = Field(description="Роль пользователя: admin или user")
    nis_number: str | None = Field(description="Номер счета абонента (NIS)")
    feeder_number: str | None = Field(description="Уникальный номер линии (фидера), автоматически определяемый по NIS (пока пустое)")
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Outage ----------

class OutageOut(BaseModel):
    id: int
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
    confirmed: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ReportsInAreaQuery(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    radius_m: int = Field(default=1000, ge=100, le=10000)


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
