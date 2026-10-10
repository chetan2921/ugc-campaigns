from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.domain.money import format_inr
from app.errors import DomainError
from app.mocks.payouts import MockPayoutProvider
from app.models import LedgerEntry, User, Wallet, Withdrawal
from app.services.notify import enqueue


def credit(db: Session, user_id: int, amount_paise: int, kind: str, now: datetime,
           payout_id: int | None = None, withdrawal_id: int | None = None) -> int:
    """Add money to a wallet and write the matching ledger line, in the caller's transaction.
    The balance and the ledger only ever change together, so they can't drift apart."""
    balance = db.execute(
        update(Wallet)
        .where(Wallet.user_id == user_id)
        .values(balance_paise=Wallet.balance_paise + amount_paise)
        .returning(Wallet.balance_paise)
        .execution_options(synchronize_session=False)
    ).scalar_one()
    db.add(LedgerEntry(user_id=user_id, kind=kind, amount_paise=amount_paise, balance_after_paise=balance,
                       payout_id=payout_id, withdrawal_id=withdrawal_id, created_at=now))
    return balance


def request_withdrawal(db: Session, creator: User, amount_paise: int, upi_id: str | None, now: datetime) -> Withdrawal:
    if amount_paise <= 0:
        raise DomainError("Enter an amount above zero", 422)
    upi = (upi_id or creator.upi_id or "").strip()
    if not upi:
        raise DomainError("Add your UPI ID to withdraw", 422)
    # Debit only if the balance covers it, in one statement: two parallel requests can't both pass.
    balance = db.execute(
        update(Wallet)
        .where(Wallet.user_id == creator.id, Wallet.balance_paise >= amount_paise)
        .values(balance_paise=Wallet.balance_paise - amount_paise)
        .returning(Wallet.balance_paise)
        .execution_options(synchronize_session=False)
    ).scalar_one_or_none()
    if balance is None:
        raise DomainError("That's more than your wallet balance")
    creator.upi_id = upi
    withdrawal = Withdrawal(user_id=creator.id, amount_paise=amount_paise, upi_id=upi, created_at=now)
    db.add(withdrawal)
    db.flush()
    db.add(LedgerEntry(user_id=creator.id, kind="withdrawal", amount_paise=-amount_paise,
                       balance_after_paise=balance, withdrawal_id=withdrawal.id, created_at=now))
    db.commit()
    return withdrawal


def process_withdrawals(db: Session, provider: MockPayoutProvider, now: datetime, limit: int = 10) -> int:
    """Worker step: settle processing withdrawals. SKIP LOCKED lets several workers share the queue."""
    pending = db.scalars(
        select(Withdrawal).where(Withdrawal.status == "processing").order_by(Withdrawal.id)
        .limit(limit).with_for_update(skip_locked=True)
    ).all()
    for w in pending:
        result = provider.transfer(w.upi_id, w.amount_paise, reference=f"wd_{w.id}")
        w.processed_at = now
        if result.ok:
            w.status, w.provider_ref = "succeeded", result.ref
            enqueue(db, w.user_id, "withdrawal_succeeded", f"{format_inr(w.amount_paise)} was sent to {w.upi_id}.", now)
        else:
            w.status, w.failure_reason = "failed", result.reason
            credit(db, w.user_id, w.amount_paise, "refund", now, withdrawal_id=w.id)
            enqueue(db, w.user_id, "withdrawal_failed",
                    f"Your withdrawal of {format_inr(w.amount_paise)} failed ({result.reason}). "
                    f"The money is back in your wallet.", now)
    db.commit()
    return len(pending)

