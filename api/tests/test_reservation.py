from datetime import timedelta

import pytest
from sqlalchemy import select

from app.errors import DomainError
from app.models import Application, Campaign, Notification, User
from app.services import applications, campaigns, deadlines, submissions
from tests.factories import FEE, NOW, applied, approved, make_campaign, make_user, paid, run_concurrently, submitted


def test_approving_reserves_the_fee_and_a_slot(db):
    campaign = make_campaign(db, make_user(db, "brand"), slots=2)
    app = approved(db, campaign)
    assert app.status == "approved"
    assert app.fee_paise == FEE
    assert (campaign.filled_slots, campaign.reserved_paise, campaign.spent_paise) == (1, FEE, 0)


def test_cannot_approve_more_creators_than_slots(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand, slots=1)
    first, second = applied(db, campaign), applied(db, campaign)
    applications.approve(db, brand, first.id, NOW)
    with pytest.raises(DomainError, match="No free slot"):
        applications.approve(db, brand, second.id, NOW)
    db.rollback()
    assert second.status == "applied"
    assert campaign.filled_slots == 1


def test_parallel_approvals_never_overfill_the_last_slot(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand, slots=1)
    app_ids = [applied(db, campaign).id for _ in range(8)]
    brand_id = brand.id

    results = run_concurrently(*[
        (lambda s, app_id=app_id: applications.approve(s, s.get(User, brand_id), app_id, NOW))
        for app_id in app_ids
    ])

    assert results.count("ok") == 1
    db.expire_all()
    assert (campaign.filled_slots, campaign.reserved_paise) == (1, FEE)
    statuses = db.scalars(select(Application.status).where(Application.campaign_id == campaign.id)).all()
    assert statuses.count("approved") == 1


def test_cannot_approve_after_the_submission_deadline(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand)
    app = applied(db, campaign)
    with pytest.raises(DomainError, match="submission deadline has passed"):
        applications.approve(db, brand, app.id, campaign.submit_deadline)


def test_withdrawing_after_approval_frees_the_slot(db):
    campaign = make_campaign(db, make_user(db, "brand"))
    app = approved(db, campaign)
    applications.withdraw(db, app.creator, app.id, NOW)
    assert app.status == "withdrawn"
    assert (campaign.filled_slots, campaign.reserved_paise) == (0, 0)


def test_withdrawing_a_pending_application_touches_no_money(db):
    campaign = make_campaign(db, make_user(db, "brand"))
    app = applied(db, campaign)
    applications.withdraw(db, app.creator, app.id, NOW)
    assert app.status == "withdrawn"
    assert (campaign.filled_slots, campaign.reserved_paise) == (0, 0)


def test_one_application_per_creator(db):
    campaign = make_campaign(db, make_user(db, "brand"))
    app = applied(db, campaign)
    with pytest.raises(DomainError, match="already applied"):
        applications.apply(db, app.creator, campaign.id, None, NOW)


def test_applying_closes_at_the_application_deadline(db):
    campaign = make_campaign(db, make_user(db, "brand"))
    with pytest.raises(DomainError, match="closed"):
        applications.apply(db, make_user(db, "creator"), campaign.id, None, campaign.apply_deadline)


def test_every_status_change_is_logged_and_notified(db):
    brand = make_user(db, "brand")
    app = approved(db, make_campaign(db, brand))
    assert [(e.from_status, e.to_status) for e in app.events] == [(None, "applied"), ("applied", "approved")]
    emails = db.execute(
        select(Notification.user_id, Notification.event).where(Notification.channel == "email").order_by(Notification.id)
    ).all()
    assert emails == [(brand.id, "application_applied"), (app.creator_id, "application_approved")]


def test_cancelling_declines_pending_but_keeps_approved_creators(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand)
    pending, kept = applied(db, campaign), approved(db, campaign)
    campaigns.cancel_campaign(db, brand, campaign.id, NOW)
    assert campaign.status == "cancelled"
    assert pending.status == "declined"
    assert kept.status == "approved"
    assert (campaign.filled_slots, campaign.reserved_paise) == (1, FEE)


def test_racing_cancel_keeps_approved_and_leaves_no_applied_row(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand, slots=4)
    kept, pending = approved(db, campaign), applied(db, campaign)
    creator_ids = [make_user(db, "creator").id for _ in range(3)]
    brand_id, campaign_id, kept_id, pending_id = brand.id, campaign.id, kept.id, pending.id
    pending_creator_id = pending.creator_id

    results = run_concurrently(
        lambda s: campaigns.cancel_campaign(s, s.get(User, brand_id), campaign_id, NOW),
        lambda s: applications.withdraw(s, s.get(User, pending_creator_id), pending_id, NOW),
        *[
            (lambda s, creator_id=creator_id: applications.apply(s, s.get(User, creator_id), campaign_id, None, NOW))
            for creator_id in creator_ids
        ],
    )

    assert not any("deadlock" in result for result in results)
    db.expire_all()
    assert db.get(Campaign, campaign_id).status == "cancelled"
    assert db.get(Application, kept_id).status == "approved"
    assert db.get(Application, pending_id).status in ("withdrawn", "declined")
    statuses = db.scalars(select(Application.status).where(Application.campaign_id == campaign_id)).all()
    assert "applied" not in statuses
    assert (db.get(Campaign, campaign_id).filled_slots, db.get(Campaign, campaign_id).reserved_paise) == (1, FEE)


def test_rejecting_a_post_frees_the_slot(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand)
    app = submitted(db, campaign)
    submissions.review(db, brand, app.id, "reject", "Product not visible", NOW)
    assert app.status == "rejected"
    assert (campaign.filled_slots, campaign.reserved_paise, campaign.spent_paise) == (0, 0, 0)


def test_payout_moves_the_fee_from_reserved_to_spent(db):
    campaign = make_campaign(db, make_user(db, "brand"))
    paid(db, campaign)
    assert (campaign.filled_slots, campaign.reserved_paise, campaign.spent_paise) == (1, 0, FEE)


def test_cannot_withdraw_after_submitting(db):
    app = submitted(db, make_campaign(db, make_user(db, "brand")))
    with pytest.raises(DomainError, match="before submitting"):
        applications.withdraw(db, app.creator, app.id, NOW)


def test_cancelled_campaign_still_pays_approved_creators(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand)
    app = approved(db, campaign)
    campaigns.cancel_campaign(db, brand, campaign.id, NOW)
    submissions.submit(db, app.creator, app.id, "https://www.instagram.com/reel/AfterCancel1/", NOW)
    submissions.review(db, brand, app.id, "approve", None, NOW)
    assert app.status == "paid"


def test_missed_deadline_expires_and_frees_the_slot(db):
    campaign = make_campaign(db, make_user(db, "brand"))
    app, pending = approved(db, campaign), applied(db, campaign)
    assert deadlines.expire_missed_deadlines(db, campaign.submit_deadline + timedelta(minutes=1)) == 2
    assert app.status == "expired"
    assert pending.status == "declined"
    assert (campaign.filled_slots, campaign.reserved_paise) == (0, 0)


def test_deadline_job_leaves_submitted_posts_alone(db):
    campaign = make_campaign(db, make_user(db, "brand"))
    app = submitted(db, campaign)
    assert deadlines.expire_missed_deadlines(db, campaign.submit_deadline + timedelta(days=1)) == 0
    assert app.status == "submitted"
