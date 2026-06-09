"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, ListChecks, X } from "lucide-react";
import { useViewerStore } from "@/store/viewerStore";

const STORAGE_KEY = "plansync-issue-guide-dismissed-v1";
const LEGACY_STORAGE_KEY = "plansync-issue-review-guide-dismissed-v1";

type Step = {
  id: string;
  title: string;
  detail: string;
  done: boolean;
};

type Props = {
  variant: "create" | "edit";
  hasPin: boolean;
  hasTitle: boolean;
  hasAssignee: boolean;
};

/**
 * Step-by-step issue checklist while creating an issue (per-session dismiss).
 */
export function IssueGuide({ variant, hasPin, hasTitle, hasAssignee }: Props) {
  const viewerProjectId = useViewerStore((s) => s.viewerProjectId);
  const [hidden, setHidden] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const dismissed =
        sessionStorage.getItem(STORAGE_KEY) === "1" ||
        sessionStorage.getItem(LEGACY_STORAGE_KEY) === "1";
      setHidden(dismissed);
    } catch {
      setHidden(false);
    }
    setReady(true);
  }, []);

  if (!ready || hidden || variant !== "create") return null;

  const steps: Step[] = [
    {
      id: "revision",
      title: "Confirm sheet revision",
      detail: "Check the revision badge matches the drawing set you are working from.",
      done: true,
    },
    {
      id: "pin",
      title: "Drop a location pin",
      detail:
        "Click the drawing where the issue occurs — optional but helps the team find it fast.",
      done: hasPin,
    },
    {
      id: "title",
      title: "Write a clear title",
      detail: "One line summary — what is wrong or what needs action.",
      done: hasTitle,
    },
    {
      id: "assign",
      title: "Assign an owner",
      detail: "Route the issue to the right person or discipline.",
      done: hasAssignee,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;

  const dismiss = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
      sessionStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  return (
    <div className="viewer-card mb-3 space-y-2 border border-blue-500/25 bg-blue-950/20 p-2.5 ring-1 ring-blue-500/15">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300/90">
            <ListChecks className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Issue checklist
          </div>
          <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
            {doneCount}/{steps.length} complete
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="viewer-focus-ring shrink-0 rounded-md p-0.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
          title="Hide checklist for this session"
          aria-label="Dismiss issue checklist"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <ol className="space-y-1.5">
        {steps.map((s, i) => (
          <li key={s.id} className="flex gap-2 text-[10px] leading-snug">
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold ${
                s.done
                  ? "border-blue-500/60 bg-blue-600/25 text-blue-200"
                  : "border-slate-600 text-slate-500"
              }`}
              aria-hidden
            >
              {s.done ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : i + 1}
            </span>
            <span>
              <span className={`font-medium ${s.done ? "text-slate-200" : "text-slate-400"}`}>
                {s.title}
              </span>
              <span className="mt-0.5 block text-slate-500">{s.detail}</span>
            </span>
          </li>
        ))}
      </ol>
      {viewerProjectId ? (
        <a
          href={`/projects/${viewerProjectId}/rfis`}
          target="_blank"
          rel="noopener noreferrer"
          className="viewer-focus-ring inline-flex items-center gap-1 text-[10px] font-medium text-blue-400/90 transition hover:text-blue-300"
        >
          Open project RFIs
          <ExternalLink className="h-3 w-3" strokeWidth={2} aria-hidden />
        </a>
      ) : null}
    </div>
  );
}
