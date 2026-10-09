import itertools
from datetime import datetime, timezone

from app.models import User, Wallet

NOW = datetime(2026, 10, 12, 6, 30, tzinfo=timezone.utc)  # 12:00 IST, outside quiet hours
FEE = 1_000_000  # ₹10,000 in paise
_ids = itertools.count(1)


def make_user(db, role: str, **fields) -> User:
    n = next(_ids)
    user = User(
        email=f"{role}{n}@ugc-test.in", password_hash="not-used", name=f"{role.title()} {n}", role=role,
        instagram_handle=f"creator.{n}" if role == "creator" else None, **fields,
    )
    db.add(user)
    db.flush()
    if role == "creator":
        db.add(Wallet(user_id=user.id, balance_paise=0))
    db.commit()
    return user


def signup(client, role: str) -> dict[str, str]:
    """Sign up through the API and return auth headers."""
    n = next(_ids)
    body = {"name": f"{role.title()} {n}", "email": f"{role}{n}@ugc-test.in", "password": "secret-pass", "role": role}
    if role == "creator":
        body["instagram_handle"] = f"creator.{n}"
    token = client.post("/auth/signup", json=body).json()["token"]
    return {"Authorization": f"Bearer {token}"}
