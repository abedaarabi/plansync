"use client";

/** Absolute layer over the PDF raster showing the revision composite. */
export function RevisionDiffOverlay(props: {
  imageUrl: string | null;
  opacity: number;
  /** When true, hide the underlying PDF paint (diff layout). */
  coverPdf: boolean;
}) {
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
        // Slight contrast so magenta/cyan pop over muted shared ink
        filter: props.coverPdf ? "contrast(1.08) saturate(1.15)" : "contrast(1.12) saturate(1.25)",
      }}
    />
  );
}
