# campaigns

Goal: alpha-quality take-home. A working slice reviewers can start with one
command and click through end to end. Money, slots and notifications get
production-grade care and tests; everything else is deliberately plain so the
author can explain every line on a live call.

Repos: this repo only. `api/` is FastAPI, `web/` is Next.js. A Flutter client
may consume `api/` later, so the API is the product and the web app is one
client of it.

Source: UGCIndia full-stack intern brief, 2026-10-09. Their existing flow
(ugccontent.in) must not be copied; the README explains what we do
differently.

## Who and what

- **Brands** run paid UGC campaigns: set a fee per creator, a number of slots,
  a budget and two deadlines, pick creators, review their Instagram posts, and
  pay on approval.
- **Creators** find campaigns, apply in one click, submit their post link, get
  paid into a wallet, and withdraw to UPI.
- **Problem:** this usually takes many steps, and creators can't see where
  their money is. **Aim:** fewer steps, every status explains itself, and every
  rupee is accounted for.

## Flows

### Sign up and log in
1. The signup screen asks for a role first (Brand or Creator), then name, email
   and password (8–72 characters).
2. Creators also give their Instagram handle (required) and a phone number
   (optional, with the helper "Add it to get WhatsApp updates").
3. There is no email verification and no OTP. Signup logs you straight in.
4. Login takes email and password. A wrong password shows "Wrong email or
   password".
5. Each role lands on its own dashboard.
6. When `NEXT_PUBLIC_DEMO=1`, the login page shows "Try as brand / Try as
   creator" buttons that log in with the seeded demo accounts.

### Brand: create a campaign
1. Fields: title, description, fee per creator (whole ₹), slots, budget (whole
   ₹), application deadline and submission deadline. Deadlines are entered and
   shown in IST.
2. The budget pre-fills as fee × slots and updates live. The brand may raise it
   but not lower it below fee × slots. A summary line reads, for example,
   "₹50,000 covers 5 creators at ₹10,000 each".
3. Validation:
   - the budget is at least fee × slots;
   - the application deadline is in the future;
   - the submission deadline is after the application deadline.
4. Every error message says what to change.

### Creator: browse and apply
1. Explore lists campaigns that are still accepting applications: active, before
   the application deadline, and with a free slot.
2. Each campaign shows the headline fee (e.g. "₹10,000"). Under it: "Platform
   fee (10%) + 18% GST on that fee, and 1% TDS are deducted from this at
   payout." No net figure is shown before payout.
3. Applying takes one click. An optional note (max 500 characters) can be
   added. The Instagram handle comes from the profile.
4. A creator applies to a campaign at most once. Withdrawing is final.

### Brand: pick creators
1. The campaign page shows a live meter: "Slots 3 of 5 · ₹30,000 reserved ·
   ₹10,000 paid · ₹10,000 free".
2. Pending applicants have Approve and Decline buttons. Decline takes an
   optional reason.
3. Approving reserves the fee from the budget atomically. When no slot or
   budget is left, or the submission deadline has passed, Approve is disabled
   and says why.
4. The brand can approve pending applicants until the submission deadline.

### Creator: withdraw from a campaign
Allowed while the application is `applied` or `approved` (that is, before the
first submission). Withdrawing from `approved` frees the slot and the reserved
fee.

### Creator: submit the post
1. The creator pastes an Instagram link, which is checked as they type and
   again on the server. It must be on instagram.com with a `/p/`, `/reel/`,
   `/reels/` or `/tv/` path.
2. The mock Instagram lookup then returns one of three results:
   - found: the caption is stored and shown to the brand;
   - not found;
   - private.
3. The same post can't be used for a different application.
4. The first submission must arrive before the submission deadline.
   Resubmissions after a revision request are not bound by the deadline,
   because the brand asked for them.

### Brand: review
On a `submitted` post the brand can:
- **Approve & pay.** The payout runs immediately (see Payout).
- **Request changes.** A note is required. At most 2 revisions are allowed, and
  both sides see "Revision 1 of 2".
- **Reject.** A reason is required. This frees the slot and the reserved fee.

### Payout
The payout happens in one transaction:
1. The application becomes `paid`.
2. A payout record stores the full bill (at most one per application).
3. The creator's wallet is credited with the net amount, and a ledger entry
   records it.
4. The campaign moves the fee from `reserved` to `spent`.
5. The notifications are queued.

### Wallet and withdrawal
1. The wallet shows the balance and a ledger, newest first, with a running
   balance. Payout rows expand into the bill (see Money rules).
2. To withdraw, the creator enters an amount (or taps "Withdraw all") and a UPI
   ID. The UPI ID is remembered after the first use. There is no PAN or KYC.
