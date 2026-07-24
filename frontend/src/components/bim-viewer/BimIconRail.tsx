"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type BimRailItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

function RailButtons(props: {
  items: BimRailItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      {props.items.map((item) => {
        const Icon = item.icon;
        const active = props.activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => props.onSelect(item.id)}
            aria-label={item.label}
            aria-pressed={active}
            title={item.label}
            data-active={active}
            className="bim-rail-btn relative mobile-touch-target"
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden />
            {item.badge != null && item.badge > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--bim-accent)] px-0.5 text-[9px] font-bold text-white">
                {item.badge > 9 ? "9+" : item.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </>
  );
}

export function BimIconRail(props: {
  side: "left" | "right";
  header?: ReactNode;
  sections: BimRailItem[][];
  activeId: string | null;
  onSelect: (id: string) => void;
  ariaLabel: string;
}) {
  return (
    <div
      className="bim-icon-rail bim-glass-surface"
      data-side={props.side}
      role="toolbar"
      aria-label={props.ariaLabel}
    >
      {props.header ? (
        <>
          <div className="bim-icon-rail__header">{props.header}</div>
          <div className="bim-icon-rail__divider" aria-hidden />
        </>
      ) : null}
      {props.sections.map((items, index) => (
        <div key={index} className="bim-icon-rail__section">
          {index > 0 ? <div className="bim-icon-rail__divider" aria-hidden /> : null}
          <RailButtons items={items} activeId={props.activeId} onSelect={props.onSelect} />
        </div>
      ))}
    </div>
  );
}
