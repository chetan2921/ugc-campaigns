import pytest
from sqlalchemy import func, select

from app.domain.money import format_inr, payout_breakdown
from app.errors import DomainError
from app.mocks.payouts import MockPayoutProvider
from app.models import LedgerEntry, Notification, Payout, User, Wallet, Withdrawal
from app.services import submissions, wallet
from tests.factories import NOW, assert_ledger_matches, fund, make_campaign, make_user, paid, run_concurrently, submitted


def test_ten_thousand_rupee_fee_bill():
    b = payout_breakdown(1_000_000)
    assert (b.fee, b.platform_fee, b.gst, b.tds, b.net) == (1_000_000, 100_000, 18_000, 8_820, 873_180)


@pytest.mark.parametrize("fee", [100, 25_000, 99_900, 123_400, 1_000_000, 9_999_900, 123_456_700])
def test_bill_always_adds_up_to_the_fee(fee):
    b = payout_breakdown(fee)
    assert b.platform_fee + b.gst + b.tds + b.net == fee
    assert min(b.platform_fee, b.gst, b.tds, b.net) >= 0


def test_each_line_rounds_half_up():
    # ₹250 fee: TDS is 1% of 22,050 paise = 220.5 paise, which rounds up to 221
    b = payout_breakdown(25_000)
    assert (b.platform_fee, b.gst, b.tds, b.net) == (2_500, 450, 221, 21_829)


def test_rounding_example_with_odd_rupees():
    # ₹999 fee: GST 1,798.2 → 1,798 paise; TDS 881.12 → 881 paise
    b = payout_breakdown(99_900)
    assert (b.platform_fee, b.gst, b.tds, b.net) == (9_990, 1_798, 881, 87_231)


@pytest.mark.parametrize("paise, text", [
    (5, "₹0.05"),
    (873_180, "₹8,731.80"),
    (1_000_000, "₹10,000.00"),
    (10_000_000_000, "₹10,00,00,000.00"),  # Indian grouping: ten crore
])
def test_format_inr_uses_indian_grouping(paise, text):
    assert format_inr(paise) == text


def test_approving_a_post_credits_the_net_amount(db):
    app = paid(db, make_campaign(db, make_user(db, "brand")))
    assert app.status == "paid"
    assert app.payout.net_paise == 873_180
    assert db.get(Wallet, app.creator_id).balance_paise == 873_180
    entry = db.scalars(select(LedgerEntry).where(LedgerEntry.user_id == app.creator_id)).one()
    assert (entry.kind, entry.amount_paise, entry.balance_after_paise) == ("payout", 873_180, 873_180)


def test_approving_twice_pays_once(db):
    brand = make_user(db, "brand")
    app = paid(db, make_campaign(db, brand))
    with pytest.raises(DomainError):
        submissions.review(db, brand, app.id, "approve", None, NOW)
    db.rollback()
    assert db.get(Wallet, app.creator_id).balance_paise == 873_180
    assert db.scalar(select(func.count()).select_from(Payout)) == 1


def test_parallel_approvals_of_one_post_pay_once(db):
    brand = make_user(db, "brand")
    app = submitted(db, make_campaign(db, brand))
    brand_id, app_id, creator_id = brand.id, app.id, app.creator_id
    results = run_concurrently(
        *[lambda s: submissions.review(s, s.get(User, brand_id), app_id, "approve", None, NOW)] * 4
    )
    assert results.count("ok") == 1
    db.expire_all()
    assert db.get(Wallet, creator_id).balance_paise == 873_180
    assert db.scalar(select(func.count()).select_from(Payout)) == 1


def test_withdrawal_holds_the_money_straight_away(db):
    creator = make_user(db, "creator")
    fund(db, creator, 500_000)
    w = wallet.request_withdrawal(db, creator, 200_000, "asha@okbank", NOW)
    assert w.status == "processing"
    assert db.get(Wallet, creator.id).balance_paise == 300_000
    assert creator.upi_id == "asha@okbank"  # remembered for next time
    assert_ledger_matches(db, creator.id)


def test_cannot_withdraw_more_than_the_balance(db):
    creator = make_user(db, "creator")
    fund(db, creator, 100_000)
    with pytest.raises(DomainError, match="more than your wallet balance"):
        wallet.request_withdrawal(db, creator, 100_001, "asha@okbank", NOW)


def test_withdrawal_needs_a_upi_id(db):
    creator = make_user(db, "creator")
    fund(db, creator, 100_000)
    with pytest.raises(DomainError, match="UPI"):
        wallet.request_withdrawal(db, creator, 50_000, None, NOW)


def test_parallel_withdrawals_cannot_overdraw(db):
    creator = make_user(db, "creator", upi_id="asha@okbank")
    fund(db, creator, 1_000_000)
    creator_id = creator.id
    results = run_concurrently(
        *[lambda s: wallet.request_withdrawal(s, s.get(User, creator_id), 600_000, None, NOW)] * 2
    )
    assert results.count("ok") == 1
    db.expire_all()
    assert db.get(Wallet, creator_id).balance_paise == 400_000
    assert_ledger_matches(db, creator_id)


def test_successful_withdrawal_settles_and_notifies(db):
    creator = make_user(db, "creator")
    fund(db, creator, 500_000)
    wallet.request_withdrawal(db, creator, 500_000, "asha@okbank", NOW)
    assert wallet.process_withdrawals(db, MockPayoutProvider(), NOW) == 1
    w = db.scalars(select(Withdrawal)).one()
    assert (w.status, w.provider_ref) == ("succeeded", f"mock_wd_{w.id}")
    assert db.get(Wallet, creator.id).balance_paise == 0
    assert db.scalars(select(Notification.event).where(Notification.user_id == creator.id)).first() == "withdrawal_succeeded"


def test_failed_withdrawal_puts_the_money_back(db):
    creator = make_user(db, "creator")
    fund(db, creator, 500_000)
    wallet.request_withdrawal(db, creator, 500_000, "fail@okbank", NOW)
    wallet.process_withdrawals(db, MockPayoutProvider(), NOW)
    w = db.scalars(select(Withdrawal)).one()
    assert w.status == "failed" and w.failure_reason
    assert db.get(Wallet, creator.id).balance_paise == 500_000
    kinds = db.scalars(select(LedgerEntry.kind).where(LedgerEntry.user_id == creator.id).order_by(LedgerEntry.id)).all()
    assert kinds == ["payout", "withdrawal", "refund"]
    assert_ledger_matches(db, creator.id)


def test_settled_withdrawals_are_never_processed_twice(db):
    creator = make_user(db, "creator")
    fund(db, creator, 500_000)
    wallet.request_withdrawal(db, creator, 500_000, "fail@okbank", NOW)
    wallet.process_withdrawals(db, MockPayoutProvider(), NOW)
    assert wallet.process_withdrawals(db, MockPayoutProvider(), NOW) == 0
    assert db.get(Wallet, creator.id).balance_paise == 500_000  # refunded once, not twice
