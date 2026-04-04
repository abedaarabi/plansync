"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ExternalLink, Folder, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { EnterpriseSlideOver } from "./EnterpriseSlideOver";
import { CloudProviderBrandIcon } from "./CloudProviderIcons";
import {
  browseDropbox,
  browseGoogleDrive,
  browseOneDrive,
  cloudAuthorizeUrl,
  disconnectCloud,
  fetchCloudConnections,
  importFromDropbox,
  importFromGoogleDrive,
  importFromOneDrive,
  openDropboxInCloud,
  openGoogleDriveInCloud,
  openOneDriveInCloud,
  type CloudConnectionsResponse,
  type CloudListItem,
  type CloudProviderUi,
} from "@/lib/cloudImportApi";

function isImportableFile(item: CloudListItem): boolean {
  if (item.kind !== "file") return false;
  const mt = (item.mimeType ?? "").toLowerCase();
  if (mt === "application/pdf" || mt.includes("pdf")) return true;
  if (mt.startsWith("image/")) return true;
  const ext = item.name.toLowerCase().match(/\.([^.]+)$/)?.[1] ?? "";
  return ["pdf", "png", "jpg", "jpeg", "webp", "gif", "tif", "tiff"].includes(ext);
}

type GoogleFrame = { parentId: string; label: string };
type MicrosoftFrame = { parentId: string | null; label: string };
type DropboxFrame = { path: string; label: string };

export type CloudImportModalProps = {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  projectId: string;
  folderId: string | null;
  /** Path + query for OAuth return (e.g. `/dashboard/projects/x/files?folder=y`). */
  oauthReturnPath: string;
  onImported: () => void;
};

