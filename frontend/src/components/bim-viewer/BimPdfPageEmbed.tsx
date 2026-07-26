"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { RenderTask } from "pdfjs-dist";
import { apiUrl } from "@/lib/api-url";
import { buildPdfOpenOptions, setupPdfWorker } from "@/lib/pdf";

// fallow-ignore-next-line complexity
export function BimPdfPageEmbed(props: {
  fileId: string;
  fileVersionId?: string | null;
  pageIndex: number;
  className?: string;
  /** Normalized pointer position callback (0–1, origin top-left). */
  onPointerNorm?: (norm: { x: number; y: number }) => void;
  /** Scroll viewport so norm center is visible. */
  scrollToCenterNorm?: { x: number; y: number } | null;
  /** Called after render with canvas pixel dimensions. */
  onCanvasSize?: (w: number, h: number) => void;
  overlay?: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    // fallow-ignore-next-line complexity
    async function render() {
      setLoading(true);
      setError(null);
      setCanvasSize(null);
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

        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        renderTask = page.render({ canvasContext: ctx, viewport, canvas });
        await renderTask.promise;
        if (cancelled) return;
        const size = { w: canvas.width, h: canvas.height };
        setCanvasSize(size);
        props.onCanvasSize?.(size.w, size.h);
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
  }, [props.fileId, props.fileVersionId, props.pageIndex]);

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
      className={`relative overflow-auto bg-slate-100 ${props.className ?? ""}`}
      onPointerDown={onPointer}
      onPointerMove={(e) => {
        if (e.buttons !== 1) return;
        onPointer(e);
      }}
    >
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        </div>
      ) : null}
      {error ? (
        <div className="flex h-full min-h-[120px] items-center justify-center p-4 text-xs text-red-600">
          {error}
        </div>
      ) : null}
      <div className="relative inline-block min-w-full">
        <canvas ref={canvasRef} className="block max-w-none" />
        {props.overlay && canvasSize ? (
          <div
            className="pointer-events-none absolute left-0 top-0"
            style={{ width: canvasSize.w, height: canvasSize.h }}
          >
            {props.overlay}
          </div>
        ) : null}
      </div>
    </div>
  );
}
