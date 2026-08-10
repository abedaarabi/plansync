"use client";

/** Absolute tint layer over the live PDF raster (transparent paper/shared). */
export function RevisionDiffOverlay(props: { imageUrl: string | null; opacity: number }) {
  if (!props.imageUrl) return null;
  // Never use multiply — it crushes cyan/sky blues into near-invisible gray on sheets.
  return (
    <img
      src={props.imageUrl}
      alt=""
      draggable={false}
      className="pointer-events-none absolute inset-0 z-[1] block h-full w-full max-w-none select-none object-fill"
      style={{
        opacity: Math.min(1, Math.max(0.2, props.opacity)),
        mixBlendMode: "normal",
        // Slight contrast so magenta/cyan pop over the live PDF
        filter: "contrast(1.1) saturate(1.2)",
      }}
    />
  );
}
