from dataclasses import dataclass


@dataclass(frozen=True)
class TransferResult:
    ok: bool
    ref: str | None = None
    reason: str | None = None


class MockPayoutProvider:
    """Stand-in for a UPI payout API. Succeeds unless the UPI ID starts with 'fail',
    so a demo can trigger a failure on purpose."""

    def transfer(self, upi_id: str, amount_paise: int, reference: str) -> TransferResult:
        if upi_id.lower().startswith("fail"):
            return TransferResult(ok=False, reason="The bank declined the transfer")
        return TransferResult(ok=True, ref=f"mock_{reference}")
