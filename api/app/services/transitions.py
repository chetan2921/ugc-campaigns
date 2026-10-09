from datetime import datetime

from sqlalchemy.orm import Session

from app.domain.ist import format_ist
from app.domain.money import format_inr
from app.domain.states import MAX_REVISIONS, check_transition
from app.models import Application, ApplicationEvent
from app.services.notify import enqueue


def move(db: Session, app: Application, target: str, now: datetime, note: str | None = None) -> None:
    """The only way an application changes status: check the move, log it, notify."""
    check_transition(app.status, target)
    previous = app.status
    app.status = target
    record(db, app, previous, now, note)


def record(db: Session, app: Application, previous: str | None, now: datetime, note: str | None = None) -> None:
    db.add(ApplicationEvent(application_id=app.id, from_status=previous, to_status=app.status, note=note, created_at=now))
    for user_id, body in messages(app, note):
        enqueue(db, user_id, f"application_{app.status}", body, now)


def messages(app: Application, note: str | None) -> list[tuple[int, str]]:
    """Who hears about the application's new status, and what they're told."""
    c = app.campaign
    who = app.creator.name
    brand, creator = c.brand_id, app.creator_id
    reason = f" Reason: {note}" if note else ""
    match app.status:
        case "applied":
            return [(brand, f"{who} applied to “{c.title}”.")]
        case "approved":
            return [(creator, f"You're in for “{c.title}”. Submit your post link by {format_ist(c.submit_deadline)}.")]
        case "declined":
            return [(creator, f"Your application to “{c.title}” wasn't accepted.{reason}")]
        case "withdrawn":
            return [(brand, f"{who} withdrew from “{c.title}”.")]
        case "submitted":
            return [(brand, f"{who} submitted a post for “{c.title}”. It's ready for your review.")]
        case "revision_requested":
            return [(creator, f"The brand asked for changes to your post for “{c.title}” "
                              f"(revision {app.revision_count} of {MAX_REVISIONS}).{reason}")]
        case "paid":
            p = app.payout
            return [(creator, f"Your post for “{c.title}” was approved. Fee {format_inr(p.fee_paise)}; "
                              f"{format_inr(p.net_paise)} credited to your wallet after fees and taxes.")]
        case "rejected":
            return [(creator, f"Your post for “{c.title}” was rejected.{reason}")]
        case "expired":
            return [
                (creator, f"You missed the submission deadline for “{c.title}”."),
                (brand, f"{who} missed the submission deadline for “{c.title}”. Their slot is free again."),
            ]
    return []
