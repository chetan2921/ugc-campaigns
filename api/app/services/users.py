from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import hash_password, verify_password
from app.errors import DomainError
from app.models import User, Wallet
from app.schemas import MeUpdate, SignupIn


def signup(db: Session, data: SignupIn) -> User:
    email = data.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise DomainError("An account with this email already exists", 409)
    handle = (data.instagram_handle or "").lstrip("@") or None
    if data.role == "creator" and handle is None:
        raise DomainError("Creators need an Instagram handle", 422)
    user = User(
        email=email, password_hash=hash_password(data.password), name=data.name.strip(), role=data.role,
        phone=data.phone, instagram_handle=handle if data.role == "creator" else None,
    )
    db.add(user)
    db.flush()
    if user.role == "creator":
        db.add(Wallet(user_id=user.id, balance_paise=0))
    db.commit()
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    user = db.scalar(select(User).where(User.email == email.lower()))
    if user is None or not verify_password(password, user.password_hash):
        raise DomainError("Wrong email or password", 401)
    return user


def update_me(db: Session, user: User, data: MeUpdate) -> User:
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is None and field in ("email_opt_in", "whatsapp_opt_in"):
            continue  # null means "no change" for toggles; for phone/upi it clears the value
        setattr(user, field, value)
    db.commit()
    return user
