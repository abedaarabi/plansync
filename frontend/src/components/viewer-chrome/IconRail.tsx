"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type ChromeRailItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

export type ChromeRailTone = "viewer" | "bim";

function RailButtons(props: {
  tone: ChromeRailTone;
  items: ChromeRailItem[];
  activeId: string | null;
  /** Mode/tool highlight when the dock is closed (viewer). */
  modeId?: string | null;
  onSelect: (id: string) => void;
  tooltipSide: "left" | "right";
  showTooltips: boolean;
}) {
  const btn = props.tone === "bim" ? "bim-rail-btn" : "viewer-rail-btn";
  const tipSideClass = props.tooltipSide === "left" ? "right-full mr-2" : "left-full ml-2";

  return (
    <>
      {props.items.map((item) => {
        const Icon = item.icon;
        const active = props.activeId === item.id;
        const mode = !active && props.modeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => props.onSelect(item.id)}
            aria-label={item.label}
            aria-pressed={active}
            data-active={active}
            data-mode={mode || undefined}
            className={`group relative ${btn} mobile-touch-target`}
          >
            <Icon
              className={`h-[18px] w-[18px] ${props.tone === "viewer" ? "text-white" : ""}`}
              strokeWidth={1.75}
              aria-hidden
            />
            {item.badge != null && item.badge > 0 ? (
              <span
                className={
                  props.tone === "bim"
                    ? "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--bim-accent)] px-0.5 text-[9px] font-bold text-white"
                    : "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--viewer-primary)] px-0.5 text-[9px] font-bold text-white"
                }
              >
                {item.badge > 9 ? "9+" : item.badge}
              </span>
            ) : null}
            {props.showTooltips ? (
              <span
                role="tooltip"
                className={`pointer-events-none absolute top-1/2 z-[60] -translate-y-1/2 whitespace-nowrap rounded-md border border-[#475569] bg-[#0f172a]/95 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 max-sm:hidden ${tipSideClass}`}
              >
                {item.label}
              </span>
            ) : null}
          </button>
        );
      })}
    </>
  );
}

export function IconRail(props: {
  tone?: ChromeRailTone;
  side: "left" | "right";
  header?: ReactNode;
  sections: ChromeRailItem[][];
  activeId: string | null;
  modeId?: string | null;
  onSelect: (id: string) => void;
  ariaLabel: string;
  showTooltips?: boolean;
  /** Lift mobile bottom rail above an open bottom drawer (inventory / sheet AI). */
  liftForBottomChrome?: boolean;
}) {
  const tone = props.tone ?? "viewer";
  const prefix = tone === "bim" ? "bim" : "viewer";
  const tooltipSide = props.side === "left" ? "right" : "left";
  const showTooltips = props.showTooltips !== false;

  return (
    <div
      className={`${prefix}-icon-rail ${prefix}-glass-surface`}
      data-side={props.side}
      data-lift={props.liftForBottomChrome ? "bottom-chrome" : undefined}
      role="toolbar"
      aria-label={props.ariaLabel}
    >
      {props.header ? (
        <>
          <div className={`${prefix}-icon-rail__header`}>{props.header}</div>
          <div className={`${prefix}-icon-rail__divider`} aria-hidden />
        </>
      ) : null}
      {props.sections.map((items, index) => (
        <div key={index} className={`${prefix}-icon-rail__section`}>
          {index > 0 ? <div className={`${prefix}-icon-rail__divider`} aria-hidden /> : null}
          <RailButtons
            tone={tone}
            items={items}
            activeId={props.activeId}
            modeId={props.modeId}
            onSelect={props.onSelect}
            tooltipSide={tooltipSide}
            showTooltips={showTooltips}
          />
        </div>
      ))}
    </div>
  );
}
