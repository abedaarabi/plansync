"use client";

import { useCallback, useEffect, useState } from "react";
import { Layers3, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { fetchDrawingLevelMaps, saveBimDrawingMaps } from "@/lib/api-client/bim-publish";
import type { BimModelLevelDraft } from "@/lib/api-client/bim-publish";
import { qk } from "@/lib/queryKeys";
import type { CloudFile, Folder as ProjectFolder } from "@/types/projects";
import { EnterpriseSlideOver } from "./EnterpriseSlideOver";
import { ModelLevelSheetMapper, type LevelMapEntry } from "./ModelLevelSheetMapper";

// fallow-ignore-next-line complexity
export function MapDrawingsSlideOver(props: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  workspaceId: string;
  ifcFile: CloudFile;
  ifcFileVersionId: string;
  folders: ProjectFolder[];
}) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [levels, setLevels] = useState<BimModelLevelDraft[]>([]);
  const [maps, setMaps] = useState<LevelMapEntry[]>([]);

  const load = useCallback(async () => {
    if (!props.open) return;
    setLoading(true);
    try {
      const data = await fetchDrawingLevelMaps(props.projectId, props.ifcFileVersionId);
      setLevels(data.levels);
      setMaps(
        data.maps.map((m) => ({
          bimModelLevelId: m.bimModelLevelId,
          pdfFileId: m.pdfFileId,
          pdfFileVersionId: m.pdfFileVersionId,
          pageIndex: m.pageIndex,
          pdfFileName: m.pdfFileName ?? "PDF",
          pdfFolderPath: m.pdfFolderPath,
          pageCount: 1,
        })),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load mappings.");
    } finally {
      setLoading(false);
    }
  }, [props.open, props.projectId, props.ifcFileVersionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      await saveBimDrawingMaps(
        props.ifcFileVersionId,
        maps.map((m) => ({
          bimModelLevelId: m.bimModelLevelId,
          pdfFileId: m.pdfFileId,
          pdfFileVersionId: m.pdfFileVersionId,
          pageIndex: m.pageIndex,
        })),
      );
      await queryClient.invalidateQueries({ queryKey: qk.projects(props.workspaceId) });
      toast.success(`Saved ${maps.length} drawing mappings.`);
      props.onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save mappings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <EnterpriseSlideOver
      open={props.open}
      onClose={props.onClose}
      panelMaxWidthClass="max-w-[640px]"
      header={
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Map drawings</p>
          <h2 className="text-base font-semibold text-[var(--enterprise-text)]">
            {props.ifcFile.name}
          </h2>
          <p className="text-xs text-slate-500">Link PDF sheets to model levels.</p>
        </div>
      }
      footer={
        <>
          <button
            type="button"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
            onClick={props.onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-xl bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            onClick={() => void save()}
            disabled={saving || loading || levels.length === 0}
          >
            {saving ? "Saving…" : "Save mappings"}
          </button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading levels and mappings…
        </div>
      ) : levels.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900">
          <Layers3 className="mb-2 h-5 w-5" />
          Publish the model first to extract levels, then map drawings here.
        </div>
      ) : (
        <ModelLevelSheetMapper
          projectId={props.projectId}
          ifcFileVersionId={props.ifcFileVersionId}
          levels={levels}
          folders={props.folders}
          maps={maps}
          onMapsChange={setMaps}
        />
      )}
    </EnterpriseSlideOver>
  );
}
