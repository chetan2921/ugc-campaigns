"use client";

import { Suspense, use, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { Popover } from "@base-ui/react/popover";
import { buttonVariants } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LoadError } from "@/components/load-error";
import { PayoutBill } from "@/components/payout-bill";
import { ReviewPanel } from "@/components/review-panel";
import { CampaignStatus, SlotMeter } from "@/components/slot-meter";
import { StatusPill } from "@/components/status-pill";
import { Timeline } from "@/components/timeline";
import { ApiError, api, post } from "@/lib/api";
import { formatIST } from "@/lib/time";
import type { AppEvent, AppStatus, Application, Campaign } from "@/lib/types";
import { cn } from "cn";

const TABS = ["applicants", "approved", "review", "finished"] as const;
type Tab = (typeof TABS)[number];
const FINISHED = new Set<AppStatus>(["paid", "rejected", "declined", "withdrawn", "expired"]);

function isTab(value: string | null): value is Tab {
  return TABS.includes(value as Tab);
}

function firstTab(apps: Application[]): Tab {
  if (apps.some((app) => app.status === "applied")) return "applicants";
  if (apps.some((app) => app.status === "approved")) return "approved";
  if (apps.some((app) => app.status === "submitted" || app.status === "revision_requested")) return "review";
  if (apps.some((app) => FINISHED.has(app.status))) return "finished";
  return "applicants";
}

function approveBlock(campaign: Campaign): string | null {
  if (campaign.status === "cancelled") return "This campaign is cancelled";
  if (campaign.filled_slots >= campaign.slots) return "All slots are filled";
  if (Date.now() >= new Date(campaign.submit_deadline).getTime()) return "The submission deadline has passed";
  return null;
}

function terminalNote(app: Application): string | null {
  for (let i = app.events.length - 1; i >= 0; i -= 1) {
    const event = app.events[i];
    if (event.to_status === app.status && event.note) return event.note;
  }
  return null;
}

function handleOf(handle: string | null): string | null {
  if (!handle) return null;
  return handle.startsWith("@") ? handle : `@${handle}`;
}

export default function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<CampaignFallback />}>
      <CampaignScreen key={id} id={id} />
    </Suspense>
  );
}

function CampaignFallback() {
  return (
    <main className="px-4 py-4 md:px-8 md:py-6" aria-busy="true">
      <h1 className="sr-only">Loading campaign</h1>
      <Skeleton className="h-7 w-64" />
      <Skeleton className="mt-3 h-4 w-80" />
      <Skeleton className="mt-4 h-8 w-full" />
    </main>
  );
}

