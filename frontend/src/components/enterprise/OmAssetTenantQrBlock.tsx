"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Printer, QrCode, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import {
  fetchOccupantTokens,
  postOmAssetOccupantScanSecret,
  ProRequiredError,
} from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";

type Props = {
  projectId: string;
  assetId: string;
  assetTag: string;
  assetName: string;
  enabled: boolean;
};

export function OmAssetTenantQrBlock({ projectId, assetId, assetTag, assetName, enabled }: Props) {
  const qc = useQueryClient();
  const { primary } = useEnterpriseWorkspace();
  const tenantPortalHref = primary
    ? `/workspaces/${primary.workspace.id}/projects/${projectId}/om/tenant-portal`
    : `/projects/${projectId}/om/tenant-portal`;

  const [portalToken, setPortalToken] = useState<string | null>(null);
  const [scanSecret, setScanSecret] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const lastSecretFetchKey = useRef("");

  const { data: tokens = [], isPending: tokensPending } = useQuery({
    queryKey: qk.occupantTokens(projectId),
    queryFn: () => fetchOccupantTokens(projectId),
    enabled: enabled && Boolean(projectId),
  });

  useEffect(() => {
    if (tokens.length === 0) {
      setPortalToken(null);
      return;
    }
    setPortalToken((prev) => {
      if (prev && tokens.some((t) => t.token === prev)) return prev;
      return tokens[0]!.token;
    });
  }, [tokens]);

  const {
    mutate: ensureScanSecret,
    isPending: ensureSecretPending,
    isError: ensureSecretError,
  } = useMutation({
    mutationFn: (rotate: boolean) => postOmAssetOccupantScanSecret(projectId, assetId, { rotate }),
    onSuccess: async (data, rotate) => {
      setScanSecret(data.occupantScanSecret);
      if (rotate) {
        toast.success("Equipment link regenerated. Old QR codes will no longer work.");
      }
      await qc.invalidateQueries({ queryKey: ["om", "assets", projectId] });
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? "Pro subscription required." : e.message);
    },
  });

  useEffect(() => {
    if (!enabled) {
      lastSecretFetchKey.current = "";
      setScanSecret(null);
      return;
    }
    if (!portalToken || tokens.length === 0) return;
    const key = `${assetId}:${portalToken}`;
    if (lastSecretFetchKey.current === key) return;
    lastSecretFetchKey.current = key;
    ensureScanSecret(false);
  }, [enabled, portalToken, assetId, tokens.length, ensureScanSecret]);

  const fullUrl = useMemo(() => {
    if (typeof window === "undefined" || !portalToken || !scanSecret) return "";
    const u = new URL(`${window.location.origin}/occupant/${portalToken}`);
    u.searchParams.set("a", scanSecret);
    return u.toString();
  }, [portalToken, scanSecret]);

  useEffect(() => {
    if (!fullUrl) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(fullUrl, { margin: 2, width: 200 }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [fullUrl]);

  function printLabel() {
    if (!qrDataUrl) return;
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Allow pop-ups to print the label.");
      return;
    }
    const title = `${assetTag} — ${assetName}`;
    w.document
      .write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;text-align:center;padding:32px;max-width:400px;margin:0 auto">
<p style="font-size:14px;font-weight:600;margin:0 0 8px">${title}</p>
<p style="font-size:12px;color:#444;margin:0 0 16px">Scan to report an issue for this equipment.</p>
<img src="${qrDataUrl}" width="220" height="220" alt="QR code" style="display:block;margin:0 auto" />
<p style="font-size:10px;color:#666;word-break:break-all;margin-top:16px">${fullUrl}</p>
</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  if (!enabled) return null;

  return (
    <section className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] p-3">
      <h3 className="mb-2 flex items-center gap-2 border-b border-[var(--enterprise-border)] pb-1 text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
        <QrCode className="h-3.5 w-3.5 text-[var(--enterprise-primary)]" strokeWidth={2} />
        Occupant QR (building link + asset)
      </h3>
      {tokensPending ? (
        <p className="text-[13px] text-[var(--enterprise-text-muted)]">Loading portal links…</p>
      ) : tokens.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-[var(--enterprise-text-muted)]">
          Add a <strong className="font-medium text-[var(--enterprise-text)]">building link</strong>{" "}
          once on the{" "}
          <Link
            href={tenantPortalHref}
            className="font-semibold text-[var(--enterprise-primary)] hover:underline"
          >
            Occupant hub
          </Link>{" "}
          page. Each asset has a fixed equipment id; combined with your chosen building link it
          forms the full occupant URL below — that is how the report is bound to this device (not a
          random link).
        </p>
      ) : (
        <div className="space-y-3">
          <label className="block text-[13px]">
            <span className="mb-1 block font-medium text-[var(--enterprise-text)]">
              Building link to embed (binds this asset when QR is generated)
            </span>
            <p className="mb-2 text-[11px] leading-snug text-[var(--enterprise-text-muted)]">
              Same link as on the Occupant hub; QR uses this plus{" "}
              <code className="rounded bg-[var(--enterprise-bg)] px-0.5">?a=</code> for this
              equipment only.
            </p>
            <select
              value={portalToken ?? ""}
              onChange={(e) => setPortalToken(e.target.value)}
              className="min-h-10 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 text-sm text-[var(--enterprise-text)]"
            >
              {tokens.map((t) => (
                <option key={t.id} value={t.token}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          {ensureSecretPending && !scanSecret ? (
            <p className="text-[13px] text-[var(--enterprise-text-muted)]">Preparing QR code…</p>
          ) : ensureSecretError ? (
            <p className="text-[13px] text-red-600">Could not load equipment link.</p>
          ) : qrDataUrl ? (
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL from qrcode */}
              <img
                src={qrDataUrl}
                alt=""
                className="h-[200px] w-[200px] rounded-lg border border-[var(--enterprise-border)] bg-white p-2"
              />
              <div className="flex w-full flex-col gap-2 sm:flex-1">
                <p className="text-[11px] font-medium text-[var(--enterprise-text)]">
                  Full occupant URL (building + this asset)
                </p>
                <p className="break-all font-mono text-[11px] text-[var(--enterprise-text-muted)]">
                  {fullUrl}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(fullUrl);
                        toast.success("Full equipment URL copied.");
                      } catch {
                        toast.error("Could not copy.");
                      }
                    }}
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] px-3 text-xs font-semibold text-[var(--enterprise-text)]"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy full URL
                  </button>
                  <button
                    type="button"
                    onClick={printLabel}
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] px-3 text-xs font-semibold text-[var(--enterprise-text)]"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Print label
                  </button>
                  <button
                    type="button"
                    onClick={() => ensureScanSecret(true)}
                    disabled={ensureSecretPending}
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-amber-200 px-3 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-900/50 dark:text-amber-200 dark:hover:bg-amber-950/40"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Regenerate secret
                  </button>
                </div>
                <p className="text-[11px] text-[var(--enterprise-text-muted)]">
                  Regenerating invalidates printed QR codes for this asset.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
