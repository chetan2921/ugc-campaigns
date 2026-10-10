# Visual direction

New visual world, nothing to preserve. This repo had no DESIGN.md, tokens, or theme. No sibling app was consulted.

These pipeline skills are not installed, so their steps were done by hand from ui-craft's written rules: `refero-design`, `impeccable`, `shadcn` (the skill; the shadcn library is installed), `design-motion-principles`, and `boneyard`.

## What the references are for

The daily screen is a list of applications. One reference leads. The other two are patterns for screens that are not lists.

- **Linear's issue list** is the page. Rows are dense and status-first, with one obvious action on the row. Applicant and application lists follow this.
- **Wise's transfer review** is the payout bill: an amount, then itemised deductions, then what arrives. It is not a look to copy.
- **Stripe Dashboard balances** is the wallet: a balance on top, then a ledger with a running balance and tabular numerals.

Auth is the same desk. A left-aligned form on the ground, not a floating card and not a marketing page.

## Constraints from outside the design space

- Money is in ₹ with en-IN grouping (₹10,00,000). `formatINR` does this. Every amount uses the `.money` class, and the body sets tabular numerals so counts in lists line up with the ledger.
- Creators are on phones (390px). The shell's nav is a bottom bar there. It does not scroll sideways.
- Brands are on short laptops (1366×768, 1280×720). Display type stays at `text-2xl` so a heading cannot overflow a 640px-tall window.
- Every deadline is shown in IST, via `formatIST`.
- On a campaign page the brand's job is approve or review. That control has to sit on the first screen at every size. Auth's primary button is marked `data-primary-cta` for the same reason.

## Decisions

**Typeface.** IBM Plex Sans, weights 400, 500, and 600, loaded with `next/font` in `layout.tsx`. It has tabular figures, and it is not Inter, Geist, Space Grotesk, Poppins, Montserrat, or Instrument Serif. create-next-app's Geist is removed. One family only: no display serif and no monospace costume. `--font-mono` points at the same face so a code-style label cannot sneak in.

**Colour.** Cool grey ground, near-black green ink, deep green for the action and for paid. Brick red for rejected. No purple-to-blue, no gradient text, no glass.

| Token | Hex | Use |
|---|---|---|
| ground | `#f3f5f3` | page background (`--background`) |
| surface | `#fbfcfb` | raised panels (`--card`) |
| ink | `#14211c` | text (`--foreground`) |
| muted | `#3a4a43` | secondary text (`--muted-foreground`) |
| line | `#d3dbd6` | borders |
| accent | `#084536` | primary actions and links (`--brand`, `--primary`) |
| good | `#084536` on `#e3f2ea` | paid |
| bad | `#7f1d22` on `#f8e6e7` | rejected, declined, missed, withdrew |

shadcn's `--accent` is the hover wash (`#e6eeea`), not the brand colour. Buttons use `--primary`. Dialog backdrops are a flat dim. The blur class was removed.

There is no theme toggle. `.dark` exists so a later toggle stays in this palette instead of shadcn's default blue.

**Radius.** 8px ceiling. `--radius` is `0.5rem`. The larger shadcn steps (`xl` through `4xl`) are capped at 8px so a badge cannot become a pill. Status pills and counts use 4px. The switch track stays a pill because that is the control, not a surface.

**Spacing.** Tailwind's scale, used unevenly. 4px inside a count, 8px between nav rows, 12px between fields, 16px page padding on a phone, 24px before the primary action, 40px (`py-10`) above a desk page on a laptop. Auth is the tight rhythm. Campaign pages, when they arrive, take the loose one.

**Motion.** State changes only, 160ms, `cubic-bezier(0, 0, 0.2, 1)`. Role selection, button colour, and the error line. Skeletons do not pulse. Nothing loops. `prefers-reduced-motion` collapses transitions and animations.

**Browser surfaces.** Selection `#c9e4d8` with ink text. Caret is the accent. Focus is a 2px accent outline, unlayered so a component `outline-none` cannot remove it. Scrollbar is thin, `#b7c4bc`. Links use `text-underline-offset: 0.18em`. Tabular numerals sit on `body` and on `.money`.

## Copy

- No eyebrow labels above headings.
- Headings are names of the screen (Log in, Sign up, Campaigns), not full-stop aphorisms.
- No "seamless", "streamline", and the rest of that vocabulary.
- No em dashes in the interface.

## Loading and empty

Loading the shell is a static skeleton with one `main`. Empty sections say what will show up there, in one sentence. Errors from the API's `detail` render inline on the form. There is no toast for auth. Settings toasts "Saved" when a channel toggle or the profile form is saved.

## Slop scan

`slop-scan` on the wallet flags uniform grid dominance (48% of the page height). The three grids are the section nav, the account block under it, and the withdraw form. They stack links and fields in one column. They are not cards. The ledger stays a table, which is the balance pattern above.
