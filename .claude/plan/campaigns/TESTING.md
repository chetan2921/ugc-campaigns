# campaigns testing

## Run
| Part | Command |
|------|---------|
| api | `cd api && .venv/bin/pytest` (uses `TEST_DATABASE_URL` from `api/.env`: a separate Neon database ending in `_test`; dev deps include `httpx2` so Starlette TestClient stays warning-free) |
| api, one suite | `.venv/bin/pytest tests/test_money.py -k parallel` |
| web | `cd web && npm run lint && npm run build` |
| web UI checks | ui-craft `audit.mjs` and `slop-scan.mjs` against the running app (PLAN Task 13) |

## Known-good examples
Fill these in as tasks land.
- health and test-db guard: `api/tests/test_health.py`
- auth signup/login over HTTP: `api/tests/test_auth.py` (factories in `api/tests/factories.py`)
- payout bill and INR format: `api/tests/test_money.py`
- quiet hours (`ist()` helper): `api/tests/test_notifications.py`
- send waits out quiet hours, including overdue messages: `test_message_created_at_night_waits_until_9am`, `test_overdue_message_still_waits_out_quiet_hours`
- opt-out and missing phone are decided at send time: `test_opt_out_is_checked_when_sending`, `test_whatsapp_needs_a_phone_number`
- each status change notifies the other side: `test_each_step_notifies_the_other_side`
- missed deadline expires approved and declines pending: `test_missed_deadline_expires_and_frees_the_slot`
- a submitted post is left alone at the deadline: `test_deadline_job_leaves_submitted_posts_alone`
- application state table: `api/tests/test_states.py`
- service-level test with factories: `api/tests/test_reservation.py`
- campaign create/edit/cancel rules: `api/tests/test_campaign_rules.py`
- cancel declines pending and keeps approved creators: `test_cancelling_declines_pending_but_keeps_approved_creators`
- cancel raced with apply and withdraw: `test_racing_cancel_keeps_approved_and_leaves_no_applied_row`
- concurrency test: `test_parallel_approvals_never_overfill_the_last_slot`
- submit, revise, and reject rules: `api/tests/test_submissions.py`
- payout credits the net once: `test_approving_a_post_credits_the_net_amount`, `test_approving_twice_pays_once`
- parallel payout of one post: `test_parallel_approvals_of_one_post_pay_once`
- withdrawal holds the money and remembers the UPI ID: `test_withdrawal_holds_the_money_straight_away`
- withdrawal overdraw and missing UPI: `test_cannot_withdraw_more_than_the_balance`, `test_withdrawal_needs_a_upi_id`
- parallel withdrawals cannot overdraw: `test_parallel_withdrawals_cannot_overdraw`
- failed payout refunds once: `test_failed_withdrawal_puts_the_money_back`, `test_settled_withdrawals_are_never_processed_twice`
- reject frees the slot: `test_rejecting_a_post_frees_the_slot`
- HTTP test with auth headers: `api/tests/test_api_flow.py`
- full campaign flow over HTTP, including revise, pay, withdraw, and one worker tick: `test_full_campaign_flow_over_http`
- wrong role is 403: `test_roles_are_enforced`
- a business refusal is a sentence: `test_business_errors_come_back_as_readable_messages`

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
- **Presenters are outside the service tests.** Task 5 checked create, list,
  apply, approve, get and cancel once through TestClient; that check was not
  kept. The lasting HTTP test is still Task 9's `test_api_flow.py`.
- **Re-run the `-k parallel` tests five times** whenever reservation, payout or
  withdrawal code changes. Task 4's last-slot test passed all five runs
  (about one minute each against Neon; that wait is the remote round-trips,
  not a hang). Task 6 ran the same `-k parallel` set five times (last-slot
  plus one-post payout): 2 passed each run, in 92s, 96s, 93s, 90s, and 155s.
  The slow fifth run still passed; the wait is Neon, not a deadlock.
  Task 7 ran the same `-k parallel` set five times (last-slot, one-post payout,
  and withdrawal overdraw): 3 passed each run, in 84.52s, 84.52s, 83.16s,
  84.40s, and 85.88s.
  Task 8 did not repeat that five-run. Deadline expiry takes the same
  campaign-then-application lock those tests already cover, and it is not on
  their path. The full suite, which includes the three parallel tests once,
  passed: 100 tests in 803.02s.
- **The HTTP flow test is a regression net.** It was written before the seed and
  `dev.sh`, and it passed on the first run (3 passed in 106.70s) because Tasks
  1–8 already implement that flow. It calls `run_once()` in-process. conftest
  points the app at the `_test` database before `app.db` is imported, so that
  tick settles the test withdrawal.
- **Seed writes the dev database, not the test one.** From `api/`,
  `.venv/bin/python -m app.seed`. The second run prints "Demo data already
  present" and returns. A crash after the brand user is inserted will also
  take that path, so a partial seed is not repaired by running it again.
- **One pytest process at a time** against the Neon `_test` database. A second
  process's `drop_all` or `TRUNCATE` deadlocks with the first and can make
  passing tests look like missing tables.
- **The same-post check is a read, not a unique index.** Two applications can
  still submit one URL at the same moment. The sequential test does not catch
  that race.
- **Slot updates use `synchronize_session=False`.** This session sees the new
  counts after its own `commit`, or after `expire_all()` when another session
  wrote them. `run_concurrently` returns `"ok"` or the `DomainError` message;
  it does not re-raise that error into the caller.

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
