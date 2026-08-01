"use client";

import { FileText, Layers } from "lucide-react";
import { toast } from "sonner";
import type { BuildingLevel, LevelDisplaySource } from "@/lib/api-client/locations";
import { useUpdateLevelDisplaySourceMutation } from "@/lib/locations/useBuildingQueries";

type Props = {
  level: BuildingLevel;
  buildingId: string;
  locationId: string;
};

/** Compact segmented control: IFC cut vs matched drawing. */
export function LevelDisplayToggle({ level, buildingId, locationId }: Props) {
  const mut = useUpdateLevelDisplaySourceMutation(buildingId, locationId);
  const hasDrawing = level.mappedDrawingCount > 0;

  const set = (displaySource: LevelDisplaySource) => {
    if (displaySource === level.displaySource) return;
    if (displaySource === "DRAWING" && !hasDrawing) return;
    mut.mutate(
      { levelId: level.id, displaySource },
      { onError: (e: Error) => toast.error(e.message) },
    );
  };

  const seg = (
    source: LevelDisplaySource,
    Icon: typeof Layers,
    label: string,
    disabled = false,
  ) => {
    const active = level.displaySource === source;
    return (
      <button
        type="button"
        disabled={disabled}
        title={disabled ? "Match a drawing first" : label}
        aria-label={label}
        aria-pressed={active}
        className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition ${
          active
            ? "bg-[var(--enterprise-surface)] text-[var(--enterprise-text)] shadow-sm"
            : "text-[var(--enterprise-text-muted)] hover:text-[var(--enterprise-text)]"
        } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          set(source);
        }}
      >
        <Icon className="h-3 w-3 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
      </button>
    );
  };

  return (
    <div
      className="flex w-full rounded-lg bg-[var(--enterprise-hover-surface)] p-0.5"
      role="group"
      aria-label="Level display source"
      onClick={(e) => e.stopPropagation()}
    >
      {seg("IFC_CUT", Layers, "IFC cut")}
      {seg("DRAWING", FileText, "Drawing", !hasDrawing)}
    </div>
  );
}
