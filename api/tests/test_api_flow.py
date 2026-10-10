from datetime import datetime, timedelta, timezone

from app.worker import run_once
from tests.factories import signup


def in_days(days: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


def test_full_campaign_flow_over_http(client):
    brand, creator = signup(client, "brand"), signup(client, "creator")
    campaign = client.post("/campaigns", headers=brand, json={
        "title": "Monsoon snack reels", "budget_paise": 2_000_000, "fee_paise": 1_000_000, "slots": 2,
        "apply_deadline": in_days(3), "submit_deadline": in_days(10),
    }).json()
    assert [c["id"] for c in client.get("/campaigns", headers=creator).json()] == [campaign["id"]]

    app = client.post(f"/campaigns/{campaign['id']}/apply", headers=creator, json={}).json()
    assert client.get(f"/campaigns/{campaign['id']}", headers=brand).json()["counts"] == {"applied": 1, "to_review": 0}
    assert client.post(f"/applications/{app['id']}/approve", headers=brand).json()["status"] == "approved"

    post = {"url": "https://www.instagram.com/reel/Abc123/"}
    client.post(f"/applications/{app['id']}/submissions", headers=creator, json=post)
    revised = client.post(f"/applications/{app['id']}/review", headers=brand,
                          json={"action": "revise", "note": "Show the pack in the first 3 seconds"}).json()
    assert revised["revisions_left"] == 1
    client.post(f"/applications/{app['id']}/submissions", headers=creator, json=post)
    done = client.post(f"/applications/{app['id']}/review", headers=brand, json={"action": "approve"}).json()
    assert done["payout"]["net_paise"] == 873_180

    res = client.post("/wallet/withdrawals", headers=creator, json={"amount_paise": 873_180, "upi_id": "asha@okbank"})
    assert res.status_code == 201
    run_once()
    wallet = client.get("/wallet", headers=creator).json()
    assert wallet["balance_paise"] == 0
    assert wallet["withdrawals"][0]["status"] == "succeeded"
    assert [e["kind"] for e in wallet["entries"]] == ["withdrawal", "payout"]
    assert wallet["entries"][1]["payout"]["tds_paise"] == 8_820


def test_roles_are_enforced(client):
    brand, creator = signup(client, "brand"), signup(client, "creator")
    assert client.get("/wallet", headers=brand).status_code == 403
    assert client.get("/campaigns/mine", headers=creator).status_code == 403


def test_business_errors_come_back_as_readable_messages(client):
    creator = signup(client, "creator")
    res = client.post("/wallet/withdrawals", headers=creator, json={"amount_paise": 100, "upi_id": "asha@okbank"})
    assert res.status_code == 409
    assert res.json() == {"detail": "That's more than your wallet balance"}
