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
