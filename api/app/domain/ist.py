from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
QUIET_FROM = time(21, 0)
QUIET_UNTIL = time(9, 0)


def is_quiet(now: datetime) -> bool:
    local = now.astimezone(IST).time()
    return local >= QUIET_FROM or local < QUIET_UNTIL


def next_send_at(now: datetime) -> datetime:
    """When a message created at `now` may go out: right away, or 09:00 IST after quiet hours."""
    if not is_quiet(now):
        return now
    local = now.astimezone(IST)
    nine = local.replace(hour=9, minute=0, second=0, microsecond=0)
    if local.time() >= QUIET_FROM:
        nine += timedelta(days=1)
    return nine.astimezone(timezone.utc)


def format_ist(moment: datetime) -> str:
    return moment.astimezone(IST).strftime("%d %b %Y, %I:%M %p IST")
