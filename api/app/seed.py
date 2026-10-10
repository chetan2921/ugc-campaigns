"""Illustrative demo data so reviewers can click through straight away. Safe to run twice."""
from datetime import timedelta

from sqlalchemy import select

from app.clock import utcnow
from app.db import SessionLocal
from app.models import User
from app.schemas import CampaignIn, SignupIn
from app.services import applications, campaigns, submissions, users

PASSWORD = "demo-pass-123"


def main() -> None:
    now = utcnow()
    with SessionLocal() as db:
        if db.scalar(select(User.id).where(User.email == "brand@ugc-demo.in")):
            print("Demo data already present")
            return
        brand = users.signup(db, SignupIn(name="Monsoon Snacks (demo)", email="brand@ugc-demo.in",
                                          password=PASSWORD, role="brand"))
        asha = users.signup(db, SignupIn(name="Asha Rao", email="creator@ugc-demo.in", password=PASSWORD,
                                         role="creator", instagram_handle="asha.makes", phone="+919800000001"))
        ravi = users.signup(db, SignupIn(name="Ravi Menon", email="ravi@ugc-demo.in", password=PASSWORD,
                                         role="creator", instagram_handle="ravi.frames"))
        meera = users.signup(db, SignupIn(name="Meera Shah", email="meera@ugc-demo.in", password=PASSWORD,
                                          role="creator", instagram_handle="meera.cooks", phone="+919800000003"))

        reels = campaigns.create_campaign(db, brand, CampaignIn(
            title="Rainy-day snack reels",
            description="Show your favourite monsoon snack moment with our masala chips. 30-45 second reel; tag the brand.",
            budget_paise=3_000_000, fee_paise=1_000_000, slots=3,
            apply_deadline=now + timedelta(days=5), submit_deadline=now + timedelta(days=12)), now)
        unboxing = campaigns.create_campaign(db, brand, CampaignIn(
            title="Festive gift box unboxing",
            description="Unbox our festive hamper on camera. One post or reel.",
            budget_paise=2_000_000, fee_paise=500_000, slots=4,
            apply_deadline=now + timedelta(days=4), submit_deadline=now + timedelta(days=10)), now)

        # Asha is already paid, so her wallet shows a payout bill on first login.
        app = applications.apply(db, asha, reels.id, "Rainy balcony set-up ready!", now)
        applications.approve(db, brand, app.id, now)
        submissions.submit(db, asha, app.id, "https://www.instagram.com/reel/DemoAsha01/", now)
        submissions.review(db, brand, app.id, "approve", None, now)
        # Ravi is waiting for the brand to decide.
        applications.apply(db, ravi, reels.id, None, now)
        # Meera's post is waiting for review.
        app = applications.apply(db, meera, unboxing.id, None, now)
        applications.approve(db, brand, app.id, now)
        submissions.submit(db, meera, app.id, "https://www.instagram.com/p/DemoMeera1/", now)
        print(f"Seeded demo data. Every demo account's password is {PASSWORD}")


if __name__ == "__main__":
    main()
