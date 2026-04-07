"use client";

import { Fragment, type ReactNode } from "react";
import type { TakeoffItem, TakeoffZone } from "@/lib/takeoffTypes";

function centroidCss(z: TakeoffZone, cssW: number, cssH: number): { x: number; y: number } {
  if (z.points.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const p of z.points) {
    sx += p.x;
    sy += p.y;
  }
  const n = z.points.length;
  return { x: (sx / n) * cssW, y: (sy / n) * cssH };
}

function qtyLabelText(z: TakeoffZone, item: TakeoffItem | undefined): string {
  const q = z.computedQuantity.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return item?.unit ? `${q} ${item.unit}` : q;
}

function truncateCanvasName(name: string, max = 30): string {
  const t = name.trim();
  if (t.length <= max) return t || "—";
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/** Renders outside multiply blend so it stays visible; fill matches takeoff item color. */
function SelectedQuantityLabel({
  x,
  y,
  itemName,
  qtyText,
  dy = 0,
  accentColor,
}: {
  x: number;
  y: number;
  itemName: string;
  qtyText: string;
  dy?: number;
  accentColor: string;
}) {
  const name = truncateCanvasName(itemName);
  const lineGap = 15;
  const baseY = y + dy;
  return (
    <g style={{ pointerEvents: "none", mixBlendMode: "normal" }}>
      <text
        x={x}
        y={baseY - lineGap / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={accentColor}
        stroke="#f8fafc"
        strokeWidth={3.5}
        paintOrder="stroke fill"
        fontSize={13}
        fontWeight={600}
      >
        {name}
      </text>
      <text
        x={x}
        y={baseY + lineGap / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={accentColor}
        stroke="#f8fafc"
        strokeWidth={3.5}
        paintOrder="stroke fill"
        fontSize={14}
        fontWeight={700}
      >
        {qtyText}
      </text>
    </g>
  );
}

type Props = {
  zones: TakeoffZone[];
  itemsById: Map<string, TakeoffItem>;
  cssW: number;
  cssH: number;
  /** Highlight these zones (inventory / canvas multi-select). */
  selectedZoneIds: string[];
  /** When set and selectedZoneIds is empty, all zones for this item draw as selected. */
  selectedItemId?: string | null;
  hoverZoneId?: string | null;
  /** Inventory row hover: light emphasis on all zones for this item. */
  hoverItemId?: string | null;
  /** Emphasize stroke (e.g. move-on-sheet target). */
  moveHighlightZoneId?: string | null;
};

export function TakeoffZonesSvg({
  zones,
  itemsById,
  cssW,
  cssH,
  selectedZoneIds,
  selectedItemId = null,
  hoverZoneId,
  hoverItemId = null,
  moveHighlightZoneId = null,
}: Props) {
  return (
    <g className="pointer-events-none print:hidden">
      {zones.map((z) => {
        if (z.noSheetGeometry) return null;
        const item = itemsById.get(z.itemId);
        const stroke = item?.color ?? "#64748b";
        /** ~44% alpha fill (was ~30%) — reads darker on white sheet */
        const fill = `${stroke}70`;
        const itemSelected =
          selectedZoneIds.length === 0 && selectedItemId != null && z.itemId === selectedItemId;
        const zoneSelected = selectedZoneIds.includes(z.id);
        const sel = zoneSelected || itemSelected;
        const hov = z.id === hoverZoneId || (hoverItemId != null && z.itemId === hoverItemId);
        const moveHi = z.id === moveHighlightZoneId;
        const op = sel ? 0.68 : hov ? (z.id === hoverZoneId ? 0.56 : 0.5) : 0.44;

        if (z.measurementType === "area" && z.points.length >= 3) {
          const d =
            z.points
              .map((p, i) => {
                const x = p.x * cssW;
                const y = p.y * cssH;
                return `${i === 0 ? "M" : "L"} ${x} ${y}`;
              })
              .join(" ") + " Z";
          const c = centroidCss(z, cssW, cssH);
          const showQty = item && (itemSelected || zoneSelected);
          return (
            <Fragment key={z.id}>
              <g style={{ mixBlendMode: "multiply" }}>
                <path
                  d={d}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={moveHi ? 3.5 : sel ? 2.5 : hov ? 2 : 1.5}
                  opacity={op}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
              {showQty ? (
                <SelectedQuantityLabel
                  x={c.x}
                  y={c.y}
                  itemName={item?.name ?? ""}
                  qtyText={qtyLabelText(z, item)}
                  accentColor={stroke}
                />
              ) : null}
            </Fragment>
          );
        }

        if (z.measurementType === "linear" && z.points.length >= 2) {
          const lines: ReactNode[] = [];
          for (let i = 0; i < z.points.length - 1; i++) {
            const a = z.points[i];
            const b = z.points[i + 1];
            lines.push(
              <line
                key={`${z.id}-${i}`}
                x1={a.x * cssW}
                y1={a.y * cssH}
                x2={b.x * cssW}
                y2={b.y * cssH}
                stroke={stroke}
                strokeWidth={moveHi ? 4.5 : sel ? 3.5 : hov ? 3 : 2.5}
                opacity={0.95}
                vectorEffect="non-scaling-stroke"
              />,
            );
          }
          const c = centroidCss(z, cssW, cssH);
          const showQty = item && (itemSelected || zoneSelected);
          return (
            <Fragment key={z.id}>
              <g style={{ mixBlendMode: "multiply" }} opacity={op + 0.12}>
                {lines}
              </g>
              {showQty ? (
                <SelectedQuantityLabel
                  x={c.x}
                  y={c.y}
                  itemName={item?.name ?? ""}
                  qtyText={qtyLabelText(z, item)}
                  dy={-6}
                  accentColor={stroke}
                />
              ) : null}
            </Fragment>
          );
        }

        if (z.measurementType === "count") {
          const cOp = sel ? 0.68 : hov ? 0.58 : 0.44;
          const c = centroidCss(z, cssW, cssH);
          const showQty = item && (itemSelected || zoneSelected);
          const labelDy = z.points.length === 1 ? -14 : 0;
          return (
            <Fragment key={z.id}>
              <g style={{ mixBlendMode: "multiply" }} opacity={cOp + 0.08}>
                {z.points.map((p, idx) => (
                  <g key={`${z.id}-c-${idx}`}>
                    <circle
                      cx={p.x * cssW}
                      cy={p.y * cssH}
                      r={9}
                      fill={stroke}
                      fillOpacity={sel ? 0.58 : hov ? 0.52 : 0.52}
                      stroke={stroke}
                      strokeWidth={hov && !sel ? 2.5 : 2}
                      vectorEffect="non-scaling-stroke"
                    />
                    <text
                      x={p.x * cssW}
                      y={p.y * cssH}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#0f172a"
                      fontSize={10}
                      fontWeight={700}
                      style={{ pointerEvents: "none" }}
                    >
                      {idx + 1}
                    </text>
                  </g>
                ))}
              </g>
              {showQty ? (
                <SelectedQuantityLabel
                  x={c.x}
                  y={c.y}
                  itemName={item?.name ?? ""}
                  qtyText={qtyLabelText(z, item)}
                  dy={labelDy}
                  accentColor={stroke}
                />
              ) : null}
            </Fragment>
          );
        }

        return null;
      })}
    </g>
  );
}
