"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, patch, post } from "@/lib/api";
import { formatINR } from "@/lib/money";
import { isoToISTInput, istInputToISO } from "@/lib/time";
import type { Campaign } from "@/lib/types";

type Fields = {
  title: string;
  description: string;
  fee: string;
  slots: string;
  budget: string;
  apply: string;
  submit: string;
};

function digits(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const value = Number(text.trim());
  return Number.isSafeInteger(value) ? value : null;
}

function wholePaise(text: string): number | null {
  const rupees = digits(text);
  if (rupees == null || rupees <= 0) return null;
  return rupees * 100;
}

function snapshot(campaign: Campaign): Fields {
  return {
    title: campaign.title,
    description: campaign.description,
    fee: String(campaign.fee_paise / 100),
    slots: String(campaign.slots),
    budget: String(campaign.budget_paise / 100),
    apply: isoToISTInput(campaign.apply_deadline),
    submit: isoToISTInput(campaign.submit_deadline),
  };
}

export function CampaignForm({ campaign }: { campaign?: Campaign }) {
  const router = useRouter();
  const editing = campaign != null;
  const initial = campaign ? snapshot(campaign) : null;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [fee, setFee] = useState(initial?.fee ?? "");
  const [slots, setSlots] = useState(initial?.slots ?? "");
  const [budget, setBudget] = useState(initial?.budget ?? "");
  const [apply, setApply] = useState(initial?.apply ?? "");
  const [submit, setSubmit] = useState(initial?.submit ?? "");
  // A saved budget is already a choice. Create mode fills it until the brand edits that field.
  const [budgetTouched, setBudgetTouched] = useState(editing);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const feeLocked = editing && campaign.filled_slots > 0;
  const slotsMin = Math.max(1, campaign?.filled_slots ?? 1);
  const feePaise = wholePaise(fee);
  const slotCount = digits(slots);
  const budgetPaise = wholePaise(budget);
  const coverError =
    feePaise != null && slotCount != null && slotCount > 0 && budgetPaise != null && budgetPaise < feePaise * slotCount
      ? `Budget must cover ${slotCount} × ${formatINR(feePaise)} = ${formatINR(feePaise * slotCount)}`
      : null;
  const summary =
    coverError == null && feePaise != null && slotCount != null && slotCount > 0 && budgetPaise != null
      ? `${formatINR(budgetPaise)} covers ${slotCount} ${slotCount === 1 ? "creator" : "creators"} at ${formatINR(feePaise)} each`
      : null;

  function fillBudget(nextFee: string, nextSlots: string) {
    if (budgetTouched) return;
    const nextFeePaise = wholePaise(nextFee);
    const nextSlotsCount = digits(nextSlots);
    if (nextFeePaise != null && nextSlotsCount != null && nextSlotsCount > 0) {
      setBudget(String((nextFeePaise / 100) * nextSlotsCount));
    }
  }

  function firstProblem(): string | null {
    const trimmed = title.trim();
    if (trimmed.length < 3 || trimmed.length > 120) return "Title must be between 3 and 120 characters.";
    if (description.length > 4000) return "Description must be 4000 characters or fewer.";
    if (feePaise == null) return "Fee and budget must be a whole number of rupees";
    if (slotCount == null || slotCount < 1 || slotCount > 1000) return "Slots must be a whole number from 1 to 1000.";
    if (slotCount < slotsMin) {
      return `${campaign?.filled_slots ?? slotsMin} creators are already approved, so slots can't go below ${slotsMin}`;
    }
    if (budgetPaise == null) return "Fee and budget must be a whole number of rupees";
    if (coverError) return coverError;
    if (!apply || !submit) return "Enter both deadlines in IST.";
    if (submit <= apply) return "The submission deadline must be after the application deadline";
    if (!editing && new Date(istInputToISO(apply)).getTime() <= Date.now()) {
      return "The application deadline must be in the future";
    }
    if (editing && initial) {
      if (apply < initial.apply || submit < initial.submit) return "Deadlines can only be extended";
    }
    return null;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = firstProblem();
    if (problem || feePaise == null || slotCount == null || budgetPaise == null) {
      setError(problem ?? "Fee and budget must be a whole number of rupees");
      return;
    }
    setError(null);
    setPending(true);
    try {
      if (!editing) {
        const saved = await post<Campaign>("/campaigns", {
          title: title.trim(),
          description: description.trim(),
          fee_paise: feePaise,
          slots: slotCount,
          budget_paise: budgetPaise,
          apply_deadline: istInputToISO(apply),
          submit_deadline: istInputToISO(submit),
        });
        toast.success("Campaign created");
        await mutate("/campaigns/mine");
        router.push(`/brand/campaigns/${saved.id}`);
        return;
      }
      if (!initial || !campaign) return;
      const body: Record<string, unknown> = {};
      if (title.trim() !== initial.title) body.title = title.trim();
      if (description.trim() !== initial.description) body.description = description.trim();
      if (!feeLocked && feePaise !== campaign.fee_paise) body.fee_paise = feePaise;
      if (slotCount !== campaign.slots) body.slots = slotCount;
      if (budgetPaise !== campaign.budget_paise) body.budget_paise = budgetPaise;
      if (apply !== initial.apply) body.apply_deadline = istInputToISO(apply);
      if (submit !== initial.submit) body.submit_deadline = istInputToISO(submit);
      if (Object.keys(body).length === 0) {
        router.push(`/brand/campaigns/${campaign.id}`);
        return;
      }
      await patch<Campaign>(`/campaigns/${campaign.id}`, body);
      toast.success("Campaign updated");
      await mutate(`/campaigns/${campaign.id}`);
      await mutate("/campaigns/mine");
      router.push(`/brand/campaigns/${campaign.id}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid max-w-xl gap-3" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" value={title} maxLength={120} onChange={(event) => { setTitle(event.target.value); setError(null); }} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" value={description} maxLength={4000} onChange={(event) => { setDescription(event.target.value); setError(null); }} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="fee">Fee (₹)</Label>
          <Input
            id="fee"
            inputMode="numeric"
            value={fee}
            disabled={feeLocked}
            aria-describedby={feeLocked ? "fee-lock" : undefined}
            onChange={(event) => {
              setFee(event.target.value);
              setError(null);
              fillBudget(event.target.value, slots);
            }}
          />
          {feeLocked ? (
            <p id="fee-lock" className="text-sm text-muted-foreground">
              Locked: creators are approved
            </p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="slots">Slots</Label>
          <Input
            id="slots"
            inputMode="numeric"
            min={slotsMin}
            value={slots}
            onChange={(event) => {
              setSlots(event.target.value);
              setError(null);
              fillBudget(fee, event.target.value);
            }}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="budget">Budget (₹)</Label>
        <Input
          id="budget"
          inputMode="numeric"
          value={budget}
          onChange={(event) => {
            setBudgetTouched(true);
            setBudget(event.target.value);
            setError(null);
          }}
        />
        {coverError ? (
          <p role="alert" className="money text-sm text-bad">
            {coverError}
          </p>
        ) : summary ? (
          <p className="money text-sm text-muted-foreground">{summary}</p>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="apply">Application deadline (IST)</Label>
          <Input
            id="apply"
            type="datetime-local"
            value={apply}
            min={initial?.apply}
            onChange={(event) => { setApply(event.target.value); setError(null); }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="submit">Submission deadline (IST)</Label>
          <Input
            id="submit"
            type="datetime-local"
            value={submit}
            min={initial?.submit}
            onChange={(event) => { setSubmit(event.target.value); setError(null); }}
          />
        </div>
      </div>
      {error && error !== coverError ? (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="mt-6 w-fit" data-primary-cta disabled={pending}>
        {pending ? (editing ? "Saving" : "Creating") : editing ? "Save changes" : "Create campaign"}
      </Button>
    </form>
  );
}
