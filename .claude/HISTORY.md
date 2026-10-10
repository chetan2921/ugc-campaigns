- 2026-10-10 planning: brief analysed and gap-checked; assumptions agreed; spec, plan, API contract and memory tree written. No code yet.
    Stack: FastAPI + Postgres + Next.js, chosen over a Next.js-only full stack.
    FastAPI is the hiring company's stack, and an API-first backend can serve a
    future mobile client. Fee display: the fee is the headline, and platform
    fee, GST and TDS appear as deductions on the payout bill (the author's
    call). A pre-computed net shown up front was the alternative.
- 2026-10-10 repo: the planning tree (AGENTS.md, CLAUDE.md, .claude/) is committed and the GitHub repo is public, both at the author's request, to show the AI workflow. Only the private leak-check script stays git-excluded. The build continues in a fresh session.
- 2026-10-10 database: hosted Postgres on Neon, replacing Postgres in Docker. The author doesn't want Docker, and MongoDB was also considered. Kept Postgres because the payout and slot-reservation logic depends on transactions, CHECK constraints and conditional updates; Neon gives a connection URL like Atlas would. Tests use a separate `_test` database and refuse to run otherwise. `dev.sh` replaces docker compose.
- 2026-10-10 walkthrough: public pages of the existing UGC site, no account. Notes in `.claude/plan/campaigns/ugcindia-notes.md`. README-only list gained usage-on-the-campaign, a file-only option, and timestamped revision notes. Build scope unchanged: no brand wallet, no tiers, no invites, net still appears on the payout bill.
- 2026-10-10 Task 1: api scaffold (FastAPI, SQLAlchemy/psycopg, settings, `/health`, conftest `_test` guard), pinned deps, pytest and leak check green; not pushed (controller reviews first).
- 2026-10-10 Task 2: ten-table data model, Alembic initial schema, signup/login with roles; auth and health tests green. Not pushed.
- 2026-10-10 Task 3: payout maths, IST quiet hours and the application state table; domain tests green with health and auth. Not pushed.
- 2026-10-10 Task 4: apply, approve with atomic slot and budget reservation, decline, withdraw; reservation tests green, including five parallel last-slot runs. Not pushed.
- 2026-10-10 Task 5: campaign create/edit/cancel rules, presenters, and campaign/application routes; campaign-rule and reservation tests green. Not pushed.
- 2026-10-10 Task 5 review: lock the campaign row before its applications on apply, approve, decline, withdraw, and cancel, and re-check status under those locks. Not pushed.
  Lock order is campaign then application, chosen over application then campaign.
  The opposite order deadlocks cancel with approve or withdraw, and a status check outside the campaign lock lets an apply land on a cancelled campaign or lets cancel overwrite withdrawn.
- 2026-10-10 Task 6: Instagram submit, review (revise, reject, pay), and wallet credit of the net. Submission, money, and reservation tests green, including five parallel payout runs. Not pushed.
  Submit and review lock via `_lock_campaign_then_application`, chosen over `lock_application`.
  `lock_application` locks only the application row. Paying or rejecting then updates the campaign, and that order deadlocks with cancel, which locks the campaign first.
- 2026-10-10 Task 7: wallet withdrawals, mock payout provider (a UPI id starting with `fail` is declined), and worker v1. A failed payout refunds the wallet once. Money tests green, including five parallel runs. Not pushed.
- 2026-10-10 Task 8: send queued notifications outside IST quiet hours, skip opted-out channels and WhatsApp with no phone at send time, and expire missed submission deadlines. Notification and reservation tests green. Full suite 100 passed. Not pushed.
  Deadline expiry locks the campaign row, then its applications, and re-checks the deadline under that lock. Chosen over the plan's single `FOR UPDATE` on the application rows.
  Releasing a slot updates the campaign. Locking the application first deadlocks with approve, withdraw, and cancel, which already lock the campaign first. A deadline read before the lock would still expire creators after the brand extended it.
- 2026-10-10 Task 9: demo seed, `dev.sh` (API + worker), HTTP flow regression test, and the repo map under `.claude/ugc-campaigns/`. Flow tests passed on the first run. Not pushed.
- 2026-10-10 Task 10: Next.js foundation, visual direction, auth and demo login. Lint, build, and the auth click-through passed. Not pushed.
  Typeface is IBM Plex Sans, chosen over a serif display. It has tabular figures for the wallet and the payout bill, and it is not on the refuse list. A serif would have landed on the cream-and-serif signature ui-craft warns about. The accent is a deep green, chosen over a purple-blue, because that gradient is refused and green is the paid state.
- 2026-10-10 Task 11: brand dashboard, campaign form, applicants and post review. Lint, build, and the brand click-through passed. Not pushed.
  The payout bill repeats the fee sentence under the lines. The creator browse can reuse that same sentence. The itemised bill was the alternative, with the sentence only on the campaign card.
  A tab panel that is leaving stays mounted until a CSS animation ends. These panels have no animation, so the old list stayed on screen. Hiding an inert panel was chosen over adding an exit animation.
- 2026-10-10 Task 11 review: the campaign page latches its first non-empty tab once. A later refresh no longer moves the brand off the tab they are reading. Not pushed.
- 2026-10-10 Task 13: notification inbox and settings, then the ui-craft audit (passed) and slop-scan (one wallet grid signal, justified in DESIGN.md). Lint and build green. Milestone 3, the web, is done. Not pushed.
  The fee sentence lives on the fee note and the payout bill imports it. A second copy was the alternative. One sentence cannot drift.
  Request changes and Reject clear the shared note when the mode switches. Keeping the previous note was the alternative, and it sent a rejection reason as a revision note.
- 2026-10-10 Task 12: creator explore, application cards with the next step, and the wallet with withdrawals. Lint, build, and the 390px click-through passed. Not pushed.
  The fee sentence stays under the payout bill and also appears once on Explore. Dropping it from the bill was the alternative. The brief puts the sentence on Explore and does not tell the bill to drop it, so both stay.
  "before deductions" opens on click, chosen over a hover tooltip. Creators use phones, and a hover-only tooltip never opened on tap.
