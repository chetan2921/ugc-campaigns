import pytest

from app.domain.states import TRANSITIONS, check_transition
from app.errors import DomainError


@pytest.mark.parametrize("current, target", [
    ("applied", "approved"), ("applied", "withdrawn"), ("approved", "submitted"),
    ("approved", "expired"), ("submitted", "revision_requested"), ("revision_requested", "submitted"),
    ("submitted", "paid"),
])
def test_allowed_moves(current, target):
    check_transition(current, target)


@pytest.mark.parametrize("current, target", [
    ("applied", "paid"), ("paid", "approved"), ("submitted", "withdrawn"),
    ("revision_requested", "paid"), ("rejected", "submitted"),
])
def test_refused_moves(current, target):
    with pytest.raises(DomainError):
        check_transition(current, target)


def test_terminal_states_go_nowhere():
    for status in ("declined", "withdrawn", "expired", "paid", "rejected"):
        assert status not in TRANSITIONS
