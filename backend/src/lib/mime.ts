const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  txt: "text/plain",
  csv: "text/csv",
  json: "application/json",
  zip: "application/zip",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** Prefer the client-provided type; fall back from filename when the browser sends an empty `type`. */
export function resolvedMimeType(contentType: string | undefined | null, fileName: string): string {
  const t = (contentType ?? "").trim();
  if (t) return t;
  const ext = fileName.toLowerCase().match(/\.([^.]+)$/)?.[1] ?? "";
  return EXT_TO_MIME[ext] ?? "application/octet-stream";
}
