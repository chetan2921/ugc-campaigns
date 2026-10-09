from sqlalchemy import update
from sqlalchemy.orm import Session

from app.errors import DomainError
from app.models import Application, Campaign


def reserve_slot(db: Session, app: Application) -> None:
    """Take a slot and reserve the fee in ONE conditional UPDATE.
    If two brands' clicks race for the last slot, Postgres row-locks the campaign:
    the second UPDATE re-checks the WHERE after the first commits, matches nothing, and we refuse."""
    fee = app.campaign.fee_paise
    taken = db.execute(
        update(Campaign)
        .where(
            Campaign.id == app.campaign_id,
            Campaign.status == "active",
            Campaign.filled_slots < Campaign.slots,
            Campaign.budget_paise - Campaign.reserved_paise - Campaign.spent_paise >= fee,
        )
        .values(filled_slots=Campaign.filled_slots + 1, reserved_paise=Campaign.reserved_paise + fee)
        .returning(Campaign.id)
        .execution_options(synchronize_session=False)
    ).first()
    if taken is None:
        raise DomainError("No free slot or budget left on this campaign")
    app.fee_paise = fee


def release_slot(db: Session, app: Application) -> None:
    db.execute(
        update(Campaign)
        .where(Campaign.id == app.campaign_id)
        .values(filled_slots=Campaign.filled_slots - 1, reserved_paise=Campaign.reserved_paise - app.fee_paise)
        .execution_options(synchronize_session=False)
    )


def mark_spent(db: Session, app: Application) -> None:
    """On payout the fee moves from reserved to spent; the slot stays filled."""
    db.execute(
        update(Campaign)
        .where(Campaign.id == app.campaign_id)
        .values(reserved_paise=Campaign.reserved_paise - app.fee_paise,
                spent_paise=Campaign.spent_paise + app.fee_paise)
        .execution_options(synchronize_session=False)
    )
