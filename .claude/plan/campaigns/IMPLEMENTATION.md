# campaigns implementation

## Now
Task 8: Sending notifications, quiet hours at send time, deadlines. Steps and code are in `PLAN.md`.

## Next
- 9. Seed, `dev.sh` one-command runner, HTTP flow test, repo map. **Milestone 1 and 2 done.**
- 10. Web foundation, ui-craft direction, auth
- 11. Brand screens
- 12. Creator screens
- 13. Inbox, settings, ui-craft scans. **Milestone 3 done.**
- 14. README, AI logs, leak check, fresh-clone run, push. **Milestone 4 done.**

Cut line if time runs short: polish in Task 13 (the slop-scan follow-ups)
goes first. Tasks 1–12 and 14 are required by the brief.

## Done
- 2026-10-10 Task 7: wallet withdrawals, mock payout provider, and worker v1. A failed payout refunds the wallet once. Money tests green, including five parallel runs.
- 2026-10-10 Task 6: submit an Instagram post, review it (revise, reject, or pay), and credit the net to the creator's wallet. Submission, money, and reservation tests green, including five parallel single-post payout runs.
- 2026-10-10 Task 5: campaign create/edit/cancel rules, presenters, and campaign/application routes. Campaign-rule tests green, including cancel keeping approved creators.
- 2026-10-10 Task 4: apply, approve with atomic slot and budget reservation, decline, withdraw. Reservation tests green, including five parallel last-slot runs.
- 2026-10-10 Task 3: payout maths, IST quiet hours, application state table. Money, notification and state tests green.
- 2026-10-10 Task 2: ten-table data model, Alembic initial schema, signup/login with roles. Auth tests green.
- 2026-10-10 Task 1: FastAPI scaffold, config/db/clock/errors/main, health check,
  pinned requirements, conftest guard for `_test` database, leak check green.
- 2026-10-10 UGCIndia public-site walkthrough. Notes in
  `.claude/plan/campaigns/ugcindia-notes.md`. Logged-in screens were not
  opened. README-only ideas updated in the spec; the build scope did not move.
- 2026-10-10 Planning. Brief analysed, gaps found, assumptions agreed with the
  user, spec/plan/contract written.
