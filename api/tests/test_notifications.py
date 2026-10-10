from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.domain.ist import IST, next_send_at
from app.models import Notification
from app.services import notify
from tests.factories import make_campaign, make_user, paid


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


def statuses(db, user_id):
    rows = db.execute(select(Notification.channel, Notification.status, Notification.skip_reason)
                      .where(Notification.user_id == user_id).order_by(Notification.channel)).all()
    return [tuple(r) for r in rows]


def test_message_created_at_night_waits_until_9am(db):
    creator = make_user(db, "creator", phone="+919800000001")
    notify.enqueue(db, creator.id, "test", "hello", ist(12, 22, 0))
    db.commit()
    assert notify.send_due_notifications(db, ist(13, 8, 59)) == 0
    assert notify.send_due_notifications(db, ist(13, 9, 0)) == 2
    assert statuses(db, creator.id) == [("email", "sent", None), ("whatsapp", "sent", None)]


def test_overdue_message_still_waits_out_quiet_hours(db):
    # queued at 20:58 for immediate sending, but the worker only got to it at 23:00
    creator = make_user(db, "creator", phone="+919800000001")
    notify.enqueue(db, creator.id, "test", "hello", ist(12, 20, 58))
    db.commit()
    assert notify.send_due_notifications(db, ist(12, 23, 0)) == 0
    assert notify.send_due_notifications(db, ist(13, 9, 0)) == 2


def test_opt_out_is_checked_when_sending(db):
    creator = make_user(db, "creator", phone="+919800000001")
    notify.enqueue(db, creator.id, "test", "hello", ist(12, 12, 0))
    creator.whatsapp_opt_in = False  # opted out after the message was queued
    db.commit()
    notify.send_due_notifications(db, ist(12, 12, 0))
    assert statuses(db, creator.id) == [("email", "sent", None), ("whatsapp", "skipped", "Opted out of WhatsApp")]


def test_whatsapp_needs_a_phone_number(db):
    creator = make_user(db, "creator")
    notify.enqueue(db, creator.id, "test", "hello", ist(12, 12, 0))
    db.commit()
    notify.send_due_notifications(db, ist(12, 12, 0))
    assert ("whatsapp", "skipped", "No phone number") in statuses(db, creator.id)


def test_each_step_notifies_the_other_side(db):
    brand = make_user(db, "brand")
    app = paid(db, make_campaign(db, brand))
    rows = db.execute(select(Notification.user_id, Notification.event)
                      .where(Notification.channel == "email").order_by(Notification.id)).all()
    assert [tuple(r) for r in rows] == [
        (brand.id, "application_applied"),
        (app.creator_id, "application_approved"),
        (brand.id, "application_submitted"),
        (app.creator_id, "application_paid"),
    ]
