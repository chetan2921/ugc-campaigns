import re
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.money import payout_breakdown
from app.domain.states import MAX_REVISIONS, check_transition
from app.errors import DomainError
from app.mocks import instagram
from app.models import Application, Payout, Submission, User
from app.services.applications import _lock_campaign_then_application, ensure_brand, ensure_creator
from app.services.slots import mark_spent, release_slot
from app.services.transitions import move
from app.services.wallet import credit

POST_URL = re.compile(r"^https?://(?:www\.)?instagram\.com/(p|reels?|tv)/([A-Za-z0-9_-]+)/?(?:\?.*)?$")


def submit(db: Session, creator: User, application_id: int, url: str, now: datetime) -> Application:
    app = _lock_campaign_then_application(db, application_id)
    ensure_creator(app, creator)
    match = POST_URL.match(url.strip())
    if match is None:
        raise DomainError("That isn't an Instagram post or reel link", 422)
    kind, shortcode = match.groups()
    check_transition(app.status, "submitted")
    # Only the first submission is bound by the deadline; revisions were asked for by the brand.
    if app.status == "approved" and now >= app.campaign.submit_deadline:
        raise DomainError("The submission deadline has passed")
    post = instagram.lookup_post(shortcode)
    if post.status == "not_found":
        raise DomainError("We couldn't find that post on Instagram", 422)
    if post.status == "private":
        raise DomainError("That post is private. Make it public so the brand can see it", 422)
    canonical = f"https://www.instagram.com/{kind}/{shortcode}/"
    if db.scalar(select(Submission.id).where(Submission.url == canonical, Submission.application_id != app.id)):
        raise DomainError("This post was already submitted for a different application")
    db.add(Submission(application_id=app.id, url=canonical, version=len(app.submissions) + 1,
                      caption=post.caption, created_at=now))
    move(db, app, "submitted", now)
    db.commit()
    return app


def review(db: Session, brand: User, application_id: int, action: str, note: str | None, now: datetime) -> Application:
    # Campaign row first, then the application. That row lock is what stops a double payout.
    app = _lock_campaign_then_application(db, application_id)
    ensure_brand(app, brand)
    note = (note or "").strip() or None
    if action == "approve":
        _pay(db, app, now)
    elif action == "revise":
        check_transition(app.status, "revision_requested")
        if note is None:
            raise DomainError("Tell the creator what to change", 422)
        if app.revision_count >= MAX_REVISIONS:
            raise DomainError(f"All {MAX_REVISIONS} revisions are used. Approve or reject this post")
        app.revision_count += 1
        move(db, app, "revision_requested", now, note)
    elif action == "reject":
        check_transition(app.status, "rejected")
        if note is None:
            raise DomainError("Give the creator a reason", 422)
        move(db, app, "rejected", now, note)
        release_slot(db, app)
    else:
        raise DomainError(f"Unknown review action '{action}'", 422)
    db.commit()
    return app


def _pay(db: Session, app: Application, now: datetime) -> None:
    """Approve and pay in one transaction: bill, wallet credit, ledger line, campaign spend."""
    check_transition(app.status, "paid")
    bill = payout_breakdown(app.fee_paise)
    payout = Payout(application=app, fee_paise=bill.fee, platform_fee_paise=bill.platform_fee, gst_paise=bill.gst,
                    tds_paise=bill.tds, net_paise=bill.net, created_at=now)
    db.add(payout)
    db.flush()
    credit(db, app.creator_id, bill.net, "payout", now, payout_id=payout.id)
    mark_spent(db, app)
    move(db, app, "paid", now)
