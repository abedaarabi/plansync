import { apiUrl } from "@/lib/api-url";

export type XhrUploadInput = {
  workspaceId: string;
  projectId: string;
  folderId: string | null;
  fileName: string;
  file: File;
  onProgress: (pct: number) => void;
};

function parseUploadResponse<T>(xhr: XMLHttpRequest): T {
  return JSON.parse(xhr.responseText) as T;
}

function uploadFailureMessage(xhr: XMLHttpRequest): string {
  try {
    const j = JSON.parse(xhr.responseText) as { error?: string };
    return j.error ?? `Upload failed (${xhr.status})`;
  } catch {
    return `Upload failed (${xhr.status})`;
  }
}

function finishUpload<T>(
  xhr: XMLHttpRequest,
  resolve: (value: T) => void,
  reject: (reason: Error) => void,
): void {
  if (xhr.status < 200 || xhr.status >= 300) {
    reject(new Error(uploadFailureMessage(xhr)));
    return;
  }
  try {
    resolve(parseUploadResponse<T>(xhr));
  } catch {
    reject(new Error("Invalid upload response."));
  }
}

export function uploadFileViaXHR<T>(input: XhrUploadInput): Promise<T> {
  const fd = new FormData();
  fd.append("workspaceId", input.workspaceId);
  fd.append("projectId", input.projectId);
  if (input.folderId) fd.append("folderId", input.folderId);
  fd.append("fileName", input.fileName);
  fd.append("file", input.file);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", apiUrl("/api/v1/files/upload"));
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        input.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => finishUpload<T>(xhr, resolve, reject);
    xhr.onerror = () => reject(new Error("Upload network error."));
    xhr.send(fd);
  });
}
