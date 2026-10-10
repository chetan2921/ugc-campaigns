import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">That address is not in this app.</p>
      <p className="mt-6">
        <Link href="/" className="text-sm text-primary underline">
          Back to Campaigns
        </Link>
      </p>
    </main>
  );
}
