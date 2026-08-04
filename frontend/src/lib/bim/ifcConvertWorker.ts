/// <reference lib="webworker" />
import * as FRAGS from "@thatopen/fragments";
import { configureLiteFallbackImporter } from "@/lib/bim/ifcImporterProfiles";

export type IfcConvertWorkerRequest = {
  type: "convert";
  requestId: string;
  bytes: ArrayBuffer;
  wasmPath: string;
};

export type IfcConvertWorkerProgress = {
  type: "progress";
  requestId: string;
  fraction: number;
};

export type IfcConvertWorkerDone = {
  type: "done";
  requestId: string;
  buffer: ArrayBuffer;
};

export type IfcConvertWorkerError = {
  type: "error";
  requestId: string;
  message: string;
};

type InMsg = IfcConvertWorkerRequest | { type: "cancel"; requestId: string };

let activeRequestId: string | null = null;

function post(
  msg: IfcConvertWorkerProgress | IfcConvertWorkerDone | IfcConvertWorkerError,
  transfer?: Transferable[],
): void {
  if (transfer?.length) {
    self.postMessage(msg, transfer);
    return;
  }
  self.postMessage(msg);
}

async function handleConvert(msg: IfcConvertWorkerRequest): Promise<void> {
  activeRequestId = msg.requestId;
  try {
    const importer = new FRAGS.IfcImporter();
    importer.wasm = { path: msg.wasmPath, absolute: true };
    configureLiteFallbackImporter(importer);

    const fragBytes = await importer.process({
      bytes: new Uint8Array(msg.bytes),
      progressCallback: (progress) => {
        if (activeRequestId !== msg.requestId) return;
        post({
          type: "progress",
          requestId: msg.requestId,
          fraction: Math.min(1, Math.max(0, progress)),
        });
      },
    });

    if (activeRequestId !== msg.requestId) return;

    const outBytes = new Uint8Array(fragBytes.byteLength);
    outBytes.set(fragBytes);
    const out = outBytes.buffer;
    post({ type: "done", requestId: msg.requestId, buffer: out }, [out]);
  } catch (err) {
    if (activeRequestId !== msg.requestId) return;
    const raw = err instanceof Error ? err.message : String(err);
    const message = /bad_alloc|Aborted|abort\(/i.test(raw)
      ? "web-ifc aborted (out of memory or corrupted IFC)"
      : raw || "IFC conversion failed in worker";
    post({ type: "error", requestId: msg.requestId, message });
  } finally {
    if (activeRequestId === msg.requestId) activeRequestId = null;
  }
}

self.onmessage = (ev: MessageEvent<InMsg>) => {
  const msg = ev.data;
  if (msg.type === "cancel") {
    if (activeRequestId === msg.requestId) activeRequestId = null;
    return;
  }
  if (msg.type === "convert") {
    void handleConvert(msg);
  }
};
