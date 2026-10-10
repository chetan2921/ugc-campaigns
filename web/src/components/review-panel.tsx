"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatINR } from "@/lib/money";
import type { Application } from "@/lib/types";

type ReviewAction = "approve" | "revise" | "reject";

export function ReviewPanel({
  application,
  pending,
  primary,
  onReview,
}: {
  application: Application;
  pending: boolean;
  primary?: boolean;
  onReview: (action: ReviewAction, note?: string) => Promise<boolean>;
}) {
  const latest = application.submissions[application.submissions.length - 1];
  const waiting = application.status !== "submitted";
  const revisionsUsed = application.revisions_left === 0;
  const [mode, setMode] = useState<"revise" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  async function send(action: ReviewAction, text?: string) {
    setNoteError(null);
    const ok = await onReview(action, text);
    if (!ok) return;
    setMode(null);
    setNote("");
    setPayOpen(false);
  }

  function onNoteSubmit(event: FormEvent) {
    event.preventDefault();
    const text = note.trim();
    if (!text) {
      setNoteError(mode === "reject" ? "Give the creator a reason" : "Tell the creator what to change");
      return;
    }
    void send(mode === "reject" ? "reject" : "revise", text);
  }

  return (
    <div className="grid gap-2">
      {latest ? (
        <>
          <a href={latest.url} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-primary underline">
            {latest.url}
          </a>
          {latest.caption ? <p className="text-sm">{latest.caption}</p> : null}
          <p className="text-sm text-muted-foreground">
            Version {latest.version} · Revisions used: {application.revision_count} of 2
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No submission yet.</p>
      )}
      {waiting ? <p className="text-sm">Waiting for the revised post.</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" data-primary-cta={primary ? true : undefined} disabled={pending || waiting} onClick={() => setPayOpen(true)}>
          Approve & pay
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending || waiting || revisionsUsed}
          onClick={() => { setMode("revise"); setNoteError(null); }}
        >
          Request changes
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={pending || waiting}
          onClick={() => { setMode("reject"); setNoteError(null); }}
        >
          Reject
        </Button>
      </div>
      {revisionsUsed ? <p className="text-sm text-muted-foreground">Both revisions used</p> : null}
      {mode ? (
        <form onSubmit={onNoteSubmit} className="grid max-w-lg gap-2">
          <Label htmlFor={`${mode}-${application.id}`}>{mode === "reject" ? "Reason" : "What should change"}</Label>
          <Textarea
            id={`${mode}-${application.id}`}
            value={note}
            maxLength={1000}
            required
            onChange={(event) => { setNote(event.target.value); setNoteError(null); }}
          />
          {noteError ? (
            <p role="alert" className="text-sm text-bad">
              {noteError}
            </p>
          ) : null}
          <Button type="submit" className="w-fit" variant={mode === "reject" ? "destructive" : "default"} disabled={pending}>
            {pending ? "Sending" : mode === "reject" ? "Reject post" : "Send changes"}
          </Button>
        </form>
      ) : null}
      <Dialog open={payOpen} onOpenChange={(open) => { if (!pending) setPayOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve and pay</DialogTitle>
            <DialogDescription>
              Pay {formatINR(application.fee_paise)} to {application.creator.name}? They&apos;ll receive the fee minus platform fee, GST and TDS.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setPayOpen(false)}>
              Back
            </Button>
            <Button type="button" disabled={pending} onClick={() => void send("approve")}>
              {pending ? "Paying" : "Approve & pay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
