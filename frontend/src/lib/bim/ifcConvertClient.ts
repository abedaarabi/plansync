import type {
  IfcConvertWorkerDone,
  IfcConvertWorkerError,
  IfcConvertWorkerProgress,
  IfcConvertWorkerRequest,
} from "@/lib/bim/ifcConvertWorker";

const WEB_IFC_WASM_PATH = "/bim/";

export type ConvertIfcInWorkerOpts = {
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
};

/**
 * Convert IFC → Fragments in a dedicated Web Worker so WASM OOM kills the
 * worker instead of the tab. Uses the lite geometry profile.
 */
export function convertIfcInWorker(
  bytes: Uint8Array,
  opts?: ConvertIfcInWorkerOpts,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./ifcConvertWorker.ts", import.meta.url), { type: "module" });
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    const requestId = `ifc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // Copy so we can transfer without detaching the caller's view.
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const transferBuffer = copy.buffer;

    const cleanup = () => {
      opts?.signal?.removeEventListener("abort", onAbort);
      try {
        worker.terminate();
      } catch {
        /* ignore */
      }
    };

    const onAbort = () => {
      worker.postMessage({ type: "cancel", requestId });
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    opts?.signal?.addEventListener("abort", onAbort, { once: true });
    if (opts?.signal?.aborted) {
      onAbort();
      return;
    }

    worker.onmessage = (
      ev: MessageEvent<IfcConvertWorkerProgress | IfcConvertWorkerDone | IfcConvertWorkerError>,
    ) => {
      const msg = ev.data;
      if (msg.requestId !== requestId) return;
      if (msg.type === "progress") {
        opts?.onProgress?.(msg.fraction);
        return;
      }
      cleanup();
      if (msg.type === "error") {
        reject(new Error(msg.message));
        return;
      }
      resolve(msg.buffer);
    };

    worker.onerror = (err) => {
      cleanup();
      reject(err.error instanceof Error ? err.error : new Error(err.message || "IFC worker error"));
    };

    const req: IfcConvertWorkerRequest = {
      type: "convert",
      requestId,
      bytes: transferBuffer,
      wasmPath: WEB_IFC_WASM_PATH,
    };
    worker.postMessage(req, [transferBuffer]);
  });
}
