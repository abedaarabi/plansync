/** Reject empty / non-IFC / truncated STEP payloads before web-ifc can abort. */
export function assertIfcBytesIntact(bytes: Uint8Array, fileLabel = "IFC file"): void {
  if (bytes.byteLength < 32) {
    throw new Error(`${fileLabel} is empty or too small to be a valid IFC.`);
  }
  const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, 96));
  if (!/ISO-10303-21/i.test(head)) {
    throw new Error(`${fileLabel} is not a valid IFC (missing ISO-10303-21 header).`);
  }
  const tailStart = Math.max(0, bytes.byteLength - 512);
  const tail = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(tailStart));
  if (!/END-ISO-10303-21\s*;?/i.test(tail)) {
    throw new Error(
      `${fileLabel} looks incomplete or corrupted (file ends abruptly). Re-upload the full IFC.`,
    );
  }
}
