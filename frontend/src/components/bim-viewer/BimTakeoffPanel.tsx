"use client";

import { useState } from "react";
import { Download, Link2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { autoMapBimTakeoff, bimQuantityExportUrl } from "@/lib/api-client/bim-viewer";
import { BimAddToTakeoffDialog, type BimTakeoffSelectionSummary } from "./BimAddToTakeoffDialog";
import type { BimModelQuantityRollup } from "@/lib/bim/modelQuantity";

export function BimTakeoffPanel(props: {
  fileVersionId: string | null;
  projectId: string | null;
  selectedGuids: string[];
  selectionSummary: BimTakeoffSelectionSummary | null;
  resolveModelQuantities: () => Promise<BimModelQuantityRollup>;
}) {
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!props.fileVersionId) return null;

  // fallow-ignore-next-line complexity
  async function autoMap() {
    setBusy(true);
    try {
      const res = await autoMapBimTakeoff(props.fileVersionId!, { createLines: true });
      if (res.createdLineIds.length === 0) {
        toast.warning(
          res.errors?.length
            ? res.errors[0]
            : "No takeoff lines created. Rebuild the quantity index if the Objects list is empty.",
        );
        return;
      }
      const mappedCount = res.mapped.filter((m) => m.materialId).length;
      toast.success(
        `Auto-mapped ${res.createdLineIds.length} takeoff lines` +
          (mappedCount > 0 ? ` (${mappedCount} matched to catalog materials).` : "."),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Auto-map failed.");
    } finally {
      setBusy(false);
    }
  }

  function openAddDialog() {
    if (props.selectedGuids.length === 0) {
      toast.error("Select at least one element.");
      return;
    }
    setDialogOpen(true);
  }

  const hasSelection = props.selectedGuids.length > 0;

  return (
    <>
      <div className="bim-detail-card">
        <div className="mb-3 flex items-start gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bim-accent-muted)] text-[var(--bim-accent)]">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="bim-section-title">Takeoff actions</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--bim-text-muted)]">
              Link selections to catalog materials. Quantities are suggested from the model and
              editable before save.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={busy || !hasSelection}
          onClick={openAddDialog}
          className="bim-btn-primary mb-2 w-full py-2.5"
        >
          <Link2 className="h-4 w-4" aria-hidden />
          Add selection to takeoff
        </button>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void autoMap()}
            className="bim-btn-secondary w-full py-2"
          >
            <Wand2 className="h-3.5 w-3.5" aria-hidden />
            Auto-map types
          </button>
          <a
            href={bimQuantityExportUrl(props.fileVersionId)}
            className="bim-btn-secondary w-full py-2"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Export CSV
          </a>
        </div>
      </div>

      <BimAddToTakeoffDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fileVersionId={props.fileVersionId}
        projectId={props.projectId}
        selectedGuids={props.selectedGuids}
        selectionSummary={props.selectionSummary}
        resolveModelQuantities={props.resolveModelQuantities}
      />
    </>
  );
}
