"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { deleteWorkspacePermanently, patchWorkspace, uploadWorkspaceLogo } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import type { MeResponse, MeWorkspace } from "@/types/enterprise";
import {
  isValidWorkspacePrimaryHex,
  normalizeWorkspacePrimaryHex,
  workspaceEnterpriseCssVars,
} from "@/lib/enterpriseTheme";
import {
  faviconUrlFromHostname,
  isGoogleFaviconUrl,
  isWorkspaceHostedLogoPath,
  normalizeWorkspaceWebsite,
} from "@/lib/workspaceBranding";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import {
  WorkspaceBillingCard,
  useStripeCheckoutReturnToast,
} from "@/components/enterprise/WorkspaceBillingCard";
import { WorkspaceTeamClient } from "@/components/enterprise/WorkspaceTeamClient";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";
import { isSuperAdmin, isWorkspaceManager } from "@/lib/workspaceRole";
import { trialDaysLeft } from "@/lib/workspaceSubscription";

type OrgTab = "organization" | "billing" | "people" | "invite-member";

export function OrganizationClient() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { primary, loading: ctxLoading } = useEnterpriseWorkspace();
  useStripeCheckoutReturnToast("/organization?tab=billing");
  const wid = primary?.workspace.id;
  const isManager = isWorkspaceManager(primary?.role);
  const superAdmin = isSuperAdmin(primary?.role);
  const ws = primary?.workspace;

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [websiteFieldError, setWebsiteFieldError] = useState<string | null>(null);
  const [websitePreviewHost, setWebsitePreviewHost] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("#2563EB");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [tab, setTabState] = useState<OrgTab>("organization");

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "billing") {
      if (superAdmin) setTabState("billing");
      else {
        setTabState("organization");
        router.replace("/organization?tab=organization", { scroll: false });
      }
    } else if (t === "invite-member" && isManager) setTabState("invite-member");
    else if (t === "people") setTabState("people");
    else if (t === "organization") setTabState("organization");
  }, [searchParams, isManager, superAdmin, router]);

  useEffect(() => {
    if (!isManager && tab === "invite-member") {
      setTabState("organization");
      router.replace("/organization?tab=organization", { scroll: false });
    }
  }, [isManager, tab, router]);

  function setTab(id: OrgTab) {
    setTabState(id);
    router.replace(`/organization?tab=${id}`, { scroll: false });
  }

  useEffect(() => {
    if (!ws) return;
    setName(ws.name);
    setSlug(ws.slug);
    const lu = ws.logoUrl ?? "";
    setLogoUrl(isWorkspaceHostedLogoPath(lu) ? "" : lu);
    setDescription(ws.description ?? "");
    setWebsite(ws.website ?? "");
    setPrimaryColor(ws.primaryColor ?? "#2563EB");
    setWebsiteFieldError(null);
    if (ws.website) {
      const n = normalizeWorkspaceWebsite(ws.website);
      setWebsitePreviewHost(n.ok ? n.hostname : null);
    } else {
      setWebsitePreviewHost(null);
    }
  }, [ws]);

  const saveMutation = useMutation({
    mutationFn: () =>
      patchWorkspace(wid!, {
        name: name.trim(),
        slug: slug.trim(),
        logoUrl: logoUrl.trim() || null,
        description: description.trim() || null,
        website: website.trim() || null,
        primaryColor: isValidWorkspacePrimaryHex(primaryColor) ? primaryColor.trim() : undefined,
      }),
    onMutate: async () => {
      const prev = queryClient.getQueryData<MeResponse | null>(qk.me());
      if (!prev || !wid) return {};
      const next: MeResponse = {
        ...prev,
        workspaces: prev.workspaces.map((mw) =>
          mw.workspace.id !== wid
            ? mw
            : {
                ...mw,
                workspace: {
                  ...mw.workspace,
                  name: name.trim(),
                  slug: slug.trim(),
                  logoUrl: logoUrl.trim() || null,
                  description: description.trim() || null,
                  website: website.trim() || null,
                  primaryColor: normalizeWorkspacePrimaryHex(primaryColor.trim() || undefined),
                },
              },
        ),
      };
      queryClient.setQueryData(qk.me(), next);
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(qk.me(), ctx.prev);
      setMsg({ type: "err", text: e.message });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.me() });
      setWebsiteFieldError(null);
      setMsg({ type: "ok", text: "Organization saved." });
    },
  });

  function onSaveOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!wid || !superAdmin) return;
    const w = website.trim();
    if (w) {
      const n = normalizeWorkspaceWebsite(w);
      if (!n.ok) {
        setWebsiteFieldError(n.message);
        setMsg({ type: "err", text: n.message });
        return;
      }
    }
    const pc = primaryColor.trim();
    if (pc && !isValidWorkspacePrimaryHex(pc)) {
      setMsg({
        type: "err",
        text: "Primary color must be a hex value like #2563EB (6 digits after #).",
      });
      return;
    }
    setMsg(null);
    saveMutation.mutate();
  }

  if (ctxLoading) {
    return (
      <EnterpriseLoadingState
        message="Loading organization…"
        label="Loading organization settings"
      />
    );
  }

  if (!primary || !ws) {
    return (
      <div className="enterprise-card p-8">
        <p className="text-sm text-[var(--enterprise-text-muted)]">
          You are not in a workspace yet. Create one from the API or ask an admin for an invite
          link.
        </p>
      </div>
    );
  }

  const roleLabel =
    primary.role === "SUPER_ADMIN" ? "Super Admin" : primary.role === "ADMIN" ? "Admin" : "Member";
  const trialDays =
    ws.subscriptionStatus === "trialing" ? trialDaysLeft(ws.currentPeriodEnd) : null;

  const tabBtn = (id: OrgTab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
        tab === id
          ? "border-[var(--enterprise-primary)] text-[var(--enterprise-text)]"
          : "border-transparent text-[var(--enterprise-text-muted)] hover:text-[var(--enterprise-text)]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-1 border-b border-[var(--enterprise-border)]">
        {tabBtn("organization", "Branding")}
        {superAdmin ? tabBtn("billing", "Plan & billing") : null}
        {tabBtn("people", "People")}
        {isManager ? tabBtn("invite-member", "Invite member") : null}
      </div>

      {tab === "organization" ? (
        <section className="enterprise-card p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--enterprise-text)]">Organization</h2>
              <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
                Name, logo, and details shown in the sidebar and on invite pages. Your role:{" "}
                <span className="font-medium text-[var(--enterprise-text)]">{roleLabel}</span>
              </p>
              <p className="mt-2 text-sm text-[var(--enterprise-text-muted)]">
                Plan:{" "}
                <span className="font-medium text-[var(--enterprise-text)]">
                  {ws.subscriptionStatus === "active"
                    ? "Pro active"
                    : ws.subscriptionStatus === "trialing"
                      ? trialDays === 0
                        ? "Trial ended"
                        : trialDays != null
                          ? `Pro trial (${trialDays} day${trialDays === 1 ? "" : "s"} left)`
                          : "Pro trial"
                      : "Free"}
                </span>
              </p>
            </div>
            {ws.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ws.logoUrl}
                alt=""
                className="h-14 w-14 rounded-lg border border-[var(--enterprise-border)] bg-white object-contain p-1.5 ring-1 ring-black/5"
              />
            ) : null}
          </div>

          {superAdmin ? (
            <form
              onSubmit={onSaveOrg}
              className="mt-8 space-y-4"
              style={workspaceEnterpriseCssVars(primaryColor)}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
                    Workspace name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
                    URL slug
                  </label>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-[var(--enterprise-border)] px-3 py-2 font-mono text-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mt-1.5 w-full resize-y rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
                  Primary color
                </label>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--enterprise-text-muted)]">
                  Buttons, links, and focus accents across the app. Pick a color or paste{" "}
                  <span className="font-mono">#RRGGBB</span>.
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-3">
                  <input
                    type="color"
                    value={
                      isValidWorkspacePrimaryHex(primaryColor)
                        ? primaryColor.trim()
                        : normalizeWorkspacePrimaryHex(undefined)
                    }
                    onChange={(e) => setPrimaryColor(e.target.value.toUpperCase())}
                    className="h-11 w-14 cursor-pointer rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-1 shadow-[var(--enterprise-shadow-xs)]"
                    aria-label="Choose primary brand color"
                  />
                  <input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    onBlur={() => {
                      const t = primaryColor.trim();
                      if (t === "") {
                        setPrimaryColor(normalizeWorkspacePrimaryHex(undefined));
                        return;
                      }
                      if (isValidWorkspacePrimaryHex(t)) {
                        setPrimaryColor(t.toUpperCase());
                      }
                    }}
                    placeholder="#2563EB"
                    spellCheck={false}
                    className="w-full min-w-[9rem] max-w-[11rem] rounded-lg border border-[var(--enterprise-border)] px-3 py-2 font-mono text-sm"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
                  Website
                </label>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--enterprise-text-muted)]">
                  We resolve your site&apos;s favicon (Google) as the logo when you don&apos;t
                  upload an image. The same branding appears on client proposal pages and emails.
                </p>
                <input
                  value={website}
                  onChange={(e) => {
                    setWebsite(e.target.value);
                    setWebsiteFieldError(null);
                  }}
                  onBlur={(e) => {
                    const v = e.currentTarget.value.trim();
                    if (!v) {
                      setWebsiteFieldError(null);
                      setWebsitePreviewHost(null);
                      return;
                    }
                    const n = normalizeWorkspaceWebsite(v);
                    if (!n.ok) {
                      setWebsiteFieldError(n.message);
                      setWebsitePreviewHost(null);
                      return;
                    }
                    setWebsiteFieldError(null);
                    setWebsitePreviewHost(n.hostname);
                    const logo = logoUrl.trim();
                    if (!logo || isGoogleFaviconUrl(logo)) {
                      setLogoUrl(faviconUrlFromHostname(n.hostname));
                    }
                  }}
                  placeholder="example.com or https://…"
                  className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm ${
                    websiteFieldError
                      ? "border-red-300 ring-1 ring-red-200"
                      : "border-[var(--enterprise-border)]"
                  }`}
                  inputMode="url"
                  autoComplete="url"
                />
                {websiteFieldError ? (
                  <p className="mt-1 text-xs text-red-600">{websiteFieldError}</p>
                ) : websitePreviewHost ? (
                  <div className="mt-2 flex items-center gap-3 rounded-lg border border-[var(--enterprise-border)] bg-slate-50/80 px-3 py-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={faviconUrlFromHostname(websitePreviewHost)}
                      alt=""
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-md border border-[var(--enterprise-border)] bg-white object-contain p-1"
                    />
                    <p className="text-xs text-[var(--enterprise-text-muted)]">
                      Logo preview from your website. It appears in the sidebar and here after you
                      save.
                    </p>
                  </div>
                ) : null}
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
                  Upload logo
                </label>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--enterprise-text-muted)]">
                  PNG, JPEG, WebP, or GIF — max 2 MB. Replaces the favicon until you clear it via
                  URL field or save website-only branding.
                </p>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="mt-1.5 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2"
                  disabled={logoUploading}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f || !wid) return;
                    setLogoUploading(true);
                    setMsg(null);
                    try {
                      const updated = await uploadWorkspaceLogo(wid, f);
                      queryClient.setQueryData<MeResponse | null>(qk.me(), (prev) => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          workspaces: prev.workspaces.map((mw) =>
                            mw.workspace.id !== wid
                              ? mw
                              : {
                                  ...mw,
                                  workspace: {
                                    ...mw.workspace,
                                    ...updated,
                                  } as MeWorkspace["workspace"],
                                },
                          ),
                        };
                      });
                      setLogoUrl("");
                      setMsg({
                        type: "ok",
                        text: "Logo uploaded. It appears on proposals and in the sidebar.",
                      });
                    } catch (err) {
                      setMsg({
                        type: "err",
                        text: err instanceof Error ? err.message : "Upload failed.",
                      });
                    } finally {
                      setLogoUploading(false);
                    }
                  }}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--enterprise-text-muted)]">
                  Logo URL (optional)
                </label>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--enterprise-text-muted)]">
                  Override with any public image URL (replaces an uploaded file when you save).
                </p>
                <input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://…"
                  className="mt-1.5 w-full rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm"
                />
              </div>
              {msg ? (
                <p className={`text-sm ${msg.type === "ok" ? "text-emerald-700" : "text-red-600"}`}>
                  {msg.text}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="rounded-lg bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saveMutation.isPending ? "Saving…" : "Save organization"}
              </button>
            </form>
          ) : (
            <dl className="mt-6 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-[var(--enterprise-text-muted)]">Name</dt>
                <dd className="font-medium text-[var(--enterprise-text)]">{ws.name}</dd>
              </div>
              {ws.description ? (
                <div>
                  <dt className="text-xs text-[var(--enterprise-text-muted)]">Description</dt>
                  <dd className="text-[var(--enterprise-text)]">{ws.description}</dd>
                </div>
              ) : null}
              {ws.website ? (
                <div>
                  <dt className="text-xs text-[var(--enterprise-text-muted)]">Website</dt>
                  <dd>
                    <a
                      href={ws.website}
                      className="text-[var(--enterprise-primary)] hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {ws.website}
                    </a>
                  </dd>
                </div>
              ) : null}
              <p className="text-xs text-[var(--enterprise-text-muted)]">
                Only the Super Admin can edit branding. Admins can manage people and invites.
              </p>
            </dl>
          )}
          {superAdmin && wid ? (
            <div className="mt-8 border-t border-red-200/90 pt-6">
              <h3 className="text-sm font-semibold text-red-900">Delete workspace</h3>
              <p className="mt-1 text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
                Permanently deletes this organization and all related data: projects, drawings,
                issues, RFIs, team memberships, and stored files. If there is an active Stripe
                subscription, it is canceled first. This cannot be undone.
              </p>
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmName("");
                  setDeleteOpen(true);
                }}
                className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-800 shadow-sm transition hover:bg-red-50"
              >
                Delete workspace…
              </button>
            </div>
          ) : null}

          {superAdmin ? (
            <div className="mt-8 border-t border-[var(--enterprise-border)] pt-6">
              <h3 className="text-sm font-semibold text-[var(--enterprise-text)]">
                Material catalog
              </h3>
              <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
                Custom columns (for example CO₂ or certifications) are configured per workspace in
                the{" "}
                <Link
                  href={`/workspaces/${ws.id}/materials`}
                  className="font-medium text-[var(--enterprise-primary)] hover:underline"
                >
                  Material Hub
                </Link>{" "}
                under{" "}
                <span className="font-medium text-[var(--enterprise-text)]">Catalog fields</span>.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "billing" && superAdmin && wid ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]/80 px-4 py-3 sm:px-5">
            <h2 className="text-base font-semibold text-[var(--enterprise-text)]">
              Plan &amp; billing
            </h2>
            <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
              Choose a plan, open the Stripe customer portal, or cancel subscription—all in one
              place.
            </p>
          </div>
          <WorkspaceBillingCard workspaceId={wid} workspace={ws} isSuperAdmin={superAdmin} />
        </div>
      ) : null}

      {tab === "people" ? <WorkspaceTeamClient embedded variant="full" /> : null}

      {tab === "invite-member" && isManager ? (
        <WorkspaceTeamClient embedded variant="inviteOnly" />
      ) : null}

      {deleteOpen && wid ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-ws-title"
        >
          <div className="max-w-md rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-5 shadow-lg">
            <h3 id="delete-ws-title" className="text-sm font-semibold text-red-900">
              Delete workspace permanently
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
              Type the workspace name{" "}
              <span className="font-medium text-[var(--enterprise-text)]">{ws.name}</span> to
              confirm. All data for this organization will be removed.
            </p>
            <input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              autoComplete="off"
              placeholder="Workspace name"
              className="mt-4 w-full rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm text-[var(--enterprise-text)] outline-none ring-[var(--enterprise-primary)]/25 focus:ring-2"
            />
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => setDeleteOpen(false)}
                className="rounded-lg border border-[var(--enterprise-border)] bg-white px-3 py-2 text-sm font-medium text-[var(--enterprise-text)] hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy || deleteConfirmName.trim() !== ws.name.trim()}
                onClick={async () => {
                  setDeleteBusy(true);
                  try {
                    await deleteWorkspacePermanently(wid, deleteConfirmName);
                    await queryClient.invalidateQueries({ queryKey: qk.me() });
                    setDeleteOpen(false);
                    toast.success("Workspace deleted.");
                    router.push("/dashboard");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not delete workspace.");
                  } finally {
                    setDeleteBusy(false);
                  }
                }}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteBusy ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
