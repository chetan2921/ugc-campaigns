"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell, ShellSkeleton } from "@/components/app-shell";
import { homeFor, useMe } from "@/lib/auth";
import { getToken } from "@/lib/token";
import type { Role } from "@/lib/types";

export function RequireRole({
  role,
  children,
}: {
  role?: Role;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: me, error } = useMe();

  useEffect(() => {
    if (!getToken() || error) {
      router.replace("/login");
      return;
    }
    if (me && role && me.role !== role) router.replace(homeFor(me.role));
  }, [me, error, role, router]);

  if (!me || (role && me.role !== role)) return <ShellSkeleton />;
  return <AppShell user={me}>{children}</AppShell>;
}
