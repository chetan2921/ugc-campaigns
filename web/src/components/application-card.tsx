"use client";

import { useState } from "react";
import { mutate } from "swr";
import { FeeHint } from "@/components/fee-note";
import { PayoutBill } from "@/components/payout-bill";
import { SubmitPostForm } from "@/components/submit-post-form";
import { Timeline } from "@/components/timeline";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { post } from "@/lib/api";
import { errorText, instant } from "@/lib/instant";
import { formatINR } from "@/lib/money";
import { creatorNextStep } from "@/lib/next-step";
import type { Application, AppStatus } from "@/lib/types";

const REASON = new Set(["rejected", "declined", "expired"]);

function revisionLine(application: Application): string | null {
  if (application.status !== "revision_requested") return null;
  let note: string | null = null;
  for (let i = application.events.length - 1; i >= 0; i -= 1) {
    if (application.events[i].to_status === "revision_requested") {
      note = application.events[i].note;
      break;
    }
  }
  const lead = `Changes requested (revision ${application.revision_count} of 2)`;
  return note ? `${lead}: ${note}` : lead;
}

function reasonLine(application: Application): string | null {
  if (!REASON.has(application.status)) return null;
  const last = application.events[application.events.length - 1];
  return last?.note ?? null;
}

export function ApplicationCard({
  application,
  primary,
  notice,
  onPreview,
  onRevert,
}: {
  application: Application;
  primary?: boolean;
  notice?: string | null;
  onPreview: (status: AppStatus) => void;
  onRevert: (message?: string) => void;
}) {
  const step = creatorNextStep(application);
  const [formOpen, setFormOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canWithdraw = application.status === "applied" || application.status === "approved";
  const asked = revisionLine(application);
  const reason = reasonLine(application);

  async function commit(status: AppStatus, success: string, request: () => Promise<unknown>) {
    setError(null);
    setPending(true);
    setWithdrawOpen(false);
    onPreview(status);
    try {
      await instant(success, request);
      setFormOpen(false);
      void Promise.all([mutate("/applications/mine"), mutate("/campaigns")]);
    } catch (err) {
      const message = errorText(err);
      onRevert(message);
      setError(message);
      throw err;
    } finally {
      setPending(false);
    }
  }

  async function withdraw() {
    try {
      await commit("withdrawn", "Withdrawn", () => post(`/applications/${application.id}/withdraw`));
    } catch {
      // commit already surfaced the message
    }
  }

  return (
    <li className="border-b border-border py-3">
      <p className="font-medium">{application.campaign.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{application.campaign.brand_name}</p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="money text-sm font-medium">{formatINR(application.fee_paise)}</span>
        <FeeHint />
      </p>
      {asked ? <p className="mt-2 text-sm">{asked}</p> : null}
      {step.kind === "action" ? (
        <Button
          type="button"
          className="mt-3 h-auto! py-2 text-left whitespace-normal!"
          data-primary-cta={primary ? true : undefined}
          aria-expanded={formOpen}
          onClick={() => setFormOpen((open) => !open)}
        >
          {step.label}
        </Button>
      ) : (
        <p className={step.kind === "done" && step.tone === "bad" ? "mt-2 text-sm text-bad" : "mt-2 text-sm text-muted-foreground"}>
          {step.label}
        </p>
      )}
      {formOpen && step.kind === "action" ? (
        <div className="mt-3">
          <SubmitPostForm
            applicationId={application.id}
            onCommit={(url) =>
              commit("submitted", "Post submitted. The brand will review it.", () =>
                post(`/applications/${application.id}/submissions`, { url }),
              )
            }
          />
        </div>
      ) : null}
      {reason ? <p className="mt-2 text-sm">{reason}</p> : null}
      {application.status === "paid" && application.payout ? (
        <div>
          <button
            type="button"
            className="mt-2 text-sm text-primary underline"
            aria-expanded={billOpen}
            onClick={() => setBillOpen((open) => !open)}
          >
            See payout
          </button>
          {billOpen ? (
            <div className="mt-2">
              <PayoutBill payout={application.payout} />
            </div>
          ) : null}
        </div>
      ) : null}
      {canWithdraw ? (
        <button type="button" className="mt-2 block text-sm text-primary underline" onClick={() => setWithdrawOpen(true)}>
          Withdraw
        </button>
      ) : null}
      {notice && !error ? (
        <p role="alert" className="mt-2 text-sm text-bad">
          {notice}
        </p>
      ) : null}
      {error && !withdrawOpen ? (
        <p role="alert" className="mt-2 text-sm text-bad">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="mt-2 text-sm text-primary underline"
        aria-expanded={historyOpen}
        onClick={() => setHistoryOpen((open) => !open)}
      >
        History
      </button>
      {historyOpen ? <Timeline events={application.events} /> : null}
      <Dialog open={withdrawOpen} onOpenChange={(open) => { if (!pending) setWithdrawOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw</DialogTitle>
            <DialogDescription>
              Withdraw from {application.campaign.title}? You can&apos;t re-apply to this campaign.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="text-sm text-bad">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setWithdrawOpen(false)}>
              Keep application
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={() => void withdraw()}>
              {pending ? "Withdrawing" : "Withdraw"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
