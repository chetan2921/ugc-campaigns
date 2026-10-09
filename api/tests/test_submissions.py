from datetime import timedelta

import pytest

from app.errors import DomainError
from app.services import submissions
from tests.factories import NOW, approved, make_campaign, make_user, submitted

URL = "https://www.instagram.com/reel/Cx1abc/"


def test_submitting_a_post_sends_it_for_review(db):
    app = approved(db, make_campaign(db, make_user(db, "brand")))
    submissions.submit(db, app.creator, app.id, URL + "?igsh=share123", NOW)
    assert app.status == "submitted"
    assert app.submissions[0].url == URL  # tracking query stripped
    assert app.submissions[0].caption.startswith("Mock caption")


@pytest.mark.parametrize("url", [
    "https://instagram.com/asha.makes/", "https://www.youtube.com/watch?v=1", "not a link",
])
def test_only_instagram_post_links_are_accepted(db, url):
    app = approved(db, make_campaign(db, make_user(db, "brand")))
    with pytest.raises(DomainError, match="isn't an Instagram post"):
        submissions.submit(db, app.creator, app.id, url, NOW)


@pytest.mark.parametrize("shortcode, message", [("missing42", "couldn't find"), ("private42", "private")])
def test_post_must_exist_and_be_public(db, shortcode, message):
    app = approved(db, make_campaign(db, make_user(db, "brand")))
    with pytest.raises(DomainError, match=message):
        submissions.submit(db, app.creator, app.id, f"https://www.instagram.com/p/{shortcode}/", NOW)


def test_the_same_post_cannot_be_used_twice(db):
    campaign = make_campaign(db, make_user(db, "brand"))
    first, second = approved(db, campaign), approved(db, campaign)
    submissions.submit(db, first.creator, first.id, URL, NOW)
    with pytest.raises(DomainError, match="already submitted"):
        submissions.submit(db, second.creator, second.id, URL, NOW)


def test_first_submission_must_beat_the_deadline(db):
    campaign = make_campaign(db, make_user(db, "brand"))
    app = approved(db, campaign)
    with pytest.raises(DomainError, match="deadline has passed"):
        submissions.submit(db, app.creator, app.id, URL, campaign.submit_deadline)


def test_revisions_need_a_note_and_stop_at_two(db):
    brand = make_user(db, "brand")
    app = submitted(db, make_campaign(db, brand))
    url = app.submissions[0].url
    with pytest.raises(DomainError, match="what to change"):
        submissions.review(db, brand, app.id, "revise", "  ", NOW)
    db.rollback()
    for n in (1, 2):
        submissions.review(db, brand, app.id, "revise", f"Fix number {n}", NOW)
        assert (app.status, app.revision_count) == ("revision_requested", n)
        submissions.submit(db, app.creator, app.id, url, NOW)  # resubmitting your own link is fine
    with pytest.raises(DomainError, match="revisions are used"):
        submissions.review(db, brand, app.id, "revise", "One more", NOW)


def test_resubmission_is_allowed_after_the_deadline(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand)
    app = submitted(db, campaign)
    submissions.review(db, brand, app.id, "revise", "Brighter lighting", NOW)
    submissions.submit(db, app.creator, app.id, app.submissions[0].url, campaign.submit_deadline + timedelta(days=1))
    assert app.status == "submitted"
    assert [s.version for s in app.submissions] == [1, 2]


def test_reject_needs_a_reason(db):
    brand = make_user(db, "brand")
    app = submitted(db, make_campaign(db, brand))
    with pytest.raises(DomainError, match="reason"):
        submissions.review(db, brand, app.id, "reject", None, NOW)
