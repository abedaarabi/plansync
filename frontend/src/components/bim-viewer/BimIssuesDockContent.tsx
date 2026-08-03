"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleAlert, MapPin, Plus } from "lucide-react";
import type { IssueRow } from "@/lib/api-client/core-issues-takeoff";
import { presignReadIssueReferencePhoto } from "@/lib/api-client";
import {
  bimIssueDockFiltersActive,
  countBimIssueDockFilterMatches,
  EMPTY_BIM_ISSUE_DOCK_FILTERS,
  filterBimDockIssues,
  type BimIssueDockFilters,
} from "@/lib/bim/bimIssueDockFilters";
import { BimIssueDockFiltersBar } from "./BimIssueDockFiltersBar";
import { BimIssueDockIssueCard } from "./BimIssueDockIssueCard";
import { BimIssuePhotoLightbox } from "./BimIssuePhotoLightbox";

function IssueDockActionBar(props: {
  hasSelection: boolean;
  onStartPlacement: () => void;
  onStartCreateOnSelection?: () => void;
}) {
  return (
    <div className="sticky top-0 z-10 flex shrink-0 gap-1.5 border-b border-[var(--bim-border)] bg-[color-mix(in_srgb,var(--bim-panel)_92%,transparent)] px-2.5 py-2 backdrop-blur-sm">
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
  );
}

function useIssuePhotoUrls(issues: IssueRow[]) {
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const photoDeps = useMemo(
    () =>
      issues
        .map((i) => {
          const p = i.referencePhotos?.[0];
          return p ? `${i.id}:${p.id}` : "";
        })
        .filter(Boolean)
        .join("|"),
    [issues],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        issues.map(async (issue) => {
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
  }, [photoDeps, issues]);

  return photoUrls;
}

// fallow-ignore-next-line complexity
function matchesIssueSearchQuery(issue: IssueRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    issue.title.toLowerCase().includes(q) ||
    (issue.description ?? "").toLowerCase().includes(q) ||
    (issue.location ?? "").toLowerCase().includes(q)
  );
}

// fallow-ignore-next-line complexity
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
  const [filters, setFilters] = useState<BimIssueDockFilters>(EMPTY_BIM_ISSUE_DOCK_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [preview, setPreview] = useState<{ issueId: string; title: string; url: string } | null>(
    null,
  );
  const photoUrls = useIssuePhotoUrls(props.issues);

  const filterCounts = useMemo(() => countBimIssueDockFilterMatches(props.issues), [props.issues]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = filterBimDockIssues(props.issues, filters);
    list = [...list].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    if (!q) return list;
    return list.filter((issue) => matchesIssueSearchQuery(issue, q));
  }, [props.issues, query, filters]);

  useEffect(() => {
    if (!props.selectedIssueId) return;
    const el = document.getElementById(`bim-sidebar-issue-${props.selectedIssueId}`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [props.selectedIssueId, filtered.length]);

  const filtersActive = bimIssueDockFiltersActive(filters) || query.trim().length > 0;

  if (props.issues.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <IssueDockActionBar
          hasSelection={props.hasSelection}
          onStartPlacement={props.onStartPlacement}
          onStartCreateOnSelection={props.onStartCreateOnSelection}
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-10 text-center">
          <CircleAlert className="h-6 w-6 text-[var(--bim-text-muted)]" aria-hidden />
          <p className="text-[12px] font-medium text-[var(--bim-text)]">No issues on this model</p>
          <p className="max-w-[14rem] text-[10px] leading-relaxed text-[var(--bim-text-muted)]">
            Place an issue on the model, link one from a markup, or create on a selected element.
          </p>
          {!props.hasSelection ? (
            <button
              type="button"
              onClick={props.onStartPlacement}
              className="bim-btn-primary inline-flex items-center gap-1.5 px-3 py-2 text-[11px]"
            >
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              Place issue on model
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <IssueDockActionBar
          hasSelection={props.hasSelection}
          onStartPlacement={props.onStartPlacement}
          onStartCreateOnSelection={props.onStartCreateOnSelection}
        />

        <div className="border-b border-[var(--bim-border)] px-2.5 py-2">
          <BimIssueDockFiltersBar
            query={query}
            onQueryChange={setQuery}
            filters={filters}
            filterCounts={filterCounts}
            open={filtersOpen}
            onToggleOpen={() => setFiltersOpen((v) => !v)}
            onChange={setFilters}
            onResetFilters={() => setFilters(EMPTY_BIM_ISSUE_DOCK_FILTERS)}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-8 text-center">
            <CircleAlert className="h-5 w-5 text-[var(--bim-text-muted)]" aria-hidden />
            <p className="text-[12px] font-medium text-[var(--bim-text)]">No matching issues</p>
            <p className="text-[10px] text-[var(--bim-text-muted)]">
              Try clearing filters or widening your search.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-[var(--bim-border)] px-2.5 py-1.5">
              <p className="text-[10px] font-medium text-[var(--bim-text-muted)]">
                {filtersActive || query.trim()
                  ? `${filtered.length} of ${props.issues.length} issues`
                  : `${props.issues.length} issue${props.issues.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <ul className="bim-dock-scroll space-y-2 p-2.5">
              {filtered.map((issue) => {
                const thumb = photoUrls[issue.id];
                return (
                  <BimIssueDockIssueCard
                    key={issue.id}
                    issue={issue}
                    selected={props.selectedIssueId === issue.id}
                    photoUrl={thumb}
                    onOpenIssue={props.onOpenIssue}
                    onFocusIssue={props.onFocusIssue}
                    onPhotoClick={
                      thumb
                        ? () => setPreview({ issueId: issue.id, title: issue.title, url: thumb })
                        : undefined
                    }
                  />
                );
              })}
            </ul>
          </>
        )}
      </div>

      <BimIssuePhotoLightbox
        open={Boolean(preview)}
        photoUrl={preview?.url ?? null}
        title={preview?.title}
        onClose={() => setPreview(null)}
      />
    </>
  );
}
