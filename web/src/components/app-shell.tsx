"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { homeFor } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { creatorNextStep } from "@/lib/next-step";
import { clearToken } from "@/lib/token";
import type { Application, User, Wallet } from "@/lib/types";
import { cn } from "cn";

type Item = {
  href: string;
  label: string;
  short: string;
  badge?: number;
  detail?: string;
};

function isCurrent(href: string, pathname: string) {
  if (href === "/creator") return pathname === href;
  if (href === "/brand/campaigns/new") return pathname === href;
  // Campaign detail and edit stay under Campaigns. New campaign has its own item.
  if (href === "/brand") return pathname === "/brand" || (pathname.startsWith("/brand/") && pathname !== "/brand/campaigns/new");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ShellSkeleton() {
  return (
    <div className="min-h-full md:grid md:grid-cols-[220px_minmax(0,1fr)]" aria-busy="true">
      <div className="hidden border-r border-border p-4 md:block">
        <Skeleton className="h-4 w-24" />
        <div className="mt-6 grid gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      </div>
      <main className="px-4 py-6">
        <h1 className="sr-only">Loading</h1>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-3 h-4 w-64" />
      </main>
    </div>
  );
}

function NavLink({ item, pathname, compact }: { item: Item; pathname: string; compact?: boolean }) {
  const on = isCurrent(item.href, pathname);
  const name = item.badge
    ? `${item.label}, ${item.badge} need action`
    : item.detail
      ? `${item.label}, ${item.detail}`
      : item.label;
  return (
    <Link
      href={item.href}
      aria-current={on ? "page" : undefined}
      aria-label={name}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground",
        compact && "min-h-11 flex-col justify-center gap-0 px-1 py-1.5 text-xs",
        on && "bg-secondary font-medium",
      )}
    >
      <span className="truncate">{compact ? item.short : item.label}</span>
      {item.badge ? <span className="count">{item.badge}</span> : null}
      {item.detail ? (
        <span className={cn("money truncate text-muted-foreground", compact ? "w-full text-center text-[10px]" : "ml-auto text-xs")}>
          {item.detail}
        </span>
      ) : null}
    </Link>
  );
}

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const creator = user.role === "creator";
  const { data: apps } = useSWR<Application[]>(creator ? "/applications/mine" : null, api);
  const { data: wallet } = useSWR<Wallet>(creator ? "/wallet" : null, api);
  const needing = (apps ?? []).filter((item) => creatorNextStep(item).kind === "action").length;

  const items: Item[] = creator
    ? [
        { href: "/creator", label: "Explore", short: "Explore" },
        { href: "/creator/campaigns", label: "My campaigns", short: "Mine", badge: needing || undefined },
        {
          href: "/creator/wallet",
          label: "Wallet",
          short: "Wallet",
          detail: wallet ? formatINR(wallet.balance_paise) : undefined,
        },
        { href: "/inbox", label: "Inbox", short: "Inbox" },
        { href: "/settings", label: "Settings", short: "Settings" },
      ]
    : [
        { href: "/brand", label: "Campaigns", short: "Campaigns" },
        { href: "/brand/campaigns/new", label: "New campaign", short: "New" },
        { href: "/inbox", label: "Inbox", short: "Inbox" },
        { href: "/settings", label: "Settings", short: "Settings" },
      ];

  async function logout() {
    clearToken();
    await mutate(() => true, undefined, { revalidate: false });
    router.replace("/login");
  }

  return (
    <div className="min-h-full overflow-x-clip md:grid md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden min-h-screen flex-col border-r border-border md:flex">
        <Link href={homeFor(user.role)} className="px-4 py-4 text-sm font-semibold tracking-tight">
          Campaigns
        </Link>
        <nav aria-label="Sections" className="grid gap-1 px-2">
          {items.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>
        <div className="mt-auto grid gap-2 px-3 py-4">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="text-xs text-muted-foreground">{user.role === "brand" ? "Brand" : "Creator"}</p>
          <Button type="button" variant="ghost" className="justify-start px-2" onClick={logout}>
            Log out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <header className="flex items-center justify-between border-b border-border px-4 py-2 md:hidden">
          <Link href={homeFor(user.role)} className="text-sm font-semibold tracking-tight">
            Campaigns
          </Link>
          <Button type="button" variant="ghost" onClick={logout}>
            Log out
          </Button>
        </header>
        {children}
      </div>

      <nav
        aria-label="Sections"
        className={cn(
          "fixed inset-x-0 bottom-0 z-10 grid border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden",
          items.length === 5 ? "grid-cols-5" : "grid-cols-4",
        )}
      >
        {items.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} compact />
        ))}
      </nav>
    </div>
  );
}
