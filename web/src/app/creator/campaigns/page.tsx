"use client";

import useSWR from "swr";
import { ApplicationCard } from "@/components/application-card";
import { LoadError } from "@/components/load-error";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { Application, AppStatus } from "@/lib/types";

const ACTION = new Set<AppStatus>(["approved", "revision_requested"]);
const WAITING = new Set<AppStatus>(["applied", "submitted"]);

const GROUPS: { key: string; title: string; match: (status: AppStatus) => boolean }[] = [
  { key: "action", title: "Needs your action", match: (status) => ACTION.has(status) },
  { key: "waiting", title: "Waiting on the brand", match: (status) => WAITING.has(status) },
  { key: "finished", title: "Finished", match: (status) => !ACTION.has(status) && !WAITING.has(status) },
];

export default function MyCampaignsPage() {
  const { data, error, isLoading, mutate } = useSWR<Application[]>("/applications/mine", api, {
    refreshInterval: 10_000,
  });
  const groups = GROUPS.map((group) => ({
    ...group,
    rows: (data ?? []).filter((application) => group.match(application.status)),
  })).filter((group) => group.rows.length > 0);
  const firstAction = groups.find((group) => group.key === "action")?.rows[0]?.id;

  return (
    <main className="px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight">My campaigns</h1>
      {isLoading ? <CampaignsSkeleton /> : null}
      {error ? (
        <LoadError
          message={error instanceof Error ? error.message : "Something went wrong. Please try again."}
          onRetry={() => void mutate()}
        />
      ) : null}
      {data && data.length === 0 ? <p className="mt-8">Campaigns you have applied to will show up here.</p> : null}
      {groups.map((group, index) => (
        <section key={group.key} className={index === 0 ? "mt-6" : "mt-10"}>
          <h2 className="text-base font-semibold">{group.title}</h2>
          <ul className="mt-2">
            {group.rows.map((application) => (
              <ApplicationCard
                key={application.id}
                application={application}
                primary={application.id === firstAction}
              />
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

function CampaignsSkeleton() {
  return (
    <div className="mt-6" aria-busy="true">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="mt-3 h-16 w-full" />
      <Skeleton className="mt-2 h-16 w-full" />
    </div>
  );
}
