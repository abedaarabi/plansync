"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  ArrowUpDown,
  EyeOff,
  Keyboard,
  Link2,
  MousePointerClick,
  Move3d,
  Navigation,
  Redo2,
  RotateCw,
  Ruler,
  ScanSearch,
  Undo2,
  X,
} from "lucide-react";

type ShortcutRow = {
  action: string;
  icon: LucideIcon;
  keys: string[];
  keyJoin?: "combo" | "or";
};

type ShortcutSection = {
  title: string;
  icon: LucideIcon;
  rows: ShortcutRow[];
};

const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    title: "Selection",
    icon: MousePointerClick,
    rows: [
      { keys: ["H"], action: "Hide selected object", icon: EyeOff },
      {
        keys: ["Shift", "Click"],
        keyJoin: "combo",
        action: "Select multiple objects",
        icon: MousePointerClick,
      },
      { keys: ["Ctrl", "L"], keyJoin: "combo", action: "Copy link to current view", icon: Link2 },
    ],
  },
  {
    title: "Navigation",
    icon: Navigation,
    rows: [
      { keys: ["W", "S"], keyJoin: "or", action: "Move forward / backward", icon: Move3d },
      { keys: ["A", "D"], keyJoin: "or", action: "Move left / right", icon: ArrowLeftRight },
      { keys: ["R", "F"], keyJoin: "or", action: "Move up / down", icon: ArrowUpDown },
      {
        keys: ["Arrow Keys", "Q", "E"],
        keyJoin: "or",
        action: "Rotate camera",
        icon: RotateCw,
      },
      { keys: ["Space"], action: "Zoom to selected object", icon: ScanSearch },
    ],
  },
  {
    title: "Measurements",
    icon: Ruler,
    rows: [
      { keys: ["Ctrl", "Z"], keyJoin: "combo", action: "Undo last measurement", icon: Undo2 },
      { keys: ["Enter"], action: "Redo last measurement", icon: Redo2 },
      { keys: ["Esc"], action: "Remove all measurements", icon: X },
      { keys: ["P"], action: "Place position measurement", icon: Ruler },
    ],
  },
];

export function BimKeyboardShortcutsPanel() {
  return (
    <div className="rounded-lg border border-[var(--bim-border)] bg-[var(--bim-panel)] p-3">
      <div className="mb-3 flex items-start gap-2.5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bim-accent-muted)] text-[var(--bim-accent)]">
          <Keyboard className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <p className="text-[11px] font-semibold text-[var(--bim-text)]">Keyboard shortcuts</p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--bim-text-muted)]">
            3D viewer — on macOS, use <KbdKey>⌘</KbdKey> where Ctrl is listed.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {SHORTCUT_SECTIONS.map((section) => (
          <ShortcutSectionBlock key={section.title} section={section} />
        ))}
      </div>
    </div>
  );
}

function ShortcutSectionBlock(props: { section: ShortcutSection }) {
  const SectionIcon = props.section.icon;

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--bim-hover)] text-[var(--bim-accent)]">
          <SectionIcon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--bim-text-subtle)]">
          {props.section.title}
        </h3>
      </div>

      <ul className="overflow-hidden rounded-lg border border-[var(--bim-border)] bg-[color-mix(in_srgb,var(--bim-hover)_35%,var(--bim-panel))]">
        {props.section.rows.map((row, index) => (
          <ShortcutRowItem
            key={row.action}
            row={row}
            isLast={index === props.section.rows.length - 1}
          />
        ))}
      </ul>
    </section>
  );
}

function ShortcutRowItem(props: { row: ShortcutRow; isLast: boolean }) {
  const RowIcon = props.row.icon;

  return (
    <li
      className={`flex items-center gap-2.5 px-2.5 py-2 ${
        props.isLast ? "" : "border-b border-[var(--bim-border)]"
      }`}
    >
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--bim-border)] bg-[var(--bim-panel)] text-[var(--bim-icon)]">
        <RowIcon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-[11px] leading-snug text-[var(--bim-text)]">
        {props.row.action}
      </span>
      <ShortcutKeys keys={props.row.keys} join={props.row.keyJoin ?? "or"} />
    </li>
  );
}

function ShortcutKeys(props: { keys: string[]; join: "combo" | "or" }) {
  const separator = props.join === "combo" ? "+" : "/";

  return (
    <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
      {props.keys.map((key, index) => (
        <span key={`${key}-${index}`} className="inline-flex items-center gap-1">
          {index > 0 ? (
            <span className="text-[9px] font-medium text-[var(--bim-text-subtle)]">
              {separator}
            </span>
          ) : null}
          {key.includes(" ") ? (
            <span className="text-[10px] font-medium text-[var(--bim-text-muted)]">{key}</span>
          ) : (
            <KbdKey>{key}</KbdKey>
          )}
        </span>
      ))}
    </span>
  );
}

function KbdKey(props: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-h-[1.375rem] min-w-[1.375rem] items-center justify-center rounded border border-[var(--bim-border)] bg-[var(--bim-hover)] px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-[var(--bim-text)] shadow-[inset_0_-1px_0_var(--bim-border)]">
      {props.children}
    </kbd>
  );
}
