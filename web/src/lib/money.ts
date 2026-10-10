const whole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const exact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });

/** ₹10,000 for whole rupees, ₹8,731.80 otherwise. */
export function formatINR(paise: number): string {
  return paise % 100 === 0 ? whole.format(paise / 100) : exact.format(paise / 100);
}

/** "499.5" -> 49950. Parses the string so no floating-point error can creep in. */
export function rupeesToPaise(text: string): number | null {
  const m = text.trim().replace(/,/g, "").match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}
