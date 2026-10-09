from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.money import format_inr
from app.errors import DomainError
from app.models import Application, Campaign, User
from app.schemas import CampaignEdit, CampaignIn
from app.services.notify import enqueue
from app.services.transitions import move

LIVE_STATUSES = ("applied", "approved", "submitted", "revision_requested")
TERMS = ("fee_paise", "slots", "budget_paise", "apply_deadline", "submit_deadline")


def accepting_applications(c: Campaign, now: datetime) -> bool:
    return c.status == "active" and now < c.apply_deadline and c.filled_slots < c.slots


def _check_terms(fee_paise: int, slots: int, budget_paise: int, apply_deadline: datetime, submit_deadline: datetime) -> None:
    if fee_paise % 100 or budget_paise % 100:
        raise DomainError("Fee and budget must be a whole number of rupees", 422)
    if budget_paise < fee_paise * slots:
        raise DomainError(f"Budget must cover {slots} × {format_inr(fee_paise)} = {format_inr(fee_paise * slots)}", 422)
    if submit_deadline <= apply_deadline:
        raise DomainError("The submission deadline must be after the application deadline", 422)


def create_campaign(db: Session, brand: User, data: CampaignIn, now: datetime) -> Campaign:
    _check_terms(data.fee_paise, data.slots, data.budget_paise, data.apply_deadline, data.submit_deadline)
    if data.apply_deadline <= now:
        raise DomainError("The application deadline must be in the future", 422)
    campaign = Campaign(brand_id=brand.id, created_at=now, **data.model_dump())
    db.add(campaign)
    db.commit()
    return campaign


def _lock_own_campaign(db: Session, brand: User, campaign_id: int) -> Campaign:
    campaign = db.execute(select(Campaign).where(Campaign.id == campaign_id).with_for_update()).scalar_one_or_none()
    if campaign is None or campaign.brand_id != brand.id:
        raise DomainError("Campaign not found", 404)
    return campaign


def _live_applications(db: Session, campaign_id: int) -> list[Application]:
    return list(db.scalars(select(Application).where(Application.campaign_id == campaign_id,
                                                     Application.status.in_(LIVE_STATUSES))))


def edit_campaign(db: Session, brand: User, campaign_id: int, data: CampaignEdit, now: datetime) -> Campaign:
    campaign = _lock_own_campaign(db, brand, campaign_id)
    if campaign.status != "active":
        raise DomainError("A cancelled campaign can't be edited")
    changes = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    if "fee_paise" in changes and changes["fee_paise"] != campaign.fee_paise and campaign.filled_slots > 0:
        raise DomainError("The fee is locked once a creator is approved")
    if changes.get("slots", campaign.slots) < campaign.filled_slots:
        raise DomainError(f"{campaign.filled_slots} creators are already approved, "
                          f"so slots can't go below {campaign.filled_slots}")
    for field in ("apply_deadline", "submit_deadline"):
        if field in changes and changes[field] < getattr(campaign, field):
            raise DomainError("Deadlines can only be extended")
    _check_terms(*(changes.get(field, getattr(campaign, field)) for field in TERMS))
    for field, value in changes.items():
        setattr(campaign, field, value)
    for app in _live_applications(db, campaign.id):
        enqueue(db, app.creator_id, "campaign_edited",
                f"“{campaign.title}” was updated by the brand. Check the latest details.", now)
    db.commit()
    return campaign


def cancel_campaign(db: Session, brand: User, campaign_id: int, now: datetime) -> Campaign:
    campaign = _lock_own_campaign(db, brand, campaign_id)
    if campaign.status != "active":
        raise DomainError("This campaign is already cancelled")
    campaign.status = "cancelled"
    for app in _live_applications(db, campaign.id):
        if app.status == "applied":
            move(db, app, "declined", now, "The brand cancelled the campaign")
        else:  # approved creators can't be removed: they keep their slot and still get paid
            enqueue(db, app.creator_id, "campaign_cancelled",
                    f"“{campaign.title}” was cancelled, but your spot is safe. "
                    f"Finish your post as agreed and you'll still be paid.", now)
    db.commit()
    return campaign


def get_for_viewer(db: Session, viewer: User, campaign_id: int) -> Campaign:
    campaign = db.get(Campaign, campaign_id)
    if campaign is None or (viewer.role == "brand" and campaign.brand_id != viewer.id):
        raise DomainError("Campaign not found", 404)
    return campaign


def list_open(db: Session, now: datetime) -> list[Campaign]:
    return list(db.scalars(
        select(Campaign)
        .where(Campaign.status == "active", Campaign.apply_deadline > now, Campaign.filled_slots < Campaign.slots)
        .order_by(Campaign.apply_deadline)
    ))


def list_for_brand(db: Session, brand: User) -> list[Campaign]:
    return list(db.scalars(select(Campaign).where(Campaign.brand_id == brand.id).order_by(Campaign.id.desc())))
