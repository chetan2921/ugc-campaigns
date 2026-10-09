import pytest

from app.domain.money import format_inr, payout_breakdown


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
