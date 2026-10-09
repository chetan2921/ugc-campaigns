# UGC Campaigns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking. Run the build in a **fresh Claude Code session started in `~/Documents/ugc-campaigns`**, so the AI logs that get submitted contain nothing from other projects.

**Goal:** a working slice of a UGC campaign marketplace. Brands create campaigns,
creators apply and submit Instagram posts, approval pays into a wallet with a
fee/GST/TDS bill, and creators withdraw through a mock provider. Notifications
are queued and respect quiet hours.

**Architecture:**
- A FastAPI JSON API with one service function per use case.
- Pure domain modules for money, IST and quiet hours, and the state machine.
- Postgres holds the data and also acts as the queue. A polling worker settles
  withdrawals, sends notifications and expires missed deadlines.
- A Next.js client calls the API with a Bearer token.

**Tech Stack:**
- Python 3.14, FastAPI, sync SQLAlchemy 2.0, Pydantic v2, Alembic, psycopg 3,
  bcrypt, PyJWT, pytest
- Postgres 17
- Next.js (App Router, TypeScript), Tailwind, shadcn/ui, SWR
- Docker Compose

**Spec:** `.claude/plan/campaigns/SPEC.md`. API seam:
`.claude/contracts/api-surface.md`. Read both before any task.

## Global Constraints

- **Money is integer paise everywhere** in the DB and API. Fees and budgets are
  whole rupees (multiples of 100).
- **Fee maths:**
  - `platform_fee = round(F × 10%)`
  - `gst = round(platform_fee × 18%)`
  - `tds = round((F − platform_fee − gst) × 1%)`
  - `net = F − platform_fee − gst − tds`
  - Rounding is half-up to the paisa.
- **Quiet hours** are 21:00–09:00 IST (`Asia/Kolkata`), checked both when
  queuing and when sending.
- **Application states** are exactly `applied, approved, declined, withdrawn,
  expired, submitted, revision_requested, paid, rejected`, with
  `MAX_REVISIONS = 2`.
- **Every application status change goes through `services.transitions.move()`**
  (or `record()` when the application is first created).
- **Every service function is one transaction.** It commits, or raises
  `DomainError` without committing.
- **Mocks are deterministic:**
  - a UPI ID starting with `fail` fails the payout;
  - an Instagram shortcode starting with `missing` returns not found;
  - an Instagram shortcode starting with `private` returns private.
- **Copy:** the fee is the headline. The fee note reads exactly: "Platform fee
  (10%) + 18% GST on that fee, and 1% TDS are deducted from this at payout."
- **Confidentiality:** never mention the author's employer, its products or any
  other local project in code, docs, commits or chat. The leak check must pass
  before every push. Run it with
  `"$(git rev-parse --git-common-dir)/../.claude/leak-check.sh"`. The script
  lives only in the main checkout and is git-excluded; this path also works
  from a worktree. Never open, print or edit it.
- **Keep the code explainable on a live call.** Plain functions, small files, no
  clever abstractions, comments only where the "why" isn't obvious.
