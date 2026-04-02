"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { patchWorkspace } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import type { MeResponse } from "@/types/enterprise";
import {
  faviconUrlFromHostname,
  isGoogleFaviconUrl,
  normalizeWorkspaceWebsite,
} from "@/lib/workspaceBranding";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { WorkspaceTeamClient } from "@/components/enterprise/WorkspaceTeamClient";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";

type OrgTab = "organization" | "people" | "invite-member";

export function OrganizationClient() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { primary, loading: ctxLoading } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isAdmin = primary?.role === "ADMIN";
  const ws = primary?.workspace;

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [websiteFieldError, setWebsiteFieldError] = useState<string | null>(null);
  const [websitePreviewHost, setWebsitePreviewHost] = useState<string | null>(null);

  const [tab, setTabState] = useState<OrgTab>("organization");

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "invite-member" && isAdmin) setTabState("invite-member");
    else if (t === "people") setTabState("people");
    else if (t === "organization") setTabState("organization");
  }, [searchParams, isAdmin]);

  useEffect(() => {
    if (!isAdmin && tab === "invite-member") {
      setTabState("organization");
      router.replace("/organization?tab=organization", { scroll: false });
    }
  }, [isAdmin, tab, router]);

  function setTab(id: OrgTab) {
    setTabState(id);
    router.replace(`/organization?tab=${id}`, { scroll: false });
  }

  useEffect(() => {
    if (!ws) return;
    setName(ws.name);
    setSlug(ws.slug);
    setLogoUrl(ws.logoUrl ?? "");
    setDescription(ws.description ?? "");
    setWebsite(ws.website ?? "");
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
    if (!wid || !isAdmin) return;
    const w = website.trim();
    if (w) {
      const n = normalizeWorkspaceWebsite(w);
      if (!n.ok) {
        setWebsiteFieldError(n.message);
        setMsg({ type: "err", text: n.message });
        return;
      }
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

  const roleLabel = primary.role === "ADMIN" ? "Admin" : "Member";

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
        {tabBtn("people", "People")}
        {isAdmin ? tabBtn("invite-member", "Invite member") : null}
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

          {isAdmin ? (
            <form onSubmit={onSaveOrg} className="mt-8 space-y-4">
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
                  Website
                </label>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--enterprise-text-muted)]">
                  We check the URL and use your site&apos;s favicon as the workspace logo (unless
                  you set a custom logo below).
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
                  Logo URL (optional)
                </label>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--enterprise-text-muted)]">
                  Override the favicon with any image URL. Leave empty to keep using the favicon
                  from your website.
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
                Only admins can edit organization details and send invites.
              </p>
            </dl>
          )}
        </section>
      ) : null}

      {tab === "people" ? <WorkspaceTeamClient embedded variant="full" /> : null}

      {tab === "invite-member" && isAdmin ? (
        <WorkspaceTeamClient embedded variant="inviteOnly" />
      ) : null}
    </div>
  );
}
