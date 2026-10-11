"""Listing must not query once per row. The hosted database is a round trip away,
so a per-row query turns Apply and Approve into a multi-second wait."""

from sqlalchemy import event

from app.db import engine
from app.models import ApplicationEvent
from app.presenters import application_out, campaigns_out
from app.services import applications, campaigns
from tests.factories import NOW, applied, make_campaign, make_user


def _queries_during(fn) -> int:
    count = 0

    def before(*_args):
        nonlocal count
        count += 1

    event.listen(engine, "before_cursor_execute", before)
    try:
        fn()
    finally:
        event.remove(engine, "before_cursor_execute", before)
    return count


def test_campaign_applications_load_in_one_query(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand)
    creators = []
    for _ in range(3):
        app = applied(db, campaign)
        creators.append(app.creator)
        db.add(ApplicationEvent(
            application_id=app.id, from_status="applied", to_status="applied", note="again", created_at=NOW,
        ))
    db.commit()
    db.expire_all()

    presented = []

    def load():
        apps = applications.list_for_campaign(db, brand, campaign.id)
        assert len(apps) == 3  # two events each must not duplicate the row
        for app in apps:
            presented.append(application_out(app))

    assert _queries_during(load) <= 3
    assert presented[0].creator.name
    assert presented[0].campaign.brand_name == brand.name
    assert len(presented[0].events) == 2

    creator = creators[0]

    def load_open():
        rows = campaigns_out(db, campaigns.list_open(db, NOW), NOW, creator)
        assert len(rows) == 1
        assert rows[0].my_application is not None
        assert rows[0].brand_name == brand.name

    assert _queries_during(load_open) <= 4

    def load_brand():
        rows = campaigns_out(db, campaigns.list_for_brand(db, brand), NOW, brand)
        assert rows[0].counts.applied == 3
        assert rows[0].brand_name == brand.name

    assert _queries_during(load_brand) <= 4
