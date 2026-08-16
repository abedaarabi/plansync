"use client";

import type { LucideIcon } from "lucide-react";
import { Copy, CopyPlus, Lock, Unlock } from "lucide-react";

const itemClass =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-slate-900 hover:bg-slate-100";
const iconClass = "h-3.5 w-3.5 shrink-0 text-[var(--viewer-icon)]";

function MenuAction(props: { label: string; icon: LucideIcon; onClick: () => void }) {
  const Icon = props.icon;
  return (
    <button type="button" role="menuitem" className={itemClass} onClick={props.onClick}>
      <Icon className={iconClass} aria-hidden strokeWidth={1.75} />
      {props.label}
    </button>
  );
}

/** Shared copy / duplicate / lock actions for PDF markup context menus. */
export function ViewerMarkupLockActions(props: {
  locked: boolean;
  onCopy: () => void;
  onDuplicate: () => void;
  onToggleLock: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <MenuAction
        label="Copy"
        icon={Copy}
        onClick={() => {
          props.onCopy();
          props.onClose();
        }}
      />
      <MenuAction
        label="Duplicate"
        icon={CopyPlus}
        onClick={() => {
          props.onDuplicate();
          props.onClose();
        }}
      />
      <MenuAction
        label={props.locked ? "Unlock" : "Lock"}
        icon={props.locked ? Unlock : Lock}
        onClick={() => {
          props.onToggleLock();
          props.onClose();
        }}
      />
    </>
  );
}
