import enum
from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import (
    Boolean, DateTime, Enum, Float, ForeignKey,
    Integer, String, Text, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class OutageSource(str, enum.Enum):
    ande_official = "ande_official"
    crowdsource = "crowdsource"
    twitter = "twitter"


class OutageStatus(str, enum.Enum):
    active = "active"
    resolved = "resolved"
    planned = "planned"


class UserRole(str, enum.Enum):
    admin = "admin"
    user = "user"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    device_id: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.user)
    nis_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    feeder_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    fcm_token: Mapped[str | None] = mapped_column(String(512), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    reports: Mapped[list["UserReport"]] = relationship(back_populates="user")
    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="user")


class Outage(Base):
    __tablename__ = "outages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[OutageSource] = mapped_column(Enum(OutageSource))
    status: Mapped[OutageStatus] = mapped_column(Enum(OutageStatus), default=OutageStatus.active)

    # Текстовое описание из ANDE / OSM reverse-geocode
    title: Mapped[str] = mapped_column(String(256))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    barrio: Mapped[str | None] = mapped_column(String(128), nullable=True)
    feeder_number: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Геометрия и координаты
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    location: Mapped[Geometry] = mapped_column(Geometry("POINT", srid=4326), nullable=True)

    scheduled_start: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    scheduled_end: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class UserReport(Base):
    """Краудсорсинговая метка 'У меня нет света'."""
    __tablename__ = "user_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    location: Mapped[Geometry] = mapped_column(Geometry("POINT", srid=4326))

    # Reverse-geocode результат
    department: Mapped[str | None] = mapped_column(String(128), nullable=True)
    city: Mapped[str | None] = mapped_column(String(128), nullable=True)
    barrio: Mapped[str | None] = mapped_column(String(128), nullable=True)
    street: Mapped[str | None] = mapped_column(String(256), nullable=True)
    house: Mapped[str | None] = mapped_column(String(64), nullable=True)

    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    user: Mapped["User"] = relationship(back_populates="reports")


class Subscription(Base):
    """Подписка пользователя на уведомления по району или фидеру."""
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    barrio: Mapped[str | None] = mapped_column(String(128), nullable=True)
    feeder_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    user: Mapped["User"] = relationship(back_populates="subscriptions")
