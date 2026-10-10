import { STATUS_LABEL } from "@/lib/next-step";
import { formatIST } from "@/lib/time";
import type { AppEvent } from "@/lib/types";

export function Timeline({ events }: { events: AppEvent[] }) {
  if (events.length === 0) {
    return <p className="mt-2 text-sm text-muted-foreground">No history yet.</p>;
  }
  return (
    <ol className="mt-2 grid gap-2">
      {events.map((event, index) => (
        <li key={`${event.created_at}-${event.to_status}-${index}`}>
          <p className="text-sm font-medium">{STATUS_LABEL[event.to_status]}</p>
          {event.note ? <p className="text-sm">{event.note}</p> : null}
          <p className="text-xs text-muted-foreground">{formatIST(event.created_at)}</p>
        </li>
      ))}
    </ol>
  );
}
