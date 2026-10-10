# UGC campaigns

## What this is

Brands create paid campaigns, and creators apply and submit Instagram posts. Approving a post pays the creator's wallet, with a fee, GST and TDS bill, and the creator withdraws through a mock provider.

## Run it

1. Get a Postgres URL. A free Neon project works: create two databases, one of them ending in `_test`.
2. `cp api/.env.example api/.env` and fill it in.
3. `cd api && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt`
4. `cd web && npm ci`

Then run `./dev.sh` from the repo root and open http://localhost:3000. API docs are at http://localhost:8000/docs.

`./dev.sh` migrates, seeds, and starts the API, the worker, and the web app. Ctrl-C stops them. To run the pieces yourself:

```bash
cd api && .venv/bin/alembic upgrade head && .venv/bin/python -m app.seed
.venv/bin/uvicorn app.main:app --reload --port 8000
.venv/bin/python -m app.worker
cd web && npm run dev
```

Demo accounts, all with password `demo-pass-123`:

| Email | Who |
|---|---|
| brand@ugc-demo.in | Monsoon Snacks, the brand |
| creator@ugc-demo.in | Asha Rao, already paid on one campaign |
| ravi@ugc-demo.in | Ravi Menon, waiting on a decision |
| meera@ugc-demo.in | Meera Shah, post waiting for review |

The login page also has "Try the demo as a brand" and "Try the demo as a creator" when `web/.env.local` contains `NEXT_PUBLIC_DEMO=1`. The web app calls `http://localhost:8000` unless `NEXT_PUBLIC_API_URL` is set.

A UPI ID that starts with `fail` is declined, and the amount returns to the wallet. An Instagram link whose shortcode starts with `missing` is not found. One whose shortcode starts with `private` is a private post. The Inbox lists mock email and WhatsApp, including messages held for quiet hours (9 PM to 9 AM IST). Use the Held filter to see those.

## Assumptions

1. Platform fee, GST and TDS come out of the creator's fee. The fee is the headline everywhere, and the bill appears at payout.
2. TDS is 1% of the payout after platform fee and GST. Each line is rounded half-up, and net is the remainder.
3. Cancelling declines pending applicants. Approved creators keep their slot and are paid on approval. Only unreserved budget is released.
4. After the first approval the fee is locked, slots cannot drop below the approved count, and deadlines can only be extended.
5. Rejecting a post, a creator withdrawing, or a missed deadline frees the slot and the reserved fee.
6. The campaign budget is treated as pre-funded. There is no brand wallet or payment step.
7. Applications close at the application deadline. Brands can approve pending applicants until the submission deadline.
8. Revision resubmissions are not bound by the submission deadline.
9. "WhatsApp or email" means every channel the user has not opted out of. The phone number is optional. Without one, WhatsApp is skipped.
10. The payout destination is a UPI ID, captured at the first withdrawal. There is no PAN or KYC.
11. One application per creator per campaign. Withdrawing is final.
12. All deadlines are entered and shown in IST.

## Key decisions

FastAPI, Postgres and Next.js, with the API first so a future mobile client can use the same HTTP surface as the web app.

Money is integer paise from the database through the API. Rupees appear only in the UI. Each bill line is rounded half-up, and the net is whatever remains, so the lines always add up to the fee.

Reserving a slot and its fee is one conditional UPDATE: the WHERE clause checks that a free slot and enough budget still exist. A second approval of the last slot matches no row and is refused. That is a single statement, rather than read-then-write or a SERIALIZABLE transaction.

Every application status change goes through `services.transitions.move()`. The notification for that step is written there, so a new transition cannot forget to tell the other side.

Notifications are rows in Postgres, written in the same transaction as the change, and a polling worker sends them with `SKIP LOCKED`. A message can wait until 9 AM, and a restart does not drop the queue. Celery, Redis, or FastAPI BackgroundTasks cannot hold a message until morning or survive a process restart.

Quiet hours are checked when the message is queued and again when the worker sends it, so an overdue row still waits until 9 AM IST.

Opt-outs are checked at send time. Turning a channel off after the message was queued still skips that send. WhatsApp is also skipped when the user has no phone number.

The wallet balance and its ledger row are written together. A CHECK constraint keeps `balance_paise >= 0`, so the balance cannot drift from the ledger or go negative.

A payout is unique per application, and review locks the campaign row and then the application row. A second approve finds the payout already there and does not pay again.

Instagram lookup, email, WhatsApp and the payout provider are deterministic mocks. The same input always takes the same branch, which is what the tests and the demo rely on.

SQLAlchemy is synchronous. The code is easier to read that way, and FastAPI runs sync routes in a threadpool.

