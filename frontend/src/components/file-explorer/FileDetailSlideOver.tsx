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
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseSlideOver, SlideOverHeader } from "@/components/enterprise/EnterpriseSlideOver";
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
      panelMaxWidthClass="max-w-full lg:max-w-[min(50vw,560px)]"
      bodyClassName="p-0"
      header={
        <SlideOverHeader
          icon={FileText}
          titleId="file-detail-title"
          title={file?.name ?? "File details"}
          description="Details, versions, and comments."
        />
      }
      footer={
        <>
          <EnterpriseButton type="button" variant="secondary" size="sm" onClick={onClose}>
            Close
          </EnterpriseButton>
          <EnterpriseButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => file && onDownloadFile(file)}
            disabled={!file}
          >
            <Download className="h-4 w-4" aria-hidden />
            Download
          </EnterpriseButton>
          <EnterpriseButton
            type="button"
            size="sm"
            onClick={() => file && onOpenFile(file)}
            disabled={!file}
          >
            <Eye className="h-4 w-4" aria-hidden />
            Open viewer
          </EnterpriseButton>
        </>
      }
    >
      {file ? (
        <div className="flex h-full min-h-0 flex-col">
          <div className="border-b border-[var(--enterprise-border)] px-4 py-3 lg:px-5">
            <div className="flex w-full rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)] p-0.5 lg:w-auto lg:flex-wrap lg:gap-1.5 lg:border-0 lg:bg-transparent lg:p-0">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition lg:flex-none lg:px-3 lg:py-1.5 ${
                    tab === id
                      ? "bg-[var(--enterprise-surface)] text-[var(--enterprise-text)] shadow-none ring-1 ring-[var(--enterprise-border)] lg:bg-[var(--enterprise-primary)] lg:text-white lg:ring-0"
                      : "text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-surface)]/80 lg:border lg:border-[var(--enterprise-border)] lg:hover:bg-[var(--enterprise-hover-surface)]"
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
                className="mb-3 inline-flex items-center gap-1.5 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-1.5 text-xs font-normal text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)]"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden />
                Preview in viewer
              </button>
            ) : null}
            {tab === "details" ? (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-3">
                    <p className="enterprise-type-label inline-flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" aria-hidden />
                      Type
                    </p>
                    <p className="mt-1 text-sm font-normal text-[var(--enterprise-text)]">
                      {file.mimeType}
                    </p>
                  </div>
                  <div className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-3">
                    <p className="enterprise-type-label inline-flex items-center gap-1.5">
                      <Layers3 className="h-3.5 w-3.5" aria-hidden />
                      Latest revision
                    </p>
                    <p className="mt-1 text-sm font-normal text-[var(--enterprise-text)]">
                      {activeVersion ? `Rev ${activeVersion.version}` : "No versions"}
                    </p>
                  </div>
                  <div className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-3">
                    <p className="enterprise-type-label inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                      Uploaded
                    </p>
                    <p className="mt-1 text-sm font-normal text-[var(--enterprise-text)]">
                      {formatItemDateOrDash(activeVersion?.createdAt ?? file.updatedAt)}
                    </p>
                  </div>
                  <div className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-3">
                    <p className="enterprise-type-label inline-flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5" aria-hidden />
                      Last opened
                    </p>
                    <p className="mt-1 text-sm font-normal text-[var(--enterprise-text)]">
                      {formatItemDateOrDash(file.lastOpenedAt)}
                    </p>
                  </div>
                </div>
                <div className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-3">
                  <p className="text-xs font-normal uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
                    Disciplines
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(file.disciplines ?? []).length > 0 ? (
                      (file.disciplines ?? []).map((discipline) => (
                        <span
                          key={discipline}
                          className="enterprise-badge-info rounded-md px-2.5 py-1 text-xs"
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
              <div className="enterprise-scrollbar max-h-[52dvh] min-h-0 overflow-y-auto rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-2 lg:max-h-none">
                <ul className="space-y-2">
                  {versions.map((item) => {
                    const selected = item.version === activeVersion?.version;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => onSelectVersion(item.version)}
                          className={`w-full rounded-md border px-3 py-2 text-left ${
                            selected
                              ? "border-[var(--enterprise-primary)] bg-blue-50/60"
                              : "border-[var(--enterprise-border)]"
                          }`}
                        >
                          <p className="text-sm font-normal text-[var(--enterprise-text)]">
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
