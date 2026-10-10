"use client";

import Link from "next/link";
import useSWR from "swr";
import { buttonVariants } from "@/components/ui/button";
import { LoadError } from "@/components/load-error";
import { CampaignStatus, SlotMeter } from "@/components/slot-meter";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatIST } from "@/lib/time";
import type { Campaign } from "@/lib/types";
import { cn } from "cn";

function attentionParts(campaign: Campaign): { href: string; label: string }[] {
  const counts = campaign.counts;
  if (!counts) return [];
  const parts: { href: string; label: string }[] = [];
  if (counts.applied > 0) {
    const n = counts.applied;
    parts.push({
      href: `/brand/campaigns/${campaign.id}?tab=applicants`,
      label: `${n} ${n === 1 ? "applicant" : "applicants"} waiting`,
    });
  }
  if (counts.to_review > 0) {
    const n = counts.to_review;
    parts.push({
      href: `/brand/campaigns/${campaign.id}?tab=review`,
      label: `${n} ${n === 1 ? "post" : "posts"} to review`,
    });
  }
  return parts;
}

export default function BrandHomePage() {
  const { data, error, isLoading, mutate } = useSWR<Campaign[]>("/campaigns/mine", api);

  return (
    <main className="px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
      {isLoading ? <DashboardSkeleton /> : null}
      {error ? <LoadError message={error instanceof Error ? error.message : "Something went wrong. Please try again."} onRetry={() => mutate()} /> : null}
      {data && data.length === 0 ? (
        <div className="mt-8">
          <p>No campaigns yet</p>
          <Link href="/brand/campaigns/new" className={cn(buttonVariants(), "mt-6")} data-primary-cta>
            Create a campaign
          </Link>
        </div>
      ) : null}
      {data && data.length > 0 ? (
        <>
          <section className="mt-6">
            <h2 className="text-base font-semibold">Needs your attention</h2>
            <Attention campaigns={data} />
          </section>
          <section className="mt-10">
            <h2 className="text-base font-semibold">All campaigns</h2>
            <ul className="mt-2">
              {data.map((campaign) => (
                <li key={campaign.id} className="grid gap-2 border-b border-border py-3 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/brand/campaigns/${campaign.id}`} className="font-medium text-foreground underline">
                        {campaign.title}
                      </Link>
                      <CampaignStatus status={campaign.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Apply by {formatIST(campaign.apply_deadline)} · Submit by {formatIST(campaign.submit_deadline)}
                    </p>
                  </div>
                  <SlotMeter campaign={campaign} compact />
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </main>
  );
}

function Attention({ campaigns }: { campaigns: Campaign[] }) {
  const rows = campaigns
    .map((campaign) => ({ campaign, parts: attentionParts(campaign) }))
    .filter((row) => row.parts.length > 0);
  if (rows.length === 0) {
    return <p className="mt-2 text-sm text-muted-foreground">Nothing is waiting on you.</p>;
  }
  return (
    <ul className="mt-2">
      {rows.map(({ campaign, parts }) => (
        <li key={campaign.id} className="border-b border-border py-3">
          <Link href={`/brand/campaigns/${campaign.id}`} className="font-medium text-foreground underline">
            {campaign.title}
          </Link>
          <p className="mt-1 text-sm">
            {parts.map((part, index) => (
              <span key={part.href}>
                {index > 0 ? " · " : null}
                <Link href={part.href} className="text-primary underline">
                  {part.label}
                </Link>
              </span>
            ))}
          </p>
        </li>
      ))}
    </ul>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mt-6" aria-busy="true">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-3 h-12 w-full" />
      <Skeleton className="mt-8 h-4 w-32" />
      <Skeleton className="mt-3 h-14 w-full" />
      <Skeleton className="mt-2 h-14 w-full" />
    </div>
  );
}
