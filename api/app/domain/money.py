from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

PLATFORM_FEE_RATE = Decimal("0.10")
GST_RATE = Decimal("0.18")  # on the platform fee
TDS_RATE = Decimal("0.01")  # on the payout after platform fee and GST


@dataclass(frozen=True)
class PayoutBreakdown:
    fee: int
    platform_fee: int
    gst: int
    tds: int
    net: int


def _percent_of(paise: int, rate: Decimal) -> int:
    return int((Decimal(paise) * rate).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def payout_breakdown(fee_paise: int) -> PayoutBreakdown:
    """The bill for one creator's fee. Net is the remainder, so the lines always add up."""
    platform_fee = _percent_of(fee_paise, PLATFORM_FEE_RATE)
    gst = _percent_of(platform_fee, GST_RATE)
    before_tds = fee_paise - platform_fee - gst
    tds = _percent_of(before_tds, TDS_RATE)
    return PayoutBreakdown(fee_paise, platform_fee, gst, tds, before_tds - tds)


def format_inr(paise: int) -> str:
    """₹ with Indian digit grouping: ₹10,00,000.00."""
    rupees, rest = divmod(paise, 100)
    digits = str(rupees)
    if len(digits) > 3:
        head, tail = digits[:-3], digits[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        groups.insert(0, head)
        digits = ",".join(groups) + "," + tail
    return f"₹{digits}.{rest:02d}"
