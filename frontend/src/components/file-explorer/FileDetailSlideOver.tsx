"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  Download,
  Eye,
  FileText,
  Layers3,
  ListTree,
  MessageSquare,
} from "lucide-react";
import type { CloudFile } from "@/types/projects";
import { formatItemDateOrDash, sortedVersions } from "./fileExplorerUtils";
import { EnterpriseSlideOver } from "@/components/enterprise/EnterpriseSlideOver";
import { FileCommentsPanel } from "./FileCommentsPanel";

type TabId = "details" | "versions" | "comments";

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  file: CloudFile | null;
  selectedVersion: number | null;
  onSelectVersion: (version: number) => void;
  onOpenFile: (file: CloudFile) => void;
  onDownloadFile: (file: CloudFile) => void;
  currentUserId?: string;
};

export function FileDetailSlideOver({
  open,
  onClose,
  projectId,
  file,
  selectedVersion,
  onSelectVersion,
  onOpenFile,
  onDownloadFile,
  currentUserId,
}: Props) {
  const [tab, setTab] = useState<TabId>("details");
  const versions = useMemo(() => (file ? sortedVersions(file) : []), [file]);
  const activeVersion =
    versions.find((item) => item.version === selectedVersion) ?? versions[0] ?? null;

  const tabs: Array<{ id: TabId; label: string; icon: typeof FileText }> = [
    { id: "details", label: "Details", icon: FileText },
    { id: "versions", label: "Versions", icon: ListTree },
    { id: "comments", label: "Comments", icon: MessageSquare },
  ];

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={onClose}
      ariaLabelledBy="file-detail-title"
      panelMaxWidthClass="max-w-full lg:max-w-[50vw]"
      panelChromeClassName="border-l border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-floating)]"
      bodyClassName="p-0"
      footerClassName="border-t border-[var(--enterprise-border)] px-4 py-3 lg:px-5"
      header={
        <div className="min-w-0">
          <h2
            id="file-detail-title"
            className="truncate text-base font-semibold text-[var(--enterprise-text)]"
          >
            {file?.name ?? "File details"}
          </h2>
          <p className="text-sm text-[var(--enterprise-text-muted)]">
            Manage file details, versions, and comments.
          </p>
        </div>
      }
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--enterprise-border)] px-4 py-2 text-sm font-medium text-[var(--enterprise-text-muted)]"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => file && onDownloadFile(file)}
            disabled={!file}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] px-4 py-2 text-sm font-medium text-[var(--enterprise-text)] disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            Download
          </button>
          <button
            type="button"
            onClick={() => file && onOpenFile(file)}
            disabled={!file}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Eye className="h-4 w-4" aria-hidden />
            Open viewer
          </button>
        </>
      }
    >
      {file ? (
        <div className="flex h-full min-h-0 flex-col">
          <div className="border-b border-[var(--enterprise-border)] px-4 py-3 lg:px-5">
            <div className="flex flex-wrap gap-2">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    tab === id
                      ? "bg-[var(--enterprise-primary)] text-white"
                      : "border border-[var(--enterprise-border)] text-[var(--enterprise-text-muted)] hover:bg-slate-50"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 px-4 py-4 lg:px-5">
            {tab === "details" ? (
              <button
                type="button"
                onClick={() => file && onOpenFile(file)}
                className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--enterprise-text-muted)] hover:bg-slate-50"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden />
                Preview in viewer
              </button>
            ) : null}
            {tab === "details" ? (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-[var(--enterprise-border)] bg-white p-3">
                    <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
                      <FileText className="h-3.5 w-3.5" aria-hidden />
                      Type
                    </p>
                    <p className="mt-1 text-sm font-medium text-[var(--enterprise-text)]">
                      {file.mimeType}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--enterprise-border)] bg-white p-3">
                    <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
                      <Layers3 className="h-3.5 w-3.5" aria-hidden />
                      Latest revision
                    </p>
                    <p className="mt-1 text-sm font-medium text-[var(--enterprise-text)]">
                      {activeVersion ? `Rev ${activeVersion.version}` : "No versions"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--enterprise-border)] bg-white p-3">
                    <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                      Uploaded
                    </p>
                    <p className="mt-1 text-sm font-medium text-[var(--enterprise-text)]">
                      {formatItemDateOrDash(activeVersion?.createdAt ?? file.updatedAt)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--enterprise-border)] bg-white p-3">
                    <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
                      <Clock3 className="h-3.5 w-3.5" aria-hidden />
                      Last opened
                    </p>
                    <p className="mt-1 text-sm font-medium text-[var(--enterprise-text)]">
                      {formatItemDateOrDash(file.lastOpenedAt)}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--enterprise-border)] bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
                    Disciplines
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(file.disciplines ?? []).length > 0 ? (
                      (file.disciplines ?? []).map((discipline) => (
                        <span
                          key={discipline}
                          className="enterprise-badge-info rounded-full px-2.5 py-1 text-xs"
                        >
                          {discipline}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-[var(--enterprise-text-muted)]">
                        No disciplines
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
            {tab === "versions" ? (
              <div className="enterprise-scrollbar max-h-[52dvh] min-h-0 overflow-y-auto rounded-xl border border-[var(--enterprise-border)] bg-white p-2 lg:max-h-none">
                <ul className="space-y-2">
                  {versions.map((item) => {
                    const selected = item.version === activeVersion?.version;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => onSelectVersion(item.version)}
                          className={`w-full rounded-lg border px-3 py-2 text-left ${
                            selected
                              ? "border-[var(--enterprise-primary)] bg-blue-50/60"
                              : "border-[var(--enterprise-border)]"
                          }`}
                        >
                          <p className="text-sm font-semibold text-[var(--enterprise-text)]">
                            Rev {item.version}
                          </p>
                          <p className="text-xs text-[var(--enterprise-text-muted)]">
                            {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            {tab === "comments" ? (
              <FileCommentsPanel
                projectId={projectId}
                fileId={file.id}
                fileVersionId={activeVersion?.id ?? null}
                currentUserId={currentUserId}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </EnterpriseSlideOver>
  );
}
