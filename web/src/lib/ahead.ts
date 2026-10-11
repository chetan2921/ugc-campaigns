"use client";

import { useState } from "react";

function caughtUp<T extends { id: number }>(row: T, patch: Partial<T>): boolean {
  return Object.entries(patch).every(([key, value]) => row[key as keyof T] === value);
}

/** Show a status change before the save returns. Drop it once the server copy matches. */
export function useAhead<T extends { id: number }>(rows: T[] | undefined) {
  const [patches, setPatches] = useState<Record<number, Partial<T>>>({});
  const [seen, setSeen] = useState(rows);
  if (rows !== seen) {
    setSeen(rows);
    setPatches((prev) => {
      if (!rows) return prev;
      const next = { ...prev };
      let changed = false;
      for (const row of rows) {
        const patch = next[row.id];
        if (patch && caughtUp(row, patch)) {
          delete next[row.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }

  const shown = (rows ?? []).map((row) => (patches[row.id] ? { ...row, ...patches[row.id] } : row));

  function preview(id: number, patch: Partial<T>) {
    setPatches((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function revert(id: number) {
    setPatches((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  return { shown, preview, revert };
}
