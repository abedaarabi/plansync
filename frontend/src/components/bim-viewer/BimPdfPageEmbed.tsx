"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { RenderTask } from "pdfjs-dist";
import { apiUrl } from "@/lib/api-url";
import { pdfRenderScale } from "@/lib/canvasRenderQuality";
import { buildPdfOpenOptions, setupPdfWorker } from "@/lib/pdf";

// fallow-ignore-next-line complexity
export function BimPdfPageEmbed(props: {
  fileId: string;
  fileVersionId?: string | null;
  pageIndex: number;
  className?: string;
  /** Normalized pointer position callback (0–1, origin top-left). */
  onPointerNorm?: (norm: { x: number; y: number }) => void;
  /** Exposes the rendered page canvas for external pick/zoom handlers. */
  pickSurfaceRef?: React.RefObject<HTMLCanvasElement | null>;
  /** Scroll viewport so norm center is visible. */
  scrollToCenterNorm?: { x: number; y: number } | null;
  /** Called after render with canvas pixel dimensions. */
  onCanvasSize?: (w: number, h: number) => void;
  overlay?: React.ReactNode;
  /** When true, the overlay receives pointer events (for interactive navigators). */
  overlayInteractive?: boolean;
  /** `high` renders at container width × DPR (for calibration / zoom panes). */
  quality?: "default" | "high";
  /** Extra multiplier for high-quality mode so zoom-in stays sharp. */
  zoomHeadroom?: number;
  /** How the page fills its box in high-quality mode (default: width-fit / contain). */
  fit?: "contain" | "stretch";
  /** PDF page size in points (1pt @ scale 1) after the page is loaded. */
  onPageSizePt?: (widthPt: number, heightPt: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layoutWidth, setLayoutWidth] = useState(0);
  const quality = props.quality ?? "default";
  const zoomHeadroom = props.zoomHeadroom ?? 2;
  const fit = props.fit ?? "contain";

  useEffect(() => {
    if (quality !== "high") return;
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setLayoutWidth(el.clientWidth);
      });
    });
    ro.observe(el);
    setLayoutWidth(el.clientWidth);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [quality]);

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    // fallow-ignore-next-line complexity
    async function render() {
      setLoading(true);
      setError(null);
      try {
        const pdfjs = (await import("pdfjs-dist")) as typeof import("pdfjs-dist");
        setupPdfWorker(pdfjs);
        const v = props.fileVersionId
          ? `?fileVersionId=${encodeURIComponent(props.fileVersionId)}`
          : "";
        const url = apiUrl(`/api/v1/files/${encodeURIComponent(props.fileId)}/content${v}`);
        const doc = await pdfjs.getDocument({
          ...buildPdfOpenOptions(url),
          withCredentials: true,
        }).promise;
        const page = await doc.getPage(props.pageIndex + 1);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        props.onPageSizePt?.(baseViewport.width, baseViewport.height);
        const cssW =
          quality === "high" && layoutWidth > 0 ? layoutWidth : Math.max(layoutWidth, 960);
        const scale =
          quality === "high" ? pdfRenderScale(baseViewport.width, cssW, zoomHeadroom) : 1.5;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        if (quality === "high") {
          canvas.style.width = "100%";
          canvas.style.height = fit === "stretch" ? "100%" : "auto";
        } else {
          canvas.style.width = "";
          canvas.style.height = "";
        }
        renderTask = page.render({ canvasContext: ctx, viewport, canvas });
        await renderTask.promise;
        if (cancelled) return;
        props.onCanvasSize?.(canvas.width, canvas.height);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not render PDF page.");
          setLoading(false);
        }
      }
    }

    void render();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
    // Intentionally omit onPageSizePt — parents often pass inline setters.
  }, [props.fileId, props.fileVersionId, props.pageIndex, quality, fit, layoutWidth, zoomHeadroom]);

  useEffect(() => {
    if (!props.scrollToCenterNorm || !containerRef.current || !canvasRef.current) return;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const cx = props.scrollToCenterNorm.x * canvas.width;
    const cy = props.scrollToCenterNorm.y * canvas.height;
    container.scrollLeft = Math.max(0, cx - container.clientWidth / 2);
    container.scrollTop = Math.max(0, cy - container.clientHeight / 2);
  }, [props.scrollToCenterNorm]);

  // fallow-ignore-next-line complexity
  function onPointer(e: React.PointerEvent<HTMLDivElement>) {
    if (!props.onPointerNorm || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    props.onPointerNorm({ x, y });
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto bg-white ${props.className ?? ""}`}
      onPointerDown={onPointer}
      onPointerMove={(e) => {
        if (e.buttons !== 1) return;
        onPointer(e);
      }}
    >
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/85">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--enterprise-primary)]" />
        </div>
      ) : null}
      {error ? (
        <div className="flex h-full min-h-[120px] items-center justify-center p-4 text-xs text-red-600">
          {error}
        </div>
      ) : null}
      <div className="relative inline-block w-full max-w-full">
        <canvas
          ref={(node) => {
            canvasRef.current = node;
            if (props.pickSurfaceRef) props.pickSurfaceRef.current = node;
          }}
          className="block max-w-none"
        />
        {props.overlay && !loading && !error ? (
          <div
            className={`absolute inset-0 ${props.overlayInteractive ? "pointer-events-auto touch-none" : "pointer-events-none"}`}
          >
            {props.overlay}
          </div>
        ) : null}
      </div>
    </div>
  );
}
