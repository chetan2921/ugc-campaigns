from datetime import datetime

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models import LedgerEntry, Wallet


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
