"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Search } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { searchPdfText, type SearchHit } from "@/lib/pdfSearch";
import { useViewerStore } from "@/store/viewerStore";

type Props = {
  pdfDoc: PDFDocumentProxy | null;
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
};

function useAnchorPopoverStyle(anchorRef: React.RefObject<HTMLElement | null>, open: boolean) {
  const [style, setStyle] = useState<React.CSSProperties | null>(null);

  const update = useCallback(() => {
    const el = anchorRef.current;
    if (!el || typeof window === "undefined") {
      setStyle(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const pad = 8;
    const maxW = Math.min(320, window.innerWidth - pad * 2);
    setStyle({
      position: "fixed",
      top: r.bottom + 4,
      right: Math.max(pad, window.innerWidth - r.right),
      width: maxW,
      zIndex: 100,
    });
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, update]);

  return open ? style : null;
}

export function PdfSearchPopover({ pdfDoc, open, onClose, anchorRef }: Props) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const requestSearchFocus = useViewerStore((s) => s.requestSearchFocus);
  const popRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const popoverStyle = useAnchorPopoverStyle(anchorRef, open);

  useClickOutside(popRef, anchorRef, open, onClose);

  const runSearch = useCallback(async () => {
    if (!pdfDoc || !query.trim()) {
      setHits([]);
      return;
    }
    setBusy(true);
    try {
      const r = await searchPdfText(pdfDoc, query, 60);
      setHits(r);
    } finally {
      setBusy(false);
    }
  }, [pdfDoc, query]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      void runSearch();
    }, 280);
    return () => window.clearTimeout(t);
  }, [open, query, runSearch]);

  if (!open || !mounted || typeof document === "undefined" || !popoverStyle) return null;

  return createPortal(
    <div
      ref={popRef}
      style={popoverStyle}
      className="rounded-xl border border-[var(--viewer-border-strong)] bg-[var(--viewer-panel)] p-2 shadow-2xl ring-1 ring-[var(--viewer-primary)]/20"
      role="dialog"
      aria-label="Search in document"
    >
      <div className="flex items-center gap-1.5 border-b border-[var(--viewer-border-strong)] pb-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-[var(--viewer-text-muted)]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search text…"
          title="Search all pages; results appear below"
          className="min-w-0 flex-1 rounded-md border border-[var(--viewer-border-strong)] bg-[var(--viewer-input-bg)] px-2 py-1.5 text-[11px] text-[var(--viewer-text)] placeholder:text-[var(--viewer-text-muted)] outline-none focus:border-[var(--viewer-primary)]/50 focus:ring-1 focus:ring-[var(--viewer-primary)]/35"
          autoFocus
        />
        {busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--viewer-primary)]" />}
      </div>
      <ul className="max-h-56 overflow-y-auto py-1 [scrollbar-width:thin]">
        {hits.length === 0 && !busy && query.trim() && (
          <li className="px-1 py-2 text-[11px] text-[var(--viewer-text-muted)]">No matches.</li>
        )}
        {hits.length === 0 && !query.trim() && (
          <li className="px-1 py-2 text-[11px] text-[var(--viewer-text-muted)]">
            Type to search all pages.
          </li>
        )}
        {hits.map((h, i) => (
          <li key={`${h.pageNumber}-${i}`}>
            <button
              type="button"
              onClick={() => {
                requestSearchFocus({
                  pageNumber: h.pageNumber,
                  rectNorm: h.rectNorm,
                });
                onClose();
              }}
              title={`Go to page ${h.pageNumber}`}
              className="w-full rounded-md px-1.5 py-1.5 text-left text-[11px] leading-snug text-[var(--viewer-text-muted)] hover:bg-[var(--viewer-input-bg)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--viewer-primary)]/50"
            >
              <span className="font-semibold text-[var(--viewer-primary)]">p.{h.pageNumber}</span>{" "}
              <span className="text-[var(--viewer-text)]/90">{h.snippet}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>,
    document.body,
  );
}

function useClickOutside(
  popRef: React.RefObject<HTMLElement | null>,
  anchorRef: React.RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onCloseRef.current();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, popRef, anchorRef]);
}
