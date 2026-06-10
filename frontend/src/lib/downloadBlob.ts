import { ProRequiredError } from "@/lib/api-client/errors";

function parseDownloadFilename(header: string | null, fallback: string): string {
  const match = header?.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function assertDownloadOk(res: Response, errorMessage: string): Promise<void> {
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok) throw new Error(errorMessage);
}

/** Download an authenticated API response as a file in the browser. */
export async function downloadAuthenticatedBlob(
  res: Response,
  defaultFilename: string,
  errorMessage: string,
): Promise<void> {
  await assertDownloadOk(res, errorMessage);
  const blob = await res.blob();
  triggerBlobDownload(
    blob,
    parseDownloadFilename(res.headers.get("Content-Disposition"), defaultFilename),
  );
}
