# campaigns testing

## Run
| Part | Command |
|------|---------|
| api | `cd api && .venv/bin/pytest` (uses `TEST_DATABASE_URL` from `api/.env`: a separate Neon database ending in `_test`) |
| api, one suite | `.venv/bin/pytest tests/test_money.py -k parallel` |
| web | `cd web && npm run lint && npm run build` |
| web UI checks | ui-craft `audit.mjs` and `slop-scan.mjs` against the running app (PLAN Task 13) |

## Known-good examples
Fill these in as tasks land.
- service-level test with factories: `api/tests/test_reservation.py`
- concurrency test: `test_parallel_approvals_never_overfill_the_last_slot`
- HTTP test with auth headers: `api/tests/test_api_flow.py`

## Strategies that work here
- **Real Postgres, never SQLite or mocks, for anything with locks, CHECKs or
  `SKIP LOCKED`.** The schema is created with `create_all` per test session,
  and tables are truncated after each test.
- **Tests run only against the `_test` database.** conftest refuses to start
  unless `TEST_DATABASE_URL` is set and differs from `DATABASE_URL`, and
  `test_tests_run_on_the_test_database` checks the database name.
- **Neon is remote,** so the suite is slower than local Postgres would be.
  Keep the Neon region close (Mumbai or Singapore).
- **Time is a parameter, not a patch.** Services and worker steps take `now`.
  Tests pass `NOW` (12:00 IST) or `ist(day, hour)` from
  `test_notifications.py`. Never freeze the clock.
- **Concurrency:** `factories.run_concurrently(*calls)` runs each call in its
  own thread and session, released together by a `threading.Barrier`. Capture
  ids (`brand.id`) before the threads start, because ORM objects can't cross
  sessions or threads.
- **After an expected `DomainError`,** call `db.rollback()` before reading more
  from the same session.
- **Re-run the `-k parallel` tests five times** whenever reservation, payout or
  withdrawal code changes.

## Inventory (planned)
| Area | Unit | Integration (service + DB) | E2E (HTTP) | Notes |
|------|------|-----------------------------|------------|-------|
| Money: bill maths, INR format | test_money | test_money (payout once, parallel approve, withdraw, refund, overdraw) | test_api_flow | risky #1 |
| Reservation: slots and budget | | test_reservation (parallel approve, release on withdraw, reject, expire; cancel keeps approved) | | risky #2 |
| Notifications: quiet hours, opt-out | test_notifications (next_send_at) | test_notifications (held until 9, overdue waits, opt-out at send, no phone, who is notified) | | risky #3 |
| State table | test_states | | | |
| Auth | | | test_auth | |
| Campaign rules | | test_campaign_rules | | |
| Submissions | | test_submissions | | |
| Roles and errors over HTTP | | | test_api_flow | |

## Gaps
- No frontend unit tests. The UI is checked by the ui-craft scans and a manual
  click-through.
- Alembic migrations aren't exercised by pytest (it uses `create_all`). The
  fresh-clone run in Task 14 (`alembic downgrade base`, then `./dev.sh`)
  covers them.
