/**
 * SVG path for a revision-style cloud along a rectangle (pixel space, clockwise).
 */
export function cloudRectPathD(minX: number, minY: number, maxX: number, maxY: number): string {
  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 2 || h < 2) return "";
  const bump = Math.min(14, Math.max(5, Math.min(w, h) / 5));

  const parts: string[] = [];

  const edge = (x1: number, y1: number, x2: number, y2: number, outX: number, outY: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const nSeg = Math.max(2, Math.round(len / (bump * 2)));
    const ddx = dx / nSeg;
    const ddy = dy / nSeg;
    for (let i = 0; i < nSeg; i++) {
      const sx0 = x1 + ddx * i;
      const sy0 = y1 + ddy * i;
      const sx1 = x1 + ddx * (i + 1);
      const sy1 = y1 + ddy * (i + 1);
      const mx = (sx0 + sx1) / 2 + outX * bump;
      const my = (sy0 + sy1) / 2 + outY * bump;
      if (i === 0) parts.push(`M ${sx0} ${sy0}`);
      parts.push(`Q ${mx} ${my} ${sx1} ${sy1}`);
    }
  };

  edge(minX, minY, maxX, minY, 0, -1);
  edge(maxX, minY, maxX, maxY, 1, 0);
  edge(maxX, maxY, minX, maxY, 0, 1);
  edge(minX, maxY, minX, minY, -1, 0);
  parts.push("Z");
  return parts.join(" ");
}