3. The amount is debited (put on hold) immediately and the withdrawal is
   `processing`.
4. The worker then calls the mock payout provider:
   - **Success:** the withdrawal becomes `succeeded`.
   - **Failure:** the withdrawal becomes `failed` with a reason, the money is
     refunded to the wallet as a `refund` ledger entry, and the creator sees
     "Try again".
5. The mock fails whenever the UPI ID starts with `fail`, so a demo can trigger
   a failure on purpose.

### Notifications
- Every state change notifies whoever is affected, except the person who did it
  (see the matrix below).
- Each notification is queued for both channels, email and WhatsApp, in the
  same transaction as the change.
- Quiet hours run from 21:00 to 09:00 IST. A message created during quiet hours
  is scheduled for the next 09:00 IST.
- At send time:
  - Nothing goes out during quiet hours, even if it is overdue (for example,
    the worker was down).
  - Opt-outs are checked when sending, not when queuing. An opted-out channel
    is marked `skipped` with the reason.
  - WhatsApp without a phone number is `skipped` with "No phone number".
- The mock senders log the message. The Inbox page shows each user what was
  sent, what's held until 9 AM, and what was skipped and why.
- Settings has an Email toggle and a WhatsApp toggle.

### Campaign edit and cancel
**Edit:**
- Title and description can change at any time.
- The fee is locked once any creator is approved.
- Slots can't drop below the number already approved.
- The budget must still cover fee × slots.
- Deadlines can only be extended.
- Cancelled campaigns can't be edited.
- Every live applicant is notified of the edit.

**Cancel:**
- Pending applicants are declined with the reason "The brand cancelled the
  campaign".
- Approved creators keep their slot, can still submit, and are paid on approval
  ("Approved creators cannot be removed").
- Budget that was neither reserved nor spent is shown as released.

### Deadlines (worker)
At the submission deadline, the worker:
- moves `approved` applications to `expired`, which frees the slot and the
  reserved fee and notifies both the creator and the brand;
- moves `applied` applications to `declined` with "The campaign closed before
  your application was reviewed".

## Money rules

- All amounts are integers in **paise**, from the database through the API.
  Rupees appear only in the UI.
- Fees and budgets are whole rupees, so they are multiples of 100 paise.
- The bill for a fee F:
  - `platform_fee = round(F × 10%)`
  - `gst = round(platform_fee × 18%)`
  - `tds = round((F − platform_fee − gst) × 1%)`
  - `net = F − platform_fee − gst − tds`
- Each line is rounded half-up to the paisa. Because net is the remainder, the
  bill always adds up exactly.
- Worked example, F = ₹10,000:

  ```
  Campaign fee                 ₹10,000.00
  − Platform fee (10%)         −₹1,000.00
  − GST on platform fee (18%)    −₹180.00
  − TDS (1%)                      −₹88.20
  Credited to wallet            ₹8,731.80
  ```

- The wallet balance has a database CHECK (≥ 0) and changes only alongside a
  ledger entry, so the balance always equals the sum of the ledger.
- Campaign invariants, enforced by CHECK constraints:
  - `0 ≤ filled_slots ≤ slots`
  - `reserved + spent ≤ budget`

## Lifecycles

The application state machine is defined in one module:

| From | To |
|---|---|
| applied | approved, declined, withdrawn |
| approved | submitted, withdrawn, expired |
| submitted | paid, revision_requested, rejected |
| revision_requested | submitted |

- Terminal states: declined, withdrawn, expired, paid, rejected.
- A slot is held in: approved, submitted, revision_requested, paid.
- Withdrawal: `processing → succeeded | failed`.
- Notification: `queued → sent | skipped`.
- Campaign: `active | cancelled`. "Accepting applications" is derived:
  active, before the application deadline, and with a free slot.

## Notification matrix

| Event | Notified |
|---|---|
| Creator applies | Brand |
| Application approved / declined | Creator |
| Creator withdraws | Brand |
| Post submitted or resubmitted | Brand |
| Changes requested / post rejected / paid | Creator |
| Withdrawal succeeded / failed | Creator |
| Campaign edited | All live applicants |
| Campaign cancelled | Pending applicants (as a decline); approved creators ("your spot is safe") |
| Submission deadline missed | Creator and brand |

Events with no other affected person (campaign created, withdrawal requested)
send nothing.

## Assumptions (copied into the README)

1. Platform fee, GST and TDS come out of the creator's fee. The fee is the
   headline everywhere, and the bill appears at payout.
2. TDS is 1% of the payout after platform fee and GST. Each line is rounded
   half-up and net is the remainder.
