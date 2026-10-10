# web

Public functions and components. A route file is the URL next to the page.

```
src/
  app/
    layout.tsx                         IBM Plex Sans, html lang en-IN
    page.tsx                           /  -> homeFor(role) or /login
    login/page.tsx                     /login
    signup/page.tsx                    /signup
    demo/[role]/page.tsx               /demo/brand, /demo/creator
    not-found.tsx
    brand/layout.tsx                   RequireRole role="brand"
    brand/page.tsx                     /brand
    brand/campaigns/new/page.tsx       /brand/campaigns/new
    brand/campaigns/[id]/page.tsx      /brand/campaigns/:id
    brand/campaigns/[id]/edit/page.tsx /brand/campaigns/:id/edit
    creator/layout.tsx                 RequireRole role="creator"
    creator/page.tsx                   /creator
    creator/campaigns/page.tsx         /creator/campaigns
    creator/wallet/page.tsx            /creator/wallet
    inbox/layout.tsx                   RequireRole
    inbox/page.tsx                     /inbox
    settings/layout.tsx                RequireRole
    settings/page.tsx                  /settings
  components/
    require-role.tsx
      RequireRole({ role?, children })
    app-shell.tsx
      AppShell({ user, children })
      ShellSkeleton()
    status-pill.tsx
      StatusPill({ status })
    auth-screen.tsx
      AuthScreen({ title, lede?, children })
    load-error.tsx
      LoadError({ message, onRetry })
    payout-bill.tsx
      FEE_NOTE
      PayoutBill({ payout })
    slot-meter.tsx
      slotMeterLabel(campaign) -> string
      SlotMeter({ campaign, compact? })
      CampaignStatus({ status })
    timeline.tsx
      Timeline({ events })
    campaign-form.tsx
      CampaignForm({ campaign? })
    review-panel.tsx
      ReviewPanel({ application, pending, primary?, onReview })
    fee-note.tsx
      FEE_NOTE
      FeeNote()
      FeeHint()
    submit-post-form.tsx
      SubmitPostForm({ applicationId, onSubmitted })
    withdraw-form.tsx
      paiseToRupeesInput(paise) -> string
      WithdrawForm({ balancePaise, amount, upi, onAmountChange, onUpiChange })
    application-card.tsx
      ApplicationCard({ application, primary? })
    ui/                                shadcn: button, input, label, textarea, tabs, dialog, switch, tooltip, skeleton, sonner, badge
  lib/
    token.ts
      getToken() -> string | null
      saveToken(token: string)
      clearToken()
    api.ts
      class ApiError
      api<T>(path, init?) -> Promise<T>
      post<T>(path, body?)
      patch<T>(path, body)
    auth.ts
      homeFor(role) -> "/brand" | "/creator"
      useMe()
    types.ts
      Role, AppStatus, AuthOut, User, Campaign, Application, Payout,
      Submission, AppEvent, LedgerEntry, Withdrawal, Wallet, Notification
    money.ts
      formatINR(paise) -> string
      rupeesToPaise(text) -> number | null
    time.ts
      formatIST(iso) -> string
      istInputToISO(value) -> string
      isoToISTInput(iso) -> string
    instagram.ts
      parseInstagramUrl(text) -> { kind, shortcode } | null
    next-step.ts
      STATUS_LABEL, Step
      creatorNextStep(app) -> Step
      brandNextStep(app) -> Step
```

<!-- mapped: .@f0f3af5 paths: web/src,web/DESIGN.md,web/package.json -->
