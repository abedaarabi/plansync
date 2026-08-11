import type { CloudFile } from "@/types/projects";

export function sortedFileVersions(f: CloudFile) {
  return [...f.versions].sort((a, b) => b.version - a.version);
}

export function relativeTime(iso: string, nowMs: number): string {
  const diff = nowMs - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatDateLabel(iso?: string | null): string {
  if (!iso) return "Not set";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not set";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Sort key: prefer last viewer open, then upload/update, then created. */
export function fileRecencySortKey(f: CloudFile): number {
  const iso = f.lastOpenedAt ?? f.updatedAt ?? f.createdAt;
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function fileActivityLabel(f: CloudFile, nowMs: number): string | null {
  const iso = f.lastOpenedAt ?? f.updatedAt;
  if (!iso) return null;
  return relativeTime(iso, nowMs);
}
