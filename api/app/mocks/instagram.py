from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class PostLookup:
    status: Literal["found", "not_found", "private"]
    caption: str | None = None


def lookup_post(shortcode: str) -> PostLookup:
    """Stand-in for the Instagram API. Deterministic, so demos and tests can hit every outcome:
    shortcodes starting with 'missing' don't exist, ones starting with 'private' are private."""
    code = shortcode.lower()
    if code.startswith("missing"):
        return PostLookup("not_found")
    if code.startswith("private"):
        return PostLookup("private")
    return PostLookup("found", caption=f"Mock caption for post {shortcode}")
