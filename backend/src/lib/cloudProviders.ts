import type { Env } from "./env.js";

export function oauthRedirectBase(env: Env): string {
  return env.BETTER_AUTH_URL.replace(/\/$/, "");
}

export function googleDriveCallbackUrl(env: Env): string {
  return `${oauthRedirectBase(env)}/api/v1/cloud/google/callback`;
}

export function oneDriveCallbackUrl(env: Env): string {
  return `${oauthRedirectBase(env)}/api/v1/cloud/microsoft/callback`;
}

export function dropboxCallbackUrl(env: Env): string {
  return `${oauthRedirectBase(env)}/api/v1/cloud/dropbox/callback`;
}

export type CloudListItem = {
  id: string;
  name: string;
  kind: "folder" | "file";
  mimeType?: string;
  sizeBytes?: number;
};

// --- Google Drive ---

export function buildGoogleAuthorizeUrl(env: Env, state: string): string | null {
  const id = env.GOOGLE_CLIENT_ID?.trim();
  if (!id) return null;
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", id);
  u.searchParams.set("redirect_uri", googleDriveCallbackUrl(env));
  u.searchParams.set("response_type", "code");
  u.searchParams.set(
    "scope",
    ["https://www.googleapis.com/auth/drive.readonly", "openid", "email", "profile"].join(" "),
  );
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("state", state);
  return u.toString();
}

export async function exchangeGoogleCode(
  env: Env,
  code: string,
): Promise<
  | {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
    }
  | { error: string }
