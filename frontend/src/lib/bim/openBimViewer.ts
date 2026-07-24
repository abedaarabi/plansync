import { disposeModelThumbnailService } from "@/lib/bim/modelThumbnail";

/**
 * Opens the BIM viewer with a clean WebGL/worker slate.
 * Soft SPA navigations leave the IFC thumbnail FragmentsManager alive and can
 * stall `BimEngine.init` until a full refresh — so we dispose it and do a
 * hard navigation.
 */
export function openBimViewer(href: string): void {
  disposeModelThumbnailService();
  if (typeof window === "undefined") return;
  window.location.assign(href);
}
