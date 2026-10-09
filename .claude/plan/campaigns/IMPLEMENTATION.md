# campaigns implementation

## Now
Planning is done. The spec, plan, contract and this tree are committed to the
public repo https://github.com/chetan2921/ugc-campaigns. No code yet. The build
runs in a fresh session: plan Task 1 (scaffold), with Task 0 (the UGCIndia
walkthrough) in parallel. Tasks and code are in `PLAN.md`.

### In flight: Task 1, scaffold
- [ ] repo files (.gitignore, docker-compose with db, db/init test DB)
- [ ] failing `test_health`, Postgres up, venv installed
- [ ] pin dependencies
- [ ] config, db, clock, errors, main
- [ ] `test_health` green, `ugc_test` exists
- [ ] leak check passes (see AGENTS.md for the command)
- [ ] commit, then `git push origin HEAD:main` (the repo already exists and is public). Full suite green, then stop here.

## Next
- 0. UGCIndia flow walkthrough (README input)
- 2. Data model, migration, signup/login
- 3. Domain core: money, IST quiet hours, state table
- 4. Apply / approve with atomic reservation / decline / withdraw
- 5. Campaign rules, presenters, routes
- 6. Submit, review, payout
- 7. Withdrawals, mock payout provider, worker v1
- 8. Notification sending, deadlines, worker v2
- 9. Seed, api/worker containers, HTTP flow test, repo map. **Milestone 1 and 2 done.**
- 10. Web foundation, ui-craft direction, auth
- 11. Brand screens
- 12. Creator screens
- 13. Inbox, settings, ui-craft scans. **Milestone 3 done.**
- 14. README, AI logs, leak check, fresh-clone run, push. **Milestone 4 done.**

Cut line if time runs short: polish in Task 13 (the slop-scan follow-ups)
goes first. Tasks 1–12 and 14 are required by the brief.

## Done
- 2026-10-10 Planning. Brief analysed, gaps found, assumptions agreed with the
  user, spec/plan/contract written.
