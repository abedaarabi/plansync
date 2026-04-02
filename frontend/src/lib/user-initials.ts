/** Two-letter initials for avatar fallbacks (name preferred, then email local-part). */
export function userInitials(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  const n = name?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  const e = email?.trim();
  if (e && e.includes("@")) {
    const local = e.split("@")[0] ?? "";
    return (local.slice(0, 2) || "?").toUpperCase();
  }
  return "?";
}
