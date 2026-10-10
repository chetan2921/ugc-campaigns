import logging
import time
from datetime import datetime

from app.clock import utcnow
from app.config import settings
from app.db import SessionLocal
from app.mocks.payouts import MockPayoutProvider
from app.services.deadlines import expire_missed_deadlines
from app.services.notify import send_due_notifications
from app.services.wallet import process_withdrawals

log = logging.getLogger("worker")


def run_once(now: datetime | None = None) -> None:
    """One tick. Expire and settle first, so the messages they queue can go out in the same tick."""
    now = now or utcnow()
    with SessionLocal() as db:
        expire_missed_deadlines(db, now)
    with SessionLocal() as db:
        process_withdrawals(db, MockPayoutProvider(), now)
    with SessionLocal() as db:
        send_due_notifications(db, now)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
    log.info("worker started, polling every %ss", settings.worker_poll_seconds)
    while True:
        try:
            run_once()
        except Exception:
            log.exception("worker tick failed; will retry")
        time.sleep(settings.worker_poll_seconds)


if __name__ == "__main__":
    main()
