"use client";

import {
  EnterpriseResponsiveDialog,
  MOBILE_DIALOG_BTN_SECONDARY,
} from "@/components/mobile/EnterpriseResponsiveDialog";

const SECTIONS: { title: string; rows: [string, string][] }[] = [
  {
    title: "Tools & modes",
    rows: [
      ["Draw / Measure / Select / Pan / Zoom area", "Top bar or icon rail"],
      ["Zoom to rectangle", "Zoom area tool — drag on the sheet"],
      ["Undo / Redo", "Ctrl+Z / Ctrl+Shift+Z"],
    ],
  },
  {
    title: "Icon rail panels",
    rows: [
      ["Pages", "P"],
      ["Outline", "O"],
      ["Draw", "D"],
      ["Measure", "M"],
      ["Scale / calibrate", "S"],
      ["Issues", "I"],
      ["Live collab", "L"],
      ["Takeoff", "T"],
      ["Toggle open panel", "Same key again"],
    ],
  },
  {
    title: "Selection (Select tool)",
    rows: [
      ["Select all on page", "Ctrl+A"],
      ["Multi-select", "⌘/Ctrl+click to toggle · Shift+click to add"],
      ["Marquee select", "Drag on empty space"],
      ["Delete selected", "Delete or Backspace"],
      ["Nudge", "Arrow keys · Shift+arrow = 10 px"],
      ["Copy / Paste / Duplicate", "Ctrl+C / Ctrl+V / Ctrl+D"],
    ],
  },
  {
    title: "Measures",
    rows: [
      ["Commit line segment", "Enter (when second point is set)"],
      ["Backspace line measure", "Undo point / clear segment"],
      ["Calibrate", "Measure tab → Calibrate"],
    ],
  },
  {
    title: "Sheet",
    rows: [
      ["Context menu", "Right-click"],
      ["Escape", "Cancel in-progress tool"],
      ["Toggle takeoff inventory height", "Ctrl+` · ⌘+J"],
      ["Collapse inventory (when its panel is focused)", "Escape"],
      ["Compare markups (clean vs annotated)", "Top bar — split icon"],
      ["Compare file revisions (magenta / cyan)", "Top bar — compare-revisions icon"],
    ],
  },
  {
    title: "Planned / later",
    rows: [
      ["Grouping markups", "Not implemented yet"],
      ["Collaboration cursors", "Requires room features"],
    ],
  },
];

export function KeyboardShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <EnterpriseResponsiveDialog
      open={open}
      onClose={onClose}
      ariaLabelledBy="kbd-shortcuts-title"
      variant="viewer-dark"
      overlayZClass="z-[300]"
      panelClassName="max-w-lg"
      bodyClassName="max-h-[85vh] overflow-y-auto"
      footer={
        <button
          type="button"
          className={`${MOBILE_DIALOG_BTN_SECONDARY} border border-slate-600 text-slate-200 hover:bg-slate-800`}
          onClick={onClose}
        >
          Close
        </button>
      }
    >
      <h2 id="kbd-shortcuts-title" className="text-lg font-semibold tracking-tight text-white">
        Keyboard shortcuts
      </h2>
      <p className="mt-2 text-sm text-slate-400">
        On macOS, use <kbd className="rounded bg-slate-800 px-1">⌘</kbd> where Ctrl is listed.
      </p>
      <div className="mt-4 space-y-5">
        {SECTIONS.map((sec) => (
          <div key={sec.title}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {sec.title}
            </h3>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {sec.rows.map(([action, keys]) => (
                  <tr key={action} className="border-t border-slate-800/80">
                    <td className="py-2 pr-3 text-slate-300">{action}</td>
                    <td className="py-2 text-right font-mono text-xs text-slate-400">{keys}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </EnterpriseResponsiveDialog>
  );
}
