const ist = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

export const formatIST = (iso: string) => `${ist.format(new Date(iso))} IST`;

/** <input type="datetime-local"> value, read as IST, to an ISO string the API accepts. */
export const istInputToISO = (value: string) => `${value}:00+05:30`;

/** ISO from the API back to a datetime-local value in IST (for the edit form). */
export function isoToISTInput(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + 330 * 60_000);
  return shifted.toISOString().slice(0, 16);
}
