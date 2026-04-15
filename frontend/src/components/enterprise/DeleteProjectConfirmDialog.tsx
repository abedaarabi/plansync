"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";

type Props = {
  open: boolean;
  projectName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
};

export function DeleteProjectConfirmDialog({
  open,
  projectName,
  onConfirm,
  onCancel,
  isDeleting = false,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [confirmName, setConfirmName] = useState("");

  const nameMatches = confirmName === projectName;

  useEffect(() => {
    setConfirmName("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, isDeleting]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => nameInputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = panel.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const els = [...focusable].filter((el) => !el.hasAttribute("disabled"));
    if (els.length === 0) return;
    const first = els[0];
    const last = els[els.length - 1];
    const onTrap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    panel.addEventListener("keydown", onTrap);
    return () => panel.removeEventListener("keydown", onTrap);
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px] print:hidden"
      role="presentation"
      onClick={() => !isDeleting && onCancel()}
    >
      <div
        ref={panelRef}
        className="w-full max-w-md rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-5 shadow-2xl shadow-black/20"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-project-title"
        aria-describedby="delete-project-desc delete-project-type-label"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-600">
            <AlertTriangle className="h-5 w-5" strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="delete-project-title"
              className="text-base font-semibold text-[var(--enterprise-text)]"
            >
              Delete project?
            </h2>
            <p
              id="delete-project-desc"
              className="mt-2 text-sm leading-relaxed text-[var(--enterprise-text-muted)]"
            >
              <span className="font-medium text-[var(--enterprise-text)]">{projectName}</span> and
              all related data will be permanently removed: drawings and versions, issues, RFIs,
              punch lists, schedules, proposals, field reports, takeoffs, O&amp;M records, and team
              access. This cannot be undone.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-2 border-t border-[var(--enterprise-border)] pt-4">
          <label
            id="delete-project-type-label"
            htmlFor="delete-project-name-input"
            className="block text-sm font-medium text-[var(--enterprise-text)]"
          >
            Type the project name to confirm
          </label>
          <p className="text-[12px] text-[var(--enterprise-text-muted)]">
            Enter{" "}
            <span className="rounded bg-[var(--enterprise-bg)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--enterprise-text)] ring-1 ring-[var(--enterprise-border)]">
              {projectName || "—"}
            </span>{" "}
            exactly (case-sensitive).
          </p>
          <input
            ref={nameInputRef}
            id="delete-project-name-input"
            type="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={isDeleting}
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            className="w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm text-[var(--enterprise-text)] shadow-sm placeholder:text-[var(--enterprise-text-muted)] focus:border-red-500/60 focus:outline-none focus:ring-2 focus:ring-red-500/25 disabled:opacity-50"
            placeholder={projectName ? `Type “${projectName}”` : "Project name"}
          />
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[var(--enterprise-border)] pt-4">
          <button
            ref={cancelRef}
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-2 text-sm font-semibold text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-hover-surface)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting || !nameMatches}
            onClick={onConfirm}
            title={!nameMatches ? "Enter the exact project name above" : undefined}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:pointer-events-none disabled:opacity-40"
          >
            {isDeleting ? "Deleting…" : "Delete project"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
