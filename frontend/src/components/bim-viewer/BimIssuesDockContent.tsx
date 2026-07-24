"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleAlert, Crosshair, ImageIcon, MapPin, Paperclip, Plus, Search } from "lucide-react";
import type { IssueRow } from "@/lib/api-client/core-issues-takeoff";
import { presignReadIssueReferencePhoto } from "@/lib/api-client";
import {
  ISSUE_STATUS_LABEL,
  issueStatusBadgeClass,
  issueStatusMarkerStrokeHex,
} from "@/lib/issueStatusStyle";

// fallow-ignore-next-line complexity
function issueHasAttachments(issue: IssueRow): boolean {
  return (
    (issue.referencePhotos?.length ?? 0) > 0 ||
    (issue.attachedMarkupAnnotationIds?.length ?? 0) > 0 ||
    (issue.linkedRfis?.length ?? 0) > 0
  );
}

export function BimIssuesDockContent(props: {
  issues: IssueRow[];
  selectedIssueId: string | null;
  onOpenIssue: (issue: IssueRow) => void;
  onFocusIssue: (issue: IssueRow) => void;
  onStartPlacement: () => void;
  onStartCreateOnSelection?: () => void;
  hasSelection: boolean;
}) {
  const [query, setQuery] = useState("");
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...props.issues].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    if (!q) return list;
    return list.filter(
      // fallow-ignore-next-line complexity
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q) ||
        (i.location ?? "").toLowerCase().includes(q),
    );
  }, [props.issues, query]);

  const photoDeps = useMemo(
    () =>
      props.issues
        .map((i) => {
          const p = i.referencePhotos?.[0];
          return p ? `${i.id}:${p.id}` : "";
        })
        .filter(Boolean)
        .join("|"),
    [props.issues],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        props.issues.map(async (issue) => {
          const photo = issue.referencePhotos?.[0];
          if (!photo) return null;
          try {
            const url = await presignReadIssueReferencePhoto(issue.id, photo.id);
            return [issue.id, url] as const;
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const e of entries) {
        if (e) next[e[0]] = e[1];
      }
      setPhotoUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [photoDeps, props.issues]);

  useEffect(() => {
    if (!props.selectedIssueId) return;
    const el = document.getElementById(`bim-sidebar-issue-${props.selectedIssueId}`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [props.selectedIssueId, filtered.length]);

  // fallow-ignore-next-line complexity
  const issueRows = filtered.map((issue) => {
    const selected = props.selectedIssueId === issue.id;
    const statusHex = issueStatusMarkerStrokeHex(issue.status);
    const thumb = photoUrls[issue.id];
    const attachments = issueHasAttachments(issue);

    return (
      <li key={issue.id} id={`bim-sidebar-issue-${issue.id}`}>
        <article
          className={`overflow-hidden rounded-xl border transition-colors duration-150 ${
            selected
              ? "border-[var(--bim-accent)] bg-[var(--bim-accent-muted)] shadow-sm"
              : "border-[var(--bim-border)] bg-[var(--bim-panel)] hover:bg-[var(--bim-hover)]"
          }`}
          style={selected ? undefined : { borderLeftWidth: 3, borderLeftColor: statusHex }}
        >
          <button
            type="button"
            aria-label="Fly to issue in model"
            title="Fly to issue in model"
            onClick={() => props.onFocusIssue(issue)}
            className="bim-focus-ring relative block w-full overflow-hidden border-b border-[var(--bim-border)] bg-[var(--bim-hover)]"
          >
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" className="aspect-[16/10] max-h-36 w-full object-cover" />
            ) : (
              <div className="flex aspect-[16/10] max-h-36 w-full items-center justify-center text-[var(--bim-text-muted)]">
                <ImageIcon className="h-8 w-8" aria-hidden />
              </div>
            )}
            {attachments ? (
              <span
                className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/55 px-1.5 py-0.5 text-white"
                title="Has attachments"
              >
                <Paperclip className="h-3 w-3" aria-hidden />
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => props.onOpenIssue(issue)}
            className="bim-focus-ring w-full p-2.5 text-left"
          >
            <span
              className={`mb-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${issueStatusBadgeClass(issue.status)}`}
            >
              {ISSUE_STATUS_LABEL[issue.status] ?? issue.status}
            </span>
            <h3 className="truncate text-[12px] font-semibold text-[var(--bim-text)]">
              {issue.title}
            </h3>
            {issue.description?.trim() ? (
              <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[var(--bim-text-muted)]">
                {issue.description}
              </p>
            ) : null}
            {(issue.attachedMarkupAnnotationIds?.length ?? 0) > 0 ? (
              <p className="mt-1 text-[9px] text-[var(--bim-text-muted)]">
                {issue.attachedMarkupAnnotationIds!.length} linked markup
                {issue.attachedMarkupAnnotationIds!.length === 1 ? "" : "s"}
              </p>
            ) : null}
          </button>

          <div className="flex items-center gap-1 border-t border-[var(--bim-border)] px-2 py-1.5">
            <button
              type="button"
              aria-label="Open issue details"
              onClick={() => props.onOpenIssue(issue)}
              className="bim-btn-secondary flex-1 py-1 text-[10px]"
            >
              Open
            </button>
            <button
              type="button"
              aria-label="Fly to issue in model"
              title="Fly to issue in model"
              onClick={() => props.onFocusIssue(issue)}
              className="bim-focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--bim-border)] text-[var(--bim-text-muted)] hover:bg-[var(--bim-hover)] hover:text-[var(--bim-text)]"
            >
              <Crosshair className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </article>
      </li>
    );
  });

  if (props.issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center">
        <CircleAlert className="h-6 w-6 text-[var(--bim-text-muted)]" aria-hidden />
        <p className="text-[12px] font-medium text-[var(--bim-text)]">No issues on this model</p>
        <p className="max-w-[14rem] text-[10px] leading-relaxed text-[var(--bim-text-muted)]">
          Place an issue on the model, link one from a markup, or create on a selected element.
        </p>
        <button
          type="button"
          onClick={props.onStartPlacement}
          className="bim-btn-primary inline-flex items-center gap-1.5 px-3 py-2 text-[11px]"
        >
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          Place issue on model
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex gap-1.5 border-b border-[var(--bim-border)] px-2.5 py-2">
        <button
          type="button"
          onClick={props.onStartPlacement}
          className="bim-btn-primary inline-flex flex-1 items-center justify-center gap-1.5 py-1.5 text-[11px]"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Place issue
        </button>
        {props.hasSelection ? (
          <button
            type="button"
            onClick={props.onStartCreateOnSelection}
            className="bim-btn-secondary inline-flex flex-1 items-center justify-center gap-1.5 py-1.5 text-[11px]"
          >
            On selection
          </button>
        ) : null}
      </div>
      <div className="border-b border-[var(--bim-border)] px-2.5 py-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--bim-text-muted)]"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search issues…"
            className="w-full rounded-lg border border-[var(--bim-border)] bg-[var(--bim-panel)] py-1.5 pl-7 pr-2 text-[12px] text-[var(--bim-text)] outline-none focus:border-[var(--bim-accent)]"
          />
        </div>
      </div>

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">{issueRows}</ul>
    </div>
  );
}
