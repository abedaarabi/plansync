// fallow-ignore-file unused-file
/**
 * Build-time stub for `three/examples/jsm/loaders/TTFLoader.js`.
 *
 * The real module does `import opentype from "https://cdn.jsdelivr.net/..."`,
 * which Turbopack/webpack cannot bundle. `@thatopen/components-front` imports
 * it for 3D text labels we never render, so alias it away (see next.config.ts).
 * Reachable only via next.config resolveAlias — not a static import graph edge.
 */
export class TTFLoader {
  constructor() {
    throw new Error("TTFLoader is not available in this build (stubbed out).");
  }
}
