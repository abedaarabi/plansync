"use client";

import { useEffect, useMemo, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { setupPdfWorker } from "@/lib/pdf";
import { getFlatOutline, type FlatOutlineItem } from "@/lib/pdfOutlineNav";
import { useViewerStore } from "@/store/viewerStore";

export function SidebarOutlineTab() {
  const pdfUrl = useViewerStore((s) => s.pdfUrl);
  const setCurrentPage = useViewerStore((s) => s.setCurrentPage);

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [items, setItems] = useState<FlatOutlineItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [outlineQuery, setOutlineQuery] = useState("");

  const filteredItems = useMemo(() => {
    const q = outlineQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.title.toLowerCase().includes(q));
  }, [items, outlineQuery]);

  useEffect(() => {
    if (!pdfUrl) {
      setDoc(null);
      setItems([]);
      setErr(null);
      return;
    }
    let cancelled = false;
    setDoc(null);
    setItems([]);
    setErr(null);
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        setupPdfWorker(pdfjs);
        const d = await pdfjs.getDocument({ url: pdfUrl }).promise;
        if (cancelled) return;
        setDoc(d);
        const outline = await getFlatOutline(d);
        if (!cancelled) setItems(outline);
      } catch {
        if (!cancelled) setErr("Could not read outline.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  if (!pdfUrl) {
    return (
      <p className="px-1 text-center text-[10px] leading-relaxed text-slate-500">
        Open a PDF to see the table of contents.
      </p>
    );
  }

  if (err) {
    return <p className="px-1 text-center text-[10px] text-red-400">{err}</p>;
  }

  if (!doc) {
    return <p className="px-1 text-center text-[10px] text-slate-500">Loading outline…</p>;
  }

  if (items.length === 0) {
    return (
      <p className="px-1 text-center text-[10px] leading-relaxed text-slate-500">
        This PDF has no bookmarks / outline.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <p className="mb-1.5 shrink-0 px-0.5 text-[9px] leading-snug text-slate-500">
        Jump to a section when the PDF has bookmarks.
      </p>
      <label className="mb-2 shrink-0 px-0.5">
        <span className="sr-only">Filter outline</span>
        <input
          type="search"
          value={outlineQuery}
          onChange={(e) => setOutlineQuery(e.target.value)}
          placeholder="Filter…"
          className="w-full rounded-md border border-slate-700/80 bg-slate-900/80 px-2 py-1 text-[10px] text-slate-200 placeholder:text-slate-600"
        />
      </label>
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden px-0.5 pb-2 [scrollbar-width:thin]">
        {filteredItems.length === 0 && items.length > 0 && (
          <li className="px-0.5 py-2 text-[9px] text-slate-500">No bookmarks match this filter.</li>
        )}
        {filteredItems.map((it, i) => (
          <li key={`${i}-${it.title}`}>
            <button
              type="button"
              disabled={it.pageNumber == null}
              onClick={() => {
                if (it.pageNumber != null) setCurrentPage(it.pageNumber);
              }}
              style={{ paddingLeft: `${6 + it.depth * 6}px` }}
              className="w-full rounded-md py-1.5 text-left text-[10px] leading-snug text-slate-300 hover:bg-slate-800/90 disabled:cursor-not-allowed disabled:opacity-40"
              title={
                it.pageNumber != null
                  ? `Jump to: ${it.title} (page ${it.pageNumber})`
                  : "No destination page for this bookmark"
              }
            >
              {it.title}
              {it.pageNumber != null && (
                <span className="ml-1 tabular-nums text-slate-500">· p.{it.pageNumber}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
