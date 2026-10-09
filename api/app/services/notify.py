from datetime import datetime

from sqlalchemy.orm import Session

from app.domain.ist import next_send_at
from app.models import Notification

CHANNELS = ("email", "whatsapp")


def enqueue(db: Session, user_id: int, event: str, body: str, now: datetime) -> None:
    """Queue the message on every channel, in the caller's transaction.
    Opt-outs are checked when sending, so a later opt-out is still respected."""
    send_at = next_send_at(now)
    for channel in CHANNELS:
        db.add(Notification(user_id=user_id, channel=channel, event=event, body=body, send_at=send_at, created_at=now))
