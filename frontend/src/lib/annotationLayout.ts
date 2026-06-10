import type { Annotation } from "@/store/viewerStore";

export type TextLayoutPx = {
  px: number;
  py: number;
  pad: number;
  lh: number;
  boxW: number;
  boxH: number;
  fontSize: number;
};

export function textBoxLayoutPx(a: Annotation, cssW: number, cssH: number): TextLayoutPx {
  const p = a.points[0];
  const px = p.x * cssW;
  const py = p.y * cssH;
  const fontSize = a.fontSize ?? 12;
  const lh = Math.round(fontSize * 1.17);
  const pad = Math.max(4, Math.round(6 * (fontSize / 12)));
  const lines = (a.text ?? "").split("\n");
  const maxChars = Math.max(...lines.map((l) => l.length), 1);
  const boxW = Math.min(cssW * 0.45, maxChars * (fontSize * 0.58) + pad * 2);
  const boxH = lines.length * lh + pad * 2;
  return { px, py, pad, lh, boxW, boxH, fontSize };
}

export function boundsNormFromPoints(points: { x: number; y: number }[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}
