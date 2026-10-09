from datetime import timedelta

import pytest
from sqlalchemy import select

from app.errors import DomainError
from app.models import Notification
from app.schemas import CampaignEdit, CampaignIn
from app.services import campaigns
from tests.factories import FEE, NOW, applied, approved, make_campaign, make_user


def campaign_in(**overrides) -> CampaignIn:
    data = dict(title="Monsoon snack reels", description="", fee_paise=FEE, slots=3, budget_paise=FEE * 3,
                apply_deadline=NOW + timedelta(days=3), submit_deadline=NOW + timedelta(days=10))
    data.update(overrides)
    return CampaignIn(**data)


def test_create_campaign(db):
    c = campaigns.create_campaign(db, make_user(db, "brand"), campaign_in(), NOW)
    assert (c.status, c.filled_slots, c.reserved_paise) == ("active", 0, 0)


@pytest.mark.parametrize("overrides, message", [
    ({"budget_paise": FEE * 2}, "Budget must cover"),
    ({"fee_paise": FEE + 50}, "whole number of rupees"),
    ({"submit_deadline": NOW + timedelta(days=2)}, "after the application deadline"),
    ({"apply_deadline": NOW - timedelta(minutes=1)}, "in the future"),
])
def test_create_validation(db, overrides, message):
    with pytest.raises(DomainError, match=message):
        campaigns.create_campaign(db, make_user(db, "brand"), campaign_in(**overrides), NOW)


def test_fee_is_locked_after_the_first_approval(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand)
    approved(db, campaign)
    with pytest.raises(DomainError, match="fee is locked"):
        campaigns.edit_campaign(db, brand, campaign.id, CampaignEdit(fee_paise=FEE * 2, budget_paise=FEE * 6), NOW)


def test_fee_can_change_before_anyone_is_approved(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand)
    campaigns.edit_campaign(db, brand, campaign.id, CampaignEdit(fee_paise=FEE * 2, budget_paise=FEE * 6), NOW)
    assert campaign.fee_paise == FEE * 2


def test_slots_cannot_drop_below_approved_creators(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand, slots=3)
    approved(db, campaign)
    approved(db, campaign)
    with pytest.raises(DomainError, match="can't go below 2"):
        campaigns.edit_campaign(db, brand, campaign.id, CampaignEdit(slots=1), NOW)


def test_deadlines_can_only_be_extended(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand)
    with pytest.raises(DomainError, match="only be extended"):
        campaigns.edit_campaign(db, brand, campaign.id,
                                CampaignEdit(submit_deadline=campaign.submit_deadline - timedelta(days=1)), NOW)


def test_editing_notifies_live_applicants(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand)
    app = applied(db, campaign)
    campaigns.edit_campaign(db, brand, campaign.id, CampaignEdit(title="Monsoon snack reels v2"), NOW)
    events = db.scalars(select(Notification.event).where(Notification.user_id == app.creator_id)).all()
    assert "campaign_edited" in events


def test_cancelled_campaign_cannot_be_edited(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand)
    campaigns.cancel_campaign(db, brand, campaign.id, NOW)
    with pytest.raises(DomainError, match="cancelled"):
        campaigns.edit_campaign(db, brand, campaign.id, CampaignEdit(title="Too late"), NOW)


def test_other_brands_cannot_touch_a_campaign(db):
    campaign = make_campaign(db, make_user(db, "brand"))
    with pytest.raises(DomainError, match="not found"):
        campaigns.cancel_campaign(db, make_user(db, "brand"), campaign.id, NOW)


def test_open_list_hides_full_closed_and_cancelled_campaigns(db):
    brand = make_user(db, "brand")
    open_one = make_campaign(db, brand)
    full = make_campaign(db, brand, slots=1)
    approved(db, full)
    cancelled = make_campaign(db, brand)
    campaigns.cancel_campaign(db, brand, cancelled.id, NOW)
    assert [c.id for c in campaigns.list_open(db, NOW)] == [open_one.id]
    assert campaigns.list_open(db, open_one.apply_deadline) == []
