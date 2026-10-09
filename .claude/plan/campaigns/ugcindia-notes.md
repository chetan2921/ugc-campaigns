# Public-site walkthrough (2026-10-10)

Research only. No account was created. Opening a live brief jumped straight
to signup, so the real create / apply / review screens were not clicked.
These notes are from the public home, brand, and creator pages, the pricing
page, the how-it-works blocks on those pages, the FAQs, and two feature
pages that show dummy dashboards. There is no separate how-it-works or FAQ
URL.

The public pages do not tell one story. Treat screen counts below as what a
visitor is led to expect, not as a logged-in click-through.

## Create

What a brand is shown:

1. Pick a role, then a name and an email. The next action is an email check,
   or a Google sign-in. No password on that first screen. Not submitted.
2. Pick a monthly plan. The cheap brand plan allows a single live campaign.
   The plan price is not the creator budget.
3. Add money to a brand wallet. Marketing says the campaign cannot pay until
   that balance is there.
4. Fill a brief: deliverables, a payout, a creator tier, and (on the feature
   page) product, style, audience, tone, examples, and must-include lines.
   Extra photo sets and a square crop are optional add-ons.
5. Either wait for applications, or search a directory and invite people.
   Both are described. A visitor cannot tell which one the product does.

Where someone waits or guesses:

- Wallet top-up, plan checkout, and the brief are separate money decisions.
  It is easy to think the subscription is the campaign budget.
- One page says creators apply in; another says the brand invites from a
  directory. Those are different products.
- The fee taken from the creator is not on any public create mock.
- A creator card in the dummy directory shows one rate. Live campaign cards
  show a ceiling. Ended campaigns show a range. Unclear whether the brand
  sets one number or negotiates.

Roughly four screens before a campaign exists, and a long brief. Our form is
one screen: title, description, fee, slots, budget, two deadlines.

## Apply

Live cards are public. Each one shows a ceiling amount, whether a public
post is required or a video file is enough, how many people have applied,
how many videos that person owes, and a due date. The brief itself is behind
signup.

The creator page calls this one click, with filters for tier and pay. The
earnings feature page says something longer: finish a profile (niche,
language, equipment, several sample videos), apply with that portfolio, then
wait to be picked and only then receive the brief.

Pricing makes the wait worse. The free creator plan is described as browsing
only, while applying sits on a paid plan. A creator FAQ says approved people
can apply on the free plan. A pricing FAQ says paid plans raise the quota.
A new creator cannot tell whether the next click costs money.

Other guesses:

- Is the ceiling the amount they keep, or the amount before a fee?
- Must they post on their own account? Some cards say yes, some say the file
  is enough. Our flow always wants a public post link.
- Are they applying, or waiting for an invite? Both are advertised.

## Approve

The brand page: open a profile (tier, followers, past work) and accept or
decline. The feature page: invite from a directory instead. No public screen
shows how many slots or how much budget is left, so a brand can accept
someone and only then learn the wallet is short.

The creator, after applying, is told to wait. No status list is shown for
"sent / seen / declined", and no reason is described for a decline.

## Submit

Upload the file on the site. Some campaigns also want a public post. If the
brand asks for changes, the creator uploads again. Nothing public shows a
link check, a caption, or a private-account result. The creator has to guess
length, rights, and "must include" items from a brief they could not open
without an account.

## Review

Named stages: brief sent, submitted, in review, changes asked, approved,
paid. The default is two rounds of changes, and a campaign can change that
number. Feedback is described as a note on a moment in the video, or as a
message thread. Approving releases the money. A late creator can be replaced;
the held money stays until something is approved. Nothing says why a button
would be disabled, or shows "round 1 of 2" as a fixed cap.

## Payout

Three different clocks:

- Brand and creator marketing: the wallet updates the moment the brand
  approves.
- The earnings feature: bank or UPI within a day or two, sometimes via the
  wallet, sometimes straight to the bank.
- A dummy ledger: a pending row, then a paid row, plus a separate fee line.

The fee itself disagrees. That dummy line used about 2 percent. An FAQ
described a band of roughly 8 to 12 percent, varying by plan. Pricing says
the fee depends on creator tier and is shown before the creator accepts.
No public page walks fee, GST, and TDS down to a single credit. A creator
cannot see which rupee is still pending, which is spendable, and which has
left for the bank.

## Withdraw

A control sends money to a bank. An FAQ also allows UPI, with no minimum, in
one or two days. The dummy history shows the withdrawal as its own row.
Nothing mentions a failed transfer, a refund back to the wallet, or a way to
retry. "Instant" on the marketing pages and "a day or two" on the feature
page are the same step.

## Notify

Creator alerts for an approval or a payment are described as not shipped yet
on the home page. WhatsApp on the brand side is a marketing broadcast tool,
not a status message. The feature pages put the conversation in an in-app
thread. No digest, no quiet hours, and no "this needs you" list. After
applying, a creator does not know whether they will hear about a decision
anywhere except by opening the site.

## Map to our friction reducers

| Their public flow | Our reducer | What we do |
|---|---|---|
| Fee is a ceiling, a range, ~2%, or ~8–12%, depending on the page | 1. Payout bill | One bill at payout. Formula is visible earlier; the net is not. Do not flip that without agreement. |
| Many tools, a thread, and no single "what now" | 2. One next step, reasons inline, a timeline | Keep. Their statuses are a menu; ours is one action. |
| Plan price, wallet top-up, and brief are separate, with no live "slots left / money left" | 3. Budget pre-fills; approval meter | Keep. A real brand wallet stays out of scope. |
| Two revision rounds, but the count can change, and the note may be a timestamp | 4. Required note, "Revision n of 2" | Keep the cap. Timestamped notes are README-only. |
| No public story for a failed bank transfer | 5. Auto-refund, try again, withdraw all | Keep. This is a gap on their public pages. |
| Payment alerts called not-yet-shipped; marketing WhatsApp is a different product | 6. Channel toggles and an Inbox | Keep. A morning digest stays README-only. |
| After apply, the creator waits with no queue | 7. Needs your attention | Keep. |
| Some jobs are a file, some are a public post; no link check is shown | 8. Link check as you type, mock lookup | Keep for this slice. File-only campaigns are README-only. |

## Left for the README, not for this build

- Draft review, and a campaign that does not require a public post.
- Usage named up front (organic, ads, whitelist, and how long).
- A revision note that points at a moment in the video.
- Already listed: 72-hour auto-approve, one morning digest, a waitlist for
  freed slots, deadline reminders.

Not added, because they add steps or contradict a decision already made:
creator tiers, brand invites, a subscription, and a brand wallet. Showing a
pre-computed net before payout was already considered and turned down; their
pages are the unclear version of that same choice.
