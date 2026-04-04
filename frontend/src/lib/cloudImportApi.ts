import { apiUrl } from "@/lib/api-url";

const jsonHeaders = { "Content-Type": "application/json" };

export type CloudProviderUi = "google" | "microsoft" | "dropbox";

export type CloudConnectionsResponse = {
  connections: Array<{ provider: CloudProviderUi; accountLabel: string | null; updatedAt: string }>;
  configured: { google: boolean; microsoft: boolean; dropbox: boolean };
  /** API origin from `BETTER_AUTH_URL` (no trailing slash). */
  oauthBase?: string;
  /** Exact redirect URIs to add in each provider’s OAuth app. */
  redirectUris?: { google: string; microsoft: string; dropbox: string };
};

export async function fetchCloudConnections(): Promise<CloudConnectionsResponse> {
  const res = await fetch(apiUrl("/api/v1/cloud/connections"), { credentials: "include" });
  if (!res.ok) throw new Error("Could not load cloud connections.");
  return res.json() as Promise<CloudConnectionsResponse>;
}

export function cloudAuthorizeUrl(provider: CloudProviderUi, returnTo: string): string {
  const q = new URLSearchParams();
  q.set("returnTo", returnTo);
  return apiUrl(`/api/v1/cloud/${provider}/authorize?${q.toString()}`);
}

export async function disconnectCloud(provider: CloudProviderUi): Promise<void> {
  const res = await fetch(apiUrl(`/api/v1/cloud/${provider}`), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Could not disconnect.");
}

export type CloudListItem = {
  id: string;
  name: string;
  kind: "folder" | "file";
  mimeType?: string;
  sizeBytes?: number;
};

export async function browseGoogleDrive(
  parentId: string,
): Promise<{ parentId: string; items: CloudListItem[] }> {
  const res = await fetch(apiUrl("/api/v1/cloud/google/browse"), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ parentId }),
  });
  const j = (await res.json()) as { error?: string; parentId?: string; items?: CloudListItem[] };
  if (!res.ok) throw new Error(j.error ?? "Could not browse Google Drive.");
  return { parentId: j.parentId ?? parentId, items: j.items ?? [] };
}

export async function browseOneDrive(
  parentId: string | null,
): Promise<{ parentId: string; items: CloudListItem[] }> {
  const res = await fetch(apiUrl("/api/v1/cloud/microsoft/browse"), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({
      parentId: parentId === "root" || parentId === null ? null : parentId,
    }),
  });
  const j = (await res.json()) as { error?: string; parentId?: string; items?: CloudListItem[] };
  if (!res.ok) throw new Error(j.error ?? "Could not browse OneDrive.");
  return { parentId: j.parentId ?? "root", items: j.items ?? [] };
}

export async function browseDropbox(
  path: string,
): Promise<{ path: string; items: CloudListItem[] }> {
  const res = await fetch(apiUrl("/api/v1/cloud/dropbox/browse"), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ path }),
  });
  const j = (await res.json()) as { error?: string; path?: string; items?: CloudListItem[] };
  if (!res.ok) throw new Error(j.error ?? "Could not browse Dropbox.");
  return { path: j.path ?? path, items: j.items ?? [] };
}

export async function importFromGoogleDrive(body: {
  workspaceId: string;
  projectId: string;
  folderId?: string;
  fileName: string;
  externalRef: string;
  mimeType?: string;
}): Promise<void> {
  const res = await fetch(apiUrl("/api/v1/cloud/google/import"), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const j = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(j.error ?? "Import failed.");
}

export async function importFromOneDrive(body: {
  workspaceId: string;
  projectId: string;
  folderId?: string;
  fileName: string;
  externalRef: string;
  mimeType?: string;
}): Promise<void> {
  const res = await fetch(apiUrl("/api/v1/cloud/microsoft/import"), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const j = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(j.error ?? "Import failed.");
}

export async function importFromDropbox(body: {
  workspaceId: string;
  projectId: string;
  folderId?: string;
  fileName: string;
  externalRef: string;
  mimeType?: string;
}): Promise<void> {
  const res = await fetch(apiUrl("/api/v1/cloud/dropbox/import"), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const j = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(j.error ?? "Import failed.");
}

/** Opens the provider’s web app (new tab). Does not import into PlanSync. */
export async function openGoogleDriveInCloud(fileId: string): Promise<string> {
  const res = await fetch(apiUrl("/api/v1/cloud/google/open-link"), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ fileId }),
  });
  const j = (await res.json()) as { error?: string; url?: string };
  if (!res.ok) throw new Error(j.error ?? "Could not open in Google Drive.");
  return j.url ?? "";
}

export async function openOneDriveInCloud(itemId: string): Promise<string> {
  const res = await fetch(apiUrl("/api/v1/cloud/microsoft/open-link"), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ itemId }),
  });
  const j = (await res.json()) as { error?: string; url?: string };
  if (!res.ok) throw new Error(j.error ?? "Could not open in OneDrive.");
  return j.url ?? "";
}

export async function openDropboxInCloud(pathLower: string): Promise<string> {
  const res = await fetch(apiUrl("/api/v1/cloud/dropbox/open-link"), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ path: pathLower }),
  });
  const j = (await res.json()) as { error?: string; url?: string };
  if (!res.ok) throw new Error(j.error ?? "Could not open in Dropbox.");
  return j.url ?? "";
}
