"use client";

import {
  ArrowRight,
  Circle,
  Cloud,
  MessageSquare,
  Minus,
  MousePointer2,
  Paintbrush,
  PenTool,
  Square,
} from "lucide-react";
import { CircleAlert, Trash2 } from "lucide-react";
import { MARKUP_STROKE_COLOR_PRESETS } from "@/lib/markupUi";
import type { MarkupShape } from "@/store/viewerStore";
import type { BimMarkupMode } from "@/store/bimMarkupStore";

const STROKE_WIDTHS = [2, 3, 4, 6, 8] as const;

const markupShapes: {
  id: MarkupShape;
  label: string;
  icon: typeof PenTool;
}[] = [
  { id: "freehand", label: "Pen", icon: PenTool },
  { id: "highlight", label: "Hi", icon: Paintbrush },
  { id: "line", label: "Line", icon: Minus },
  { id: "arrow", label: "Arrow", icon: ArrowRight },
  { id: "rect", label: "Rect", icon: Square },
  { id: "ellipse", label: "Ellipse", icon: Circle },
  { id: "cloud", label: "Cloud", icon: Cloud },
  { id: "text", label: "Text", icon: MessageSquare },
];

export function BimMarkupFlyoutPanel(props: {
  markupShape: MarkupShape;
  markupMode: BimMarkupMode;
  strokeColor: string;
  strokeWidth: number;
  hasSelection: boolean;
  onSetShape: (shape: MarkupShape) => void;
  onSetMode: (mode: BimMarkupMode) => void;
  onSetColor: (color: string) => void;
  onSetWidth: (width: number) => void;
  onDeleteSelected: () => void;
  onCreateIssue: () => void;
}) {
  return (
    <div className="bim-markup-flyout-panel">
      <div className="bim-markup-flyout-section">
        <p className="bim-markup-flyout-label">Shape</p>
        <div className="bim-markup-shape-grid">
          {markupShapes.map((m) => {
            const Icon = m.icon;
            const active = props.markupMode === "draw" && props.markupShape === m.id;
            return (
              <button
                key={m.id}
                type="button"
                aria-label={m.label}
                title={m.label}
                data-active={active}
                onClick={() => {
                  props.onSetMode("draw");
                  props.onSetShape(m.id);
                }}
                className="bim-markup-shape-btn"
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </button>
            );
          })}
        </div>
      </div>

      <div className="bim-markup-flyout-section">
        <p className="bim-markup-flyout-label">Color</p>
        <div className="flex flex-wrap gap-1">
          {MARKUP_STROKE_COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              data-active={props.strokeColor === c}
              onClick={() => props.onSetColor(c)}
              className="bim-markup-color-swatch"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div className="bim-markup-flyout-section">
        <p className="bim-markup-flyout-label">Thickness</p>
        <div className="flex flex-wrap gap-1">
          {STROKE_WIDTHS.map((w) => (
            <button
              key={w}
              type="button"
              data-active={props.strokeWidth === w}
              onClick={() => props.onSetWidth(w)}
              className="bim-markup-width-chip"
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      <div className="bim-markup-flyout-actions">
        <button
          type="button"
          data-active={props.markupMode === "select"}
          onClick={() => props.onSetMode("select")}
          className="bim-bottom-flyout-btn"
        >
          <MousePointer2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Select
        </button>
        <button
          type="button"
          disabled={!props.hasSelection}
          onClick={props.onDeleteSelected}
          className="bim-bottom-flyout-btn"
        >
          <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Delete
        </button>
        <button
          type="button"
          disabled={!props.hasSelection}
          onClick={props.onCreateIssue}
          className="bim-bottom-flyout-btn text-[var(--bim-accent)]"
        >
          <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Create issue
        </button>
      </div>
    </div>
  );
}
