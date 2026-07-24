// fallow-ignore-next-line complexity
function vecDist(a: number[] | undefined, b: number[] | undefined): number {
  if (!a || !b || a.length !== 3 || b.length !== 3) return Infinity;
  return Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
}

/** Tolerance scales with model size so small orbit moves do not hide markups. */
function matchTolerance(saved: Record<string, unknown>): { posEps: number; tgtEps: number } {
  const pos = saved.position as number[] | undefined;
  const tgt = saved.target as number[] | undefined;
  const span = vecDist(pos, tgt);
  const base = Number.isFinite(span) && span > 0 ? span : 10;
  return {
    posEps: Math.max(1.5, base * 0.08),
    tgtEps: Math.max(0.75, base * 0.04),
  };
}

/** True when the current camera is close enough to the markup's saved view. */
// fallow-ignore-next-line complexity
export function camerasMatch(
  saved: Record<string, unknown>,
  current: Record<string, unknown>,
): boolean {
  const posD = vecDist(
    saved.position as number[] | undefined,
    current.position as number[] | undefined,
  );
  const tgtD = vecDist(
    saved.target as number[] | undefined,
    current.target as number[] | undefined,
  );
  if (!Number.isFinite(posD) || !Number.isFinite(tgtD)) return false;
  const savedProj = saved.projection;
  const currentProj = current.projection;
  if (savedProj && currentProj && savedProj !== currentProj) return false;
  const { posEps, tgtEps } = matchTolerance(saved);
  return posD <= posEps && tgtD <= tgtEps;
}
