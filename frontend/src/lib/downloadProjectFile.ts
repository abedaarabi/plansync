import { apiUrl } from "@/lib/api-url";

export function projectFileContentUrl(fileId: string, version: number): string {
  const base = apiUrl(`/api/v1/files/${encodeURIComponent(fileId)}/content`);
  return `${base}?version=${encodeURIComponent(String(version))}`;
}

function safeDownloadFileName(name: string): string {
  const t = name.replace(/[/\\]/g, "_").trim();
  return t.length > 0 ? t : "download";
}

/** Fetch project file bytes with cookies and trigger a browser download (any MIME type). */
export async function downloadProjectFileVersion(params: {
  fileId: string;
  fileName: string;
  version: number;
}): Promise<void> {
  const url = projectFileContentUrl(params.fileId, params.version);
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    throw new Error(
      res.status === 403 ? "You are not allowed to download this file." : "Download failed.",
    );
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = safeDownloadFileName(params.fileName);
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
