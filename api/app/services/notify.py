from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.ist import is_quiet, next_send_at
from app.mocks.messaging import SENDERS
from app.models import Notification, User

CHANNELS = ("email", "whatsapp")


def enqueue(db: Session, user_id: int, event: str, body: str, now: datetime) -> None:
    """Queue the message on every channel, in the caller's transaction.
    Opt-outs are checked when sending, so a later opt-out is still respected."""
    send_at = next_send_at(now)
    for channel in CHANNELS:
        db.add(Notification(user_id=user_id, channel=channel, event=event, body=body, send_at=send_at, created_at=now))


def _skip_reason(user: User, channel: str) -> str | None:
    if channel == "email" and not user.email_opt_in:
        return "Opted out of email"
    if channel == "whatsapp" and not user.whatsapp_opt_in:
        return "Opted out of WhatsApp"
    if channel == "whatsapp" and not user.phone:
        return "No phone number"
    return None


def send_due_notifications(db: Session, now: datetime, limit: int = 50) -> int:
    """Worker step. Nothing goes out during quiet hours, even overdue messages
    (say the worker was down at 20:59); they all go at 09:00."""
    if is_quiet(now):
        return 0
    due = db.scalars(
        select(Notification).where(Notification.status == "queued", Notification.send_at <= now)
        .order_by(Notification.id).limit(limit).with_for_update(skip_locked=True)
    ).all()
    for n in due:
        user = db.get(User, n.user_id)
        reason = _skip_reason(user, n.channel)
        if reason:
            n.status, n.skip_reason = "skipped", reason
        else:
            SENDERS[n.channel](user, n.body)
            n.status, n.sent_at = "sent", now
    db.commit()
    return len(due)
