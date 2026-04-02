/** Whether a cloud file or upload is treated as PDF in the app. */
export function isPdfFile(file: { name: string; mimeType?: string | null }): boolean {
  const mt = (file.mimeType ?? "").toLowerCase();
  if (mt === "application/pdf" || mt.includes("pdf")) return true;
  return file.name.toLowerCase().endsWith(".pdf");
}
