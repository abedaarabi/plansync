"use client";

import { Eye, ListChecks, Package, Pencil } from "lucide-react";
import type { ViewerWorkspaceMode } from "@/store/viewerStore";
import { useViewerStore } from "@/store/viewerStore";

const MODES: {
  id: ViewerWorkspaceMode;
  label: string;
  short: string;
  icon: typeof Eye;
  proOnly?: boolean;
}[] = [
  { id: "view", label: "View", short: "View", icon: Eye },
  { id: "markup", label: "Markup", short: "Draw", icon: Pencil },
  { id: "issues", label: "Issues", short: "Issues", icon: ListChecks, proOnly: true },
  { id: "takeoff", label: "Takeoff", short: "Qty", icon: Package, proOnly: true },
];

type Props = {
  showProModes: boolean;
  onModeChange?: (mode: ViewerWorkspaceMode) => void;
};

function modeTabClass(active: boolean): string {
  return `viewer-focus-ring flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1.5 text-[9px] font-semibold uppercase tracking-[0.06em] transition duration-150 ${
    active
      ? "border-[rgba(37,99,235,0.55)] bg-[#2563EB] text-white shadow-[0_1px_3px_rgba(0,0,0,0.25)]"
      : "border-[#334155] bg-[#1E293B] text-[#94A3B8] hover:border-[#475569] hover:bg-[#334155] hover:text-[#F8FAFC]"
  }`;
}

export function ViewerModeNav({ showProModes, onModeChange }: Props) {
  const mode = useViewerStore((s) => s.viewerWorkspaceMode);
  const setViewerWorkspaceMode = useViewerStore((s) => s.setViewerWorkspaceMode);

  const visibleModes = MODES.filter((m) => !m.proOnly || showProModes);

  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${visibleModes.length}, minmax(0, 1fr))` }}
      role="tablist"
      aria-label="Viewer mode"
    >
      {visibleModes.map((m) => {
        const Icon = m.icon;
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={active}
            title={m.label}
            onClick={() => {
              setViewerWorkspaceMode(m.id);
              onModeChange?.(m.id);
            }}
            className={modeTabClass(active)}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            <span className="truncate">{m.short}</span>
          </button>
        );
      })}
    </div>
  );
}
