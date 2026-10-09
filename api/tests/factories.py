import itertools
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from app.db import SessionLocal
from app.errors import DomainError
from app.models import Campaign, User, Wallet
from app.services import applications

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


def make_campaign(db, brand: User, *, fee: int = FEE, slots: int = 3, budget: int | None = None, now=NOW) -> Campaign:
    campaign = Campaign(
        brand_id=brand.id, title="Monsoon snack reels", description="", fee_paise=fee, slots=slots,
        budget_paise=budget or fee * slots, apply_deadline=now + timedelta(days=3),
        submit_deadline=now + timedelta(days=10),
    )
    db.add(campaign)
    db.commit()
    return campaign


def applied(db, campaign: Campaign, creator: User | None = None):
    return applications.apply(db, creator or make_user(db, "creator"), campaign.id, None, NOW)


def approved(db, campaign: Campaign):
    app = applied(db, campaign)
    return applications.approve(db, campaign.brand, app.id, NOW)


def run_concurrently(*calls) -> list[str]:
    """Run each call(session) in its own thread and DB session, all released at the same moment.
    Returns "ok" or the DomainError message for each call."""
    barrier = threading.Barrier(len(calls))

    def run(call):
        with SessionLocal() as session:
            barrier.wait()
            try:
                call(session)
                return "ok"
            except DomainError as error:
                return error.message

    with ThreadPoolExecutor(len(calls)) as pool:
        return list(pool.map(run, calls))
