import calendar
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo


def today_in(tz_name: str) -> date:
    try:
        return datetime.now(ZoneInfo(tz_name)).date()
    except Exception:  # noqa: BLE001 — unknown zone → UTC
        return datetime.now(timezone.utc).date()


def period_of(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def due_date_for(year: int, month: int, due_day: int) -> date:
    last = calendar.monthrange(year, month)[1]
    return date(year, month, min(due_day, last))


def month_iter(start: date, end: date):
    """Yield (year, month) from start's month through end's month inclusive."""
    y, m = start.year, start.month
    while (y, m) <= (end.year, end.month):
        yield y, m
        m += 1
        if m == 13:
            y, m = y + 1, 1


def add_months(d: date, months: int) -> date:
    m = d.month - 1 + months
    y = d.year + m // 12
    m = m % 12 + 1
    return date(y, m, min(d.day, calendar.monthrange(y, m)[1]))
