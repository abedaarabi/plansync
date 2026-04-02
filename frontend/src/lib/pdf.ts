import type * as PdfjsModule from "pdfjs-dist";

export function setupPdfWorker(pdfjs: typeof PdfjsModule) {
  if (typeof window === "undefined") return;
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
}
