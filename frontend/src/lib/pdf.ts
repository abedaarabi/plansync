import type * as PdfjsModule from "pdfjs-dist";

/** Synced from pdfjs-dist on dev/build — see scripts/copy-pdf-worker.mjs */
const PDF_WORKER_PATH = "/pdf.worker.mjs";

export function setupPdfWorker(pdfjs: typeof PdfjsModule) {
  if (typeof window === "undefined") return;
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_PATH;
  }
}

/**
 * Tuned pdf.js open options for large documents:
 * - use streaming/range requests when server supports them
 * - avoid aggressive auto-fetch of not-yet-viewed pages
 */
export function buildPdfOpenOptions(pdfUrl: string) {
  const isBlobUrl = pdfUrl.startsWith("blob:");
  return {
    url: pdfUrl,
    rangeChunkSize: 512 * 1024,
    disableAutoFetch: true,
    disableStream: false,
    disableRange: isBlobUrl,
  };
}
