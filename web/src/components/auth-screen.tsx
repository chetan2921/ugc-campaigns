import type { ReactNode } from "react";

export function AuthScreen({
  title,
  lede,
  children,
}: {
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-full bg-background">
      <header className="px-4 py-3 md:px-8">
        <p className="text-sm font-semibold tracking-tight">Campaigns</p>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-col px-4 pb-12 pt-4 md:pt-10">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {lede ? <p className="mt-2 text-sm text-muted-foreground">{lede}</p> : null}
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
