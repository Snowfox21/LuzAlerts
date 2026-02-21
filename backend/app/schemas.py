from datetime import datetime

from pydantic import BaseModel, Field


# ---------- User ----------

class UserCreate(BaseModel):
    device_id: str
    nis_number: str | None = None
    fcm_token: str | None = None


class UserOut(BaseModel):
    id: int
    device_id: str
    nis_number: str | None
    feeder_number: str | None
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
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    comment: str | None = None


class ReportOut(BaseModel):
    id: int
    latitude: float
    longitude: float
    barrio: str | None
    street: str | None
    city: str | None
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
