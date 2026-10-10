from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Application, Campaign
from app.services.applications import lock_campaign
from app.services.slots import release_slot
from app.services.transitions import move


def expire_missed_deadlines(db: Session, now: datetime) -> int:
    """Worker step. At the submission deadline, approved creators who never submitted expire
    (their slot and fee are freed) and still-pending applicants are declined."""
    campaign_ids = db.scalars(
        select(Campaign.id).join(Application)
        .where(Campaign.submit_deadline <= now, Application.status.in_(("applied", "approved")))
        .distinct().order_by(Campaign.id)
    ).all()
    changed = 0
    for campaign_id in campaign_ids:
        # Campaign row first, then its applications. Releasing a slot updates the campaign,
        # and the opposite order deadlocks with approve, withdraw, and cancel.
        campaign = lock_campaign(db, campaign_id)
        if campaign is None or campaign.submit_deadline > now:
            continue
        overdue = db.scalars(
            select(Application)
            .where(Application.campaign_id == campaign_id, Application.status.in_(("applied", "approved")))
            .order_by(Application.id)
            .with_for_update(of=Application, skip_locked=True)
            .execution_options(populate_existing=True)
        ).all()
        for app in overdue:
            if app.status == "approved":
                move(db, app, "expired", now)
                release_slot(db, app)
            else:
                move(db, app, "declined", now, "The campaign closed before your application was reviewed")
            changed += 1
    db.commit()
    return changed
