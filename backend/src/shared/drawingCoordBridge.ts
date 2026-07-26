export type DrawingCoordTransform = {
  version: 1;
  controlPoints: Array<{
    pdfNorm: { x: number; y: number };
    worldXZ: { x: number; z: number };
  }>;
  scale: number;
  rotationRad: number;
  translation: { x: number; z: number };
  mmPerPdfUnit: number;
  pageWidthPt: number;
  pageHeightPt: number;
};

export type CoordPoint2 = { x: number; z: number };

export function pdfUserToNorm(
  u: number,
  v: number,
  pageWidthPt: number,
  pageHeightPt: number,
): { x: number; y: number } {
  return {
    x: pageWidthPt > 0 ? u / pageWidthPt : 0,
    y: pageHeightPt > 0 ? v / pageHeightPt : 0,
  };
}

export function pdfNormToUser(
  norm: { x: number; y: number },
  pageWidthPt: number,
  pageHeightPt: number,
): { u: number; v: number } {
  return {
    u: norm.x * pageWidthPt,
    v: norm.y * pageHeightPt,
  };
}

/** Least-squares 2D similarity transform: dst ≈ scale * R(θ) * src + translation. */
export function fitSimilarityTransform(pairs: Array<{ src: CoordPoint2; dst: CoordPoint2 }>): {
  scale: number;
  rotationRad: number;
  translation: CoordPoint2;
} {
  if (pairs.length < 2) {
    throw new Error("At least 2 control point pairs required");
  }

  const n = pairs.length;
  let srcCx = 0;
  let srcCz = 0;
  let dstCx = 0;
  let dstCz = 0;
  for (const p of pairs) {
    srcCx += p.src.x;
    srcCz += p.src.z;
    dstCx += p.dst.x;
    dstCz += p.dst.z;
  }
  srcCx /= n;
  srcCz /= n;
  dstCx /= n;
  dstCz /= n;

  const centered = pairs.map((p) => ({
    sx: p.src.x - srcCx,
    sz: p.src.z - srcCz,
    dx: p.dst.x - dstCx,
    dz: p.dst.z - dstCz,
  }));

  let num = 0;
  let den = 0;
  for (const { sx, sz, dx, dz } of centered) {
    num += sx * dz - sz * dx;
    den += sx * sx + sz * sz;
  }

  const rotationRad = den > 1e-12 ? Math.atan2(num, den) : 0;
  const cosR = Math.cos(rotationRad);
  const sinR = Math.sin(rotationRad);

  let scaleNum = 0;
  let scaleDen = 0;
  for (const { sx, sz, dx, dz } of centered) {
    const rx = cosR * sx - sinR * sz;
    const rz = sinR * sx + cosR * sz;
    scaleNum += rx * dx + rz * dz;
    scaleDen += rx * rx + rz * rz;
  }
  const scale = scaleDen > 1e-12 ? scaleNum / scaleDen : 1;

  const translation = {
    x: dstCx - scale * (cosR * srcCx - sinR * srcCz),
    z: dstCz - scale * (sinR * srcCx + cosR * srcCz),
  };

  return { scale, rotationRad, translation };
}

function applySimilarity(
  src: CoordPoint2,
  scale: number,
  rotationRad: number,
  translation: CoordPoint2,
): CoordPoint2 {
  const cosR = Math.cos(rotationRad);
  const sinR = Math.sin(rotationRad);
  const rx = cosR * src.x - sinR * src.z;
  const rz = sinR * src.x + cosR * src.z;
  return {
    x: scale * rx + translation.x,
    z: scale * rz + translation.z,
  };
}

function invertSimilarity(
  dst: CoordPoint2,
  scale: number,
  rotationRad: number,
  translation: CoordPoint2,
): CoordPoint2 {
  const cosR = Math.cos(rotationRad);
  const sinR = Math.sin(rotationRad);
  const dx = dst.x - translation.x;
  const dz = dst.z - translation.z;
  const invScale = scale !== 0 ? 1 / scale : 0;
  const rx = invScale * (cosR * dx + sinR * dz);
  const rz = invScale * (-sinR * dx + cosR * dz);
  return { x: rx, z: rz };
}

export function pdfNormToWorldXZ(
  norm: { x: number; y: number },
  transform: DrawingCoordTransform,
): CoordPoint2 {
  const { u, v } = pdfNormToUser(norm, transform.pageWidthPt, transform.pageHeightPt);
  return applySimilarity(
    { x: u, z: v },
    transform.scale,
    transform.rotationRad,
    transform.translation,
  );
}

export function worldXZToPdfNorm(
  worldX: number,
  worldZ: number,
  transform: DrawingCoordTransform,
): { x: number; y: number } {
  const src = invertSimilarity(
    { x: worldX, z: worldZ },
    transform.scale,
    transform.rotationRad,
    transform.translation,
  );
  return pdfUserToNorm(src.x, src.z, transform.pageWidthPt, transform.pageHeightPt);
}

/** Max residual distance (meters) at control points for validation. */
export function maxControlPointResidualMeters(transform: DrawingCoordTransform): number {
  let max = 0;
  for (const cp of transform.controlPoints) {
    const fitted = pdfNormToWorldXZ(cp.pdfNorm, transform);
    const dx = fitted.x - cp.worldXZ.x;
    const dz = fitted.z - cp.worldXZ.z;
    max = Math.max(max, Math.hypot(dx, dz));
  }
  return max;
}

export function buildTransformFromControlPoints(
  controlPoints: DrawingCoordTransform["controlPoints"],
  mmPerPdfUnit: number,
  pageWidthPt: number,
  pageHeightPt: number,
): DrawingCoordTransform {
  const pairs = controlPoints.map((cp) => {
    const { u, v } = pdfNormToUser(cp.pdfNorm, pageWidthPt, pageHeightPt);
    return {
      src: { x: u, z: v },
      dst: { x: cp.worldXZ.x, z: cp.worldXZ.z },
    };
  });
  const { scale, rotationRad, translation } = fitSimilarityTransform(pairs);
  return {
    version: 1,
    controlPoints,
    scale,
    rotationRad,
    translation,
    mmPerPdfUnit,
    pageWidthPt,
    pageHeightPt,
  };
}
