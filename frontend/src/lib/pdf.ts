import type * as PdfjsModule from "pdfjs-dist";

export function setupPdfWorker(pdfjs: typeof PdfjsModule) {
  if (typeof window === "undefined") return;
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
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
