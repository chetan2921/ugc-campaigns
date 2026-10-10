"use client";

import { use } from "react";
import Link from "next/link";
import useSWR from "swr";
import { CampaignForm } from "@/components/campaign-form";
import { LoadError } from "@/components/load-error";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { Campaign } from "@/lib/types";

export default function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, isLoading, mutate } = useSWR<Campaign>(`/campaigns/${id}`, api);

  return (
    <main className="px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Edit campaign</h1>
      {isLoading ? (
        <div className="mt-6 grid max-w-xl gap-3" aria-busy="true">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-2/3" />
        </div>
      ) : null}
      {error ? (
        <LoadError message={error instanceof Error ? error.message : "Something went wrong. Please try again."} onRetry={() => mutate()} />
      ) : null}
      {data && data.status === "cancelled" ? (
        <div className="mt-6 grid gap-3">
          <p>A cancelled campaign can&apos;t be edited.</p>
          <Link href={`/brand/campaigns/${data.id}`} className="text-sm text-primary underline">
            Back to {data.title}
          </Link>
        </div>
      ) : null}
      {data && data.status === "active" ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">{data.title}</p>
          <CampaignForm key={data.id} campaign={data} />
        </>
      ) : null}
    </main>
  );
}
