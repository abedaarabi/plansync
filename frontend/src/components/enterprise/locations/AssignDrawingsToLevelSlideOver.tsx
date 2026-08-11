"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseSlideOver, SlideOverHeader } from "@/components/enterprise/EnterpriseSlideOver";
import type { BuildingAsset, BuildingLevel } from "@/lib/api-client/locations";
import { useAssignDrawingToLevelMutation } from "@/lib/locations/useBuildingQueries";

type Props = {
  open: boolean;
  onClose: () => void;
  buildingId: string;
  locationId: string;
  level: BuildingLevel | null;
  unmappedPdfs: BuildingAsset[];
};

export function AssignDrawingsToLevelSlideOver({
  open,
  onClose,
  buildingId,
  locationId,
  level,
  unmappedPdfs,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const assignMut = useAssignDrawingToLevelMutation(buildingId, locationId);

  useEffect(() => {
    if (!open) setSelected(new Set());
  }, [open]);

  const sorted = useMemo(
    () => [...unmappedPdfs].sort((a, b) => a.fileName.localeCompare(b.fileName)),
    [unmappedPdfs],
  );

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.has(id) ? new Set([...prev].filter((x) => x !== id)) : new Set([...prev, id]),
    );
  };

  const submit = async () => {
    if (!level || selected.size === 0) return;
    setBusy(true);
    const ids = [...selected];
    const results = await Promise.allSettled(
      ids.map((fileAssetId) => assignMut.mutateAsync({ levelId: level.id, fileAssetId })),
    );
    setBusy(false);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const fail = results.length - ok;
    if (ok > 0) {
      toast.success(
        ok === 1 ? "Drawing assigned to level" : `${ok} drawings assigned to ${level.name}`,
      );
    }
    if (fail > 0) {
      toast.error(fail === 1 ? "One drawing could not be assigned" : `${fail} drawings failed`);
    }
    if (fail === 0) onClose();
  };

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={handleClose}
      ariaLabelledBy="assign-drawings-title"
      header={
        <SlideOverHeader
          icon={FileText}
          titleId="assign-drawings-title"
          title="Assign drawings"
          description={
            level
              ? `Link PDF files to ${level.name}. Issues and assets created on these sheets will use this level.`
              : "Select a level first."
          }
        />
      }
      footer={
        <>
          <EnterpriseButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleClose}
            disabled={busy}
          >
            Cancel
          </EnterpriseButton>
          <EnterpriseButton
            type="button"
            size="sm"
            loading={busy}
            disabled={!level || selected.size === 0 || busy}
            onClick={() => void submit()}
          >
            {busy ? "Assigning…" : selected.size === 0 ? "Assign" : `Assign ${selected.size}`}
          </EnterpriseButton>
        </>
      }
    >
      {sorted.length === 0 ? (
        <p className="enterprise-type-body text-[var(--enterprise-text-muted)]">
          No unassigned PDFs on this building. Upload drawings first, then assign them here.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--enterprise-border)] rounded-md border border-[var(--enterprise-border)]">
          {sorted.map((pdf) => {
            const checked = selected.has(pdf.id);
            return (
              <li key={pdf.id}>
                <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-[var(--enterprise-hover-surface)]">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-[var(--enterprise-border)] text-[var(--enterprise-primary)]"
                    checked={checked}
                    onChange={() => toggle(pdf.id)}
                    disabled={busy}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[var(--enterprise-text)]">
                      {pdf.fileName}
                    </span>
                    <span className="enterprise-type-caption text-[var(--enterprise-text-muted)]">
                      {pdf.status === "READY" ? "Ready" : pdf.status}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </EnterpriseSlideOver>
  );
}
