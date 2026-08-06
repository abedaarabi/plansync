export type ActiveSection = "client" | "pricing" | "cover" | "review";
export type SaveStatus = "saved" | "saving" | "unsaved" | "error";

export const EDITOR_STEPS: { id: ActiveSection; label: string; number: number }[] = [
  { id: "client", label: "Client", number: 1 },
  { id: "pricing", label: "Pricing", number: 2 },
  { id: "cover", label: "Cover", number: 3 },
  { id: "review", label: "Review & Send", number: 4 },
];

export function fmtMoney(amount: string, currency: string) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.length === 3 ? currency : "USD",
    }).format(n);
  } catch {
    return amount;
  }
}

/** True when cover HTML has real text (not empty / empty paragraph). */
export function coverHasMeaningfulContent(html: string): boolean {
  const t = html.trim();
  if (!t) return false;
  if (t === "<p></p>" || t === "<p><br></p>" || t === "<p><br/></p>") return false;
  const text = t
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0;
}
