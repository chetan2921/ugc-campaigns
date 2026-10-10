from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import creator_only
from app.clock import utcnow
from app.db import get_db
from app.models import User
from app.presenters import wallet_out
from app.schemas import WalletOut, WithdrawalOut, WithdrawIn
from app.services import wallet

router = APIRouter(prefix="/wallet", tags=["wallet"])


@router.get("", response_model=WalletOut)
def get_wallet(creator: User = Depends(creator_only), db: Session = Depends(get_db)):
    return wallet_out(db, creator)


@router.post("/withdrawals", response_model=WithdrawalOut, status_code=201)
def withdraw(data: WithdrawIn, creator: User = Depends(creator_only), db: Session = Depends(get_db)):
    return WithdrawalOut.model_validate(
        wallet.request_withdrawal(db, creator, data.amount_paise, data.upi_id, utcnow())
    )
