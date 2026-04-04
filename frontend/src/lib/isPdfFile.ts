/** Whether a cloud file, `File`, or upload is treated as PDF in the app. */
export function isPdfFile(file: {
  name: string;
  mimeType?: string | null;
  /** Browser `File.type` */
  type?: string | null;
}): boolean {
  const mt = (file.mimeType ?? file.type ?? "").toLowerCase();
  if (mt === "application/pdf" || mt.includes("pdf")) return true;
  return file.name.toLowerCase().endsWith(".pdf");
}

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif"]);

const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/** Browser `File.type` is often empty; fall back from the extension for uploads. */
export function guessFileMimeType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.toLowerCase().match(/\.([^.]+)$/)?.[1] ?? "";
  return EXT_MIME[ext] ?? "application/octet-stream";
}

/** Whether we can show a raster preview in the file grid (same-origin fetch + <img>). */
export function isImageThumbnailFile(file: {
  name: string;
  mimeType?: string | null;
  type?: string | null;
}): boolean {
  const mt = (file.mimeType ?? file.type ?? "").toLowerCase();
  if (mt.startsWith("image/")) return true;
  const ext = file.name.toLowerCase().match(/\.([^.]+)$/)?.[1] ?? "";
  return IMAGE_EXT.has(ext);
}