export function CloudImportModal({
  open,
  onClose,
  workspaceId,
  projectId,
  folderId,
  oauthReturnPath,
  onImported,
}: CloudImportModalProps) {
  const [provider, setProvider] = useState<CloudProviderUi>("google");
  const [loadingConn, setLoadingConn] = useState(false);
  const [configured, setConfigured] = useState({
    google: false,
    microsoft: false,
    dropbox: false,
  });
  /** Rows from GET /cloud/connections — presence means OAuth completed for that provider. */
  const [connectionRows, setConnectionRows] = useState<
    Array<{ provider: CloudProviderUi; accountLabel: string | null }>
  >([]);
  const [redirectUris, setRedirectUris] = useState<
    CloudConnectionsResponse["redirectUris"] | undefined
  >();

  const [googleStack, setGoogleStack] = useState<GoogleFrame[]>([
    { parentId: "root", label: "My Drive" },
  ]);
  const [msStack, setMsStack] = useState<MicrosoftFrame[]>([{ parentId: null, label: "OneDrive" }]);
  const [dbStack, setDbStack] = useState<DropboxFrame[]>([{ path: "", label: "Dropbox" }]);

  const [items, setItems] = useState<CloudListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [importing, setImporting] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const refreshConnections = useCallback(async () => {
    setLoadingConn(true);
    try {
      const data = await fetchCloudConnections();
      setConfigured(data.configured);
      setConnectionRows(data.connections);
      setRedirectUris(data.redirectUris);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load connections.");
    } finally {
      setLoadingConn(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refreshConnections();
  }, [open, refreshConnections]);

  useEffect(() => {
    if (!open) return;
    setGoogleStack([{ parentId: "root", label: "My Drive" }]);
    setMsStack([{ parentId: null, label: "OneDrive" }]);
    setDbStack([{ path: "", label: "Dropbox" }]);
    setSelected(new Set());
    setItems([]);
  }, [open, provider]);

  const googleTop = googleStack[googleStack.length - 1]!;
  const msTop = msStack[msStack.length - 1]!;
  const dbTop = dbStack[dbStack.length - 1]!;

  const rowForProvider = connectionRows.find((r) => r.provider === provider);
  const isConnected = Boolean(rowForProvider);
  const isConfigured = configured[provider];

  const loadList = useCallback(async () => {
    setListLoading(true);
    setSelected(new Set());
    try {
      if (provider === "google") {
        const r = await browseGoogleDrive(googleTop.parentId);
        setItems(r.items);
      } else if (provider === "microsoft") {
        const r = await browseOneDrive(msTop.parentId);
        setItems(r.items);
      } else {
        const r = await browseDropbox(dbTop.path);
        setItems(r.items);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not list files.");
      setItems([]);
    } finally {
      setListLoading(false);
    }
  }, [provider, googleTop.parentId, msTop.parentId, dbTop.path]);

  useEffect(() => {
    if (!open || !isConfigured || !isConnected) return;
    void loadList();
  }, [open, provider, isConfigured, isConnected, loadList]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const enterFolder = (item: CloudListItem) => {
    if (item.kind !== "folder") return;
    if (provider === "google") {
      setGoogleStack((s) => [...s, { parentId: item.id, label: item.name }]);
    } else if (provider === "microsoft") {
      setMsStack((s) => [...s, { parentId: item.id, label: item.name }]);
    } else {
      setDbStack((s) => [...s, { path: item.id, label: item.name }]);
    }
  };

  const goBack = () => {
    if (provider === "google" && googleStack.length > 1) {
      setGoogleStack((s) => s.slice(0, -1));
    } else if (provider === "microsoft" && msStack.length > 1) {
      setMsStack((s) => s.slice(0, -1));
    } else if (provider === "dropbox" && dbStack.length > 1) {
      setDbStack((s) => s.slice(0, -1));
    }
  };

  const breadcrumb = useMemo(() => {
    if (provider === "google") return googleStack.map((f) => f.label).join(" / ");
    if (provider === "microsoft") return msStack.map((f) => f.label).join(" / ");
    return dbStack.map((f) => f.label).join(" / ");
  }, [provider, googleStack, msStack, dbStack]);

  const canGoBack =
    (provider === "google" && googleStack.length > 1) ||
    (provider === "microsoft" && msStack.length > 1) ||
    (provider === "dropbox" && dbStack.length > 1);

  async function openInProvider(item: CloudListItem) {
    setOpeningId(item.id);
    try {
      let url: string;
      if (provider === "google") {
        url = await openGoogleDriveInCloud(item.id);
      } else if (provider === "microsoft") {
        url = await openOneDriveInCloud(item.id);
      } else {
        url = await openDropboxInCloud(item.id);
      }
      if (!url) throw new Error("No link returned.");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open in cloud.");
    } finally {
      setOpeningId(null);
    }
  }

  async function runImport() {
    const toImport = items.filter(
      (i) => i.kind === "file" && selected.has(i.id) && isImportableFile(i),
    );
    if (toImport.length === 0) {
      toast.error("Select one or more PDF or image files.");
      return;
    }
    setImporting(true);
    let ok = 0;
    try {
      for (const file of toImport) {
        const mime = file.mimeType;
        const body = {
          workspaceId,
          projectId,
          folderId: folderId ?? undefined,
          fileName: file.name,
          externalRef: file.id,
          mimeType: mime,
        };
        if (provider === "google") await importFromGoogleDrive(body);
        else if (provider === "microsoft") await importFromOneDrive(body);
        else await importFromDropbox(body);
        ok += 1;
      }
      toast.success(ok === 1 ? `Imported “${toImport[0]!.name}”.` : `Imported ${ok} files.`);
      onImported();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  function connect() {
    window.location.href = cloudAuthorizeUrl(provider, oauthReturnPath);
  }

  async function disconnect() {
    try {
      await disconnectCloud(provider);
      toast.success("Disconnected.");
      await refreshConnections();
      setItems([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not disconnect.");
    }
  }

  const tab = (p: CloudProviderUi, label: string) => (
    <button
      key={p}
      type="button"
      onClick={() => setProvider(p)}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        provider === p
          ? "bg-[var(--enterprise-primary)] text-white"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      <span
        className={
          provider === p
            ? "rounded-md bg-white/15 p-0.5 ring-1 ring-white/25"
            : "rounded-md bg-white p-0.5 shadow-sm ring-1 ring-slate-200/80"
        }
      >
        <CloudProviderBrandIcon provider={p} className="h-4 w-4" />
      </span>
      {label}
    </button>
  );

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={onClose}
      ariaLabelledBy="cloud-import-title"
      panelMaxWidthClass="max-w-[640px]"
      bodyClassName="px-5 py-4"
      header={
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 p-1.5 ring-1 ring-slate-200/80">
            <CloudProviderBrandIcon provider={provider} className="h-7 w-7" />
          </div>
          <div>
            <h2
              id="cloud-import-title"
              className="text-lg font-semibold text-[var(--enterprise-text)]"
            >
              Import from cloud
            </h2>
            <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
              Connect Google Drive, OneDrive, or Dropbox, then choose PDFs or images to copy into
              this project — or open a file in the provider’s site without importing.
            </p>
          </div>
        </div>
      }
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[var(--enterprise-text-muted)]">
            Files are copied into PlanSync storage (same as upload).
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!isConnected || !isConfigured || importing || selected.size === 0}
              onClick={() => void runImport()}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--enterprise-primary)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Importing…
                </>
              ) : (
                "Import selected"
              )}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {tab("google", "Google Drive")}
          {tab("microsoft", "OneDrive")}
          {tab("dropbox", "Dropbox")}
        </div>

        {loadingConn ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : null}

        {!isConfigured ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-medium">Server env is missing OAuth credentials</p>
            <p className="mt-2 leading-relaxed">
              Add these to the <strong>repo root</strong>{" "}
              <code className="rounded bg-amber-100/90 px-1">.env</code> or{" "}
              <code className="rounded bg-amber-100/90 px-1">.env.local</code> (the API loads them
              on startup), then <strong>restart the backend</strong>.
            </p>
            {provider === "google" ? (
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>
                  <code className="rounded bg-amber-100/90 px-1">GOOGLE_CLIENT_ID</code> and{" "}
                  <code className="rounded bg-amber-100/90 px-1">GOOGLE_CLIENT_SECRET</code> (same
                  app as Google sign-in if you use it).
                </li>
                <li>
                  In Google Cloud Console → OAuth client → Authorized redirect URIs, add:
                  {redirectUris?.google ? (
                    <code className="mt-1 block w-full overflow-x-auto rounded border border-amber-200/80 bg-white px-2 py-1.5 text-xs text-slate-800">
                      {redirectUris.google}
                    </code>
                  ) : null}
                </li>
                <li>Enable the Google Drive API for that Google Cloud project.</li>
              </ul>
            ) : provider === "microsoft" ? (
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>
                  <code className="rounded bg-amber-100/90 px-1">MICROSOFT_CLIENT_ID</code> and{" "}
                  <code className="rounded bg-amber-100/90 px-1">MICROSOFT_CLIENT_SECRET</code>
                </li>
                <li>
                  Azure app registration → Authentication → redirect URI:
                  {redirectUris?.microsoft ? (
                    <code className="mt-1 block w-full overflow-x-auto rounded border border-amber-200/80 bg-white px-2 py-1.5 text-xs text-slate-800">
                      {redirectUris.microsoft}
                    </code>
                  ) : null}
                </li>
              </ul>
            ) : (
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>
                  <code className="rounded bg-amber-100/90 px-1">DROPBOX_APP_KEY</code> and{" "}
                  <code className="rounded bg-amber-100/90 px-1">DROPBOX_APP_SECRET</code>
                </li>
                <li>
                  Dropbox app console → redirect URI:
                  {redirectUris?.dropbox ? (
                    <code className="mt-1 block w-full overflow-x-auto rounded border border-amber-200/80 bg-white px-2 py-1.5 text-xs text-slate-800">
                      {redirectUris.dropbox}
                    </code>
                  ) : null}
                </li>
              </ul>
            )}
            <p className="mt-2 text-xs text-amber-900/85">
              <code className="rounded bg-amber-100/90 px-1">BETTER_AUTH_URL</code> must match the
              API origin used above (default{" "}
              <code className="rounded bg-amber-100/90 px-1">http://localhost:8787</code>). See{" "}
              <code className="rounded bg-amber-100/90 px-1">.env.example</code>.
            </p>
          </div>
        ) : null}

        {isConfigured && !isConnected ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p className="font-medium">Not connected</p>
            <p className="mt-1 text-slate-600">
              Sign in to{" "}
              {provider === "google"
                ? "Google"
                : provider === "microsoft"
                  ? "Microsoft"
                  : "Dropbox"}{" "}
              to browse files.
            </p>
            <button
              type="button"
              onClick={connect}
              className="mt-3 rounded-lg bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-semibold text-white"
            >
              Connect
            </button>
          </div>
        ) : null}

        {isConfigured && isConnected ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span className="truncate" title={breadcrumb}>
                {rowForProvider?.accountLabel ? (
                  <span>
                    Signed in as{" "}
                    <strong className="text-slate-800">{rowForProvider.accountLabel}</strong>
                  </span>
                ) : (
                  "Connected"
                )}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void disconnect()}
                  className="text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
                >
                  Disconnect
                </button>
                <button
                  type="button"
                  onClick={() => void loadList()}
                  className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Refresh
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                disabled={!canGoBack}
                onClick={goBack}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Back
              </button>
              <span className="min-w-0 truncate text-sm text-slate-700">{breadcrumb}</span>
            </div>

            <div className="max-h-[min(52vh,420px)] overflow-auto rounded-xl border border-slate-200">
              {listLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-600">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  Loading folder…
                </div>
              ) : items.length === 0 ? (
                <div className="space-y-2 px-4 py-10 text-center text-sm text-slate-500">
                  <p>No files or folders here.</p>
                  {provider === "google" ? (
                    <p className="text-xs leading-relaxed text-slate-400">
                      Open a subfolder, or pick a{" "}
                      <strong className="font-medium text-slate-500">shared drive</strong> from the
                      top level if your team stores files there.
                    </p>
                  ) : null}
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <li
                      key={`${item.kind}:${item.id}`}
                      className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50/80"
                    >
                      {item.kind === "folder" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => enterFolder(item)}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium text-slate-800"
                          >
                            <Folder className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                            <span className="truncate">{item.name}</span>
                          </button>
                          {provider !== "dropbox" ? (
                            <button
                              type="button"
                              disabled={openingId !== null}
                              title="Open folder in browser"
                              onClick={() => void openInProvider(item)}
                              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                            >
                              {openingId === item.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                              ) : (
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                              )}
                              Open
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selected.has(item.id)}
                              disabled={!isImportableFile(item)}
                              onChange={() => toggleSelect(item.id)}
                              className="rounded border-slate-300"
                            />
                            <span
                              className={`truncate ${isImportableFile(item) ? "text-slate-800" : "text-slate-400"}`}
                            >
                              {item.name}
                            </span>
                            {!isImportableFile(item) ? (
                              <span className="shrink-0 text-xs text-slate-400">Not supported</span>
                            ) : null}
                          </label>
                          <button
                            type="button"
                            disabled={openingId !== null}
                            title="Open in browser (does not import)"
                            onClick={() => void openInProvider(item)}
                            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                          >
                            {openingId === item.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                            )}
                            Open
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </EnterpriseSlideOver>
  );
}