- **Tests come first** for every behaviour task (this repo's AGENTS.md rule).
- **Commits** use the user's git identity.
- **The planning tree is committed and public.** `AGENTS.md`, `CLAUDE.md` and
  `.claude/` show the AI workflow. Never write secrets, tokens or internal URLs
  into them.
- **Each task's commit includes the memory files** it updated
  (`IMPLEMENTATION.md`, `TESTING.md`, `HISTORY.md`, the contract): add
  `.claude` (and `AGENTS.md` if it changed) to the commit.
- **Push after every task's commit with `git push origin HEAD:main`.** The repo
  is public at https://github.com/chetan2921/ugc-campaigns. This works from
  `main` or from a worktree branch, as long as it fast-forwards.

---

## File structure

```
ugc-campaigns/
├── docker-compose.yml           db, api, worker, web
├── db/init/01-test-db.sql       creates ugc_test
├── README.md                    submission README (Task 14)
├── docs/ai-logs/                exported, cleaned AI chat logs (Task 14)
├── api/
│   ├── Dockerfile, .dockerignore, requirements.txt, requirements-dev.txt, pyproject.toml
│   ├── alembic.ini, migrations/ (env.py, versions/)
│   ├── app/
│   │   ├── main.py              FastAPI app, CORS, error handler, routers
│   │   ├── config.py            settings from env
│   │   ├── db.py                engine, SessionLocal, Base (naming convention), get_db
│   │   ├── clock.py             utcnow()
│   │   ├── errors.py            DomainError
│   │   ├── models.py            all SQLAlchemy tables
│   │   ├── schemas.py           all Pydantic request/response models
│   │   ├── auth.py              bcrypt, JWT, current_user, brand_only, creator_only
│   │   ├── presenters.py        ORM -> response models
│   │   ├── domain/              pure, no DB
│   │   │   ├── money.py         payout_breakdown(), format_inr()
│   │   │   ├── ist.py           IST, is_quiet(), next_send_at(), format_ist()
│   │   │   └── states.py        TRANSITIONS, MAX_REVISIONS, check_transition()
│   │   ├── mocks/
│   │   │   ├── instagram.py     lookup_post()
│   │   │   ├── payouts.py       MockPayoutProvider
│   │   │   └── messaging.py     SENDERS (email, whatsapp -> log)
│   │   ├── services/            one function per use case
│   │   │   ├── users.py         signup, authenticate, update_me
│   │   │   ├── campaigns.py     create, edit, cancel, lists, accepting_applications
│   │   │   ├── slots.py         reserve_slot, release_slot, mark_spent   (risky #2)
│   │   │   ├── transitions.py   move, record, messages
│   │   │   ├── applications.py  apply, approve, decline, withdraw, lists, locking
│   │   │   ├── submissions.py   submit, review (+ payout)                (risky #1)
│   │   │   ├── wallet.py        credit, request_withdrawal, process_withdrawals (risky #1)
│   │   │   ├── notify.py        enqueue, send_due_notifications          (risky #3)
│   │   │   └── deadlines.py     expire_missed_deadlines
│   │   ├── routers/             auth, campaigns, applications, wallet, notifications
│   │   ├── worker.py            run_once(), main loop
│   │   └── seed.py              demo data
│   └── tests/
│       ├── conftest.py, factories.py
│       ├── test_money.py          risky #1
│       ├── test_reservation.py    risky #2
│       ├── test_notifications.py  risky #3
│       └── test_states.py, test_auth.py, test_campaign_rules.py, test_submissions.py, test_api_flow.py
└── web/                         Next.js app (Tasks 10-13)
    ├── DESIGN.md                visual direction (ui-craft step 1 output)
    └── src/
        ├── lib/                 token, api, auth, types, money, time, instagram, next-step
        ├── components/          require-role, app-shell, status-pill, payout-bill, timeline, slot-meter, fee-note
        └── app/                 login, signup, demo/[role], brand/..., creator/..., inbox, settings
```

---

### Task 0: Walk through UGCIndia's existing flow (independent; do first or in parallel)

**Files:**
- Create: `.claude/plan/campaigns/ugcindia-notes.md` (committed, so write it in your own words with no copied text)
- Modify: `.claude/plan/campaigns/SPEC.md` (the friction reducers section, only if findings change it)

- [ ] **Step 1:** Open https://ugccontent.in in the built-in browser. Read the
  public pages: home, the brand and creator pages, how it works, pricing and
  FAQ. Use `get_page_text` rather than screenshots. Do not create an account.
  If the real flow is behind a login, ask the user to sign up themselves and
  walk you through it, or share screenshots.
- [ ] **Step 2:** For each step of the brief (create, apply, approve, submit,
  review, payout, withdraw, notify), note how many screens and fields their
  flow appears to need, and where a brand or creator would wait or guess.
  Write this in your own words: no copied text, no copied UI.
- [ ] **Step 3:** Map each finding to our friction reducers. Add any new
  "README only" idea to SPEC.md. Change what we build only if the user agrees.
- [ ] **Step 4:** Report the 3–5 strongest contrasts to the user. They become
  the README's "What we'd do differently" section in Task 14.

---

### Task 1: Scaffold, database, health check, leak check

**Files:**
- Create: `.gitignore`, `docker-compose.yml`, `db/init/01-test-db.sql`
- Create: `api/requirements.txt`, `api/requirements-dev.txt`, `api/pyproject.toml`, `api/.dockerignore`
- Create: `api/app/__init__.py`, `api/app/config.py`, `api/app/db.py`, `api/app/clock.py`, `api/app/errors.py`, `api/app/main.py`
- Create: `api/app/domain/__init__.py`, `api/app/mocks/__init__.py`, `api/app/services/__init__.py`, `api/app/routers/__init__.py` (all empty)
- Create: `api/tests/conftest.py`, `api/tests/test_health.py`
- Run (exists, git-excluded): the leak check (see Global Constraints)

**Interfaces:**
- Produces: `settings` (`database_url`, `jwt_secret`, `jwt_ttl_hours`, `cors_origins`, `worker_poll_seconds`), `engine`, `SessionLocal`, `Base`, `get_db()`, `utcnow()`, `DomainError(message, status_code=409)` with `.message` and `.status_code`, and FastAPI `app` in `app.main`.

- [ ] **Step 1: Repo files**

`.gitignore`:
```
.venv/
__pycache__/
*.pyc
.pytest_cache/
.env
node_modules/
.next/
.DS_Store
```

`docker-compose.yml` (db only for now; Tasks 9 and 10 add services):
```yaml
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_USER: ugc
      POSTGRES_PASSWORD: ugc
      POSTGRES_DB: ugc
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./db/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ugc"]
      interval: 2s
      retries: 30

volumes:
  pgdata:
```

`db/init/01-test-db.sql`:
```sql
CREATE DATABASE ugc_test;
```

`api/requirements.txt` (unpinned here; pinned in Step 4):
```
fastapi
uvicorn[standard]
sqlalchemy
psycopg[binary]
alembic
pydantic-settings
email-validator
pyjwt
bcrypt
tzdata
```

`api/requirements-dev.txt`:
```
-r requirements.txt
pytest
httpx
```

`api/pyproject.toml`:
```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
addopts = "-q"
```

`api/.dockerignore`:
```
.venv
__pycache__
.pytest_cache
```

- [ ] **Step 2: Write the failing test**

`api/tests/conftest.py`:
```python
import os

# Point the app at the test database before anything imports app.config.
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://ugc:ugc@localhost:5432/ugc_test"
)
```

`api/tests/test_health.py`:
```python
from fastapi.testclient import TestClient

from app.main import app


def test_health():
    assert TestClient(app).get("/health").json() == {"ok": True}
```

- [ ] **Step 3: Start Postgres and see the test fail**

```bash
docker compose up -d db
cd api && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/pytest
```
Expected: FAIL with `ModuleNotFoundError: No module named 'app.main'`.

- [ ] **Step 4: Pin dependencies**

```bash
cd api && .venv/bin/pip freeze | grep -iE '^(fastapi|uvicorn|sqlalchemy|psycopg|psycopg-binary|alembic|pydantic-settings|email-validator|pyjwt|bcrypt|tzdata)==' > /tmp/pins.txt && cat /tmp/pins.txt
```
Replace the unpinned lines in `requirements.txt` with these `==` pins. Keep
`uvicorn[standard]` and `psycopg[binary]` as the extras spelling, with the
pinned version.

- [ ] **Step 5: Minimal implementation**

`api/app/config.py`:
```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://ugc:ugc@localhost:5432/ugc"
    jwt_secret: str = "dev-only-secret-change-me"
    jwt_ttl_hours: int = 24 * 7
    cors_origins: list[str] = ["http://localhost:3000"]
    worker_poll_seconds: float = 3.0


settings = Settings()
```

`api/app/db.py`:
```python
from sqlalchemy import MetaData, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(engine)


class Base(DeclarativeBase):
    # Predictable constraint names, so Alembic migrations stay readable.
    metadata = MetaData(naming_convention={
        "ix": "ix_%(column_0_label)s",
        "uq": "uq_%(table_name)s_%(column_0_name)s",
        "ck": "ck_%(table_name)s_%(constraint_name)s",
        "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        "pk": "pk_%(table_name)s",
    })


def get_db():
    with SessionLocal() as db:
        yield db
```

`api/app/clock.py`:
```python
from datetime import datetime, timezone


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
```

`api/app/errors.py`:
```python
class DomainError(Exception):
    """A business rule said no. The message is shown to the user as-is."""

    def __init__(self, message: str, status_code: int = 409):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
```

`api/app/main.py`:
```python
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.errors import DomainError

app = FastAPI(title="UGC Campaigns API")
app.add_middleware(
    CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"]
)


@app.exception_handler(DomainError)
def handle_domain_error(request: Request, exc: DomainError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


@app.get("/health")
def health():
    return {"ok": True}
```

- [ ] **Step 6: Run the test and see it pass**

Run: `cd api && .venv/bin/pytest`. Expected: `1 passed`.
Also run `docker compose exec db psql -U ugc -lqt | cut -d'|' -f1 | grep -w ugc_test`, which should print `ugc_test`.

- [ ] **Step 7: Leak check.** The script already exists (written and
  self-tested during planning; git-excluded). **Run it; never open, print or
  edit it.** Its search terms must stay out of the build session's chat logs.
  Run: `"$(git rev-parse --git-common-dir)/../.claude/leak-check.sh"`. Expected: `Leak check passed`.

- [ ] **Step 8: Commit, then ask about GitHub**

```bash
git add .gitignore docker-compose.yml db api .claude
git status --short   # must NOT list .claude/leak-check.sh
git commit -m "chore: scaffold FastAPI api with Postgres and health check"
git push origin HEAD:main
```
The public GitHub repo already exists (created during planning with the
planning tree as its first commit).

---

### Task 2: Data model, migration, signup/login

**Files:**
- Create: `api/app/models.py`, `api/app/schemas.py`, `api/app/auth.py`, `api/app/services/users.py`, `api/app/routers/auth.py`
- Create: `api/alembic.ini`, `api/migrations/env.py`, `api/migrations/versions/<rev>_initial_schema.py` (generated)
- Modify: `api/app/main.py` (include the auth router), `api/tests/conftest.py` (fixtures)
- Create: `api/tests/factories.py`, `api/tests/test_auth.py`

**Interfaces:**
- Consumes: `Base`, `get_db`, `SessionLocal`, `utcnow`, `DomainError`, and `settings` from Task 1.
- Produces:
  - Models: `User, Wallet, Campaign, Application, ApplicationEvent, Submission, Payout, LedgerEntry, Withdrawal, Notification`.
  - Every Pydantic schema in the contract.
  - From `auth`: `hash_password(str)->str`, `verify_password(str,str)->bool`, `create_token(User)->str`, `current_user`, `brand_only`, `creator_only`.
  - From `users`: `signup(db, SignupIn)->User`, `authenticate(db, email, password)->User`, `update_me(db, User, MeUpdate)->User`.
  - Fixtures: `db`, `client`.
  - Factories: `NOW`, `FEE`, `make_user(db, role, **fields)`, `signup(client, role)->headers`.

- [ ] **Step 1: Write the models** (all ten tables now, so there's one migration)

`api/app/models.py`:
```python
from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('brand', 'creator')", name="role_valid"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(10))
    phone: Mapped[str | None] = mapped_column(String(20))
    instagram_handle: Mapped[str | None] = mapped_column(String(30))
    upi_id: Mapped[str | None] = mapped_column(String(100))
    email_opt_in: Mapped[bool] = mapped_column(default=True)
    whatsapp_opt_in: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Wallet(Base):
    __tablename__ = "wallets"
    __table_args__ = (CheckConstraint("balance_paise >= 0", name="balance_never_negative"),)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    balance_paise: Mapped[int] = mapped_column(BigInteger, default=0)


class Campaign(Base):
    __tablename__ = "campaigns"
    __table_args__ = (
        CheckConstraint("fee_paise > 0", name="fee_positive"),
        CheckConstraint("slots > 0", name="slots_positive"),
        CheckConstraint("filled_slots >= 0 AND filled_slots <= slots", name="filled_within_slots"),
        CheckConstraint("reserved_paise >= 0 AND spent_paise >= 0", name="money_non_negative"),
        CheckConstraint("reserved_paise + spent_paise <= budget_paise", name="within_budget"),
        CheckConstraint("apply_deadline < submit_deadline", name="deadlines_ordered"),
        CheckConstraint("status IN ('active', 'cancelled')", name="status_valid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    budget_paise: Mapped[int] = mapped_column(BigInteger)
    fee_paise: Mapped[int] = mapped_column(BigInteger)
    slots: Mapped[int]
    apply_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    submit_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(10), default="active")
    filled_slots: Mapped[int] = mapped_column(default=0)
    reserved_paise: Mapped[int] = mapped_column(BigInteger, default=0)
    spent_paise: Mapped[int] = mapped_column(BigInteger, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    brand: Mapped[User] = relationship()


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        UniqueConstraint("campaign_id", "creator_id"),
        CheckConstraint("revision_count BETWEEN 0 AND 2", name="revisions_capped"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("campaigns.id"))
    creator_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(20), default="applied")
    note: Mapped[str | None] = mapped_column(Text)
    fee_paise: Mapped[int | None] = mapped_column(BigInteger)  # agreed fee, set on approval
    revision_count: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    campaign: Mapped[Campaign] = relationship()
    creator: Mapped[User] = relationship()
    submissions: Mapped[list[Submission]] = relationship(order_by="Submission.version")
    events: Mapped[list[ApplicationEvent]] = relationship(order_by="ApplicationEvent.id")
    payout: Mapped[Payout | None] = relationship(back_populates="application")


class ApplicationEvent(Base):
    __tablename__ = "application_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"))
    from_status: Mapped[str | None] = mapped_column(String(20))
    to_status: Mapped[str] = mapped_column(String(20))
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"))
    url: Mapped[str] = mapped_column(String(300))
    version: Mapped[int]
    caption: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Payout(Base):
    __tablename__ = "payouts"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), unique=True)  # one payout per application, ever
    fee_paise: Mapped[int] = mapped_column(BigInteger)
    platform_fee_paise: Mapped[int] = mapped_column(BigInteger)
    gst_paise: Mapped[int] = mapped_column(BigInteger)
    tds_paise: Mapped[int] = mapped_column(BigInteger)
    net_paise: Mapped[int] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    application: Mapped[Application] = relationship(back_populates="payout")


class Withdrawal(Base):
    __tablename__ = "withdrawals"
    __table_args__ = (
        CheckConstraint("amount_paise > 0", name="amount_positive"),
        CheckConstraint("status IN ('processing', 'succeeded', 'failed')", name="status_valid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    amount_paise: Mapped[int] = mapped_column(BigInteger)
    upi_id: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(12), default="processing")
    failure_reason: Mapped[str | None] = mapped_column(String(200))
    provider_ref: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"
    __table_args__ = (CheckConstraint("kind IN ('payout', 'withdrawal', 'refund')", name="kind_valid"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(12))
    amount_paise: Mapped[int] = mapped_column(BigInteger)  # signed: + credit, - debit
    balance_after_paise: Mapped[int] = mapped_column(BigInteger)
    payout_id: Mapped[int | None] = mapped_column(ForeignKey("payouts.id"))
    withdrawal_id: Mapped[int | None] = mapped_column(ForeignKey("withdrawals.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    payout: Mapped[Payout | None] = relationship()


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        CheckConstraint("channel IN ('email', 'whatsapp')", name="channel_valid"),
        CheckConstraint("status IN ('queued', 'sent', 'skipped')", name="status_valid"),
        Index("ix_notifications_due", "status", "send_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    channel: Mapped[str] = mapped_column(String(10))
    event: Mapped[str] = mapped_column(String(40))
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(10), default="queued")
    skip_reason: Mapped[str | None] = mapped_column(String(100))
    send_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 2: Schemas** (the whole contract, so later tasks only consume them)

`api/app/schemas.py`:
```python
from datetime import datetime
from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, EmailStr, Field

PHONE = r"^\+?[0-9]{10,15}$"
HANDLE = r"^@?[A-Za-z0-9._]{1,30}$"
UPI = r"^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$"


class FromORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- auth and profile ---
class SignupIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)  # bcrypt's limit
    role: Literal["brand", "creator"]
    phone: str | None = Field(default=None, pattern=PHONE)
    instagram_handle: str | None = Field(default=None, pattern=HANDLE)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(FromORM):
    id: int
    name: str
    email: str
    role: str
    phone: str | None
    instagram_handle: str | None
    upi_id: str | None
    email_opt_in: bool
    whatsapp_opt_in: bool


class AuthOut(BaseModel):
    token: str
    user: UserOut


class MeUpdate(BaseModel):
    phone: str | None = Field(default=None, pattern=PHONE)
    upi_id: str | None = Field(default=None, pattern=UPI)
    email_opt_in: bool | None = None
    whatsapp_opt_in: bool | None = None


# --- campaigns ---
class CampaignIn(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(default="", max_length=4000)
    budget_paise: int = Field(gt=0)
    fee_paise: int = Field(gt=0)
    slots: int = Field(ge=1, le=1000)
    apply_deadline: AwareDatetime
    submit_deadline: AwareDatetime


class CampaignEdit(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=120)
    description: str | None = Field(default=None, max_length=4000)
    budget_paise: int | None = Field(default=None, gt=0)
    fee_paise: int | None = Field(default=None, gt=0)
    slots: int | None = Field(default=None, ge=1, le=1000)
    apply_deadline: AwareDatetime | None = None
    submit_deadline: AwareDatetime | None = None


class CampaignCounts(BaseModel):
    applied: int
    to_review: int


class MyApplication(BaseModel):
    id: int
    status: str


class CampaignOut(BaseModel):
    id: int
    brand_name: str
    title: str
    description: str
    budget_paise: int
    fee_paise: int
    slots: int
    filled_slots: int
    reserved_paise: int
    spent_paise: int
    apply_deadline: datetime
    submit_deadline: datetime
    status: str
    accepting_applications: bool
    counts: CampaignCounts | None = None
    my_application: MyApplication | None = None


# --- applications ---
class ApplyIn(BaseModel):
    note: str | None = Field(default=None, max_length=500)


class DeclineIn(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class SubmitIn(BaseModel):
    url: str = Field(min_length=1, max_length=300)


class ReviewIn(BaseModel):
    action: Literal["approve", "revise", "reject"]
    note: str | None = Field(default=None, max_length=1000)


class CampaignSummary(BaseModel):
    id: int
    title: str
    brand_name: str
    fee_paise: int
    apply_deadline: datetime
    submit_deadline: datetime
    status: str


class CreatorSummary(FromORM):
    id: int
    name: str
    instagram_handle: str | None


class SubmissionOut(FromORM):
    id: int
    url: str
    version: int
    caption: str | None
    created_at: datetime


class EventOut(FromORM):
    from_status: str | None
    to_status: str
    note: str | None
    created_at: datetime


class PayoutOut(FromORM):
    fee_paise: int
    platform_fee_paise: int
    gst_paise: int
    tds_paise: int
    net_paise: int


class ApplicationOut(BaseModel):
    id: int
    status: str
    note: str | None
    fee_paise: int
    revision_count: int
    revisions_left: int
    created_at: datetime
    campaign: CampaignSummary
    creator: CreatorSummary
    submissions: list[SubmissionOut]
    events: list[EventOut]
    payout: PayoutOut | None


# --- wallet ---
class WithdrawIn(BaseModel):
    amount_paise: int = Field(gt=0)
    upi_id: str | None = Field(default=None, pattern=UPI)


class WithdrawalOut(FromORM):
    id: int
    amount_paise: int
    upi_id: str
    status: str
    failure_reason: str | None
    created_at: datetime
    processed_at: datetime | None


class LedgerOut(BaseModel):
    id: int
    kind: str
    amount_paise: int
    balance_after_paise: int
    created_at: datetime
    campaign_title: str | None
    payout: PayoutOut | None
    withdrawal_id: int | None


class WalletOut(BaseModel):
    balance_paise: int
    upi_id: str | None
    entries: list[LedgerOut]
    withdrawals: list[WithdrawalOut]


# --- notifications ---
class NotificationOut(FromORM):
    id: int
    channel: str
    event: str
    body: str
    status: str
    skip_reason: str | None
    send_at: datetime
    sent_at: datetime | None
    created_at: datetime
```

- [ ] **Step 3: Alembic**

```bash
cd api && .venv/bin/alembic init migrations
```
In `api/migrations/env.py`, replace the `target_metadata = None` block with:
```python
from app.config import settings
from app.db import Base
import app.models  # noqa: F401  (registers every table)

config.set_main_option("sqlalchemy.url", settings.database_url)
target_metadata = Base.metadata
```
Then:
```bash
.venv/bin/alembic revision --autogenerate -m "initial schema"
.venv/bin/alembic upgrade head
docker compose exec db psql -U ugc -c '\dt'
```
Expected: ten tables plus `alembic_version`. Open the generated revision and
check that every CHECK constraint is present.

- [ ] **Step 4: Test fixtures and factories**

Append to `api/tests/conftest.py`:
```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app import models  # noqa: F401  (registers tables)
from app.db import Base, SessionLocal, engine
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture(autouse=True)
def clean_tables():
    yield
    names = ", ".join(table.name for table in Base.metadata.sorted_tables)
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


@pytest.fixture
def client():
    return TestClient(app)
```

`api/tests/factories.py`:
```python
import itertools
from datetime import datetime, timezone

from app.models import User, Wallet

NOW = datetime(2026, 10, 12, 6, 30, tzinfo=timezone.utc)  # 12:00 IST, outside quiet hours
FEE = 1_000_000  # ₹10,000 in paise
_ids = itertools.count(1)


def make_user(db, role: str, **fields) -> User:
    n = next(_ids)
    user = User(
        email=f"{role}{n}@ugc-test.in", password_hash="not-used", name=f"{role.title()} {n}", role=role,
        instagram_handle=f"creator.{n}" if role == "creator" else None, **fields,
    )
    db.add(user)
    db.flush()
    if role == "creator":
        db.add(Wallet(user_id=user.id, balance_paise=0))
    db.commit()
    return user


def signup(client, role: str) -> dict[str, str]:
    """Sign up through the API and return auth headers."""
    n = next(_ids)
    body = {"name": f"{role.title()} {n}", "email": f"{role}{n}@ugc-test.in", "password": "secret-pass", "role": role}
    if role == "creator":
        body["instagram_handle"] = f"creator.{n}"
    token = client.post("/auth/signup", json=body).json()["token"]
    return {"Authorization": f"Bearer {token}"}
```

- [ ] **Step 5: Write the failing tests**

`api/tests/test_auth.py`:
```python
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
```
Run: `.venv/bin/pytest tests/test_auth.py`. Expected: FAIL (404s, because the
routes don't exist yet).

- [ ] **Step 6: Implement auth**

`api/app/auth.py`:
```python
from datetime import timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.clock import utcnow
from app.config import settings
from app.db import get_db
from app.models import User

bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_token(user: User) -> str:
    payload = {"sub": str(user.id), "role": user.role,
               "exp": utcnow() + timedelta(hours=settings.jwt_ttl_hours)}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> User:
    if creds is None:
        raise HTTPException(401, "Log in to continue")
    try:
        payload = jwt.decode(creds.credentials, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Your session has expired. Log in again")
    user = db.get(User, int(payload["sub"]))
    if user is None:
        raise HTTPException(401, "Log in to continue")
    return user


def require_role(role: str):
    def dependency(user: User = Depends(current_user)) -> User:
        if user.role != role:
            raise HTTPException(403, f"Only {role}s can do this")
        return user
    return dependency


brand_only = require_role("brand")
creator_only = require_role("creator")
```

`api/app/services/users.py`:
```python
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import hash_password, verify_password
from app.errors import DomainError
from app.models import User, Wallet
from app.schemas import MeUpdate, SignupIn


def signup(db: Session, data: SignupIn) -> User:
    email = data.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise DomainError("An account with this email already exists", 409)
    handle = (data.instagram_handle or "").lstrip("@") or None
    if data.role == "creator" and handle is None:
        raise DomainError("Creators need an Instagram handle", 422)
    user = User(
        email=email, password_hash=hash_password(data.password), name=data.name.strip(), role=data.role,
        phone=data.phone, instagram_handle=handle if data.role == "creator" else None,
    )
    db.add(user)
    db.flush()
    if user.role == "creator":
        db.add(Wallet(user_id=user.id, balance_paise=0))
    db.commit()
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    user = db.scalar(select(User).where(User.email == email.lower()))
    if user is None or not verify_password(password, user.password_hash):
        raise DomainError("Wrong email or password", 401)
    return user


def update_me(db: Session, user: User, data: MeUpdate) -> User:
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is None and field in ("email_opt_in", "whatsapp_opt_in"):
            continue  # null means "no change" for toggles; for phone/upi it clears the value
        setattr(user, field, value)
    db.commit()
    return user
```

`api/app/routers/auth.py`:
```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import create_token, current_user
from app.db import get_db
from app.models import User
from app.schemas import AuthOut, LoginIn, MeUpdate, SignupIn, UserOut
from app.services import users

router = APIRouter(tags=["auth"])


def _auth_out(user: User) -> AuthOut:
    return AuthOut(token=create_token(user), user=UserOut.model_validate(user))


@router.post("/auth/signup", response_model=AuthOut, status_code=201)
def signup(data: SignupIn, db: Session = Depends(get_db)):
    return _auth_out(users.signup(db, data))


@router.post("/auth/login", response_model=AuthOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    return _auth_out(users.authenticate(db, data.email, data.password))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut)
def update_me(data: MeUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return UserOut.model_validate(users.update_me(db, user, data))
```

In `api/app/main.py`, add at the bottom:
```python
from app.routers import auth  # noqa: E402

app.include_router(auth.router)
```

- [ ] **Step 7: Run the tests and see them pass**

Run: `.venv/bin/pytest`. Expected: all pass. If `EmailStr` rejects the
`ugc-test.in` domain, switch the test emails to another public-looking domain
rather than turning off validation.

- [ ] **Step 8: Commit**
```bash
git add api && git commit -m "feat(api): data model, migration, signup/login with roles"
```

---

### Task 3: Domain core (money, IST, state table)

**Files:**
- Create: `api/app/domain/money.py`, `api/app/domain/ist.py`, `api/app/domain/states.py`
- Create: `api/tests/test_money.py`, `api/tests/test_notifications.py`, `api/tests/test_states.py`

**Interfaces:**
- Produces:
  - From `money`: `PayoutBreakdown(fee, platform_fee, gst, tds, net)`, `payout_breakdown(fee_paise:int)->PayoutBreakdown`, `format_inr(paise:int)->str`.
  - From `ist`: `IST`, `is_quiet(now)->bool`, `next_send_at(now)->datetime`, `format_ist(dt)->str`.
  - From `states`: `TRANSITIONS: dict[str, set[str]]`, `MAX_REVISIONS = 2`, `check_transition(current, target)` (raises `DomainError`).

- [ ] **Step 1: Write the failing tests**

`api/tests/test_money.py`:
```python
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
```

`api/tests/test_notifications.py`:
```python
from datetime import datetime, timezone

import pytest

from app.domain.ist import IST, next_send_at


def ist(day: int, hour: int, minute: int = 0, second: int = 0) -> datetime:
    """A moment on that day of October 2026 in IST, returned in UTC like the app stores it."""
    return datetime(2026, 10, day, hour, minute, second, tzinfo=IST).astimezone(timezone.utc)


@pytest.mark.parametrize("now, expected", [
    (ist(12, 9, 0), ist(12, 9, 0)),             # 9 AM sharp: send now
    (ist(12, 20, 59, 59), ist(12, 20, 59, 59)),  # last second before quiet hours
    (ist(12, 21, 0), ist(13, 9, 0)),             # 9 PM sharp: hold until tomorrow 9 AM
    (ist(12, 23, 30), ist(13, 9, 0)),
    (ist(13, 2, 0), ist(13, 9, 0)),              # after midnight: same day 9 AM
    (ist(13, 8, 59, 59), ist(13, 9, 0)),
])
def test_next_send_at(now, expected):
    assert next_send_at(now) == expected


def test_quiet_hours_follow_ist_not_the_server_clock():
    fifteen_thirty_utc = datetime(2026, 10, 12, 15, 30, tzinfo=timezone.utc)  # = 21:00 IST
    assert next_send_at(fifteen_thirty_utc) == ist(13, 9, 0)
```

`api/tests/test_states.py`:
```python
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
```
Run: `.venv/bin/pytest tests/test_money.py tests/test_notifications.py tests/test_states.py`. Expected: FAIL with import errors.

- [ ] **Step 2: Implement**

`api/app/domain/money.py`:
```python
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
```

`api/app/domain/ist.py`:
```python
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
QUIET_FROM = time(21, 0)
QUIET_UNTIL = time(9, 0)


def is_quiet(now: datetime) -> bool:
    local = now.astimezone(IST).time()
    return local >= QUIET_FROM or local < QUIET_UNTIL


def next_send_at(now: datetime) -> datetime:
    """When a message created at `now` may go out: right away, or 09:00 IST after quiet hours."""
    if not is_quiet(now):
        return now
    local = now.astimezone(IST)
    nine = local.replace(hour=9, minute=0, second=0, microsecond=0)
    if local.time() >= QUIET_FROM:
        nine += timedelta(days=1)
    return nine.astimezone(timezone.utc)


def format_ist(moment: datetime) -> str:
    return moment.astimezone(IST).strftime("%d %b %Y, %I:%M %p IST")
```

`api/app/domain/states.py`:
```python
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
```

- [ ] **Step 3: Run and see them pass.** Run: `.venv/bin/pytest`. Expected: all pass.

- [ ] **Step 4: Commit**
```bash
git add api && git commit -m "feat(api): payout maths, IST quiet hours and application state table"
```

---

### Task 4: Apply, approve with reservation, decline, withdraw

**Files:**
- Create: `api/app/services/notify.py` (enqueue only), `api/app/services/transitions.py`, `api/app/services/slots.py`, `api/app/services/applications.py`
- Modify: `api/tests/factories.py`
- Create: `api/tests/test_reservation.py`

**Interfaces:**
- Consumes: the models, `DomainError`, `check_transition`, `MAX_REVISIONS`, `format_ist`, `format_inr` and `next_send_at`.
- Produces:
  - `notify.enqueue(db, user_id, event, body, now)`
  - `transitions.move(db, app, target, now, note=None)` and `transitions.record(db, app, previous, now, note=None)`
  - `slots.reserve_slot(db, app)`, `slots.release_slot(db, app)`, `slots.mark_spent(db, app)`
  - From `applications`: `lock_application(db, id)`, `ensure_brand(app, brand)`, `ensure_creator(app, creator)`, `apply(db, creator, campaign_id, note, now)`, `approve(db, brand, application_id, now)`, `decline(db, brand, application_id, reason, now)`, `withdraw(db, creator, application_id, now)`, `list_for_creator(db, creator)`, `list_for_campaign(db, brand, campaign_id)`.
  - Factories: `make_campaign`, `applied`, `approved`, `run_concurrently`.

- [ ] **Step 1: Extend the factories**

Append to `api/tests/factories.py`:
```python
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

from app.db import SessionLocal
from app.errors import DomainError
from app.models import Campaign
from app.services import applications


def make_campaign(db, brand: User, *, fee: int = FEE, slots: int = 3, budget: int | None = None, now=NOW) -> Campaign:
    campaign = Campaign(
        brand_id=brand.id, title="Monsoon snack reels", description="", fee_paise=fee, slots=slots,
        budget_paise=budget or fee * slots, apply_deadline=now + timedelta(days=3),
        submit_deadline=now + timedelta(days=10),
    )
    db.add(campaign)
    db.commit()
    return campaign


def applied(db, campaign: Campaign, creator: User | None = None):
    return applications.apply(db, creator or make_user(db, "creator"), campaign.id, None, NOW)


def approved(db, campaign: Campaign):
    app = applied(db, campaign)
    return applications.approve(db, campaign.brand, app.id, NOW)


def run_concurrently(*calls) -> list[str]:
    """Run each call(session) in its own thread and DB session, all released at the same moment.
    Returns "ok" or the DomainError message for each call."""
    barrier = threading.Barrier(len(calls))

    def run(call):
        with SessionLocal() as session:
            barrier.wait()
            try:
                call(session)
                return "ok"
            except DomainError as error:
                return error.message

    with ThreadPoolExecutor(len(calls)) as pool:
        return list(pool.map(run, calls))
```
(Move the new imports to the top of the file.)

- [ ] **Step 2: Write the failing tests**

`api/tests/test_reservation.py`:
```python
import pytest
from sqlalchemy import select

from app.errors import DomainError
from app.models import Application, Notification, User
from app.services import applications
from tests.factories import FEE, NOW, applied, approved, make_campaign, make_user, run_concurrently


def test_approving_reserves_the_fee_and_a_slot(db):
    campaign = make_campaign(db, make_user(db, "brand"), slots=2)
    app = approved(db, campaign)
    assert app.status == "approved"
    assert app.fee_paise == FEE
    assert (campaign.filled_slots, campaign.reserved_paise, campaign.spent_paise) == (1, FEE, 0)


def test_cannot_approve_more_creators_than_slots(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand, slots=1)
    first, second = applied(db, campaign), applied(db, campaign)
    applications.approve(db, brand, first.id, NOW)
    with pytest.raises(DomainError, match="No free slot"):
        applications.approve(db, brand, second.id, NOW)
    db.rollback()
    assert second.status == "applied"
    assert campaign.filled_slots == 1


def test_parallel_approvals_never_overfill_the_last_slot(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand, slots=1)
    app_ids = [applied(db, campaign).id for _ in range(8)]
    brand_id = brand.id

    results = run_concurrently(*[
        (lambda s, app_id=app_id: applications.approve(s, s.get(User, brand_id), app_id, NOW))
        for app_id in app_ids
    ])

    assert results.count("ok") == 1
    db.expire_all()
    assert (campaign.filled_slots, campaign.reserved_paise) == (1, FEE)
    statuses = db.scalars(select(Application.status).where(Application.campaign_id == campaign.id)).all()
    assert statuses.count("approved") == 1


def test_cannot_approve_after_the_submission_deadline(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand)
    app = applied(db, campaign)
    with pytest.raises(DomainError, match="submission deadline has passed"):
        applications.approve(db, brand, app.id, campaign.submit_deadline)


def test_withdrawing_after_approval_frees_the_slot(db):
    campaign = make_campaign(db, make_user(db, "brand"))
    app = approved(db, campaign)
    applications.withdraw(db, app.creator, app.id, NOW)
    assert app.status == "withdrawn"
    assert (campaign.filled_slots, campaign.reserved_paise) == (0, 0)


def test_withdrawing_a_pending_application_touches_no_money(db):
    campaign = make_campaign(db, make_user(db, "brand"))
    app = applied(db, campaign)
    applications.withdraw(db, app.creator, app.id, NOW)
    assert app.status == "withdrawn"
    assert (campaign.filled_slots, campaign.reserved_paise) == (0, 0)


def test_one_application_per_creator(db):
    campaign = make_campaign(db, make_user(db, "brand"))
    app = applied(db, campaign)
    with pytest.raises(DomainError, match="already applied"):
        applications.apply(db, app.creator, campaign.id, None, NOW)


def test_applying_closes_at_the_application_deadline(db):
    campaign = make_campaign(db, make_user(db, "brand"))
    with pytest.raises(DomainError, match="closed"):
        applications.apply(db, make_user(db, "creator"), campaign.id, None, campaign.apply_deadline)


def test_every_status_change_is_logged_and_notified(db):
    brand = make_user(db, "brand")
    app = approved(db, make_campaign(db, brand))
    assert [(e.from_status, e.to_status) for e in app.events] == [(None, "applied"), ("applied", "approved")]
    emails = db.execute(
        select(Notification.user_id, Notification.event).where(Notification.channel == "email").order_by(Notification.id)
    ).all()
    assert emails == [(brand.id, "application_applied"), (app.creator_id, "application_approved")]
```
Run: `.venv/bin/pytest tests/test_reservation.py`. Expected: FAIL with import errors.

- [ ] **Step 3: Implement**

`api/app/services/notify.py`:
```python
from datetime import datetime

from sqlalchemy.orm import Session

from app.domain.ist import next_send_at
from app.models import Notification

CHANNELS = ("email", "whatsapp")


def enqueue(db: Session, user_id: int, event: str, body: str, now: datetime) -> None:
    """Queue the message on every channel, in the caller's transaction.
    Opt-outs are checked when sending, so a later opt-out is still respected."""
    send_at = next_send_at(now)
    for channel in CHANNELS:
        db.add(Notification(user_id=user_id, channel=channel, event=event, body=body, send_at=send_at, created_at=now))
```

`api/app/services/transitions.py`:
```python
from datetime import datetime

from sqlalchemy.orm import Session

from app.domain.ist import format_ist
from app.domain.money import format_inr
from app.domain.states import MAX_REVISIONS, check_transition
from app.models import Application, ApplicationEvent
from app.services.notify import enqueue


def move(db: Session, app: Application, target: str, now: datetime, note: str | None = None) -> None:
    """The only way an application changes status: check the move, log it, notify."""
    check_transition(app.status, target)
    previous = app.status
    app.status = target
    record(db, app, previous, now, note)


def record(db: Session, app: Application, previous: str | None, now: datetime, note: str | None = None) -> None:
    db.add(ApplicationEvent(application_id=app.id, from_status=previous, to_status=app.status, note=note, created_at=now))
    for user_id, body in messages(app, note):
        enqueue(db, user_id, f"application_{app.status}", body, now)


def messages(app: Application, note: str | None) -> list[tuple[int, str]]:
    """Who hears about the application's new status, and what they're told."""
    c = app.campaign
    who = app.creator.name
    brand, creator = c.brand_id, app.creator_id
    reason = f" Reason: {note}" if note else ""
    match app.status:
        case "applied":
            return [(brand, f"{who} applied to “{c.title}”.")]
        case "approved":
            return [(creator, f"You're in for “{c.title}”. Submit your post link by {format_ist(c.submit_deadline)}.")]
        case "declined":
            return [(creator, f"Your application to “{c.title}” wasn't accepted.{reason}")]
        case "withdrawn":
            return [(brand, f"{who} withdrew from “{c.title}”.")]
        case "submitted":
            return [(brand, f"{who} submitted a post for “{c.title}”. It's ready for your review.")]
        case "revision_requested":
            return [(creator, f"The brand asked for changes to your post for “{c.title}” "
                              f"(revision {app.revision_count} of {MAX_REVISIONS}).{reason}")]
        case "paid":
            p = app.payout
            return [(creator, f"Your post for “{c.title}” was approved. Fee {format_inr(p.fee_paise)}; "
                              f"{format_inr(p.net_paise)} credited to your wallet after fees and taxes.")]
        case "rejected":
            return [(creator, f"Your post for “{c.title}” was rejected.{reason}")]
        case "expired":
            return [
                (creator, f"You missed the submission deadline for “{c.title}”."),
                (brand, f"{who} missed the submission deadline for “{c.title}”. Their slot is free again."),
            ]
    return []
```

`api/app/services/slots.py`:
```python
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.errors import DomainError
from app.models import Application, Campaign


def reserve_slot(db: Session, app: Application) -> None:
    """Take a slot and reserve the fee in ONE conditional UPDATE.
    If two brands' clicks race for the last slot, Postgres row-locks the campaign:
    the second UPDATE re-checks the WHERE after the first commits, matches nothing, and we refuse."""
    fee = app.campaign.fee_paise
    taken = db.execute(
        update(Campaign)
        .where(
            Campaign.id == app.campaign_id,
            Campaign.status == "active",
            Campaign.filled_slots < Campaign.slots,
            Campaign.budget_paise - Campaign.reserved_paise - Campaign.spent_paise >= fee,
        )
        .values(filled_slots=Campaign.filled_slots + 1, reserved_paise=Campaign.reserved_paise + fee)
        .returning(Campaign.id)
        .execution_options(synchronize_session=False)
    ).first()
    if taken is None:
        raise DomainError("No free slot or budget left on this campaign")
    app.fee_paise = fee


def release_slot(db: Session, app: Application) -> None:
    db.execute(
        update(Campaign)
        .where(Campaign.id == app.campaign_id)
        .values(filled_slots=Campaign.filled_slots - 1, reserved_paise=Campaign.reserved_paise - app.fee_paise)
        .execution_options(synchronize_session=False)
    )


def mark_spent(db: Session, app: Application) -> None:
    """On payout the fee moves from reserved to spent; the slot stays filled."""
    db.execute(
        update(Campaign)
        .where(Campaign.id == app.campaign_id)
        .values(reserved_paise=Campaign.reserved_paise - app.fee_paise,
                spent_paise=Campaign.spent_paise + app.fee_paise)
        .execution_options(synchronize_session=False)
    )
```

`api/app/services/applications.py`:
```python
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.states import check_transition
from app.errors import DomainError
from app.models import Application, Campaign, User
from app.services.slots import release_slot, reserve_slot
from app.services.transitions import move, record


def lock_application(db: Session, application_id: int) -> Application:
    """Load and row-lock the application, so two requests on it run one after the other."""
    app = db.execute(
        select(Application).where(Application.id == application_id).with_for_update(of=Application)
    ).scalar_one_or_none()
    if app is None:
        raise DomainError("Application not found", 404)
    return app


def ensure_brand(app: Application, brand: User) -> None:
    if app.campaign.brand_id != brand.id:
        raise DomainError("Application not found", 404)


def ensure_creator(app: Application, creator: User) -> None:
    if app.creator_id != creator.id:
        raise DomainError("Application not found", 404)


def apply(db: Session, creator: User, campaign_id: int, note: str | None, now: datetime) -> Application:
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise DomainError("Campaign not found", 404)
    if campaign.status != "active" or now >= campaign.apply_deadline:
        raise DomainError("Applications for this campaign are closed")
    if campaign.filled_slots >= campaign.slots:
        raise DomainError("All slots on this campaign are filled")
    if db.scalar(select(Application.id).where(Application.campaign_id == campaign_id,
                                              Application.creator_id == creator.id)):
        raise DomainError("You've already applied to this campaign")
    app = Application(campaign_id=campaign_id, creator_id=creator.id, status="applied",
                      note=(note or "").strip() or None, created_at=now)
    db.add(app)
    db.flush()
    record(db, app, None, now)
    db.commit()
    return app


def approve(db: Session, brand: User, application_id: int, now: datetime) -> Application:
    app = lock_application(db, application_id)
    ensure_brand(app, brand)
    if now >= app.campaign.submit_deadline:
        raise DomainError("The submission deadline has passed, so no more creators can be approved")
    check_transition(app.status, "approved")  # fail before touching the budget
    reserve_slot(db, app)
    move(db, app, "approved", now)
    db.commit()
    return app


def decline(db: Session, brand: User, application_id: int, reason: str | None, now: datetime) -> Application:
    app = lock_application(db, application_id)
    ensure_brand(app, brand)
    move(db, app, "declined", now, (reason or "").strip() or None)
    db.commit()
    return app


def withdraw(db: Session, creator: User, application_id: int, now: datetime) -> Application:
    app = lock_application(db, application_id)
    ensure_creator(app, creator)
    if app.status not in ("applied", "approved"):
        raise DomainError("You can only withdraw before submitting your post")
    held_slot = app.status == "approved"
    move(db, app, "withdrawn", now)
    if held_slot:
        release_slot(db, app)
    db.commit()
    return app


def list_for_creator(db: Session, creator: User) -> list[Application]:
    return list(db.scalars(select(Application).where(Application.creator_id == creator.id)
                           .order_by(Application.id.desc())))


def list_for_campaign(db: Session, brand: User, campaign_id: int) -> list[Application]:
    campaign = db.get(Campaign, campaign_id)
    if campaign is None or campaign.brand_id != brand.id:
        raise DomainError("Campaign not found", 404)
    return list(db.scalars(select(Application).where(Application.campaign_id == campaign_id)
                           .order_by(Application.id)))
```

- [ ] **Step 4: Run and see them pass.** Run: `.venv/bin/pytest`. Expected: all pass. Run the concurrency test 5 times to make sure it isn't flaky: `for i in 1 2 3 4 5; do .venv/bin/pytest tests/test_reservation.py -k parallel || break; done`.

- [ ] **Step 5: Commit**
```bash
git add api && git commit -m "feat(api): apply/approve/decline/withdraw with atomic slot and budget reservation"
```

---

### Task 5: Campaign rules, presenters, campaign and application routes

**Files:**
- Create: `api/app/services/campaigns.py`, `api/app/presenters.py`, `api/app/routers/campaigns.py`, `api/app/routers/applications.py`
- Modify: `api/app/main.py` (include the routers)
- Create: `api/tests/test_campaign_rules.py`
- Modify: `api/tests/test_reservation.py` (the cancel test)

**Interfaces:**
- Consumes: Task 4 services, `enqueue`, `move`, `format_inr`, `brand_only`, `creator_only`, `current_user`, and the schemas.
- Produces:
  - From `campaigns`: `create_campaign(db, brand, CampaignIn, now)`, `edit_campaign(db, brand, campaign_id, CampaignEdit, now)`, `cancel_campaign(db, brand, campaign_id, now)`, `get_for_viewer(db, viewer, campaign_id)`, `list_open(db, now)`, `list_for_brand(db, brand)`, `accepting_applications(campaign, now)->bool`.
  - From `presenters`: `campaign_out(db, campaign, now, viewer)->CampaignOut`, `application_out(app)->ApplicationOut`.
  - HTTP: the campaign routes and the `/applications` routes for mine, approve, decline and withdraw.

- [ ] **Step 1: Write the failing tests**

`api/tests/test_campaign_rules.py`:
```python
from datetime import timedelta

import pytest
from sqlalchemy import select

from app.errors import DomainError
from app.models import Notification
from app.schemas import CampaignEdit, CampaignIn
from app.services import campaigns
from tests.factories import FEE, NOW, applied, approved, make_campaign, make_user


def campaign_in(**overrides) -> CampaignIn:
    data = dict(title="Monsoon snack reels", description="", fee_paise=FEE, slots=3, budget_paise=FEE * 3,
                apply_deadline=NOW + timedelta(days=3), submit_deadline=NOW + timedelta(days=10))
    data.update(overrides)
    return CampaignIn(**data)


def test_create_campaign(db):
    c = campaigns.create_campaign(db, make_user(db, "brand"), campaign_in(), NOW)
    assert (c.status, c.filled_slots, c.reserved_paise) == ("active", 0, 0)


@pytest.mark.parametrize("overrides, message", [
    ({"budget_paise": FEE * 2}, "Budget must cover"),
    ({"fee_paise": FEE + 50}, "whole number of rupees"),
    ({"submit_deadline": NOW + timedelta(days=2)}, "after the application deadline"),
    ({"apply_deadline": NOW - timedelta(minutes=1)}, "in the future"),
])
def test_create_validation(db, overrides, message):
    with pytest.raises(DomainError, match=message):
        campaigns.create_campaign(db, make_user(db, "brand"), campaign_in(**overrides), NOW)


def test_fee_is_locked_after_the_first_approval(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand)
    approved(db, campaign)
    with pytest.raises(DomainError, match="fee is locked"):
        campaigns.edit_campaign(db, brand, campaign.id, CampaignEdit(fee_paise=FEE * 2, budget_paise=FEE * 6), NOW)


def test_fee_can_change_before_anyone_is_approved(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand)
    campaigns.edit_campaign(db, brand, campaign.id, CampaignEdit(fee_paise=FEE * 2, budget_paise=FEE * 6), NOW)
    assert campaign.fee_paise == FEE * 2


def test_slots_cannot_drop_below_approved_creators(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand, slots=3)
    approved(db, campaign)
    approved(db, campaign)
    with pytest.raises(DomainError, match="can't go below 2"):
        campaigns.edit_campaign(db, brand, campaign.id, CampaignEdit(slots=1), NOW)


def test_deadlines_can_only_be_extended(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand)
    with pytest.raises(DomainError, match="only be extended"):
        campaigns.edit_campaign(db, brand, campaign.id,
                                CampaignEdit(submit_deadline=campaign.submit_deadline - timedelta(days=1)), NOW)


def test_editing_notifies_live_applicants(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand)
    app = applied(db, campaign)
    campaigns.edit_campaign(db, brand, campaign.id, CampaignEdit(title="Monsoon snack reels v2"), NOW)
    events = db.scalars(select(Notification.event).where(Notification.user_id == app.creator_id)).all()
    assert "campaign_edited" in events


def test_cancelled_campaign_cannot_be_edited(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand)
    campaigns.cancel_campaign(db, brand, campaign.id, NOW)
    with pytest.raises(DomainError, match="cancelled"):
        campaigns.edit_campaign(db, brand, campaign.id, CampaignEdit(title="Too late"), NOW)


def test_other_brands_cannot_touch_a_campaign(db):
    campaign = make_campaign(db, make_user(db, "brand"))
    with pytest.raises(DomainError, match="not found"):
        campaigns.cancel_campaign(db, make_user(db, "brand"), campaign.id, NOW)


def test_open_list_hides_full_closed_and_cancelled_campaigns(db):
    brand = make_user(db, "brand")
    open_one = make_campaign(db, brand)
    full = make_campaign(db, brand, slots=1)
    approved(db, full)
    cancelled = make_campaign(db, brand)
    campaigns.cancel_campaign(db, brand, cancelled.id, NOW)
    assert [c.id for c in campaigns.list_open(db, NOW)] == [open_one.id]
    assert campaigns.list_open(db, open_one.apply_deadline) == []
```

Append to `api/tests/test_reservation.py`:
```python
from app.services import campaigns


def test_cancelling_declines_pending_but_keeps_approved_creators(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand)
    pending, kept = applied(db, campaign), approved(db, campaign)
    campaigns.cancel_campaign(db, brand, campaign.id, NOW)
    assert campaign.status == "cancelled"
    assert pending.status == "declined"
    assert kept.status == "approved"
    assert (campaign.filled_slots, campaign.reserved_paise) == (1, FEE)
```
Run: `.venv/bin/pytest`. Expected: FAIL (no `app.services.campaigns`).

- [ ] **Step 2: Implement the service**

`api/app/services/campaigns.py`:
```python
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.money import format_inr
from app.errors import DomainError
from app.models import Application, Campaign, User
from app.schemas import CampaignEdit, CampaignIn
from app.services.notify import enqueue
from app.services.transitions import move

LIVE_STATUSES = ("applied", "approved", "submitted", "revision_requested")
TERMS = ("fee_paise", "slots", "budget_paise", "apply_deadline", "submit_deadline")


def accepting_applications(c: Campaign, now: datetime) -> bool:
    return c.status == "active" and now < c.apply_deadline and c.filled_slots < c.slots


def _check_terms(fee_paise: int, slots: int, budget_paise: int, apply_deadline: datetime, submit_deadline: datetime) -> None:
    if fee_paise % 100 or budget_paise % 100:
        raise DomainError("Fee and budget must be a whole number of rupees", 422)
    if budget_paise < fee_paise * slots:
        raise DomainError(f"Budget must cover {slots} × {format_inr(fee_paise)} = {format_inr(fee_paise * slots)}", 422)
    if submit_deadline <= apply_deadline:
        raise DomainError("The submission deadline must be after the application deadline", 422)


def create_campaign(db: Session, brand: User, data: CampaignIn, now: datetime) -> Campaign:
    _check_terms(data.fee_paise, data.slots, data.budget_paise, data.apply_deadline, data.submit_deadline)
    if data.apply_deadline <= now:
        raise DomainError("The application deadline must be in the future", 422)
    campaign = Campaign(brand_id=brand.id, created_at=now, **data.model_dump())
    db.add(campaign)
    db.commit()
    return campaign


def _lock_own_campaign(db: Session, brand: User, campaign_id: int) -> Campaign:
    campaign = db.execute(select(Campaign).where(Campaign.id == campaign_id).with_for_update()).scalar_one_or_none()
    if campaign is None or campaign.brand_id != brand.id:
        raise DomainError("Campaign not found", 404)
    return campaign


def _live_applications(db: Session, campaign_id: int) -> list[Application]:
    return list(db.scalars(select(Application).where(Application.campaign_id == campaign_id,
                                                     Application.status.in_(LIVE_STATUSES))))


def edit_campaign(db: Session, brand: User, campaign_id: int, data: CampaignEdit, now: datetime) -> Campaign:
    campaign = _lock_own_campaign(db, brand, campaign_id)
    if campaign.status != "active":
        raise DomainError("A cancelled campaign can't be edited")
    changes = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    if "fee_paise" in changes and changes["fee_paise"] != campaign.fee_paise and campaign.filled_slots > 0:
        raise DomainError("The fee is locked once a creator is approved")
    if changes.get("slots", campaign.slots) < campaign.filled_slots:
        raise DomainError(f"{campaign.filled_slots} creators are already approved, "
                          f"so slots can't go below {campaign.filled_slots}")
    for field in ("apply_deadline", "submit_deadline"):
        if field in changes and changes[field] < getattr(campaign, field):
            raise DomainError("Deadlines can only be extended")
    _check_terms(*(changes.get(field, getattr(campaign, field)) for field in TERMS))
    for field, value in changes.items():
        setattr(campaign, field, value)
    for app in _live_applications(db, campaign.id):
        enqueue(db, app.creator_id, "campaign_edited",
                f"“{campaign.title}” was updated by the brand. Check the latest details.", now)
    db.commit()
    return campaign


def cancel_campaign(db: Session, brand: User, campaign_id: int, now: datetime) -> Campaign:
    campaign = _lock_own_campaign(db, brand, campaign_id)
    if campaign.status != "active":
        raise DomainError("This campaign is already cancelled")
    campaign.status = "cancelled"
    for app in _live_applications(db, campaign.id):
        if app.status == "applied":
            move(db, app, "declined", now, "The brand cancelled the campaign")
        else:  # approved creators can't be removed: they keep their slot and still get paid
            enqueue(db, app.creator_id, "campaign_cancelled",
                    f"“{campaign.title}” was cancelled, but your spot is safe. "
                    f"Finish your post as agreed and you'll still be paid.", now)
    db.commit()
    return campaign


def get_for_viewer(db: Session, viewer: User, campaign_id: int) -> Campaign:
    campaign = db.get(Campaign, campaign_id)
    if campaign is None or (viewer.role == "brand" and campaign.brand_id != viewer.id):
        raise DomainError("Campaign not found", 404)
    return campaign


def list_open(db: Session, now: datetime) -> list[Campaign]:
    return list(db.scalars(
        select(Campaign)
        .where(Campaign.status == "active", Campaign.apply_deadline > now, Campaign.filled_slots < Campaign.slots)
        .order_by(Campaign.apply_deadline)
    ))


def list_for_brand(db: Session, brand: User) -> list[Campaign]:
    return list(db.scalars(select(Campaign).where(Campaign.brand_id == brand.id).order_by(Campaign.id.desc())))
```

- [ ] **Step 3: Presenters and routes**

`api/app/presenters.py`:
```python
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domain.states import MAX_REVISIONS
from app.models import Application, Campaign, User
from app.schemas import (ApplicationOut, CampaignCounts, CampaignOut, CampaignSummary, CreatorSummary, EventOut,
                         MyApplication, PayoutOut, SubmissionOut)
from app.services.campaigns import accepting_applications


def campaign_out(db: Session, c: Campaign, now: datetime, viewer: User) -> CampaignOut:
    counts, mine = None, None
    if viewer.role == "brand":
        by_status = dict(db.execute(
            select(Application.status, func.count())
            .where(Application.campaign_id == c.id)
            .group_by(Application.status)
        ).all())
        counts = CampaignCounts(applied=by_status.get("applied", 0), to_review=by_status.get("submitted", 0))
    else:
        app = db.scalar(select(Application).where(Application.campaign_id == c.id, Application.creator_id == viewer.id))
        if app:
            mine = MyApplication(id=app.id, status=app.status)
    return CampaignOut(
        id=c.id, brand_name=c.brand.name, title=c.title, description=c.description,
        budget_paise=c.budget_paise, fee_paise=c.fee_paise, slots=c.slots, filled_slots=c.filled_slots,
        reserved_paise=c.reserved_paise, spent_paise=c.spent_paise,
        apply_deadline=c.apply_deadline, submit_deadline=c.submit_deadline, status=c.status,
        accepting_applications=accepting_applications(c, now), counts=counts, my_application=mine,
    )


def application_out(app: Application) -> ApplicationOut:
    c = app.campaign
    return ApplicationOut(
        id=app.id, status=app.status, note=app.note, fee_paise=app.fee_paise or c.fee_paise,
        revision_count=app.revision_count, revisions_left=MAX_REVISIONS - app.revision_count,
        created_at=app.created_at,
        campaign=CampaignSummary(id=c.id, title=c.title, brand_name=c.brand.name, fee_paise=c.fee_paise,
                                 apply_deadline=c.apply_deadline, submit_deadline=c.submit_deadline, status=c.status),
        creator=CreatorSummary.model_validate(app.creator),
        submissions=[SubmissionOut.model_validate(s) for s in app.submissions],
        events=[EventOut.model_validate(e) for e in app.events],
        payout=PayoutOut.model_validate(app.payout) if app.payout else None,
    )
```

`api/app/routers/campaigns.py`:
```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import brand_only, creator_only, current_user
from app.clock import utcnow
from app.db import get_db
from app.models import User
from app.presenters import application_out, campaign_out
from app.schemas import ApplicationOut, ApplyIn, CampaignEdit, CampaignIn, CampaignOut
from app.services import applications, campaigns

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.post("", response_model=CampaignOut, status_code=201)
def create(data: CampaignIn, brand: User = Depends(brand_only), db: Session = Depends(get_db)):
    now = utcnow()
    return campaign_out(db, campaigns.create_campaign(db, brand, data, now), now, brand)


@router.get("/mine", response_model=list[CampaignOut])
def mine(brand: User = Depends(brand_only), db: Session = Depends(get_db)):
    now = utcnow()
    return [campaign_out(db, c, now, brand) for c in campaigns.list_for_brand(db, brand)]


@router.get("", response_model=list[CampaignOut])
def open_campaigns(creator: User = Depends(creator_only), db: Session = Depends(get_db)):
    now = utcnow()
    return [campaign_out(db, c, now, creator) for c in campaigns.list_open(db, now)]


@router.get("/{campaign_id}", response_model=CampaignOut)
def get_one(campaign_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return campaign_out(db, campaigns.get_for_viewer(db, user, campaign_id), utcnow(), user)


@router.patch("/{campaign_id}", response_model=CampaignOut)
def edit(campaign_id: int, data: CampaignEdit, brand: User = Depends(brand_only), db: Session = Depends(get_db)):
    now = utcnow()
    return campaign_out(db, campaigns.edit_campaign(db, brand, campaign_id, data, now), now, brand)


@router.post("/{campaign_id}/cancel", response_model=CampaignOut)
def cancel(campaign_id: int, brand: User = Depends(brand_only), db: Session = Depends(get_db)):
    now = utcnow()
    return campaign_out(db, campaigns.cancel_campaign(db, brand, campaign_id, now), now, brand)


@router.get("/{campaign_id}/applications", response_model=list[ApplicationOut])
def campaign_applications(campaign_id: int, brand: User = Depends(brand_only), db: Session = Depends(get_db)):
    return [application_out(a) for a in applications.list_for_campaign(db, brand, campaign_id)]


@router.post("/{campaign_id}/apply", response_model=ApplicationOut, status_code=201)
def apply(campaign_id: int, data: ApplyIn, creator: User = Depends(creator_only), db: Session = Depends(get_db)):
    return application_out(applications.apply(db, creator, campaign_id, data.note, utcnow()))
```

`api/app/routers/applications.py`:
```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import brand_only, creator_only
from app.clock import utcnow
from app.db import get_db
from app.models import User
from app.presenters import application_out
from app.schemas import ApplicationOut, DeclineIn
from app.services import applications

router = APIRouter(prefix="/applications", tags=["applications"])


@router.get("/mine", response_model=list[ApplicationOut])
def mine(creator: User = Depends(creator_only), db: Session = Depends(get_db)):
    return [application_out(a) for a in applications.list_for_creator(db, creator)]


@router.post("/{application_id}/approve", response_model=ApplicationOut)
def approve(application_id: int, brand: User = Depends(brand_only), db: Session = Depends(get_db)):
    return application_out(applications.approve(db, brand, application_id, utcnow()))


@router.post("/{application_id}/decline", response_model=ApplicationOut)
def decline(application_id: int, data: DeclineIn, brand: User = Depends(brand_only), db: Session = Depends(get_db)):
    return application_out(applications.decline(db, brand, application_id, data.reason, utcnow()))


@router.post("/{application_id}/withdraw", response_model=ApplicationOut)
def withdraw(application_id: int, creator: User = Depends(creator_only), db: Session = Depends(get_db)):
    return application_out(applications.withdraw(db, creator, application_id, utcnow()))
```

In `main.py`, extend the router block:
```python
from app.routers import applications, auth, campaigns  # noqa: E402

for router in (auth.router, campaigns.router, applications.router):
    app.include_router(router)
```

- [ ] **Step 4: Run and see them pass.** Run: `.venv/bin/pytest`. Expected: all pass. Smoke-test in Swagger: `.venv/bin/uvicorn app.main:app --reload`, open http://localhost:8000/docs, then sign up a brand, authorize, and create a campaign.

- [ ] **Step 5: Commit**
```bash
git add api && git commit -m "feat(api): campaign create/edit/cancel rules and campaign/application routes"
```

---

### Task 6: Submit, review, and pay out

**Files:**
- Create: `api/app/mocks/instagram.py`, `api/app/services/wallet.py` (`credit` only), `api/app/services/submissions.py`
- Modify: `api/app/routers/applications.py`, `api/tests/factories.py`, `api/tests/test_money.py`, `api/tests/test_reservation.py`
- Create: `api/tests/test_submissions.py`

**Interfaces:**
- Consumes: `lock_application`, `ensure_brand`, `ensure_creator`, `move`, `release_slot`, `mark_spent`, `payout_breakdown`, `check_transition` and `MAX_REVISIONS`.
- Produces:
  - `instagram.lookup_post(shortcode)->PostLookup(status, caption)`
  - `wallet.credit(db, user_id, amount_paise, kind, now, payout_id=None, withdrawal_id=None)->int` (returns the new balance)
  - `submissions.submit(db, creator, application_id, url, now)`, `submissions.review(db, brand, application_id, action, note, now)`
  - Factories: `submitted`, `paid`.

- [ ] **Step 1: Factories**

Append to `api/tests/factories.py` (imports at the top):
```python
from app.services import submissions


def submitted(db, campaign: Campaign):
    app = approved(db, campaign)
    return submissions.submit(db, app.creator, app.id, f"https://www.instagram.com/reel/Post{app.id}/", NOW)


def paid(db, campaign: Campaign):
    app = submitted(db, campaign)
    return submissions.review(db, campaign.brand, app.id, "approve", None, NOW)
```

- [ ] **Step 2: Write the failing tests**

`api/tests/test_submissions.py`:
```python
from datetime import timedelta

import pytest

from app.errors import DomainError
from app.services import submissions
from tests.factories import NOW, approved, make_campaign, make_user, submitted

URL = "https://www.instagram.com/reel/Cx1abc/"


def test_submitting_a_post_sends_it_for_review(db):
    app = approved(db, make_campaign(db, make_user(db, "brand")))
    submissions.submit(db, app.creator, app.id, URL + "?igsh=share123", NOW)
    assert app.status == "submitted"
    assert app.submissions[0].url == URL  # tracking query stripped
    assert app.submissions[0].caption.startswith("Mock caption")


@pytest.mark.parametrize("url", [
    "https://instagram.com/asha.makes/", "https://www.youtube.com/watch?v=1", "not a link",
])
def test_only_instagram_post_links_are_accepted(db, url):
    app = approved(db, make_campaign(db, make_user(db, "brand")))
    with pytest.raises(DomainError, match="isn't an Instagram post"):
        submissions.submit(db, app.creator, app.id, url, NOW)


@pytest.mark.parametrize("shortcode, message", [("missing42", "couldn't find"), ("private42", "private")])
def test_post_must_exist_and_be_public(db, shortcode, message):
    app = approved(db, make_campaign(db, make_user(db, "brand")))
    with pytest.raises(DomainError, match=message):
        submissions.submit(db, app.creator, app.id, f"https://www.instagram.com/p/{shortcode}/", NOW)


def test_the_same_post_cannot_be_used_twice(db):
    campaign = make_campaign(db, make_user(db, "brand"))
    first, second = approved(db, campaign), approved(db, campaign)
    submissions.submit(db, first.creator, first.id, URL, NOW)
    with pytest.raises(DomainError, match="already submitted"):
        submissions.submit(db, second.creator, second.id, URL, NOW)


def test_first_submission_must_beat_the_deadline(db):
    campaign = make_campaign(db, make_user(db, "brand"))
    app = approved(db, campaign)
    with pytest.raises(DomainError, match="deadline has passed"):
        submissions.submit(db, app.creator, app.id, URL, campaign.submit_deadline)


def test_revisions_need_a_note_and_stop_at_two(db):
    brand = make_user(db, "brand")
    app = submitted(db, make_campaign(db, brand))
    url = app.submissions[0].url
    with pytest.raises(DomainError, match="what to change"):
        submissions.review(db, brand, app.id, "revise", "  ", NOW)
    db.rollback()
    for n in (1, 2):
        submissions.review(db, brand, app.id, "revise", f"Fix number {n}", NOW)
        assert (app.status, app.revision_count) == ("revision_requested", n)
        submissions.submit(db, app.creator, app.id, url, NOW)  # resubmitting your own link is fine
    with pytest.raises(DomainError, match="revisions are used"):
        submissions.review(db, brand, app.id, "revise", "One more", NOW)


def test_resubmission_is_allowed_after_the_deadline(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand)
    app = submitted(db, campaign)
    submissions.review(db, brand, app.id, "revise", "Brighter lighting", NOW)
    submissions.submit(db, app.creator, app.id, app.submissions[0].url, campaign.submit_deadline + timedelta(days=1))
    assert app.status == "submitted"
    assert [s.version for s in app.submissions] == [1, 2]


def test_reject_needs_a_reason(db):
    brand = make_user(db, "brand")
    app = submitted(db, make_campaign(db, brand))
    with pytest.raises(DomainError, match="reason"):
        submissions.review(db, brand, app.id, "reject", None, NOW)
```

Append to `api/tests/test_money.py`:
```python
from sqlalchemy import func, select

from app.errors import DomainError
from app.models import LedgerEntry, Payout, User, Wallet
from app.services import submissions
from tests.factories import NOW, make_campaign, make_user, paid, run_concurrently, submitted


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
```

Append to `api/tests/test_reservation.py`:
```python
from app.services import submissions
from tests.factories import paid, submitted


def test_rejecting_a_post_frees_the_slot(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand)
    app = submitted(db, campaign)
    submissions.review(db, brand, app.id, "reject", "Product not visible", NOW)
    assert app.status == "rejected"
    assert (campaign.filled_slots, campaign.reserved_paise, campaign.spent_paise) == (0, 0, 0)


def test_payout_moves_the_fee_from_reserved_to_spent(db):
    campaign = make_campaign(db, make_user(db, "brand"))
    paid(db, campaign)
    assert (campaign.filled_slots, campaign.reserved_paise, campaign.spent_paise) == (1, 0, FEE)


def test_cannot_withdraw_after_submitting(db):
    app = submitted(db, make_campaign(db, make_user(db, "brand")))
    with pytest.raises(DomainError, match="before submitting"):
        applications.withdraw(db, app.creator, app.id, NOW)


def test_cancelled_campaign_still_pays_approved_creators(db):
    brand = make_user(db, "brand")
    campaign = make_campaign(db, brand)
    app = approved(db, campaign)
    campaigns.cancel_campaign(db, brand, campaign.id, NOW)
    submissions.submit(db, app.creator, app.id, "https://www.instagram.com/reel/AfterCancel1/", NOW)
    submissions.review(db, brand, app.id, "approve", None, NOW)
    assert app.status == "paid"
```
Run: `.venv/bin/pytest`. Expected: FAIL (no `app.services.submissions`).

- [ ] **Step 3: Implement**

`api/app/mocks/instagram.py`:
```python
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
```

`api/app/services/wallet.py`:
```python
from datetime import datetime

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models import LedgerEntry, Wallet


def credit(db: Session, user_id: int, amount_paise: int, kind: str, now: datetime,
           payout_id: int | None = None, withdrawal_id: int | None = None) -> int:
    """Add money to a wallet and write the matching ledger line, in the caller's transaction.
    The balance and the ledger only ever change together, so they can't drift apart."""
    balance = db.execute(
        update(Wallet)
        .where(Wallet.user_id == user_id)
        .values(balance_paise=Wallet.balance_paise + amount_paise)
        .returning(Wallet.balance_paise)
        .execution_options(synchronize_session=False)
    ).scalar_one()
    db.add(LedgerEntry(user_id=user_id, kind=kind, amount_paise=amount_paise, balance_after_paise=balance,
                       payout_id=payout_id, withdrawal_id=withdrawal_id, created_at=now))
    return balance
```

`api/app/services/submissions.py`:
```python
import re
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.money import payout_breakdown
from app.domain.states import MAX_REVISIONS, check_transition
from app.errors import DomainError
from app.mocks import instagram
from app.models import Application, Payout, Submission, User
from app.services.applications import ensure_brand, ensure_creator, lock_application
from app.services.slots import mark_spent, release_slot
from app.services.transitions import move
from app.services.wallet import credit

POST_URL = re.compile(r"^https?://(?:www\.)?instagram\.com/(p|reels?|tv)/([A-Za-z0-9_-]+)/?(?:\?.*)?$")


def submit(db: Session, creator: User, application_id: int, url: str, now: datetime) -> Application:
    app = lock_application(db, application_id)
    ensure_creator(app, creator)
    match = POST_URL.match(url.strip())
    if match is None:
        raise DomainError("That isn't an Instagram post or reel link", 422)
    kind, shortcode = match.groups()
    check_transition(app.status, "submitted")
    # Only the first submission is bound by the deadline; revisions were asked for by the brand.
    if app.status == "approved" and now >= app.campaign.submit_deadline:
        raise DomainError("The submission deadline has passed")
    post = instagram.lookup_post(shortcode)
    if post.status == "not_found":
        raise DomainError("We couldn't find that post on Instagram", 422)
    if post.status == "private":
        raise DomainError("That post is private. Make it public so the brand can see it", 422)
    canonical = f"https://www.instagram.com/{kind}/{shortcode}/"
    if db.scalar(select(Submission.id).where(Submission.url == canonical, Submission.application_id != app.id)):
        raise DomainError("This post was already submitted for a different application")
    db.add(Submission(application_id=app.id, url=canonical, version=len(app.submissions) + 1,
                      caption=post.caption, created_at=now))
    move(db, app, "submitted", now)
    db.commit()
    return app


def review(db: Session, brand: User, application_id: int, action: str, note: str | None, now: datetime) -> Application:
    app = lock_application(db, application_id)  # the row lock is what stops a double payout
    ensure_brand(app, brand)
    note = (note or "").strip() or None
    if action == "approve":
        _pay(db, app, now)
    elif action == "revise":
        check_transition(app.status, "revision_requested")
        if note is None:
            raise DomainError("Tell the creator what to change", 422)
        if app.revision_count >= MAX_REVISIONS:
            raise DomainError(f"All {MAX_REVISIONS} revisions are used. Approve or reject this post")
        app.revision_count += 1
        move(db, app, "revision_requested", now, note)
    elif action == "reject":
        check_transition(app.status, "rejected")
        if note is None:
            raise DomainError("Give the creator a reason", 422)
        move(db, app, "rejected", now, note)
        release_slot(db, app)
    else:
        raise DomainError(f"Unknown review action '{action}'", 422)
    db.commit()
    return app


def _pay(db: Session, app: Application, now: datetime) -> None:
    """Approve and pay in one transaction: bill, wallet credit, ledger line, campaign spend."""
    check_transition(app.status, "paid")
    bill = payout_breakdown(app.fee_paise)
    payout = Payout(application=app, fee_paise=bill.fee, platform_fee_paise=bill.platform_fee, gst_paise=bill.gst,
                    tds_paise=bill.tds, net_paise=bill.net, created_at=now)
    db.add(payout)
    db.flush()
    credit(db, app.creator_id, bill.net, "payout", now, payout_id=payout.id)
    mark_spent(db, app)
    move(db, app, "paid", now)
```

Append to `api/app/routers/applications.py`:
```python
from app.schemas import ReviewIn, SubmitIn
from app.services import submissions


@router.post("/{application_id}/submissions", response_model=ApplicationOut)
def submit(application_id: int, data: SubmitIn, creator: User = Depends(creator_only), db: Session = Depends(get_db)):
    return application_out(submissions.submit(db, creator, application_id, data.url, utcnow()))


@router.post("/{application_id}/review", response_model=ApplicationOut)
def review(application_id: int, data: ReviewIn, brand: User = Depends(brand_only), db: Session = Depends(get_db)):
    return application_out(submissions.review(db, brand, application_id, data.action, data.note, utcnow()))
```
(Move the imports to the top.)

- [ ] **Step 4: Run and see them pass.** Run: `.venv/bin/pytest`. Expected: all pass. Run `-k parallel` five times, as in Task 4.

- [ ] **Step 5: Commit**
```bash
git add api && git commit -m "feat(api): post submission with mock Instagram lookup, revisions, payout to wallet"
```

---

### Task 7: Withdrawals, mock payout provider, worker v1

**Files:**
- Create: `api/app/mocks/payouts.py`, `api/app/routers/wallet.py`, `api/app/worker.py`
- Modify: `api/app/services/wallet.py`, `api/app/presenters.py` (`wallet_out`), `api/app/main.py`, `api/tests/factories.py`, `api/tests/test_money.py`

**Interfaces:**
- Consumes: `credit`, `enqueue` and `format_inr`.
- Produces:
  - `MockPayoutProvider().transfer(upi_id, amount_paise, reference)->TransferResult(ok, ref, reason)`
  - `wallet.request_withdrawal(db, creator, amount_paise, upi_id, now)->Withdrawal`
  - `wallet.process_withdrawals(db, provider, now, limit=10)->int`
  - `presenters.wallet_out(db, creator)->WalletOut`
  - `worker.run_once(now=None)`
  - HTTP: `GET /wallet`, `POST /wallet/withdrawals`
  - Factories: `fund(db, user, amount)`, `assert_ledger_matches(db, user_id)`.

- [ ] **Step 1: Factories**

Append to `api/tests/factories.py`:
```python
from sqlalchemy import func, select

from app.models import LedgerEntry
from app.services import wallet


def fund(db, user: User, amount_paise: int) -> None:
    wallet.credit(db, user.id, amount_paise, "payout", NOW)
    db.commit()


def assert_ledger_matches(db, user_id: int) -> None:
    db.expire_all()
    total = db.scalar(select(func.coalesce(func.sum(LedgerEntry.amount_paise), 0)).where(LedgerEntry.user_id == user_id))
    assert total == db.get(Wallet, user_id).balance_paise
```

- [ ] **Step 2: Write the failing tests** (append to `api/tests/test_money.py`)
```python
from app.mocks.payouts import MockPayoutProvider
from app.models import Notification, Withdrawal
from app.services import wallet
from tests.factories import assert_ledger_matches, fund


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
```
Run: `.venv/bin/pytest tests/test_money.py`. Expected: FAIL (import errors).

- [ ] **Step 3: Implement**

`api/app/mocks/payouts.py`:
```python
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
```

Append to `api/app/services/wallet.py` (merge imports at the top):
```python
from sqlalchemy import select

from app.domain.money import format_inr
from app.errors import DomainError
from app.mocks.payouts import MockPayoutProvider
from app.models import User, Withdrawal
from app.services.notify import enqueue


def request_withdrawal(db: Session, creator: User, amount_paise: int, upi_id: str | None, now: datetime) -> Withdrawal:
    if amount_paise <= 0:
        raise DomainError("Enter an amount above zero", 422)
    upi = (upi_id or creator.upi_id or "").strip()
    if not upi:
        raise DomainError("Add your UPI ID to withdraw", 422)
    # Debit only if the balance covers it, in one statement: two parallel requests can't both pass.
    balance = db.execute(
        update(Wallet)
        .where(Wallet.user_id == creator.id, Wallet.balance_paise >= amount_paise)
        .values(balance_paise=Wallet.balance_paise - amount_paise)
        .returning(Wallet.balance_paise)
        .execution_options(synchronize_session=False)
    ).scalar_one_or_none()
    if balance is None:
        raise DomainError("That's more than your wallet balance")
    creator.upi_id = upi
    withdrawal = Withdrawal(user_id=creator.id, amount_paise=amount_paise, upi_id=upi, created_at=now)
    db.add(withdrawal)
    db.flush()
    db.add(LedgerEntry(user_id=creator.id, kind="withdrawal", amount_paise=-amount_paise,
                       balance_after_paise=balance, withdrawal_id=withdrawal.id, created_at=now))
    db.commit()
    return withdrawal


def process_withdrawals(db: Session, provider: MockPayoutProvider, now: datetime, limit: int = 10) -> int:
    """Worker step: settle processing withdrawals. SKIP LOCKED lets several workers share the queue."""
    pending = db.scalars(
        select(Withdrawal).where(Withdrawal.status == "processing").order_by(Withdrawal.id)
        .limit(limit).with_for_update(skip_locked=True)
    ).all()
    for w in pending:
        result = provider.transfer(w.upi_id, w.amount_paise, reference=f"wd_{w.id}")
        w.processed_at = now
        if result.ok:
            w.status, w.provider_ref = "succeeded", result.ref
            enqueue(db, w.user_id, "withdrawal_succeeded", f"{format_inr(w.amount_paise)} was sent to {w.upi_id}.", now)
        else:
            w.status, w.failure_reason = "failed", result.reason
            credit(db, w.user_id, w.amount_paise, "refund", now, withdrawal_id=w.id)
            enqueue(db, w.user_id, "withdrawal_failed",
                    f"Your withdrawal of {format_inr(w.amount_paise)} failed ({result.reason}). "
                    f"The money is back in your wallet.", now)
    db.commit()
    return len(pending)
```

Append to `api/app/presenters.py`:
```python
from app.models import LedgerEntry, Wallet, Withdrawal
from app.schemas import LedgerOut, WalletOut, WithdrawalOut


def wallet_out(db: Session, creator: User) -> WalletOut:
    entries = db.scalars(select(LedgerEntry).where(LedgerEntry.user_id == creator.id).order_by(LedgerEntry.id.desc()))
    withdrawals = db.scalars(select(Withdrawal).where(Withdrawal.user_id == creator.id).order_by(Withdrawal.id.desc()))
    return WalletOut(
        balance_paise=db.get(Wallet, creator.id).balance_paise,
        upi_id=creator.upi_id,
        entries=[
            LedgerOut(
                id=e.id, kind=e.kind, amount_paise=e.amount_paise, balance_after_paise=e.balance_after_paise,
                created_at=e.created_at,
                campaign_title=e.payout.application.campaign.title if e.payout else None,
                payout=PayoutOut.model_validate(e.payout) if e.payout else None,
                withdrawal_id=e.withdrawal_id,
            )
            for e in entries
        ],
        withdrawals=[WithdrawalOut.model_validate(w) for w in withdrawals],
    )
```

`api/app/routers/wallet.py`:
```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import creator_only
from app.clock import utcnow
from app.db import get_db
from app.models import User
from app.presenters import wallet_out
from app.schemas import WalletOut, WithdrawalOut, WithdrawIn
from app.services import wallet

router = APIRouter(prefix="/wallet", tags=["wallet"])


@router.get("", response_model=WalletOut)
def get_wallet(creator: User = Depends(creator_only), db: Session = Depends(get_db)):
    return wallet_out(db, creator)


@router.post("/withdrawals", response_model=WithdrawalOut, status_code=201)
def withdraw(data: WithdrawIn, creator: User = Depends(creator_only), db: Session = Depends(get_db)):
    return WithdrawalOut.model_validate(
        wallet.request_withdrawal(db, creator, data.amount_paise, data.upi_id, utcnow())
    )
```
Add `wallet.router` to the router tuple in `main.py`.

`api/app/worker.py`:
```python
import logging
import time
from datetime import datetime

from app.clock import utcnow
from app.config import settings
from app.db import SessionLocal
from app.mocks.payouts import MockPayoutProvider
from app.services.wallet import process_withdrawals

log = logging.getLogger("worker")


def run_once(now: datetime | None = None) -> None:
    now = now or utcnow()
    with SessionLocal() as db:
        process_withdrawals(db, MockPayoutProvider(), now)


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
```

- [ ] **Step 4: Run and see them pass.** Run: `.venv/bin/pytest`. Expected: all pass. Run `-k parallel` five times.

- [ ] **Step 5: Commit**
```bash
git add api && git commit -m "feat(api): wallet withdrawals with mock payout provider and refund on failure"
```

---

### Task 8: Sending notifications, quiet hours at send time, deadlines

**Files:**
- Create: `api/app/mocks/messaging.py`, `api/app/services/deadlines.py`, `api/app/routers/notifications.py`
- Modify: `api/app/services/notify.py`, `api/app/worker.py`, `api/app/main.py`, `api/tests/test_notifications.py`, `api/tests/test_reservation.py`

**Interfaces:**
- Consumes: `enqueue`, `is_quiet`, `move` and `release_slot`.
- Produces:
  - `notify.send_due_notifications(db, now, limit=50)->int`
  - `deadlines.expire_missed_deadlines(db, now)->int`
  - `worker.run_once` now runs expire, then withdrawals, then send.
  - HTTP: `GET /notifications`.

- [ ] **Step 1: Write the failing tests** (append to `api/tests/test_notifications.py`)
```python
from sqlalchemy import select

from app.models import Notification
from app.services import notify
from tests.factories import make_campaign, make_user, paid


def statuses(db, user_id):
    rows = db.execute(select(Notification.channel, Notification.status, Notification.skip_reason)
                      .where(Notification.user_id == user_id).order_by(Notification.channel)).all()
    return [tuple(r) for r in rows]


def test_message_created_at_night_waits_until_9am(db):
    creator = make_user(db, "creator", phone="+919800000001")
    notify.enqueue(db, creator.id, "test", "hello", ist(12, 22, 0))
    db.commit()
    assert notify.send_due_notifications(db, ist(13, 8, 59)) == 0
    assert notify.send_due_notifications(db, ist(13, 9, 0)) == 2
    assert statuses(db, creator.id) == [("email", "sent", None), ("whatsapp", "sent", None)]


def test_overdue_message_still_waits_out_quiet_hours(db):
    # queued at 20:58 for immediate sending, but the worker only got to it at 23:00
    creator = make_user(db, "creator", phone="+919800000001")
    notify.enqueue(db, creator.id, "test", "hello", ist(12, 20, 58))
    db.commit()
    assert notify.send_due_notifications(db, ist(12, 23, 0)) == 0
    assert notify.send_due_notifications(db, ist(13, 9, 0)) == 2


def test_opt_out_is_checked_when_sending(db):
    creator = make_user(db, "creator", phone="+919800000001")
    notify.enqueue(db, creator.id, "test", "hello", ist(12, 12, 0))
    creator.whatsapp_opt_in = False  # opted out after the message was queued
    db.commit()
    notify.send_due_notifications(db, ist(12, 12, 0))
    assert statuses(db, creator.id) == [("email", "sent", None), ("whatsapp", "skipped", "Opted out of WhatsApp")]


def test_whatsapp_needs_a_phone_number(db):
    creator = make_user(db, "creator")
    notify.enqueue(db, creator.id, "test", "hello", ist(12, 12, 0))
    db.commit()
    notify.send_due_notifications(db, ist(12, 12, 0))
    assert ("whatsapp", "skipped", "No phone number") in statuses(db, creator.id)


def test_each_step_notifies_the_other_side(db):
    brand = make_user(db, "brand")
    app = paid(db, make_campaign(db, brand))
    rows = db.execute(select(Notification.user_id, Notification.event)
                      .where(Notification.channel == "email").order_by(Notification.id)).all()
    assert [tuple(r) for r in rows] == [
        (brand.id, "application_applied"),
        (app.creator_id, "application_approved"),
        (brand.id, "application_submitted"),
        (app.creator_id, "application_paid"),
    ]
```

Append to `api/tests/test_reservation.py`:
```python
from datetime import timedelta

from app.services import deadlines


def test_missed_deadline_expires_and_frees_the_slot(db):
    campaign = make_campaign(db, make_user(db, "brand"))
    app, pending = approved(db, campaign), applied(db, campaign)
    assert deadlines.expire_missed_deadlines(db, campaign.submit_deadline + timedelta(minutes=1)) == 2
    assert app.status == "expired"
    assert pending.status == "declined"
    assert (campaign.filled_slots, campaign.reserved_paise) == (0, 0)


def test_deadline_job_leaves_submitted_posts_alone(db):
    campaign = make_campaign(db, make_user(db, "brand"))
    app = submitted(db, campaign)
    assert deadlines.expire_missed_deadlines(db, campaign.submit_deadline + timedelta(days=1)) == 0
    assert app.status == "submitted"
```
Run: `.venv/bin/pytest`. Expected: FAIL.

- [ ] **Step 2: Implement**

`api/app/mocks/messaging.py`:
```python
import logging

from app.models import User

log = logging.getLogger("mock.messaging")


def send_email(user: User, body: str) -> None:
    log.info("EMAIL to %s: %s", user.email, body)


def send_whatsapp(user: User, body: str) -> None:
    log.info("WHATSAPP to %s: %s", user.phone, body)


SENDERS = {"email": send_email, "whatsapp": send_whatsapp}
```

Append to `api/app/services/notify.py` (merge imports):
```python
from sqlalchemy import select

from app.domain.ist import is_quiet
from app.mocks.messaging import SENDERS
from app.models import User


def _skip_reason(user: User, channel: str) -> str | None:
    if channel == "email" and not user.email_opt_in:
        return "Opted out of email"
    if channel == "whatsapp" and not user.whatsapp_opt_in:
        return "Opted out of WhatsApp"
    if channel == "whatsapp" and not user.phone:
        return "No phone number"
    return None


def send_due_notifications(db: Session, now: datetime, limit: int = 50) -> int:
    """Worker step. Nothing goes out during quiet hours, even overdue messages
    (say the worker was down at 20:59); they all go at 09:00."""
    if is_quiet(now):
        return 0
    due = db.scalars(
        select(Notification).where(Notification.status == "queued", Notification.send_at <= now)
        .order_by(Notification.id).limit(limit).with_for_update(skip_locked=True)
    ).all()
    for n in due:
        user = db.get(User, n.user_id)
        reason = _skip_reason(user, n.channel)
        if reason:
            n.status, n.skip_reason = "skipped", reason
        else:
            SENDERS[n.channel](user, n.body)
            n.status, n.sent_at = "sent", now
    db.commit()
    return len(due)
```

`api/app/services/deadlines.py`:
```python
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Application, Campaign
from app.services.slots import release_slot
from app.services.transitions import move


def expire_missed_deadlines(db: Session, now: datetime) -> int:
    """Worker step. At the submission deadline, approved creators who never submitted expire
    (their slot and fee are freed) and still-pending applicants are declined."""
    overdue = db.scalars(
        select(Application).join(Campaign)
        .where(Campaign.submit_deadline <= now, Application.status.in_(("applied", "approved")))
        .with_for_update(of=Application, skip_locked=True)
    ).all()
    for app in overdue:
        if app.status == "approved":
            move(db, app, "expired", now)
            release_slot(db, app)
        else:
            move(db, app, "declined", now, "The campaign closed before your application was reviewed")
    db.commit()
    return len(overdue)
```

Replace `run_once` in `api/app/worker.py`:
```python
from app.services.deadlines import expire_missed_deadlines
from app.services.notify import send_due_notifications


def run_once(now: datetime | None = None) -> None:
    """One tick. Expire and settle first, so the messages they queue can go out in the same tick."""
    now = now or utcnow()
    with SessionLocal() as db:
        expire_missed_deadlines(db, now)
    with SessionLocal() as db:
        process_withdrawals(db, MockPayoutProvider(), now)
    with SessionLocal() as db:
        send_due_notifications(db, now)
```

`api/app/routers/notifications.py`:
```python
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import current_user
from app.db import get_db
from app.models import Notification, User
from app.schemas import NotificationOut

router = APIRouter(tags=["notifications"])


@router.get("/notifications", response_model=list[NotificationOut])
def my_notifications(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Notification).where(Notification.user_id == user.id)
                      .order_by(Notification.id.desc()).limit(200))
    return [NotificationOut.model_validate(n) for n in rows]
```
Add `notifications.router` to `main.py`.

- [ ] **Step 3: Run and see them pass.** Run: `.venv/bin/pytest`. Expected: all pass.

- [ ] **Step 4: Commit**
```bash
git add api && git commit -m "feat(api): notification sending with IST quiet hours and opt-outs, deadline expiry"
```

---

### Task 9: Seed data, full-stack compose for api and worker, HTTP flow test, repo map

**Files:**
- Create: `api/Dockerfile`, `api/app/seed.py`, `api/tests/test_api_flow.py`
- Modify: `docker-compose.yml`
- Create: `.claude/ugc-campaigns/AGENTS.md`, `.claude/ugc-campaigns/CLAUDE.md`, `.claude/ugc-campaigns/STRUCTURE.md`
- Modify: `.claude/contracts/api-surface.md` (stamp), root `AGENTS.md` (Repos row)

- [ ] **Step 1: Write the failing test**

`api/tests/test_api_flow.py`:
```python
from datetime import datetime, timedelta, timezone

from app.worker import run_once
from tests.factories import signup


def in_days(days: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


def test_full_campaign_flow_over_http(client):
    brand, creator = signup(client, "brand"), signup(client, "creator")
    campaign = client.post("/campaigns", headers=brand, json={
        "title": "Monsoon snack reels", "budget_paise": 2_000_000, "fee_paise": 1_000_000, "slots": 2,
        "apply_deadline": in_days(3), "submit_deadline": in_days(10),
    }).json()
    assert [c["id"] for c in client.get("/campaigns", headers=creator).json()] == [campaign["id"]]

    app = client.post(f"/campaigns/{campaign['id']}/apply", headers=creator, json={}).json()
    assert client.get(f"/campaigns/{campaign['id']}", headers=brand).json()["counts"] == {"applied": 1, "to_review": 0}
    assert client.post(f"/applications/{app['id']}/approve", headers=brand).json()["status"] == "approved"

    post = {"url": "https://www.instagram.com/reel/Abc123/"}
    client.post(f"/applications/{app['id']}/submissions", headers=creator, json=post)
    revised = client.post(f"/applications/{app['id']}/review", headers=brand,
                          json={"action": "revise", "note": "Show the pack in the first 3 seconds"}).json()
    assert revised["revisions_left"] == 1
    client.post(f"/applications/{app['id']}/submissions", headers=creator, json=post)
    done = client.post(f"/applications/{app['id']}/review", headers=brand, json={"action": "approve"}).json()
    assert done["payout"]["net_paise"] == 873_180

    res = client.post("/wallet/withdrawals", headers=creator, json={"amount_paise": 873_180, "upi_id": "asha@okbank"})
    assert res.status_code == 201
    run_once()
    wallet = client.get("/wallet", headers=creator).json()
    assert wallet["balance_paise"] == 0
    assert wallet["withdrawals"][0]["status"] == "succeeded"
    assert [e["kind"] for e in wallet["entries"]] == ["withdrawal", "payout"]
    assert wallet["entries"][1]["payout"]["tds_paise"] == 8_820


def test_roles_are_enforced(client):
    brand, creator = signup(client, "brand"), signup(client, "creator")
    assert client.get("/wallet", headers=brand).status_code == 403
    assert client.get("/campaigns/mine", headers=creator).status_code == 403


def test_business_errors_come_back_as_readable_messages(client):
    creator = signup(client, "creator")
    res = client.post("/wallet/withdrawals", headers=creator, json={"amount_paise": 100, "upi_id": "asha@okbank"})
    assert res.status_code == 409
    assert res.json() == {"detail": "That's more than your wallet balance"}
```
Run: `.venv/bin/pytest tests/test_api_flow.py`. Expected: PASS straight away, because all the behaviour exists. That is fine; this is a regression net. If anything fails, fix the code, not the test.

- [ ] **Step 2: Seed**

`api/app/seed.py`:
```python
"""Illustrative demo data so reviewers can click through straight away. Safe to run twice."""
from datetime import timedelta

from sqlalchemy import select

from app.clock import utcnow
from app.db import SessionLocal
from app.models import User
from app.schemas import CampaignIn, SignupIn
from app.services import applications, campaigns, submissions, users

PASSWORD = "demo-pass-123"


def main() -> None:
    now = utcnow()
    with SessionLocal() as db:
        if db.scalar(select(User.id).where(User.email == "brand@ugc-demo.in")):
            print("Demo data already present")
            return
        brand = users.signup(db, SignupIn(name="Monsoon Snacks (demo)", email="brand@ugc-demo.in",
                                          password=PASSWORD, role="brand"))
        asha = users.signup(db, SignupIn(name="Asha Rao", email="creator@ugc-demo.in", password=PASSWORD,
                                         role="creator", instagram_handle="asha.makes", phone="+919800000001"))
        ravi = users.signup(db, SignupIn(name="Ravi Menon", email="ravi@ugc-demo.in", password=PASSWORD,
                                         role="creator", instagram_handle="ravi.frames"))
        meera = users.signup(db, SignupIn(name="Meera Shah", email="meera@ugc-demo.in", password=PASSWORD,
                                          role="creator", instagram_handle="meera.cooks", phone="+919800000003"))

        reels = campaigns.create_campaign(db, brand, CampaignIn(
            title="Rainy-day snack reels",
            description="Show your favourite monsoon snack moment with our masala chips. 30-45 second reel; tag the brand.",
            budget_paise=3_000_000, fee_paise=1_000_000, slots=3,
            apply_deadline=now + timedelta(days=5), submit_deadline=now + timedelta(days=12)), now)
        unboxing = campaigns.create_campaign(db, brand, CampaignIn(
            title="Festive gift box unboxing",
            description="Unbox our festive hamper on camera. One post or reel.",
            budget_paise=2_000_000, fee_paise=500_000, slots=4,
            apply_deadline=now + timedelta(days=4), submit_deadline=now + timedelta(days=10)), now)

        # Asha is already paid, so her wallet shows a payout bill on first login.
        app = applications.apply(db, asha, reels.id, "Rainy balcony set-up ready!", now)
        applications.approve(db, brand, app.id, now)
        submissions.submit(db, asha, app.id, "https://www.instagram.com/reel/DemoAsha01/", now)
        submissions.review(db, brand, app.id, "approve", None, now)
        # Ravi is waiting for the brand to decide.
        applications.apply(db, ravi, reels.id, None, now)
        # Meera's post is waiting for review.
        app = applications.apply(db, meera, unboxing.id, None, now)
        applications.approve(db, brand, app.id, now)
        submissions.submit(db, meera, app.id, "https://www.instagram.com/p/DemoMeera1/", now)
        print(f"Seeded demo data. Every demo account's password is {PASSWORD}")


if __name__ == "__main__":
    main()
```
Run against the dev DB: `cd api && .venv/bin/python -m app.seed`, twice. The
second run should print "Demo data already present".

- [ ] **Step 3: Containers**

`api/Dockerfile`:
```dockerfile
FROM python:3.14-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
```

Add to `docker-compose.yml` under `services:`:
```yaml
  api:
    build: ./api
    environment: &api-env
      DATABASE_URL: postgresql+psycopg://ugc:ugc@db:5432/ugc
      JWT_SECRET: local-demo-secret
    command: sh -c "alembic upgrade head && python -m app.seed && uvicorn app.main:app --host 0.0.0.0 --port 8000"
    ports:
      - "8000:8000"
    depends_on:
      db:
        condition: service_healthy

  worker:
    build: ./api
    environment: *api-env
    command: python -m app.worker
    depends_on:
      - api
```
Run: `docker compose up --build -d api worker && sleep 8 && curl -s localhost:8000/health && docker compose logs worker | tail -5`.
Expected: `{"ok":true}` and "worker started". (The worker may log a failed tick
before the migrations finish; it retries on the next tick.)

- [ ] **Step 4: Map the repo** (repo-setup step 2, now that code exists)

Write `.claude/ugc-campaigns/AGENTS.md`: what the repo is, the stack, entry
points (`app.main:app`, `python -m app.worker`, `python -m app.seed`), the
folder map, and the commands. Add a `CLAUDE.md` next to it containing
`@AGENTS.md`. Write `.claude/ugc-campaigns/STRUCTURE.md`: the file tree under
`api/app` with every public function signature.

End both with the stamp
`<!-- mapped: .@<short sha> paths: api/app,api/tests -->` (no space before
`@`; the sweep in the root AGENTS.md splits on it). Also stamp the contract:
replace its `<!-- intent ... -->` footer with
`<!-- mapped: .@<short sha> paths: api/app/schemas.py,api/app/routers -->`.
Update the Repos row in the root `AGENTS.md`.

- [ ] **Step 5: Full suite, then commit**
```bash
cd api && .venv/bin/pytest && cd .. && "$(git rev-parse --git-common-dir)/../.claude/leak-check.sh"
git add api docker-compose.yml .claude AGENTS.md && git commit -m "feat: demo seed, api and worker containers, end-to-end HTTP flow test"
git push origin HEAD:main
```

---

### Task 10: Web foundation: scaffold, visual direction (ui-craft 0–1), auth screens

**Files:**
- Create: `web/` (create-next-app), `web/DESIGN.md`, `web/Dockerfile`, `web/.dockerignore`, `web/.env.local.example`
- Create: `web/src/lib/{token,api,auth,types,money,time,instagram,next-step}.ts`
- Create: `web/src/components/{require-role,app-shell,status-pill}.tsx`
- Create: `web/src/app/{login,signup}/page.tsx`, `web/src/app/demo/[role]/page.tsx`, `web/src/app/{brand,creator,inbox,settings}/layout.tsx`
- Modify: `web/src/app/{layout.tsx,page.tsx,globals.css}`, `docker-compose.yml`

**Interfaces:**
- Consumes: the HTTP contract (`.claude/contracts/api-surface.md`).
- Produces (later web tasks use these):
  - `api<T>(path, init?)`, `post<T>(path, body?)`, `patch<T>(path, body)`, and `ApiError(status, message)`
  - `getToken/saveToken/clearToken`, `useMe()`, `homeFor(role)`
  - `formatINR(paise)`, `rupeesToPaise(text)->number|null`
  - `formatIST(iso)`, `istInputToISO(value)`, `isoToISTInput(iso)`
  - `parseInstagramUrl(text)->{kind, shortcode}|null`
  - `creatorNextStep(app)`, `brandNextStep(app)`, `STATUS_LABEL`
  - `<RequireRole role?>`, `<AppShell>`, `<StatusPill>`
  - All the types in `types.ts`.

- [ ] **Step 1: Scaffold**
```bash
npx create-next-app@latest web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
cd web && npm i swr && npx shadcn@latest init
npx shadcn@latest add button input label textarea tabs dialog switch tooltip skeleton sonner badge
```
(If a flag has changed, check `npx create-next-app@latest --help`; the intent
is TypeScript, Tailwind, App Router and a `src/` directory.)
`web/.env.local.example` and your local `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_DEMO=1
```

- [ ] **Step 2: ui-craft, one-time setup.** Follow the skill's Setup section:
  clone `https://github.com/XploY04/shaktiyan.git` into a scratch folder, copy
  `skills/ui-craft` to `~/.claude/skills/`, and run `npm install` in its
  `scripts/`. Then load the `ui-craft` skill.
  - Tell the user which pipeline sub-skills are **not installed**:
    `refero-design`, `impeccable`, `shadcn` (the skill; the library is fine),
    `design-motion-principles` and `boneyard`. Their steps are done by hand
    following ui-craft's rules, not skipped silently.

- [ ] **Step 3: ui-craft Step 0, source of visual truth.** This is a new repo
  with no DESIGN.md, tokens or theme. **Do not search outside this repo for a
  sibling app's theme.** Other local projects are off-limits (confidentiality).
  Record "new visual world, nothing to preserve" at the top of `web/DESIGN.md`.

- [ ] **Step 4: ui-craft Step 1, references and direction.** Write `web/DESIGN.md`.

  **The references.** Name three real products and what each gives us, not a
  look:
  - **Wise's transfer review:** an amount, then itemised deductions, then what
    arrives. This is our payout bill.
  - **Linear's issue list:** dense, status-first rows with one obvious action
    per row. These are our applicant and application lists.
  - **Stripe Dashboard balances:** a balance on top, then a ledger with a
    running balance and tabular numerals. This is our wallet.

  Optionally capture them with `node shot.mjs` (edit its URL) into the
  scratchpad, not the repo.

  **Constraints from outside the design space:**
  - Money is in ₹ with en-IN grouping (₹10,00,000).
  - Creators are on phones (390px).
  - Brands are on short laptops (1366×768, 1280×720).
  - Every deadline is shown in IST.
  - A brand's job on the campaign page is "approve or review". That control
    must be on the first screen at every size.

  **Decisions to write down:**
  - **Typeface:** one with tabular figures that is not on ui-craft's refuse list
    (so not Inter, Geist, Space Grotesk, Poppins, Montserrat or Instrument
    Serif). Replace create-next-app's default Geist.
  - **Colour tokens:** ground, ink, muted, line, accent, plus good and bad for
    paid/rejected. Avoid purple-to-blue, gradient text and glass.
  - **Radius:** 8px or less.
  - **Spacing:** a scale with both tight and loose rhythm.
  - **Motion:** state changes only, 120–220ms ease-out, nothing looping.
  - **Browser surfaces:** selection colour, caret, focus ring, scrollbar,
    underline offset, and `font-variant-numeric: tabular-nums` on all money.

  **Copy rules:**
  - no eyebrow labels;
  - headings aren't full-stop aphorisms;
  - no "seamless", "streamline" and so on;
  - no em-dash habit.

- [ ] **Step 5: Tokens.** Put the tokens in `globals.css` (Tailwind v4
  `@theme` or CSS variables), and any component classes inside
  `@layer components`. Set the font through `next/font` in `layout.tsx`. Set
  `<html lang="en-IN">`.

- [ ] **Step 6: The lib files**

`web/src/lib/token.ts`:
```ts
const KEY = "token";

export function getToken(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function saveToken(token: string) {
  try { localStorage.setItem(KEY, token); } catch {}
}
export function clearToken() {
  try { localStorage.removeItem(KEY); } catch {}
}
```

`web/src/lib/api.ts`:
```ts
import { clearToken, getToken } from "./token";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function messageFrom(body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  return "Something went wrong. Please try again.";
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (res.status === 401) clearToken();
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, messageFrom(body));
  return body as T;
}

export const post = <T>(path: string, body: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
```

`web/src/lib/types.ts`: one TypeScript type per contract shape (`User`,
`Campaign`, `Application`, `Payout`, `Submission`, `AppEvent`, `LedgerEntry`,
`Withdrawal`, `Wallet`, `Notification`), plus
`type Role = "brand" | "creator"` and
`type AppStatus = "applied" | "approved" | "declined" | "withdrawn" | "expired" | "submitted" | "revision_requested" | "paid" | "rejected"`.
Copy the field names exactly from `.claude/contracts/api-surface.md`.

`web/src/lib/auth.ts`:
```ts
"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { api } from "./api";
import { getToken } from "./token";
import type { Role, User } from "./types";

export const homeFor = (role: Role) => (role === "brand" ? "/brand" : "/creator");

/** The logged-in user. Waits for the first client render so server and client markup match. */
export function useMe() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return useSWR<User>(ready && getToken() ? "/me" : null, api);
}
```

`web/src/lib/money.ts`:
```ts
const whole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const exact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });

/** ₹10,000 for whole rupees, ₹8,731.80 otherwise. */
export function formatINR(paise: number): string {
  return paise % 100 === 0 ? whole.format(paise / 100) : exact.format(paise / 100);
}

/** "499.5" -> 49950. Parses the string so no floating-point error can creep in. */
export function rupeesToPaise(text: string): number | null {
  const m = text.trim().replace(/,/g, "").match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}
```

`web/src/lib/time.ts`:
```ts
const ist = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

export const formatIST = (iso: string) => `${ist.format(new Date(iso))} IST`;

/** <input type="datetime-local"> value, read as IST, to an ISO string the API accepts. */
export const istInputToISO = (value: string) => `${value}:00+05:30`;

/** ISO from the API back to a datetime-local value in IST (for the edit form). */
export function isoToISTInput(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + 330 * 60_000);
  return shifted.toISOString().slice(0, 16);
}
```

`web/src/lib/instagram.ts`:
```ts
const POST_URL = /^https?:\/\/(?:www\.)?instagram\.com\/(p|reels?|tv)\/([A-Za-z0-9_-]+)\/?(?:\?.*)?$/;

/** Same rule as the API, so creators see a problem while typing, not after submitting. */
export function parseInstagramUrl(text: string): { kind: string; shortcode: string } | null {
  const m = text.trim().match(POST_URL);
  return m ? { kind: m[1], shortcode: m[2] } : null;
}
```

`web/src/lib/next-step.ts`:
```ts
import { formatINR } from "./money";
import { formatIST } from "./time";
import type { Application, AppStatus } from "./types";

export type Step =
  | { kind: "action"; label: string }
  | { kind: "waiting"; label: string }
  | { kind: "done"; label: string; tone: "good" | "bad" };

export const STATUS_LABEL: Record<AppStatus, string> = {
  applied: "Applied", approved: "Approved", declined: "Declined", withdrawn: "Withdrew",
  expired: "Deadline missed", submitted: "Post submitted", revision_requested: "Changes requested",
  paid: "Paid", rejected: "Post rejected",
};

export function creatorNextStep(a: Application): Step {
  switch (a.status) {
    case "applied": return { kind: "waiting", label: "Waiting for the brand to decide" };
    case "approved": return { kind: "action", label: `Submit post link by ${formatIST(a.campaign.submit_deadline)}` };
    case "submitted": return { kind: "waiting", label: "Your post is in review" };
    case "revision_requested": return { kind: "action", label: "Resubmit your post" };
    case "paid": return { kind: "done", label: `Paid ${formatINR(a.payout!.fee_paise)}`, tone: "good" };
    case "rejected": return { kind: "done", label: "Post rejected", tone: "bad" };
    case "declined": return { kind: "done", label: "Not selected", tone: "bad" };
    case "withdrawn": return { kind: "done", label: "You withdrew", tone: "bad" };
    case "expired": return { kind: "done", label: "Deadline missed", tone: "bad" };
  }
}

export function brandNextStep(a: Application): Step {
  switch (a.status) {
    case "applied": return { kind: "action", label: "Approve or decline" };
    case "approved": return { kind: "waiting", label: `Post due ${formatIST(a.campaign.submit_deadline)}` };
    case "submitted": return { kind: "action", label: "Review post" };
    case "revision_requested": return { kind: "waiting", label: "Waiting for the revised post" };
    case "paid": return { kind: "done", label: "Paid", tone: "good" };
    default: return { kind: "done", label: STATUS_LABEL[a.status], tone: "bad" };
  }
}
```

- [ ] **Step 7: Guard, shell and auth screens**
  - **`RequireRole`** (`role?: Role`). It uses `useMe()`.
    - With no token or on an error, it runs `router.replace("/login")`.
    - With the wrong role, it runs `router.replace(homeFor(me.role))`.
    - While loading it renders a skeleton of the shell. Otherwise it renders
      `<AppShell user={me}>{children}</AppShell>`.
    - The layouts use it: `brand/layout.tsx` with `role="brand"`,
      `creator/layout.tsx` with `role="creator"`, and `inbox/layout.tsx` and
      `settings/layout.tsx` with no role.
  - **`AppShell`**
    - **Brand nav:** Campaigns, New campaign, Inbox, Settings.
    - **Creator nav:** Explore, My campaigns (badge = number needing action),
      Wallet (shows the balance), Inbox, Settings.
    - **Log out** clears the token and goes to `/login`.
    - On phones the nav collapses to a bottom bar or a menu, never a horizontal
      scroll.
  - **`/` (`page.tsx`):** redirects to `homeFor(me.role)` or `/login`.
  - **`/signup`:**
    - **Step 1:** pick a role from two large choices, "I'm a brand" and "I'm a
      creator", each with one line of explanation.
    - **Step 2:** the fields. Creators get the Instagram handle (required) and
      phone (optional, with the helper "Add it to get WhatsApp updates").
    - **On submit:** `post<AuthOut>("/auth/signup")`, then `saveToken`, then
      `router.replace(homeFor(role))`.
    - **Errors:** show the API's `detail` inline.
  - **`/login`:** email and password, with the API error inline. When
    `NEXT_PUBLIC_DEMO === "1"`, show "Try the demo as a brand" and "…as a
    creator" links to `/demo/brand` and `/demo/creator`.
  - **`/demo/[role]`:** only works when `NEXT_PUBLIC_DEMO === "1"` (otherwise
    it calls `notFound()`).
    - It logs in with the seeded account (`brand@ugc-demo.in` or
      `creator@ugc-demo.in`, password `demo-pass-123`, the test values from
      `api/app/seed.py`).
    - It saves the token and redirects to `?next=` or the role's home.
    - It is used by the demo buttons and by ui-craft's audit.

- [ ] **Step 8: Web container.** Write `web/Dockerfile`:
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_DEMO=1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_PUBLIC_DEMO=$NEXT_PUBLIC_DEMO
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```
Its `.dockerignore` should list `node_modules` and `.next`. Add this to compose:
```yaml
  web:
    build: ./web
    ports:
      - "3000:3000"
    depends_on:
      - api
```

- [ ] **Step 9: Verify**
  - `cd web && npm run lint && npm run build` succeeds.
  - Run `npm run dev` with the API running locally. Then:
    - sign up a new creator and land on `/creator`;
    - log out;
    - "Try the demo as a brand" lands on `/brand`;
    - visiting `/creator` as the brand redirects back to `/brand`.

- [ ] **Step 10: Commit**
```bash
git add web docker-compose.yml && git commit -m "feat(web): Next.js foundation, visual direction, auth and demo login"
```

---

### Task 11: Brand screens

**Files:**
- Create: `web/src/app/brand/page.tsx`, `web/src/app/brand/campaigns/new/page.tsx`, `web/src/app/brand/campaigns/[id]/page.tsx`, `web/src/app/brand/campaigns/[id]/edit/page.tsx`
- Create: `web/src/components/{campaign-form,slot-meter,payout-bill,timeline,review-panel}.tsx`

**Interfaces:**
- Consumes: the Task 10 lib and components, plus `/campaigns/mine`, `/campaigns`, `/campaigns/{id}`, `/campaigns/{id}/applications`, approve, decline, review and cancel.
- Produces: `<PayoutBill payout>`, `<Timeline events>` and `<SlotMeter campaign>`. Task 12 reuses them.

Every screen ships its **loading** (skeleton), **empty** and **error** (the API
`detail` and a retry) states. Every mutation shows a toast and calls SWR
`mutate` on the affected keys.

- [ ] **Step 1: `PayoutBill`** (reused on the creator side)
```tsx
import { formatINR } from "@/lib/money";
import type { Payout } from "@/lib/types";

export function PayoutBill({ payout }: { payout: Payout }) {
  const lines: [string, number][] = [
    ["Campaign fee", payout.fee_paise],
    ["Platform fee (10%)", -payout.platform_fee_paise],
    ["GST on platform fee (18%)", -payout.gst_paise],
    ["TDS (1%)", -payout.tds_paise],
  ];
  return (
    <dl className="tabular-nums">
      {lines.map(([label, amount]) => (
        <div key={label} className="flex justify-between gap-6 py-1">
          <dt>{label}</dt>
          <dd>{amount < 0 ? "−" : ""}{formatINR(Math.abs(amount))}</dd>
        </div>
      ))}
      <div className="flex justify-between gap-6 border-t pt-2 font-semibold">
        <dt>Credited to wallet</dt>
        <dd>{formatINR(payout.net_paise)}</dd>
      </div>
    </dl>
  );
}
```
Style it with the DESIGN.md tokens; keep the structure.

- [ ] **Step 2: `SlotMeter`**
  - It reads "Slots {filled} of {slots} · {reserved} reserved · {spent} paid ·
    {budget − reserved − spent} free".
  - It has a bar split into spent, reserved and free.
  - For a cancelled campaign, the free part is labelled "released".

- [ ] **Step 3: `CampaignForm`** (create and edit)
  - **Fields:** title, description, fee (₹, whole), slots, budget (₹, whole),
    application deadline and submission deadline. Both deadlines are
    `datetime-local` inputs labelled "(IST)".
  - **Budget auto-fill:** until the user edits the budget, it equals fee ×
    slots. The minimum is fee × slots.
  - **Live summary:** "₹50,000 covers 5 creators at ₹10,000 each".
  - **Client checks** mirror the server's (budget covers the slots,
    submission after application). The server message is still shown if it
    refuses.
  - **On submit**, send rupees × 100 as paise and `istInputToISO(...)` for the
    deadlines.
  - **In edit mode:**
    - prefill with `isoToISTInput`;
    - disable the fee with the hint "Locked: creators are approved" when
      `filled_slots > 0`;
    - set the slots minimum to `filled_slots`;
    - set the deadline minimums to their current values;
    - send only the fields that changed (PATCH).

- [ ] **Step 4: `/brand` dashboard**
  - **"Needs your attention":** campaigns with `counts.applied > 0` or
    `counts.to_review > 0`, as rows such as "3 applicants waiting · 1 post to
    review", each linking to the right tab.
  - **"All campaigns":** rows (not a card grid) with title, status, deadlines
    in IST and a compact `SlotMeter`.
  - **Empty state:** "No campaigns yet" with a "Create a campaign" button.

- [ ] **Step 5: `/brand/campaigns/new` and `/[id]/edit`.** Both use
  `CampaignForm`. After saving, go to the campaign page.

- [ ] **Step 6: `/brand/campaigns/[id]`**
  - **Header:** title, status, both deadlines (IST), Edit and Cancel buttons.
    Cancel opens a dialog explaining: "Pending applicants will be declined.
    Approved creators keep their spot and are still paid for approved posts."
  - **`SlotMeter`** in full.
  - **Tabs (default to the first non-empty one):**
    - **Applicants (`applied`):** each row shows the creator's name, @handle and
      note, plus Approve and Decline. Decline uses an optional reason textarea
      in a popover.
      - Approve is disabled, with a tooltip giving the reason, when:
        - the campaign is cancelled;
        - `filled_slots >= slots` ("All slots are filled");
        - or now ≥ the submission deadline ("The submission deadline has
          passed").
    - **Approved (`approved`):** "Post due {IST}".
    - **Posts to review (`submitted`, `revision_requested`):** use
      `ReviewPanel`.
    - **Finished:** `paid`, `rejected`, `declined`, `withdrawn`, `expired`,
      each with its `PayoutBill` or reason.
  - **Every row** has a "History" toggle that shows `<Timeline events>`. Each
    event shows its `STATUS_LABEL`, note and time (IST).
  - **Polling:** refresh this page every 10s while it's open (SWR
    `refreshInterval`), so a new submission appears without a reload.

- [ ] **Step 7: `ReviewPanel`**
  - It shows the latest submission: the link (opens in a new tab), its mock
    caption, "Version n", and "Revisions used: n of 2".
  - It has three actions:
    - **Approve & pay:** confirms with "Pay {fee} to {name}? They'll receive
      the fee minus platform fee, GST and TDS."
    - **Request changes:** a required note. Disabled with "Both revisions used"
      once `revisions_left === 0`.
    - **Reject:** a required reason.

- [ ] **Step 8: Verify by running.** Start the API, the worker and
  `npm run dev`, then log in as the demo brand:
  - Approve Ravi and watch the meter update.
  - Review Meera's post: request changes, then check the creator side in Task
    12 later.
  - Create a campaign with a budget below fee × slots and check the error.
  - Edit: the fee is locked on "Rainy-day snack reels".
  - Cancel the second campaign and check the dialog copy.
  - Check at 1366×768 that Approve and Review are on the first screen.

- [ ] **Step 9: Commit**
```bash
git add web && git commit -m "feat(web): brand dashboard, campaign form, applicants and post review"
```

---

### Task 12: Creator screens

**Files:**
- Create: `web/src/app/creator/page.tsx` (explore), `web/src/app/creator/campaigns/page.tsx`, `web/src/app/creator/wallet/page.tsx`
- Create: `web/src/components/{fee-note,submit-post-form,withdraw-form,application-card}.tsx`

**Interfaces:**
- Consumes: `PayoutBill`, `Timeline`, `creatorNextStep`, `parseInstagramUrl`, `rupeesToPaise`, `formatINR` and `formatIST`, plus `/campaigns`, apply, `/applications/mine`, submissions, withdraw, `/wallet` and `/wallet/withdrawals`.

- [ ] **Step 1: `FeeNote`**
  - It exports
    `FEE_NOTE = "Platform fee (10%) + 18% GST on that fee, and 1% TDS are deducted from this at payout."`
    exactly.
  - Show it once as a note at the top of Explore.
  - Next to each fee, add "before deductions" with a tooltip showing
    `FEE_NOTE`.

- [ ] **Step 2: `/creator` (Explore)**
  - **Each campaign** shows: brand name, title, the description (clamped, with
    "More"), the **fee as the headline** ("₹10,000"), "{slots − filled} of
    {slots} slots left", and "Apply by {IST}".
  - **Apply** is one click, with an optional "Add a note" link that expands a
    500-character textarea.
    - Afterwards the button becomes a status: "Applied · waiting for the
      brand".
    - The toast reads "Applied. We'll let you know when the brand decides."
  - **When `my_application`** exists, show its status instead of Apply.
  - **Empty state:** "No open campaigns right now. New ones appear here as
    brands post them."

- [ ] **Step 3: `ApplicationCard` and `/creator/campaigns`**
  - **Groups:**
    - **"Needs your action":** `approved`, `revision_requested`
    - **"Waiting on the brand":** `applied`, `submitted`
    - **"Finished":** everything else
  - **Each card** shows: title, brand, fee, and `creatorNextStep` as either the
    primary button (action) or a quiet status line (waiting or done).
  - **`revision_requested`:** show the brand's latest note inline, e.g.
    "Changes requested (revision 1 of 2): Show the pack in the first 3
    seconds". Take it from the last event with `to_status ===
    "revision_requested"`.
  - **The action** opens `SubmitPostForm` inline:
    - a URL input with a paste button and a live check through
      `parseInstagramUrl`, showing either "Instagram reel ✓" or "Paste a link
      to an Instagram post or reel";
    - Submit is disabled until the link is valid;
    - API errors (not found, private, already used, deadline) appear inline.
  - **Withdraw** (only for `applied` or `approved`) asks for confirmation:
    "Withdraw from {title}? You can't re-apply to this campaign."
  - **`rejected`, `declined`, `expired`:** show the reason from the last
    event's note.
  - **`paid`:** shows `PayoutBill`, collapsed under "See payout".
  - **A "History" toggle** shows `<Timeline>`.
  - **Polling:** refresh every 10s.

- [ ] **Step 4: `/creator/wallet`**
  - **Top:** the balance (large, tabular) and `WithdrawForm`.
  - **`WithdrawForm`:**
    - an amount field (₹, decimals allowed, parsed with `rupeesToPaise`, which
      gives "Enter an amount like 500 or 499.50" if null);
    - a "Withdraw all" button that fills the exact balance;
    - a UPI ID field, prefilled from `wallet.upi_id`, with the hint "Payouts go
      to this UPI ID";
    - submitting calls `post("/wallet/withdrawals")`, toasts "Withdrawal
      started", and mutates.
  - **"Withdrawals" list:**
    - `processing` shows "Processing…" (refresh every 3s while any are
      processing);
    - `succeeded` shows "Sent to {upi} · {IST}";
    - `failed` shows "Failed: {reason}. {amount} is back in your wallet." with
      a **Try again** button that fills the form with the same amount.
  - **"Ledger" table:** date (IST), what ("Payout: {campaign_title}" /
    "Withdrawal" / "Refund"), amount (+/−), running balance. Payout rows expand
    to `PayoutBill`.
  - **Empty state:** "No money yet. Approved posts are paid here."

- [ ] **Step 5: Verify by running,** as the demo creator (Asha):
  - The wallet shows ₹8,731.80 and the bill adds up.
  - Withdraw ₹1,000 to `asha@okbank` and watch it go processing → succeeded.
  - Withdraw to `fail@okbank` and watch it fail with a refund and Try again.

  Then as a new creator:
  - Apply to "Rainy-day snack reels".
  - As the brand, approve; as the creator, submit an invalid link and see the
    live hint.
  - Submit `https://www.instagram.com/p/missing1/` and see "couldn't find".
  - Submit a valid link; as the brand, request changes; check the note appears
    inline; resubmit; as the brand, approve; check the bill appears.

  Check everything at 390×844.

- [ ] **Step 6: Commit**
```bash
git add web && git commit -m "feat(web): creator explore, applications with next step, wallet and withdrawals"
```

---

### Task 13: Inbox, settings, ui-craft verification

**Files:**
- Create: `web/src/app/inbox/page.tsx`, `web/src/app/settings/page.tsx`
- Modify: whatever the scans flag

- [ ] **Step 1: `/inbox`** (both roles)
  - The list is `GET /notifications`, refreshed every 5s.
  - **Each row:** channel (Email or WhatsApp), body and created time (IST),
    with a status line:
    - `sent`: "Sent {IST}"
    - `queued` with `send_at` in the future: "Held until {IST} (quiet hours
      9 PM to 9 AM)"
    - `queued` and due: "Sending…"
    - `skipped`: "Not sent: {skip_reason}"
  - **Filter chips:** All / Held / Sent / Not sent.
  - **A short note** at the top explains this is where the mock email and
    WhatsApp messages land.
  - **Empty state:** "Nothing yet. Updates about your campaigns show up here."

- [ ] **Step 2: `/settings`** (both roles)
  - Name and email are read-only.
  - **Phone:** shows "Needed for WhatsApp".
  - **UPI ID:** creators only.
  - **An Email toggle and a WhatsApp toggle.** Each `PATCH /me`s at once and
    toasts "Saved".
  - When there's no phone, the WhatsApp toggle still works, but the helper
    text says "Add a phone number to receive WhatsApp messages".

- [ ] **Step 3: ui-craft Step 6, the scans.** Run with the full stack up
  (`docker compose up` or the local dev servers) and the seed loaded:
```bash
cd ~/.claude/skills/ui-craft/scripts
node audit.mjs http://localhost:3000 /login /signup "/demo/brand?next=/brand" "/demo/brand?next=/brand/campaigns/new" "/demo/brand?next=/brand/campaigns/1" "/demo/creator?next=/creator" "/demo/creator?next=/creator/campaigns" "/demo/creator?next=/creator/wallet" "/demo/creator?next=/inbox" "/demo/creator?next=/settings"
node slop-scan.mjs http://localhost:3000/login
node slop-scan.mjs "http://localhost:3000/demo/creator?next=/creator/wallet"
```
  - `audit.mjs` must exit 0: no blank viewports, contrast passes, every control
    is focusable with a visible ring, and each page has one `h1` and one
    `main`.
  - Treat each failure as a hypothesis and verify it before changing the page.
  - If the audit catches the page mid-redirect, check whether the route
    actually renders before changing anything.
  - `slop-scan` is advisory. For every signal it raises, either fix it or write
    the reason in DESIGN.md.

- [ ] **Step 4: One batch of fixes, one confirming run, then stop**
  (ui-craft's bounded passes). If a third batch seems necessary, stop and tell
  the user, because it means the direction is wrong.

- [ ] **Step 5: Commit**
```bash
git add web && git commit -m "feat(web): notification inbox and settings; ui-craft audit fixes"
```

---

### Task 14: README, AI logs, leak check, final verification, push

**Files:**
- Create: `README.md`, `docs/ai-logs/README.md`, `docs/ai-logs/01-planning.md`, `docs/ai-logs/0N-build-*.md`
- Modify: `.claude/plan/campaigns/IMPLEMENTATION.md`, `.claude/plan/campaigns/TESTING.md`, `.claude/HISTORY.md`

- [ ] **Step 1: README.md** with these sections, in this order:
  1. **What this is** (two sentences) and **Run it**:
     - `docker compose up --build`, then http://localhost:3000. API docs are at
       http://localhost:8000/docs.
     - The demo accounts (brand@ugc-demo.in, creator@ugc-demo.in,
       ravi@ugc-demo.in and meera@ugc-demo.in, all with `demo-pass-123`), or
       the demo buttons on the login page.
     - How to trigger every mock branch: a UPI ID starting with `fail` fails;
       Instagram links whose shortcode starts with `missing` or `private`.
     - How to see quiet hours: the Inbox shows held messages.
     - Local dev without Docker: the venv, `alembic upgrade head`, `uvicorn`,
       `python -m app.worker`, `npm run dev`.
  2. **Assumptions:** the 12 numbered assumptions from SPEC.md.
  3. **Key decisions and why.** One short paragraph each:
     - FastAPI + Postgres + Next.js, API-first for a future mobile client;
     - integer paise, with net as the remainder;
     - a conditional UPDATE for reservations (rather than read-then-write or
       SERIALIZABLE);
     - one `move()` choke point, so "every state change notifies" can't be
       forgotten;
     - a Postgres outbox plus a polling worker with SKIP LOCKED (rather than
       Celery/Redis or FastAPI BackgroundTasks, which can't hold a message
       until 9 AM or survive a restart);
     - quiet hours checked at both queue and send time;
     - opt-outs checked at send time;
     - the wallet balance and ledger written together under a CHECK ≥ 0;
     - the payout unique per application plus a row lock;
     - deterministic mocks;
     - sync SQLAlchemy for readability;
     - JWT Bearer, usable by web and mobile alike;
     - tests on real Postgres.
  4. **What we'd do differently from the existing flow:** the Task 0 findings
     next to our friction reducers. Show a table with "Implemented ✓" or "Next"
     against each.
  5. **Known gaps:**
     - no real integrations;
     - mock Instagram doesn't verify post ownership;
     - no KYC or PAN (in reality, TDS without a PAN is higher);
     - the payout provider is called inside the DB transaction (fine for a
       mock; a real one needs an idempotency key, webhooks and
       reconciliation);
     - no pagination;
     - N+1 queries in the lists;
     - the token in localStorage (XSS exposure), with no refresh tokens, rate
       limiting or password reset;
     - no admin view of platform fees and taxes collected (the data is in
       `payouts`);
     - stalled revision requests never time out;
     - no frontend unit tests (the UI is checked by the ui-craft scans and
       manual runs);
     - bcrypt's 72-byte password limit;
     - only one worker process has been tried.
  6. **Tests:** how to run them (`docker compose up -d db`, then
     `cd api && .venv/bin/pytest`). Name the **three riskiest parts and why**:
     - money (mistakes are irreversible and involve tax);
     - slot and budget reservation under concurrency (races never show up in
       manual testing);
     - notification timing (timezone bugs, and 2 AM messages, go unnoticed).

     Map each to its test file.
  7. **AI logs:** a pointer to `docs/ai-logs/`.

  Write it in plain sentences. Follow ui-craft's copy rules here too.

- [ ] **Step 2: AI logs**
  - **Export the build session(s).** Use the desktop app's transcript export,
    or ask Claude to export them. Save them as
    `docs/ai-logs/02-build-<topic>.md` and so on.
  - **For the planning session**, write `docs/ai-logs/01-planning.md` as a
    **cleaned summary**. Keep:
    - the user's prompts;
    - the decisions;
    - the assistant's approach and assumptions;
    - the gap check.

    Remove:
    - every reference to the author's employer, its apps, internal file paths
      and endpoints;
    - any personal context unrelated to this assignment.

    Replace the exploration of other apps with one neutral line: "Reviewed
    general UX patterns from creator-campaign apps I've worked on; only generic
    patterns were carried over."
  - **`docs/ai-logs/README.md`** lists the files and says that 01 is a cleaned
    summary.
  - **Show `01-planning.md` to the user** and get their OK before committing.

- [ ] **Step 3: Fresh-clone verification**
```bash
"$(git rev-parse --git-common-dir)/../.claude/leak-check.sh"
cd api && .venv/bin/pytest && cd ..
cd web && npm run lint && npm run build && cd ..
rm -rf /tmp/ugc-verify && git clone . /tmp/ugc-verify && cd /tmp/ugc-verify
docker compose down -v; docker compose up --build -d && sleep 20
curl -s localhost:8000/health
```
  Use the scratchpad directory instead of `/tmp` if one is available.
  Then click through the whole brief in the browser on the fresh stack. Write
  down anything that breaks, and fix it before going further.

- [ ] **Step 4: Update the memory files.**
  - In `IMPLEMENTATION.md`, collapse every task to a dated line.
  - Make `TESTING.md` match the final inventory.
  - Add one line to `HISTORY.md`.

- [ ] **Step 5: Commit and push.** Run the leak check again, then commit and push.
```bash
"$(git rev-parse --git-common-dir)/../.claude/leak-check.sh"
git add README.md docs .claude AGENTS.md && git commit -m "docs: README with assumptions, decisions, friction comparison, gaps; AI logs"
git push origin HEAD:main
```
Give the user the public repo link: https://github.com/chetan2921/ugc-campaigns
