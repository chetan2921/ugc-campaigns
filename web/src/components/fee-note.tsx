"use client";

import { Popover } from "@base-ui/react/popover";

export const FEE_NOTE =
  "Platform fee (10%) + 18% GST on that fee, and 1% TDS are deducted from this at payout.";

export function FeeNote() {
  return <p className="max-w-prose text-sm text-muted-foreground">{FEE_NOTE}</p>;
}

/** Opens on click. A hover-only tooltip never appears on a phone, which is where creators are. */
export function FeeHint() {
  return (
    <Popover.Root>
      <Popover.Trigger className="text-sm text-muted-foreground underline decoration-dotted">
        before deductions
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} className="z-50">
          <Popover.Popup className="w-64 rounded-md bg-foreground px-3 py-1.5 text-left text-xs text-background outline-none">
            {FEE_NOTE}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
