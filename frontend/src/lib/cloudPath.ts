/**
 * SVG path for a revision-style cloud along a rectangle (pixel space, clockwise).
 * Single continuous path with outward semicircular scallops.
 */
export function cloudRectPathD(minX: number, minY: number, maxX: number, maxY: number): string {
  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 2 || h < 2) return "";

  const bump = Math.min(18, Math.max(6, Math.min(w, h) / 4.5));
  const corners = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ] as const;

  const parts: string[] = [];
  let started = false;

  for (let e = 0; e < 4; e++) {
    const a = corners[e];
    const b = corners[(e + 1) % 4];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;

    // ~semicircle lobes; keep count even so corners land on lobe joints.
    const nSeg = Math.max(2, Math.round(len / (bump * 1.35)));
    const stepX = dx / nSeg;
    const stepY = dy / nSeg;
    // Chord length ≈ 2r for a half-disk bulge.
    const r = Math.hypot(stepX, stepY) / 2;

    for (let i = 0; i < nSeg; i++) {
      const sx0 = a.x + stepX * i;
      const sy0 = a.y + stepY * i;
      const sx1 = a.x + stepX * (i + 1);
      const sy1 = a.y + stepY * (i + 1);
      if (!started) {
        parts.push(`M ${sx0} ${sy0}`);
        started = true;
      }
      // Clockwise rect walk + Y-down coords: sweep=0 bulges outward.
      parts.push(`A ${r} ${r} 0 0 0 ${sx1} ${sy1}`);
    }
  }

  if (!started) return "";
  parts.push("Z");
  return parts.join(" ");
}
