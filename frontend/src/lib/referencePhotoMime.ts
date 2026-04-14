/** MIME for S3 PUT + API validation (mobile cameras often omit type or use HEIC). */
export function referencePhotoContentType(file: File): string {
  const raw = file.type?.trim().toLowerCase() || "";
  const allowed = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
  ]);
  if (allowed.has(raw)) return raw;
  const n = file.name.toLowerCase();
  if (n.endsWith(".heic")) return "image/heic";
  if (n.endsWith(".heif")) return "image/heif";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}
