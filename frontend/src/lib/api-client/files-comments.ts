import { apiUrl } from "@/lib/api-url";
import { readJsonOrEmpty } from "./shared";

export type FileCommentRow = {
  id: string;
  body: string;
  fileVersionId: string | null;
  resolvedAt: string | null;
  editedAt: string | null;
  createdAt: string;
  author: { id: string; name: string; email: string; image: string | null };
};

function readErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const errorValue = (payload as { error?: unknown }).error;
    if (typeof errorValue === "string" && errorValue.trim()) return errorValue;
  }
  return fallback;
}

export async function fetchFileComments(
  projectId: string,
  fileId: string,
  fileVersionId?: string | null,
): Promise<{ comments: FileCommentRow[] }> {
  const params = new URLSearchParams();
  if (fileVersionId) params.set("fileVersionId", fileVersionId);
  const suffix = params.toString();
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}/comments${suffix ? `?${suffix}` : ""}`,
    ),
    { credentials: "include" },
  );
  const json = await readJsonOrEmpty(res);
  if (!res.ok) throw new Error(readErrorMessage(json, "Could not load file comments."));
  return json as { comments: FileCommentRow[] };
}

export async function postFileComment(
  projectId: string,
  fileId: string,
  body: string,
  fileVersionId?: string | null,
): Promise<FileCommentRow> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}/comments`,
    ),
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, fileVersionId: fileVersionId ?? null }),
    },
  );
  const json = await readJsonOrEmpty(res);
  if (!res.ok) throw new Error(readErrorMessage(json, "Could not post comment."));
  return json as FileCommentRow;
}

export async function patchFileComment(
  projectId: string,
  fileId: string,
  commentId: string,
  patch: { body?: string; resolved?: boolean },
): Promise<FileCommentRow> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}/comments/${encodeURIComponent(commentId)}`,
    ),
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  const json = await readJsonOrEmpty(res);
  if (!res.ok) throw new Error(readErrorMessage(json, "Could not update comment."));
  return json as FileCommentRow;
}

export async function deleteFileComment(
  projectId: string,
  fileId: string,
  commentId: string,
): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/v1/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}/comments/${encodeURIComponent(commentId)}`,
    ),
    {
      method: "DELETE",
      credentials: "include",
    },
  );
  if (res.ok) return;
  const json = await readJsonOrEmpty(res);
  throw new Error(readErrorMessage(json, "Could not delete comment."));
}
