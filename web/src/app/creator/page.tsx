"use client";

import { useEffect, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { FeeHint, FeeNote } from "@/components/fee-note";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ApiError, api, post } from "@/lib/api";
import { formatINR } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/next-step";
import { formatIST } from "@/lib/time";
import type { AppStatus, Campaign } from "@/lib/types";

function statusText(status: AppStatus): string {
  if (status === "applied") return "Applied · waiting for the brand";
  return STATUS_LABEL[status];
}

function ClampedDescription({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [text, open]);

  if (!text) return null;
  return (
    <div className="mt-2">
      <p ref={ref} className={open ? "text-sm" : "line-clamp-2 text-sm"}>
        {text}
      </p>
      {overflows && !open ? (
        <button type="button" className="mt-1 text-sm text-primary underline" onClick={() => setOpen(true)}>
          More
        </button>
      ) : null}
    </div>
  );
}

function CampaignRow({
  campaign,
  primary,
  justApplied,
  onApplied,
}: {
  campaign: Campaign;
  primary: boolean;
  justApplied: boolean;
  onApplied: () => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const left = Math.max(0, campaign.slots - campaign.filled_slots);
  const mine = campaign.my_application;

  async function apply() {
    setError(null);
    setPending(true);
    try {
      const text = noteOpen ? note.trim() : "";
      await post(`/campaigns/${campaign.id}/apply`, text ? { note: text } : {});
      toast.success("Applied. We'll let you know when the brand decides.");
      onApplied();
      await Promise.all([mutate("/campaigns"), mutate("/applications/mine")]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="border-b border-border py-4">
      <p className="text-sm text-muted-foreground">{campaign.brand_name}</p>
      <h2 className="mt-1 text-base font-medium">{campaign.title}</h2>
      <ClampedDescription text={campaign.description} />
      <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="money text-2xl font-semibold">{formatINR(campaign.fee_paise)}</span>
        <FeeHint />
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {left} of {campaign.slots} slots left
      </p>
      <p className="text-sm text-muted-foreground">Apply by {formatIST(campaign.apply_deadline)}</p>
      {mine || justApplied ? (
        <p className="mt-3 text-sm text-muted-foreground">{mine ? statusText(mine.status) : "Applied · waiting for the brand"}</p>
      ) : (
        <div className="mt-3">
          <Button type="button" data-primary-cta={primary ? true : undefined} disabled={pending} onClick={() => void apply()}>
            {pending ? "Applying" : "Apply"}
          </Button>
          <button
            type="button"
            className="mt-2 block text-sm text-primary underline"
            aria-expanded={noteOpen}
            onClick={() => setNoteOpen((open) => !open)}
          >
            Add a note
          </button>
          {noteOpen ? (
            <div className="mt-2">
              <Label htmlFor={`note-${campaign.id}`} className="sr-only">
                Note
              </Label>
              <Textarea
                id={`note-${campaign.id}`}
                value={note}
                maxLength={500}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="mt-2 text-sm text-bad">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </li>
  );
}

export default function ExplorePage() {
  const { data, error, isLoading, mutate: reload } = useSWR<Campaign[]>("/campaigns", api);
  const [appliedIds, setAppliedIds] = useState<number[]>([]);
  const firstOpen = data?.find((campaign) => campaign.my_application == null && !appliedIds.includes(campaign.id));

  return (
    <main className="px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Explore</h1>
      <div className="mt-2">
        <FeeNote />
      </div>
      {isLoading ? <ExploreSkeleton /> : null}
      {error ? (
        <LoadError
          message={error instanceof Error ? error.message : "Something went wrong. Please try again."}
          onRetry={() => void reload()}
        />
      ) : null}
      {data && data.length === 0 ? (
        <p className="mt-8">No open campaigns right now. New ones appear here as brands post them.</p>
      ) : null}
      {data && data.length > 0 ? (
        <ul className="mt-4">
          {data.map((campaign) => (
            <CampaignRow
              key={campaign.id}
              campaign={campaign}
              primary={firstOpen?.id === campaign.id}
              justApplied={appliedIds.includes(campaign.id)}
              onApplied={() => setAppliedIds((ids) => (ids.includes(campaign.id) ? ids : [...ids, campaign.id]))}
            />
          ))}
        </ul>
      ) : null}
    </main>
  );
}

function ExploreSkeleton() {
  return (
    <div className="mt-6" aria-busy="true">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-3 h-16 w-full" />
      <Skeleton className="mt-3 h-8 w-28" />
    </div>
  );
}