> {
  const id = env.GOOGLE_CLIENT_ID?.trim();
  const secret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (!id || !secret) return { error: "Google OAuth is not configured" };
  const body = new URLSearchParams({
    code,
    client_id: id,
    client_secret: secret,
    redirect_uri: googleDriveCallbackUrl(env),
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    return {
      error:
        typeof j.error_description === "string" ? j.error_description : "Token exchange failed",
    };
  }
  if (typeof j.access_token !== "string") return { error: "Invalid token response" };
  return {
    access_token: j.access_token,
    refresh_token: typeof j.refresh_token === "string" ? j.refresh_token : undefined,
    expires_in: typeof j.expires_in === "number" ? j.expires_in : 3600,
    scope: typeof j.scope === "string" ? j.scope : undefined,
  };
}

export async function refreshGoogleAccessToken(
  env: Env,
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number } | { error: string }> {
  const id = env.GOOGLE_CLIENT_ID?.trim();
  const secret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (!id || !secret) return { error: "Google OAuth is not configured" };
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: id,
    client_secret: secret,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j = (await res.json()) as Record<string, unknown>;
  if (!res.ok || typeof j.access_token !== "string") {
    return { error: "Could not refresh Google token" };
  }
  return {
    access_token: j.access_token,
    expires_in: typeof j.expires_in === "number" ? j.expires_in : 3600,
  };
}

const GOOGLE_FOLDER = "application/vnd.google-apps.folder";

/** Synthetic folder id so we can open a shared drive root (`GET /drives` + `files.list` with driveId). */
export const GOOGLE_SHARED_DRIVE_PREFIX = "sharedDrive:";

function sortDriveItems(items: CloudListItem[]): CloudListItem[] {
  return [...items].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

function mapDriveFilesToItems(
  files: Array<{ id?: string; name?: string; mimeType?: string; size?: string }>,
): CloudListItem[] {
  const out: CloudListItem[] = [];
  for (const f of files) {
    if (!f.id || !f.name) continue;
    const isFolder = f.mimeType === GOOGLE_FOLDER;
    out.push({
      id: f.id,
      name: f.name,
      kind: isFolder ? "folder" : "file",
      mimeType: f.mimeType,
      sizeBytes: f.size ? Number(f.size) : undefined,
    });
  }
  return out;
}

/** List children of a folder (or virtual `root` inside a shared drive). */
async function listGoogleDriveFilesInParent(
  accessToken: string,
  parentInQuery: string,
  opts: {
    corpora: "user" | "drive";
    driveId?: string;
  },
): Promise<CloudListItem[] | { error: string }> {
  const q = `'${parentInQuery}' in parents and trashed=false`;
  const u = new URL("https://www.googleapis.com/drive/v3/files");
  u.searchParams.set("q", q);
  u.searchParams.set("fields", "files(id,name,mimeType,size)");
  u.searchParams.set("pageSize", "200");
  if (opts.corpora === "drive" && opts.driveId) {
    u.searchParams.set("corpora", "drive");
    u.searchParams.set("driveId", opts.driveId);
    u.searchParams.set("supportsAllDrives", "true");
    u.searchParams.set("includeItemsFromAllDrives", "true");
  } else {
    /**
     * My Drive root / default user corpus: only `q` + pagination + `fields`.
     * Do not set `corpora`, `includeItemsFromAllDrives`, or `supportsAllDrives` — combinations
     * of those with `corpora=user` return 400 from Google for some accounts.
     */
  }
  const res = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const j = (await res.json()) as {
    error?: { message?: string; errors?: unknown[] };
    files?: Array<{ id?: string; name?: string; mimeType?: string; size?: string }>;
  };
  if (!res.ok) {
    const hint = j.error?.message ? `: ${j.error.message}` : "";
    return { error: `Could not list Google Drive folder${hint}` };
  }
  return sortDriveItems(mapDriveFilesToItems(j.files ?? []));
}

/** List children when `parentId` is a normal folder/file parent (My Drive or inside a shared drive). */
async function listGoogleDriveByParentId(
  accessToken: string,
  parentId: string,
): Promise<CloudListItem[] | { error: string }> {
  const q = `'${parentId}' in parents and trashed=false`;
  const u = new URL("https://www.googleapis.com/drive/v3/files");
  u.searchParams.set("q", q);
  u.searchParams.set("fields", "files(id,name,mimeType,size)");
  u.searchParams.set("pageSize", "200");
  u.searchParams.set("corpora", "allDrives");
  u.searchParams.set("supportsAllDrives", "true");
  u.searchParams.set("includeItemsFromAllDrives", "true");
  const res = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const j = (await res.json()) as {
    error?: { message?: string };
    files?: Array<{ id?: string; name?: string; mimeType?: string; size?: string }>;
  };
  if (!res.ok) {
    const hint = j.error?.message ? `: ${j.error.message}` : "";
    return { error: `Could not list Google Drive folder${hint}` };
  }
  return sortDriveItems(mapDriveFilesToItems(j.files ?? []));
}

async function listSharedDriveEntries(
  accessToken: string,
): Promise<CloudListItem[] | { error: string }> {
  const u = new URL("https://www.googleapis.com/drive/v3/drives");
  u.searchParams.set("pageSize", "100");
  u.searchParams.set("fields", "drives(id,name)");
  const res = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const j = (await res.json()) as { drives?: Array<{ id?: string; name?: string }> };
  if (!res.ok) {
    const err = j as { error?: { message?: string } };
    const hint = err.error?.message ? `: ${err.error.message}` : "";
    return { error: `Could not list shared drives${hint}` };
  }
  const out: CloudListItem[] = [];
  for (const d of j.drives ?? []) {
    if (!d.id || !d.name) continue;
    out.push({
      id: `${GOOGLE_SHARED_DRIVE_PREFIX}${d.id}`,
      name: d.name,
      kind: "folder",
      mimeType: GOOGLE_FOLDER,
    });
  }
  return sortDriveItems(out);
}

export async function listGoogleDriveChildren(
  accessToken: string,
  parentId: string,
): Promise<CloudListItem[] | { error: string }> {
  if (parentId.startsWith(GOOGLE_SHARED_DRIVE_PREFIX)) {
    const driveId = parentId.slice(GOOGLE_SHARED_DRIVE_PREFIX.length);
    return listGoogleDriveFilesInParent(accessToken, "root", { corpora: "drive", driveId });
  }
  if (parentId === "root") {
    const myDrive = await listGoogleDriveFilesInParent(accessToken, "root", { corpora: "user" });
    if ("error" in myDrive) return myDrive;
    const shared = await listSharedDriveEntries(accessToken);
    /** If `drives.list` fails (scope/org policy), still show My Drive. */
    if ("error" in shared) {
      console.warn("[cloud] listSharedDriveEntries:", shared.error);
      return myDrive;
    }
    return sortDriveItems([...shared, ...myDrive]);
  }
  return listGoogleDriveByParentId(accessToken, parentId);
}

/** Open in browser: Google Drive web UI URL for a file or folder. */
export async function getGoogleDriveWebViewUrl(
  accessToken: string,
  fileId: string,
): Promise<{ url: string } | { error: string }> {
  if (fileId.startsWith(GOOGLE_SHARED_DRIVE_PREFIX)) {
    return { error: "Use a file or folder inside the drive, not the drive entry itself." };
  }
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=webViewLink&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const j = (await res.json()) as { webViewLink?: string; error?: { message?: string } };
  if (!res.ok) {
    const hint = j.error?.message ? `: ${j.error.message}` : "";
    return { error: `Could not get Google Drive link${hint}` };
  }
  if (typeof j.webViewLink === "string" && j.webViewLink.length > 0) {
    return { url: j.webViewLink };
  }
  return { url: `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view` };
}

export async function downloadGoogleDriveFile(
  accessToken: string,
  fileId: string,
): Promise<Buffer | { error: string }> {
  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=mimeType,name`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const meta = (await metaRes.json()) as { mimeType?: string; name?: string };
  if (!metaRes.ok) return { error: "Could not read file metadata" };
  if (meta.mimeType === GOOGLE_FOLDER) return { error: "Not a file" };
  if (meta.mimeType?.startsWith("application/vnd.google-apps.")) {
    return {
      error: "Google Docs/Sheets cannot be imported — export as PDF from Drive, then upload.",
    };
  }
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return { error: "Could not download file from Google Drive" };
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

// --- Microsoft OneDrive (Graph) ---

export function buildMicrosoftAuthorizeUrl(env: Env, state: string): string | null {
  const id = env.MICROSOFT_CLIENT_ID?.trim();
  if (!id) return null;
  const u = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  u.searchParams.set("client_id", id);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", oneDriveCallbackUrl(env));
  u.searchParams.set("scope", ["offline_access", "Files.Read", "User.Read"].join(" "));
  u.searchParams.set("state", state);
  return u.toString();
}

export async function exchangeMicrosoftCode(
  env: Env,
  code: string,
): Promise<
  | {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
    }
  | { error: string }
> {
  const id = env.MICROSOFT_CLIENT_ID?.trim();
  const secret = env.MICROSOFT_CLIENT_SECRET?.trim();
  if (!id || !secret) return { error: "Microsoft OAuth is not configured" };
  const body = new URLSearchParams({
    client_id: id,
    client_secret: secret,
    code,
    redirect_uri: oneDriveCallbackUrl(env),
    grant_type: "authorization_code",
  });
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    return {
      error:
        typeof j.error_description === "string" ? j.error_description : "Token exchange failed",
    };
  }
  if (typeof j.access_token !== "string") return { error: "Invalid token response" };
  return {
    access_token: j.access_token,
    refresh_token: typeof j.refresh_token === "string" ? j.refresh_token : undefined,
    expires_in: typeof j.expires_in === "number" ? j.expires_in : 3600,
    scope: typeof j.scope === "string" ? j.scope : undefined,
  };
}

export async function refreshMicrosoftAccessToken(
  env: Env,
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number } | { error: string }> {
  const id = env.MICROSOFT_CLIENT_ID?.trim();
  const secret = env.MICROSOFT_CLIENT_SECRET?.trim();
  if (!id || !secret) return { error: "Microsoft OAuth is not configured" };
  const body = new URLSearchParams({
    client_id: id,
    client_secret: secret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: ["offline_access", "Files.Read", "User.Read"].join(" "),
  });
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j = (await res.json()) as Record<string, unknown>;
  if (!res.ok || typeof j.access_token !== "string") {
    return { error: "Could not refresh Microsoft token" };
  }
  return {
    access_token: j.access_token,
    expires_in: typeof j.expires_in === "number" ? j.expires_in : 3600,
  };
}

export async function listMicrosoftDriveChildren(
  accessToken: string,
  parentId: string | null,
): Promise<CloudListItem[] | { error: string }> {
  const path =
    parentId == null || parentId === "root"
      ? "https://graph.microsoft.com/v1.0/me/drive/root/children"
      : `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(parentId)}/children`;
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const j = (await res.json()) as {
    value?: Array<{
      id?: string;
      name?: string;
      folder?: Record<string, unknown>;
      file?: Record<string, unknown>;
      size?: number;
    }>;
  };
  if (!res.ok) return { error: "Could not list OneDrive folder" };
  const values = j.value ?? [];
  const out: CloudListItem[] = [];
  for (const v of values) {
    if (!v.id || !v.name) continue;
    const isFolder = Boolean(v.folder);
    out.push({
      id: v.id,
      name: v.name,
      kind: isFolder ? "folder" : "file",
      mimeType: isFolder ? "inode/directory" : "application/octet-stream",
      sizeBytes: typeof v.size === "number" ? v.size : undefined,
    });
  }
  out.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
  return out;
}

export async function downloadMicrosoftDriveFile(
  accessToken: string,
  itemId: string,
): Promise<Buffer | { error: string }> {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(itemId)}/content`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return { error: "Could not download file from OneDrive" };
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

/** Open in browser: OneDrive / SharePoint web URL for an item. */
export async function getMicrosoftDriveWebUrl(
  accessToken: string,
  itemId: string,
): Promise<{ url: string } | { error: string }> {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(itemId)}?$select=webUrl`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const j = (await res.json()) as { webUrl?: string; error?: { message?: string } };
  if (!res.ok) {
    const hint = j.error?.message ? `: ${j.error.message}` : "";
    return { error: `Could not get OneDrive link${hint}` };
  }
  if (typeof j.webUrl === "string" && j.webUrl.length > 0) {
    return { url: j.webUrl };
  }
  return { error: "No web URL for this item." };
}

// --- Dropbox ---

export function buildDropboxAuthorizeUrl(env: Env, state: string): string | null {
  const id = env.DROPBOX_APP_KEY?.trim();
  if (!id) return null;
  const u = new URL("https://www.dropbox.com/oauth2/authorize");
  u.searchParams.set("client_id", id);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("token_access_type", "offline");
  u.searchParams.set("redirect_uri", dropboxCallbackUrl(env));
  u.searchParams.set("state", state);
  return u.toString();
}

export async function exchangeDropboxCode(
  env: Env,
  code: string,
): Promise<
  | {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    }
  | { error: string }
> {
  const id = env.DROPBOX_APP_KEY?.trim();
  const secret = env.DROPBOX_APP_SECRET?.trim();
  if (!id || !secret) return { error: "Dropbox OAuth is not configured" };
  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    client_id: id,
    client_secret: secret,
    redirect_uri: dropboxCallbackUrl(env),
  });
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    return { error: typeof j.error === "string" ? j.error : "Token exchange failed" };
  }
  if (typeof j.access_token !== "string") return { error: "Invalid token response" };
  return {
    access_token: j.access_token,
    refresh_token: typeof j.refresh_token === "string" ? j.refresh_token : undefined,
    expires_in: typeof j.expires_in === "number" ? j.expires_in : 14_400,
  };
}

export async function refreshDropboxAccessToken(
  env: Env,
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number } | { error: string }> {
  const id = env.DROPBOX_APP_KEY?.trim();
  const secret = env.DROPBOX_APP_SECRET?.trim();
  if (!id || !secret) return { error: "Dropbox OAuth is not configured" };
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: id,
    client_secret: secret,
  });
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j = (await res.json()) as Record<string, unknown>;
  if (!res.ok || typeof j.access_token !== "string") {
    return { error: "Could not refresh Dropbox token" };
  }
  return {
    access_token: j.access_token,
    expires_in: typeof j.expires_in === "number" ? j.expires_in : 14_400,
  };
}

type DropboxEntry = {
  ".tag"?: string;
  name?: string;
  path_lower?: string;
  size?: number;
};

export async function listDropboxFolder(
  accessToken: string,
  path: string,
): Promise<CloudListItem[] | { error: string }> {
  const res = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: path === "" ? "" : path, limit: 200 }),
  });
  const j = (await res.json()) as { entries?: DropboxEntry[]; error?: { error_summary?: string } };
  if (!res.ok) {
    return { error: j.error?.error_summary ?? "Could not list Dropbox folder" };
  }
  const entries = j.entries ?? [];
  const out: CloudListItem[] = [];
  for (const e of entries) {
    const tag = e[".tag"];
    const name = e.name;
    const pl = e.path_lower;
    if (!name || !pl) continue;
    if (tag === "folder") {
      out.push({ id: pl, name, kind: "folder", mimeType: "inode/directory" });
    } else if (tag === "file") {
      out.push({
        id: pl,
        name,
        kind: "file",
        sizeBytes: typeof e.size === "number" ? e.size : undefined,
      });
    }
  }
  out.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
  return out;
}

export async function downloadDropboxFile(
  accessToken: string,
  pathLower: string,
): Promise<Buffer | { error: string }> {
  const res = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Dropbox-API-Arg": JSON.stringify({ path: pathLower }),
    },
  });
  if (!res.ok) return { error: "Could not download file from Dropbox" };
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

/**
 * Prefer an existing Dropbox shared link; otherwise a short-lived direct link (no sharing change).
 */
export async function getDropboxOpenUrl(
  accessToken: string,
  pathLower: string,
): Promise<{ url: string } | { error: string }> {
  const listRes = await fetch("https://api.dropboxapi.com/2/sharing/list_shared_links", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: pathLower, direct_only: false }),
  });
  const listJ = (await listRes.json()) as {
    links?: Array<{ url?: string }>;
    error?: { error_summary?: string };
  };
  if (listRes.ok) {
    const first = listJ.links?.find((l) => typeof l.url === "string" && l.url.length > 0);
    if (first?.url) return { url: first.url };
  }
  const tmpRes = await fetch("https://api.dropboxapi.com/2/files/get_temporary_link", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: pathLower }),
  });
  const tmpJ = (await tmpRes.json()) as { link?: string; error?: { error_summary?: string } };
  if (!tmpRes.ok) {
    return { error: tmpJ.error?.error_summary ?? "Could not open file from Dropbox" };
  }
  if (typeof tmpJ.link === "string" && tmpJ.link.length > 0) {
    return { url: tmpJ.link };
  }
  return { error: "Could not open file from Dropbox" };
}

export async function fetchGoogleAccountLabel(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { email?: string };
  return j.email?.trim() ?? null;
}

export async function fetchMicrosoftAccountLabel(accessToken: string): Promise<string | null> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { mail?: string; userPrincipalName?: string };
  return (j.mail ?? j.userPrincipalName)?.trim() ?? null;
}

export async function fetchDropboxAccountLabel(accessToken: string): Promise<string | null> {
  const res = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(null),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { email?: string; name?: { display_name?: string } };
  if (j.email) return j.email;
  return j.name?.display_name?.trim() ?? null;
}
