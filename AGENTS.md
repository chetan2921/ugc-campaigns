# ugc-campaigns

A take-home build of a UGC campaign marketplace slice. Brands create paid
campaigns and creators apply and submit Instagram posts. Approval pays into a
wallet with a fee/GST/TDS bill, and creators withdraw through a mock provider.
One repo with two parts: `api/` (FastAPI + Postgres + a polling worker) and
`web/` (Next.js), which is one client of the API. A Flutter client may follow.

## Repos
| Repo | What it is | Mapped from | Context |
|------|-----------|-------------|---------|
| . (ugc-campaigns) | `api/` FastAPI service and worker; `web/` Next.js client | .@09f5afd | `.claude/ugc-campaigns/AGENTS.md`, `.claude/web/AGENTS.md` |

## Products
| Product | Repos | Plan |
|---------|-------|------|
| campaigns | . (api/, web/) | `.claude/plan/campaigns/` (SPEC, PLAN, IMPLEMENTATION, TESTING) |

## Contracts
| Seam | What must agree | File |
|------|-----------------|------|
| api-surface | `api/` routers and schemas ↔ `web/src/lib/types.ts` and `api.ts` (and any future mobile client) | `.claude/contracts/api-surface.md` |

Facts that span both sides live in the contract, not in a repo file. Read it
before changing either side, and update it when a side moves.

## Project rules
- **Confidentiality.** Never mention the author's employer, its products or any
  other local project in code, docs, commits, the README or chat. Don't read
  other local projects for "inspiration". Run the leak check before every push:
  `"$(git rev-parse --git-common-dir)/../.claude/leak-check.sh"`. It lives only
  in the main checkout, is git-excluded, and the path works from worktrees too.
  Never open, print or edit it, so its search terms stay out of the chat logs.
- **Secrets live only in `api/.env`** (gitignored and filled in by the user):
  the Neon database URLs and the JWT secret. Never print it, never ask for its
  values in chat, and never commit it. `api/.env.example` has placeholders. A
  worktree copies the real file from the main checkout:
  `cp "$(git rev-parse --git-common-dir)/../api/.env" api/.env`.
- **This tree is public.** Never write credentials, tokens or internal URLs
  into `AGENTS.md`, `CLAUDE.md` or anything under `.claude/`. Commit memory
  updates together with the change they describe, then
  `git push origin HEAD:main`.
- **Tests come first here.** Every checklist step that builds behaviour is
  preceded by a step that tests it. This overrides any global rule against
  unrequested tests. The three risky suites (money, reservation,
  notifications) must stay green.
- **Explainable code.** The author walks reviewers through this code live, so
  keep it plain: small files, plain functions, comments only for the "why".
- **Money is integer paise.** Every application status change goes through
  `services.transitions.move()`.
- **Frontend work** goes through the `ui-craft` skill (pipeline plus its two
  scans). `web/DESIGN.md` is the visual source of truth once it exists.

## Navigate
- Working in the API: `.claude/ugc-campaigns/AGENTS.md`.
- Working in the web client: `.claude/web/AGENTS.md`.
- Looking for a symbol or a file: `.claude/ugc-campaigns/STRUCTURE.md`.
- Building a feature: `SPEC.md` for what it should do, `PLAN.md` for the
  step-by-step tasks, and `IMPLEMENTATION.md` for where the work stands.
- Changing a seam: the contract.
- Wondering why something is the way it is: `.claude/HISTORY.md`, newest lines
  last.

Read what the task needs, never the whole tree.

## Trust, then update
A context file is only true for the commit it was read from. Before relying on
one, check its footer stamp:

    git -C <repo> diff --stat <sha from the footer>..HEAD -- <paths from the footer>

If the output is empty, the file still describes the code. Anything else names
what to re-read: re-read those files, rewrite the context file, and re-stamp it
with the current sha.

Sweep every stamp at once, from the workspace root, after a pull, a merge, or a
branch switch:

    grep -rl '<!-- mapped:' .claude --include='*.md' | while read -r f; do
      line=$(grep -o '<!-- mapped: .* -->' "$f" | head -1)
      repo=${line#<!-- mapped: }; repo=${repo%%@*}
      rest=${line#*@};            sha=${rest%% *}
      paths=${line#*paths: };     paths=${paths% -->}
      out=$(git -C "$repo" diff --stat "$sha"..HEAD -- $(echo "$paths" | tr ',' ' ') 2>&1)
      if [ -n "$out" ]; then printf '\n=== %s\n%s\n' "$f" "$out"; fi
    done

Every file it prints must be rewritten before you trust it. The `tr` is
needed, not decoration: zsh splits a command substitution into words but never
a parameter expansion, so the obvious `${paths//,/ }` would pass one argument
and report every file clean.

## Update as you go
When a session does something in the left column, it updates the file on the
right before it ends. Not next session, and not when someone notices.

| What happened | What to update |
|---------------|----------------|
| new folder, service, entry point, or dependency | `.claude/ugc-campaigns/AGENTS.md` |
| function added or removed, signature changed | `.claude/ugc-campaigns/STRUCTURE.md` |
| either side of a seam moved | the contract, and every side it names |
| a checklist step or milestone landed | `.claude/plan/campaigns/IMPLEMENTATION.md` |
| a test added, or a testing lesson learned | `.claude/plan/campaigns/TESTING.md` |
| a decision that contradicts the spec | `SPEC.md` (and `PLAN.md` if a task changes), or the spec becomes fiction |
| a folder grew into its own subsystem (e.g. `web/`) | give it its own `AGENTS.md` pair under `.claude/` |
| a new seam appeared | a new file in `.claude/contracts/` |

Re-stamp every mapped file you rewrite. A rewritten file with an old stamp is
worse than a stale file, because the sweep will then call it clean.

## Before the session ends
A session that changed anything makes the updates above, then adds one line to
`.claude/HISTORY.md`. A session that only answered questions writes nothing.

## HISTORY.md
One line per session, newest last. A session that made a decision someone will
question later adds a short indented block under its line: what was chosen,
what it was chosen over, and why. Past 120 lines, fold the oldest half into one
`## Before <date>` paragraph. Never re-fold a folded paragraph.

## Compression
- `IMPLEMENTATION.md` has one checklist, for the current item only. A finished
  item becomes one dated line under `## Done`.
- `HISTORY.md` has one line per session, folded as above.
- Everything else points at where the truth lives instead of restating it.

## Re-running
Re-run `/repo-setup` after a large merge, or when the sweep prints more files
than you want to fix by hand.

Tracking: committed, in the public repo https://github.com/chetan2921/ugc-campaigns
(the author's choice, to show the AI workflow). Only `.claude/leak-check.sh` is
excluded, via `.git/info/exclude`.
Layout: central (single repo; the tree lives in this repo's `.claude/`).
