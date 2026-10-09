from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.states import check_transition
from app.errors import DomainError
from app.models import Application, Campaign, User
from app.services.slots import release_slot, reserve_slot
from app.services.transitions import move, record


def lock_campaign(db: Session, campaign_id: int) -> Campaign | None:
    # Campaign row first, then application rows: the opposite order deadlocks with cancel.
    return db.execute(
        select(Campaign).where(Campaign.id == campaign_id).with_for_update().execution_options(populate_existing=True)
    ).scalar_one_or_none()


def lock_application(db: Session, application_id: int) -> Application:
    """Load and row-lock the application, so two requests on it run one after the other."""
    app = db.execute(
        select(Application).where(Application.id == application_id).with_for_update(of=Application)
        .execution_options(populate_existing=True)
    ).scalar_one_or_none()
    if app is None:
        raise DomainError("Application not found", 404)
    return app


def _lock_campaign_then_application(db: Session, application_id: int) -> Application:
    campaign_id = db.scalar(select(Application.campaign_id).where(Application.id == application_id))
    if campaign_id is None or lock_campaign(db, campaign_id) is None:
        raise DomainError("Application not found", 404)
    return lock_application(db, application_id)


def ensure_brand(app: Application, brand: User) -> None:
    if app.campaign.brand_id != brand.id:
        raise DomainError("Application not found", 404)


def ensure_creator(app: Application, creator: User) -> None:
    if app.creator_id != creator.id:
        raise DomainError("Application not found", 404)


def apply(db: Session, creator: User, campaign_id: int, note: str | None, now: datetime) -> Application:
    campaign = lock_campaign(db, campaign_id)
    if campaign is None:
        raise DomainError("Campaign not found", 404)
    if campaign.status != "active" or now >= campaign.apply_deadline:
        raise DomainError("Applications for this campaign are closed")
    if campaign.filled_slots >= campaign.slots:
        raise DomainError("All slots on this campaign are filled")
    if db.scalar(select(Application.id).where(Application.campaign_id == campaign_id,
                                              Application.creator_id == creator.id)):
        raise DomainError("You've already applied to this campaign")
    app = Application(campaign_id=campaign_id, creator_id=creator.id, status="applied",
                      note=(note or "").strip() or None, created_at=now)
    db.add(app)
    db.flush()
    record(db, app, None, now)
    db.commit()
    return app


def approve(db: Session, brand: User, application_id: int, now: datetime) -> Application:
    app = _lock_campaign_then_application(db, application_id)
    ensure_brand(app, brand)
    if now >= app.campaign.submit_deadline:
        raise DomainError("The submission deadline has passed, so no more creators can be approved")
    check_transition(app.status, "approved")  # fail before touching the budget
    reserve_slot(db, app)
    move(db, app, "approved", now)
    db.commit()
    return app


def decline(db: Session, brand: User, application_id: int, reason: str | None, now: datetime) -> Application:
    app = _lock_campaign_then_application(db, application_id)
    ensure_brand(app, brand)
    move(db, app, "declined", now, (reason or "").strip() or None)
    db.commit()
    return app


def withdraw(db: Session, creator: User, application_id: int, now: datetime) -> Application:
    app = _lock_campaign_then_application(db, application_id)
    ensure_creator(app, creator)
    if app.status not in ("applied", "approved"):
        raise DomainError("You can only withdraw before submitting your post")
    held_slot = app.status == "approved"
    move(db, app, "withdrawn", now)
    if held_slot:
        release_slot(db, app)
    db.commit()
    return app


def list_for_creator(db: Session, creator: User) -> list[Application]:
    return list(db.scalars(select(Application).where(Application.creator_id == creator.id)
                           .order_by(Application.id.desc())))


def list_for_campaign(db: Session, brand: User, campaign_id: int) -> list[Application]:
    campaign = db.get(Campaign, campaign_id)
    if campaign is None or campaign.brand_id != brand.id:
        raise DomainError("Campaign not found", 404)
    return list(db.scalars(select(Application).where(Application.campaign_id == campaign_id)
                           .order_by(Application.id)))