3. Cancelling declines pending applicants. Approved creators keep their slot
   and are paid on approval. Only unreserved budget is released.
4. After the first approval the fee is locked, slots can't drop below the
   approved count, and deadlines can only be extended.
5. Rejecting a post, a creator withdrawing, or a missed deadline frees the slot
   and the reserved fee.
6. The campaign budget is treated as pre-funded (mocked). There is no brand
   wallet or payment step.
7. Applications close at the application deadline. Brands can approve pending
   applicants until the submission deadline.
8. Revision resubmissions are not bound by the submission deadline.
9. "WhatsApp or email" means every channel the user hasn't opted out of. The
   phone number is optional; without one, WhatsApp is skipped.
10. The payout destination is a UPI ID, captured at the first withdrawal. There
    is no PAN or KYC.
11. One application per creator per campaign. Withdrawing is final.
12. All deadlines are entered and shown in IST.

## Friction reducers

**Built:**
1. A clear payout bill, from fee to credit.
2. One next-step button per application, with reasons shown inline and a
   timeline of what happened.
3. The budget pre-fills from fee × slots, and the approval screen has a live
   slot/budget meter.
4. Revision requests require a note, and "Revision n of 2" is visible to both
   sides.
5. Failed withdrawals are refunded automatically, with "Try again" and
   "Withdraw all".
6. Real per-channel notification toggles, and an Inbox that shows held
   messages.
7. A "Needs your attention" section on both dashboards.
8. The Instagram link check as you type, plus the mock post lookup.

**README only (we would do these next):**
- Review a draft before it's posted publicly, so creators don't end up with a
  rejected public post.
- Auto-approve if the brand doesn't review within 72 hours.
- One 9 AM digest instead of many separate messages.
- Fill freed slots automatically from a waitlist.
- Deadline reminders.

Refine this list after Task 0 (the ugccontent.in walkthrough).

## Milestones

1. **API core.** Done when `pytest` is green, including the three risky suites,
   and the API flow test runs a campaign through to a paid wallet.
2. **Worker.** Done when withdrawals settle (success and failure), held messages
   go out at 09:00 IST, and missed deadlines expire.
3. **Web.** Done when a reviewer can log in as the demo brand and the demo
   creator and do every step of the brief from the UI.
4. **Submission.** Done when `docker compose up` on a clean clone works, the
   README has all four sections, the AI logs are in `docs/ai-logs/`, the leak
   check passes, and the repo is pushed.

**Not in scope:** real integrations, KYC/PAN, a brand wallet or payment,
pagination, an admin panel, draft review, refresh tokens, rate limiting, and
frontend unit tests.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Front end | Next.js (App Router, TypeScript), Tailwind, shadcn/ui, SWR | Asked for by the author. A thin client over the API. SWR handles loading and error states with very little code. |
| Back end | FastAPI, sync SQLAlchemy 2.0, Pydantic v2, Alembic | The company's stack. Sync code is simpler to explain, and FastAPI runs sync routes in a threadpool. |
| Data | Postgres 17 | Transactions, row locks, conditional updates, CHECK constraints and `SKIP LOCKED` queues: the risky parts rely on all of these. |
| Queue / worker | A Postgres table plus a `python -m app.worker` polling loop | Durable, written in the same transaction as the change, supports scheduled sends, and needs no Redis or Celery. |
| Auth | Email + bcrypt, JWT (HS256, 7 days) as a Bearer token | The same token works for the web app and a future Flutter app. |
| Tests | pytest against a real Postgres `ugc_test` database | Concurrency and constraints can't be tested on SQLite or with mocks. |
| Hosting | `docker compose up` (db, api, worker, web) | The brief asks for a repo link. One command lets reviewers run it. |

## Architecture

```
web (Next.js) ──HTTP/JSON──► api (FastAPI) ──► services ──► Postgres
                                                   │
                         notifications, withdrawals tables (the queue)
                                                   │
                                     worker ──► mock email / WhatsApp
                                            ──► mock payout provider
                                  services ──► mock Instagram (on submit)
```

- `domain/` holds pure functions: money, IST and quiet hours, and the state
  table. `services/` holds one function per use case, and each commits its own
  transaction. Routers stay thin. `presenters.py` shapes the responses.
- The API shape lives in `.claude/contracts/api-surface.md`.
- Data model: `users`, `wallets`, `campaigns`, `applications`,
  `application_events`, `submissions`, `payouts`, `ledger_entries`,
  `withdrawals`, `notifications`.

## Confidentiality

Nothing in this repo, its commits, the README or the AI logs may mention the
author's employer, its products or any other local project.
A private, git-excluded leak check enforces this and runs before every push
(see AGENTS.md).
