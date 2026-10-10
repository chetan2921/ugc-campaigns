# campaigns implementation

## Now
Task 14: README, AI logs, leak check, fresh-clone run, push

## Next
- Milestone 4 is the end of the plan.

Cut line if time runs short: polish in Task 13 (the slop-scan follow-ups)
goes first. Tasks 1–12 and 14 are required by the brief.

## Done
- 2026-10-10 Task 13: notification inbox and settings. Lint and build green. ui-craft audit passed on the Task 13 route list. slop-scan was clear on /login; the wallet grid signal is the sidebar and the withdraw form, recorded in web/DESIGN.md. Click-through: creator inbox filters, held/sending/skipped lines, and both settings pages. Milestone 3 (web) is done.
- 2026-10-10 Task 12: creator explore, applications with the next step, and the wallet with withdrawals. Lint and build green. At 390×844, Asha's wallet showed ₹8,731.80 and the bill added up. ₹1,000 to asha@okbank succeeded. ₹1,000 to fail@okbank showed Processing…, then the bank decline, the refund, and Try again. A new creator applied to Rainy-day snack reels, saw the live link hint, "couldn't find" on missing1, the revision note inline, and the same bill after the brand paid.
- 2026-10-10 Task 11: brand dashboard, campaign form, applicants and post review. Lint clean. Browser click-through as the demo brand: Ravi's approval moved the meter to 2 of 3 with ₹10,000 reserved, Meera's post took a revision request, a budget below fee × slots stayed on the form with the cover error, the Rainy-day fee was locked, and cancelling Festive gift box unboxing showed the pending-applicants dialog and labelled the free budget released. Approve and Approve & pay were on the first screen at 1366×768.
- 2026-10-10 Task 10: Next.js foundation, visual direction, auth and demo login. Lint and build green. Browser: a new creator lands on `/creator`, logout returns to `/login`, demo brand lands on `/brand`, and that brand opening `/creator` is sent back to `/brand`.
- 2026-10-10 Task 9: demo seed (second run says already present), `dev.sh`, HTTP flow test, repo map. Flow tests passed on the first run. Health curl `{"ok":true}` and the worker logged "worker started"; both processes were then stopped. Full suite: 103 passed.
- 2026-10-10 Task 8: send queued notifications outside IST quiet hours, honour opt-out and a missing phone at send time, and expire missed submission deadlines. Notification and reservation tests green. Full suite: 100 passed.
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
