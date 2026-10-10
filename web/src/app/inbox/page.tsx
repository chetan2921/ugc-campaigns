"use client";

import { useState } from "react";
import useSWR from "swr";
import { LoadError } from "@/components/load-error";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatIST } from "@/lib/time";
import type { Notification } from "@/lib/types";
import { cn } from "cn";

type Filter = "all" | "held" | "sent" | "skipped";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "held", label: "Held" },
  { id: "sent", label: "Sent" },
  { id: "skipped", label: "Not sent" },
];

function channelLabel(channel: Notification["channel"]): string {
  return channel === "email" ? "Email" : "WhatsApp";
}

function isHeld(item: Notification, now: number): boolean {
  return item.status === "queued" && new Date(item.send_at).getTime() > now;
}

function statusLine(item: Notification, now: number): string {
  if (item.status === "sent") return `Sent ${formatIST(item.sent_at ?? item.created_at)}`;
  if (item.status === "skipped") return `Not sent: ${item.skip_reason ?? "Skipped"}`;
  if (isHeld(item, now)) return `Held until ${formatIST(item.send_at)} (quiet hours 9 PM to 9 AM)`;
  return "Sending…";
}

function matches(item: Notification, filter: Filter, now: number): boolean {
  if (filter === "all") return true;
  if (filter === "held") return isHeld(item, now);
  if (filter === "sent") return item.status === "sent";
  return item.status === "skipped";
}

type Inbox = { items: Notification[]; fetchedAt: number };

async function loadInbox(path: string): Promise<Inbox> {
  const items = await api<Notification[]>(path);
  return { items, fetchedAt: Date.now() };
}

export default function InboxPage() {
  const { data, error, isLoading, mutate } = useSWR<Inbox>("/notifications", loadInbox, { refreshInterval: 5_000 });
  const [filter, setFilter] = useState<Filter>("all");
  const now = data?.fetchedAt ?? 0;
  const items = data?.items;
  const rows = (items ?? []).filter((item) => matches(item, filter, now));

  return (
    <main className="px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        This is where the mock email and WhatsApp messages land.
      </p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter messages">
        {FILTERS.map((item) => {
          const on = filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={on}
              className={cn("rounded-md px-2 py-1 text-sm", on && "bg-secondary font-medium")}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {isLoading ? <InboxSkeleton /> : null}
      {error ? (
        <LoadError
          message={error instanceof Error ? error.message : "Something went wrong. Please try again."}
          onRetry={() => void mutate()}
        />
      ) : null}
      {items && items.length === 0 ? (
        <p className="mt-8">Nothing yet. Updates about your campaigns show up here.</p>
      ) : null}
      {items && items.length > 0 && rows.length === 0 ? <p className="mt-8">Nothing in this filter.</p> : null}
      {rows.length > 0 ? (
        <ul className="mt-2">
          {rows.map((item) => (
            <li key={item.id} className="border-b border-border py-3">
              <p className="text-sm font-medium">{channelLabel(item.channel)}</p>
              <p className="mt-1 text-sm">{item.body}</p>
              <p className="mt-1 text-sm text-muted-foreground">{formatIST(item.created_at)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{statusLine(item, now)}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}

function InboxSkeleton() {
  return (
    <div className="mt-6" aria-busy="true">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-16 w-full" />
      <Skeleton className="mt-2 h-16 w-full" />
    </div>
  );
}
