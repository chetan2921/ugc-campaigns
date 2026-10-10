from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domain.states import MAX_REVISIONS
from app.models import Application, Campaign, LedgerEntry, User, Wallet, Withdrawal
from app.schemas import (ApplicationOut, CampaignCounts, CampaignOut, CampaignSummary, CreatorSummary, EventOut,
                         LedgerOut, MyApplication, PayoutOut, SubmissionOut, WalletOut, WithdrawalOut)
from app.services.campaigns import accepting_applications


def campaign_out(db: Session, c: Campaign, now: datetime, viewer: User) -> CampaignOut:
    counts, mine = None, None
    if viewer.role == "brand":
        by_status = dict(db.execute(
            select(Application.status, func.count())
            .where(Application.campaign_id == c.id)
            .group_by(Application.status)
        ).all())
        counts = CampaignCounts(applied=by_status.get("applied", 0), to_review=by_status.get("submitted", 0))
    else:
        app = db.scalar(select(Application).where(Application.campaign_id == c.id, Application.creator_id == viewer.id))
        if app:
            mine = MyApplication(id=app.id, status=app.status)
    return CampaignOut(
        id=c.id, brand_name=c.brand.name, title=c.title, description=c.description,
        budget_paise=c.budget_paise, fee_paise=c.fee_paise, slots=c.slots, filled_slots=c.filled_slots,
        reserved_paise=c.reserved_paise, spent_paise=c.spent_paise,
        apply_deadline=c.apply_deadline, submit_deadline=c.submit_deadline, status=c.status,
        accepting_applications=accepting_applications(c, now), counts=counts, my_application=mine,
    )


def application_out(app: Application) -> ApplicationOut:
    c = app.campaign
    return ApplicationOut(
        id=app.id, status=app.status, note=app.note, fee_paise=app.fee_paise or c.fee_paise,
        revision_count=app.revision_count, revisions_left=MAX_REVISIONS - app.revision_count,
        created_at=app.created_at,
        campaign=CampaignSummary(id=c.id, title=c.title, brand_name=c.brand.name, fee_paise=c.fee_paise,
                                 apply_deadline=c.apply_deadline, submit_deadline=c.submit_deadline, status=c.status),
        creator=CreatorSummary.model_validate(app.creator),
        submissions=[SubmissionOut.model_validate(s) for s in app.submissions],
        events=[EventOut.model_validate(e) for e in app.events],
        payout=PayoutOut.model_validate(app.payout) if app.payout else None,
    )


def wallet_out(db: Session, creator: User) -> WalletOut:
    entries = db.scalars(select(LedgerEntry).where(LedgerEntry.user_id == creator.id).order_by(LedgerEntry.id.desc()))
    withdrawals = db.scalars(select(Withdrawal).where(Withdrawal.user_id == creator.id).order_by(Withdrawal.id.desc()))
    return WalletOut(
        balance_paise=db.get(Wallet, creator.id).balance_paise,
        upi_id=creator.upi_id,
        entries=[
            LedgerOut(
                id=e.id, kind=e.kind, amount_paise=e.amount_paise, balance_after_paise=e.balance_after_paise,
                created_at=e.created_at,
                campaign_title=e.payout.application.campaign.title if e.payout else None,
                payout=PayoutOut.model_validate(e.payout) if e.payout else None,
                withdrawal_id=e.withdrawal_id,
            )
            for e in entries
        ],
        withdrawals=[WithdrawalOut.model_validate(w) for w in withdrawals],
    )
