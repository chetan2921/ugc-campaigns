import logging

from app.models import User

log = logging.getLogger("mock.messaging")


def send_email(user: User, body: str) -> None:
    log.info("EMAIL to %s: %s", user.email, body)


def send_whatsapp(user: User, body: str) -> None:
    log.info("WHATSAPP to %s: %s", user.phone, body)


SENDERS = {"email": send_email, "whatsapp": send_whatsapp}
