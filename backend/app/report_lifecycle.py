"""Жизненный цикл пользовательской метки: закрытие автором и автозакрытие по сроку.

Метка "нет света" живет ограниченное время: через REPORT_AUTO_RESOLVE_HOURS часов
она заведомо неактуальна и считается закрытой, даже если автор про нее забыл.

Здесь собраны срок жизни, SQL-условие "метка активна" и оверлей для чтения —
чтобы литерал срока не размазывался по роутерам и по крауд-сорсу.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_

from app.config import settings
from app.models import UserReport

# Причина закрытия (колонка user_reports.resolved_reason).
RESOLUTION_AUTHOR = "author"  # автор нажал "ya volvio la luz"
RESOLUTION_AUTO = "auto"      # истек срок жизни метки


def utcnow_naive() -> datetime:
    """Текущее UTC-время без tzinfo — в том же виде, в каком лежит created_at."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def auto_resolve_after() -> timedelta:
    """Срок жизни метки. Настраивается через REPORT_AUTO_RESOLVE_HOURS."""
    return timedelta(hours=settings.REPORT_AUTO_RESOLVE_HOURS)


def expiry_cutoff(now: datetime | None = None) -> datetime:
    """Метки, созданные не позже этого момента, уже просрочены."""
    return (now or utcnow_naive()) - auto_resolve_after()


def expires_at(created_at: datetime) -> datetime:
    """Момент, в который метка протухает."""
    return created_at + auto_resolve_after()


def active_report_clause(now: datetime | None = None):
    """SQL-условие "метка активна и должна попадать в выдачу".

    Просроченные отсекаются по created_at прямо в запросе, а не только по
    resolved_at: фоновая задача ходит раз в несколько часов, и между ее
    прогонами протухшая метка иначе продолжала бы отдаваться как активная.
    """
    return and_(
        UserReport.is_active == True,  # noqa: E712 — SQL-выражение, не питоновский bool
        UserReport.resolved_at.is_(None),
        UserReport.created_at > expiry_cutoff(now),
    )


def apply_auto_resolution(report: UserReport, now: datetime | None = None) -> UserReport:
    """Показать просроченную метку закрытой, даже если задача еще не отработала.

    Проставляет resolved_at/resolved_reason только в памяти (без commit).
    Значение совпадает с тем, что запишет фоновая задача, потому что оба
    считают его как created_at + срок, а не по времени прогона.
    """
    if report.resolved_at is None and report.created_at <= expiry_cutoff(now):
        report.resolved_at = expires_at(report.created_at)
        report.resolved_reason = RESOLUTION_AUTO
    return report
