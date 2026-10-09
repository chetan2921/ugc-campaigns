from datetime import datetime, timezone

import pytest

from app.domain.ist import IST, next_send_at


def ist(day: int, hour: int, minute: int = 0, second: int = 0) -> datetime:
    """A moment on that day of October 2026 in IST, returned in UTC like the app stores it."""
    return datetime(2026, 10, day, hour, minute, second, tzinfo=IST).astimezone(timezone.utc)


@pytest.mark.parametrize("now, expected", [
    (ist(12, 9, 0), ist(12, 9, 0)),             # 9 AM sharp: send now
    (ist(12, 20, 59, 59), ist(12, 20, 59, 59)),  # last second before quiet hours
    (ist(12, 21, 0), ist(13, 9, 0)),             # 9 PM sharp: hold until tomorrow 9 AM
    (ist(12, 23, 30), ist(13, 9, 0)),
    (ist(13, 2, 0), ist(13, 9, 0)),              # after midnight: same day 9 AM
    (ist(13, 8, 59, 59), ist(13, 9, 0)),
])
def test_next_send_at(now, expected):
    assert next_send_at(now) == expected


def test_quiet_hours_follow_ist_not_the_server_clock():
    fifteen_thirty_utc = datetime(2026, 10, 12, 15, 30, tzinfo=timezone.utc)  # = 21:00 IST
    assert next_send_at(fifteen_thirty_utc) == ist(13, 9, 0)
