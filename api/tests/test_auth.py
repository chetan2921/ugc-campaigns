from app.models import Wallet


def signup(client, **overrides):
    body = {"name": "Asha Rao", "email": "asha@ugc-test.in", "password": "secret-pass",
            "role": "creator", "instagram_handle": "@asha.makes"}
    body.update(overrides)
    return client.post("/auth/signup", json=body)


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_signup_returns_a_working_token(client):
    res = signup(client)
    assert res.status_code == 201
    me = client.get("/me", headers=bearer(res.json()["token"])).json()
    assert me["role"] == "creator"
    assert me["instagram_handle"] == "asha.makes"
    assert me["email_opt_in"] and me["whatsapp_opt_in"]


def test_creators_start_with_an_empty_wallet(client, db):
    user_id = signup(client).json()["user"]["id"]
    assert db.get(Wallet, user_id).balance_paise == 0


def test_duplicate_email_is_refused_case_insensitively(client):
    signup(client)
    assert signup(client, email="ASHA@ugc-test.in").status_code == 409


def test_creators_need_an_instagram_handle(client):
    assert signup(client, instagram_handle=None).status_code == 422


def test_brands_need_no_handle_or_wallet(client, db):
    res = signup(client, role="brand", instagram_handle=None, email="brand@ugc-test.in")
    assert res.status_code == 201
    assert db.get(Wallet, res.json()["user"]["id"]) is None


def test_login_checks_the_password(client):
    signup(client)
    assert client.post("/auth/login", json={"email": "asha@ugc-test.in", "password": "wrong-pass"}).status_code == 401
    assert client.post("/auth/login", json={"email": "Asha@ugc-test.in", "password": "secret-pass"}).status_code == 200


def test_me_needs_a_token(client):
    assert client.get("/me").status_code == 401
    assert client.get("/me", headers=bearer("garbage")).status_code == 401


def test_updating_me_saves_preferences(client):
    token = signup(client).json()["token"]
    res = client.patch("/me", headers=bearer(token), json={"whatsapp_opt_in": False, "phone": "+919800000001"})
    assert res.json()["whatsapp_opt_in"] is False
    assert res.json()["phone"] == "+919800000001"
