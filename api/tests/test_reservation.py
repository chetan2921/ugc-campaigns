import pytest
from sqlalchemy import select

from app.errors import DomainError
from app.models import Application, Notification, User
from app.services import applications
from tests.factories import FEE, NOW, applied, approved, make_campaign, make_user, run_concurrently


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