Auth is email and bcrypt, with a JWT (HS256, 7 days) sent as a Bearer token. The same token works for the web app and a future mobile client.

Tests run on real Postgres, in a separate database whose name ends in `_test`. The suite refuses to start if that URL is missing or is the same as the app database, because the tests wipe every table.

Postgres is hosted (Neon) rather than run in Docker. Setup is Python and Node, and any Postgres URL works. The reservation and payout rules need transactions, row locks, conditional updates, CHECK constraints and `SKIP LOCKED`.

## What we would do differently

These notes come from the public pages of an existing creator-campaign flow. Logged-in screens were not opened. Each row is what that flow leaves unclear, the reducer we chose, and whether this repo does it.

| Existing public flow | Reducer | Status |
|---|---|---|
| The fee is a ceiling, a range, about 2%, or about 8–12%, depending on the page. | One payout bill, from the fee down to the credit. The fee sentence is visible earlier. The net appears on the bill. | Implemented ✓ |
| Many tools and a thread, and no single next action. Statuses read like a menu. | One next step per application, the reason inline, and a timeline of what happened. | Implemented ✓ |
| The plan price, a wallet top-up, and the brief are separate money decisions, with no live slots or budget left. | The budget pre-fills from fee × slots, and the approval screen has a live slot and budget meter. A brand wallet stays out of scope. | Implemented ✓ |
| Two revision rounds, but the count can change. | A revision request requires a note, and both sides see "revision n of 2". | Implemented ✓ |
| The revision note may point at a moment in the video. | A note that points at a timestamp. | Next |
| Nothing public describes a failed bank transfer, a refund, or a retry. | A failed withdrawal is refunded. The wallet offers Try again and Withdraw all. | Implemented ✓ |
| Payment alerts are described as not shipped. WhatsApp on the brand side is a marketing broadcast, not a status message. | Real per-channel toggles, and an Inbox that shows held messages. | Implemented ✓ |
| One 9 AM digest instead of many separate messages. | A morning digest. | Next |
| After applying, the creator waits with no queue of what needs them. | The brand dashboard has "Needs your attention". The creator's campaign list has "Needs your action". | Implemented ✓ |
| Some jobs want a file and some want a public post. No link check is shown. | The Instagram link is checked as you type, and submit runs the mock post lookup. | Implemented ✓ |
| Review a draft on the platform before it has to be public, and allow a campaign that does not need a post on the creator's account. | Draft review, and a file-only campaign. | Next |
| Usage is not named before anyone applies. | Name organic, paid ads, or a whitelist, and for how long, on the campaign. | Next |
| A brand can leave a post in review with no clock. | Auto-approve if the brand does not review within 72 hours. | Next |
| A freed slot waits for someone new to find the campaign. | Fill freed slots from a waitlist. | Next |
| Deadlines pass with no reminder. | Deadline reminders. | Next |

A brand wallet, subscriptions, creator tiers, and invites stay out. Showing a pre-computed net before payout was considered and turned down. The fee stays the headline, and the bill appears at payout.

## Known gaps

- No real Instagram, email, WhatsApp, or payout provider. The mocks stand in for all of them.
- The mock Instagram lookup does not check that the creator owns the post.
- No KYC or PAN. In reality, TDS without a PAN is higher.
- The payout provider is called inside the database transaction. That is fine for a mock. A real provider needs an idempotency key, webhooks, and reconciliation.
- No pagination.
- List endpoints do N+1 queries.
- The token is in localStorage, so an XSS bug can read it. There are no refresh tokens, no rate limiting, and no password reset.
- No admin view of platform fees and taxes collected. The amounts are on the `payouts` rows.
- A revision request that the creator never answers does not time out.
- No frontend unit tests. The UI is checked by the ui-craft scans and by manual runs.
- bcrypt only hashes the first 72 bytes of a password. Signup and login reject anything longer.
- Only one worker process has been tried. The queue uses `SKIP LOCKED`, but a second process has not been run.

## Tests

From `api/`, with `TEST_DATABASE_URL` set in `api/.env` to a database whose name ends in `_test`:

```bash
cd api && .venv/bin/pytest
```

The three riskiest parts:

| Risk | Why | Tests |
|---|---|---|
| Money | A wrong credit is hard to undo, and the bill includes tax. | `api/tests/test_money.py` |
| Slot and budget reservation under concurrency | Two approvals can race for the last slot. That race does not show up in a manual click-through. | `api/tests/test_reservation.py` |
| Notification timing | A timezone mistake, or a message sent at 2 AM, is easy to miss. | `api/tests/test_notifications.py` |

## AI logs

The AI logs live in `docs/ai-logs/` and will be added after the author reviews them.
