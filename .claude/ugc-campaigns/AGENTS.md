# api

The FastAPI service for the UGC campaign marketplace. Brands create paid
campaigns. Creators apply, submit Instagram posts, and get paid into a wallet.
A polling worker expires missed deadlines, settles withdrawals, and sends
notifications. `web/` (Next.js) is the client. Its map is `.claude/web/AGENTS.md`.

## Stack
- Python, FastAPI, SQLAlchemy 2, Alembic, Postgres via psycopg
- JWT bearer auth, bcrypt passwords
- Money is integer paise. Every application status change goes through
  `services.transitions.move()`
- Lock order is the campaign row, then the application row

## Entry points
- API: `app.main:app` (`uvicorn app.main:app --reload --port 8000`)
- Worker: `python -m app.worker`
- Demo data: `python -m app.seed` (safe to run twice)
- All three: `./dev.sh` from the repo root. It migrates, seeds, then starts
  the API and the worker. When `web/` exists it starts that too. Ctrl-C stops
  them.

## Folder map
```
api/
  app/main.py            FastAPI app, CORS, domain-error handler, /health
  app/worker.py          polling loop: deadlines, withdrawals, notifications
  app/seed.py            idempotent demo accounts and campaigns
  app/auth.py            passwords, JWT, role dependencies
  app/config.py          settings from api/.env
  app/db.py              engine, session, Base
  app/models.py          ten tables
  app/schemas.py         request and response shapes
  app/presenters.py      ORM rows to response models
  app/errors.py          DomainError
  app/clock.py           utcnow
  app/domain/            payout maths, IST quiet hours, status table
  app/services/          campaigns, applications, submissions, wallet, notify
  app/routers/           HTTP routes
  app/mocks/             Instagram lookup, messaging, UPI payouts
  migrations/            Alembic
  tests/                 pytest against the separate _test database
```
Symbol lookup is `.claude/ugc-campaigns/STRUCTURE.md`. The HTTP shapes shared
with clients are `.claude/contracts/api-surface.md`.

## Commands
Run from `api/` with the venv, except `./dev.sh`, which is the repo root.

| What | Command |
|------|---------|
| tests | `.venv/bin/pytest` |
| one file | `.venv/bin/pytest tests/test_api_flow.py` |
| migrate | `.venv/bin/alembic upgrade head` |
| seed | `.venv/bin/python -m app.seed` |
| api | `.venv/bin/uvicorn app.main:app --reload --port 8000` |
| worker | `.venv/bin/python -m app.worker` |
| all of the above | `./dev.sh` |

Secrets stay in `api/.env`. Tests refuse to run unless `TEST_DATABASE_URL`
points at a different database whose name ends in `_test`.

<!-- mapped: .@09f5afd paths: api/app,api/tests -->