function CampaignScreen({ id }: { id: string }) {
  const search = useSearchParams();
  const requested = search.get("tab");
  const campaign = useSWR<Campaign>(`/campaigns/${id}`, api, { refreshInterval: 10_000 });
  const applications = useSWR<Application[]>(`/campaigns/${id}/applications`, api, { refreshInterval: 10_000 });
  const [picked, setPicked] = useState<Tab | null>(isTab(requested) ? requested : null);
  const [followedQuery, setFollowedQuery] = useState(requested);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  // The first non-empty tab is the arrival default. Later refreshes must not move it.
  if (requested !== followedQuery) {
    setFollowedQuery(requested);
    if (isTab(requested)) setPicked(requested);
  } else if (picked == null && applications.data && !isTab(requested)) {
    setPicked(firstTab(applications.data));
  }

  const failed = campaign.error || applications.error;
  if (failed) {
    const message = failed instanceof Error ? failed.message : "Something went wrong. Please try again.";
    return (
      <main className="px-4 py-4 md:px-8 md:py-6">
        <h1 className="text-2xl font-semibold tracking-tight">Campaign</h1>
        <LoadError
          message={message}
          onRetry={() => {
            void campaign.mutate();
            void applications.mutate();
          }}
        />
      </main>
    );
  }
  if (!campaign.data || !applications.data) return <CampaignFallback />;

  const current = campaign.data;
  const apps = applications.data;
  const tab = picked ?? firstTab(apps);
  const block = approveBlock(current);
  const groups = {
    applicants: apps.filter((app) => app.status === "applied"),
    approved: apps.filter((app) => app.status === "approved"),
    review: apps.filter((app) => app.status === "submitted" || app.status === "revision_requested"),
    finished: apps.filter((app) => FINISHED.has(app.status)),
  };

  async function run(task: () => Promise<unknown>, success: string): Promise<boolean> {
    setActionError(null);
    setPending(true);
    try {
      await task();
      toast.success(success);
      await Promise.all([
        mutate(`/campaigns/${id}`),
        mutate(`/campaigns/${id}/applications`),
        mutate("/campaigns/mine"),
      ]);
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
      setActionError(message);
      toast.error(message);
      return false;
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="px-4 py-4 md:px-8 md:py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{current.title}</h1>
            <CampaignStatus status={current.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Apply by {formatIST(current.apply_deadline)} · Submit by {formatIST(current.submit_deadline)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/brand/campaigns/${current.id}/edit`} className={buttonVariants({ variant: "outline" })}>
            Edit
          </Link>
          {current.status === "active" ? (
            <Button type="button" variant="destructive" onClick={() => setCancelOpen(true)}>
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
      {current.description ? <p className="mt-3 max-w-prose text-sm">{current.description}</p> : null}
      <div className="mt-4">
        <SlotMeter campaign={current} />
      </div>
      {actionError ? (
        <p role="alert" className="mt-3 text-sm text-bad">
          {actionError}
        </p>
      ) : null}
      <Tabs value={tab} onValueChange={(value) => { if (isTab(String(value))) setPicked(value as Tab); }} className="mt-4">
        <TabsList variant="line" className="h-auto w-full flex-wrap justify-start group-data-horizontal/tabs:h-auto">
          <TabsTrigger className="h-8 flex-none px-2" value="applicants">Applicants</TabsTrigger>
          <TabsTrigger className="h-8 flex-none px-2" value="approved">Approved</TabsTrigger>
          <TabsTrigger className="h-8 flex-none px-2" value="review">Posts to review</TabsTrigger>
          <TabsTrigger className="h-8 flex-none px-2" value="finished">Finished</TabsTrigger>
        </TabsList>
        <TabsContent value="applicants">
          <ApplicationList
            empty="No applicants waiting."
            rows={groups.applicants.map((app, index) => (
              <li key={app.id} className="border-b border-border py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <CreatorLine app={app} />
                  <div className="flex gap-2">
                    <ApproveButton
                      reason={block}
                      pending={pending}
                      primary={tab === "applicants" && index === 0}
                      onApprove={() => void run(() => post(`/applications/${app.id}/approve`), `${app.creator.name} approved`)}
                    />
                    <DeclineButton
                      app={app}
                      pending={pending}
                      onDecline={(reason) =>
                        run(
                          () => post(`/applications/${app.id}/decline`, reason ? { reason } : {}),
                          `${app.creator.name} declined`,
                        )
                      }
                    />
                  </div>
                </div>
                <History events={app.events} />
              </li>
            ))}
          />
        </TabsContent>
        <TabsContent value="approved">
          <ApplicationList
            empty="No approved creators yet."
            rows={groups.approved.map((app) => (
              <li key={app.id} className="border-b border-border py-3">
                <CreatorLine app={app} />
                <p className="mt-1 text-sm">Post due {formatIST(app.campaign.submit_deadline)}</p>
                <History events={app.events} />
              </li>
            ))}
          />
        </TabsContent>
        <TabsContent value="review">
          <ApplicationList
            empty="No posts to review."
            rows={groups.review.map((app, index) => (
              <li key={app.id} className="border-b border-border py-3">
                <CreatorLine app={app} />
                <div className="mt-2">
                  <ReviewPanel
                    application={app}
                    pending={pending}
                    primary={tab === "review" && index === 0}
                    onReview={(action, note) =>
                      run(
                        () => post(`/applications/${app.id}/review`, note ? { action, note } : { action }),
                        action === "approve" ? `Paid ${app.creator.name}` : action === "revise" ? "Changes requested" : "Post rejected",
                      )
                    }
                  />
                </div>
                <History events={app.events} />
              </li>
            ))}
          />
        </TabsContent>
        <TabsContent value="finished">
          <ApplicationList
            empty="Nothing has finished."
            rows={groups.finished.map((app) => (
              <li key={app.id} className="border-b border-border py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CreatorLine app={app} />
                  <StatusPill status={app.status} />
                </div>
                {app.payout ? (
                  <div className="mt-2">
                    <PayoutBill payout={app.payout} />
                  </div>
                ) : terminalNote(app) ? (
                  <p className="mt-1 text-sm">{terminalNote(app)}</p>
                ) : null}
                <History events={app.events} />
              </li>
            ))}
          />
        </TabsContent>
      </Tabs>
      <Dialog open={cancelOpen} onOpenChange={(open) => { if (!pending) setCancelOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel campaign</DialogTitle>
            <DialogDescription>
              Pending applicants will be declined. Approved creators keep their spot and are still paid for approved posts.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setCancelOpen(false)}>
              Keep campaign
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() =>
                void run(() => post(`/campaigns/${current.id}/cancel`), "Campaign cancelled").then((ok) => {
                  if (ok) setCancelOpen(false);
                })
              }
            >
              {pending ? "Cancelling" : "Cancel campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function ApplicationList({ empty, rows }: { empty: string; rows: ReactNode[] }) {
  if (rows.length === 0) return <p className="py-3 text-sm text-muted-foreground">{empty}</p>;
  return <ul>{rows}</ul>;
}

function CreatorLine({ app }: { app: Application }) {
  const handle = handleOf(app.creator.instagram_handle);
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium">
        {app.creator.name}
        {handle ? <span className="ml-2 font-normal text-muted-foreground">{handle}</span> : null}
      </p>
      {app.note ? <p className="mt-1 text-sm">{app.note}</p> : null}
    </div>
  );
}

function History({ events }: { events: AppEvent[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" className="mt-2 text-sm text-primary underline" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        History
      </button>
      {open ? <Timeline events={events} /> : null}
    </div>
  );
}

function ApproveButton({
  reason,
  pending,
  primary,
  onApprove,
}: {
  reason: string | null;
  pending: boolean;
  primary: boolean;
  onApprove: () => void;
}) {
  const button = (
    <Button type="button" data-primary-cta={primary ? true : undefined} disabled={pending || reason != null} onClick={onApprove}>
      Approve
    </Button>
  );
  if (!reason) return button;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className="inline-flex rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            tabIndex={0}
            aria-label={`Approve unavailable. ${reason}`}
          />
        }
      >
        {button}
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

function DeclineButton({
  app,
  pending,
  onDecline,
}: {
  app: Application;
  pending: boolean;
  onDecline: (reason: string) => Promise<boolean>;
}) {
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className={cn(buttonVariants({ variant: "outline" }))} disabled={pending}>
        Decline
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="end" className="z-50">
          <Popover.Popup className="w-72 rounded-lg border border-border bg-popover p-3 text-sm text-popover-foreground outline-none">
            <form
              className="grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void onDecline(reason.trim()).then((ok) => {
                  if (!ok) return;
                  setReason("");
                  setOpen(false);
                });
              }}
            >
              <Label htmlFor={`decline-${app.id}`}>Reason (optional)</Label>
              <Textarea
                id={`decline-${app.id}`}
                value={reason}
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
              />
              <Button type="submit" variant="destructive" className="w-fit" disabled={pending}>
                {pending ? "Declining" : "Decline"}
              </Button>
            </form>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
