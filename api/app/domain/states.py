from app.errors import DomainError

MAX_REVISIONS = 2

# Every status an application can move to, from each status.
# Anything not listed here is terminal: declined, withdrawn, expired, paid, rejected.
TRANSITIONS: dict[str, set[str]] = {
    "applied": {"approved", "declined", "withdrawn"},
    "approved": {"submitted", "withdrawn", "expired"},
    "submitted": {"paid", "revision_requested", "rejected"},
    "revision_requested": {"submitted"},
}


def check_transition(current: str, target: str) -> None:
    if target not in TRANSITIONS.get(current, set()):
        raise DomainError(f"An application that is '{current}' can't become '{target}'")
