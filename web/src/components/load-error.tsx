import { Button } from "@/components/ui/button";

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mt-6 grid justify-items-start gap-3">
      <p role="alert" className="text-sm text-bad">
        {message}
      </p>
      <Button type="button" variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
