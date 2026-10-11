import { toast } from "sonner";
import { ApiError } from "./api";

export function errorText(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
}

/** Confirm on the click, not after the round trip. A refusal replaces the same toast with the reason. */
export async function instant<T>(message: string, request: () => Promise<T>): Promise<T> {
  const id = toast.success(message);
  try {
    return await request();
  } catch (err) {
    toast.error(errorText(err), { id });
    throw err;
  }
}
