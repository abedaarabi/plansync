"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fetchProjects } from "@/lib/api-client";
import { FileExplorerTree } from "@/components/file-explorer";
import { useLinkExistingFileMutation } from "@/lib/locations/useBuildingQueries";
import { qk } from "@/lib/queryKeys";
import { assetTypeFromKind, iconClassForKind, iconForKind, kindFromName } from "./fileKind";

type Props = {
  projectId: string;
  workspaceId: string;
  buildingId: string;
  locationId: string;
  onLinked: () => void;
};

export function ProjectFilesSource({
  projectId,
  workspaceId,
  buildingId,
  locationId,
  onLinked,
}: Props) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const linkMut = useLinkExistingFileMutation(buildingId, locationId);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: qk.projects(workspaceId),
    queryFn: () => fetchProjects(workspaceId),
  });

  const project = projects.find((p) => p.id === projectId);
  const files = useMemo(
    () => (project?.files ?? []).filter((f) => f.folderId === selectedFolderId),
    [project, selectedFolderId],
  );

  // fallow-ignore-next-line code-duplication
  const toggleFile = (id: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // fallow-ignore-next-line code-duplication
  const linkSelected = async () => {
    const chosen = (project?.files ?? []).filter((f) => selectedFiles.has(f.id));
    if (chosen.length === 0) return;
    try {
      for (const f of chosen) {
        const type = assetTypeFromKind(kindFromName(f.name));
        await linkMut.mutateAsync({ fileId: f.id, type });
      }
      toast.success(`Linked ${chosen.length} file${chosen.length === 1 ? "" : "s"} to building`);
      setSelectedFiles(new Set());
      onLinked();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to link files");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--enterprise-text-muted)]" aria-hidden />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-[var(--enterprise-border)]">
        <div className="w-56 shrink-0 border-r border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]/40">
          <FileExplorerTree
            folders={project?.folders ?? []}
            rootLabel={project?.name ?? "Project"}
            selectedFolderId={selectedFolderId}
            expanded={expanded}
            onToggleExpand={(id) =>
              setExpanded((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onSelectFolder={setSelectedFolderId}
          />
        </div>

        <ul className="enterprise-scrollbar min-w-0 flex-1 overflow-y-auto p-2">
          {files.length === 0 ? (
            <li className="px-3 py-10 text-center text-sm text-[var(--enterprise-text-muted)]">
              No files in this folder
            </li>
          ) : (
            files.map((f) => {
              const kind = kindFromName(f.name);
              const Icon = iconForKind(kind);
              const checked = selectedFiles.has(f.id);
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                      checked
                        ? "bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary-deep)]"
                        : "hover:bg-[var(--enterprise-hover-surface)]"
                    }`}
                    onClick={() => toggleFile(f.id)}
                    aria-pressed={checked}
                  >
                    <Icon className={iconClassForKind(kind)} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        checked
                          ? "border-[var(--enterprise-primary)] bg-[var(--enterprise-primary)] text-white"
                          : "border-[var(--enterprise-border)]"
                      }`}
                      aria-hidden
                    >
                      {checked ? <Check className="h-3.5 w-3.5" /> : null}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>

      <div className="flex items-center justify-between gap-2 pt-3">
        <p className="enterprise-type-caption text-[var(--enterprise-text-muted)]">
          {selectedFiles.size} selected
        </p>
        <button
          type="button"
          className="enterprise-btn-primary mobile-touch-target rounded-lg px-4 py-2 text-sm disabled:opacity-50"
          disabled={selectedFiles.size === 0 || linkMut.isPending}
          onClick={linkSelected}
        >
          {linkMut.isPending ? "Linking…" : "Add to building"}
        </button>
      </div>
    </div>
  );
}
