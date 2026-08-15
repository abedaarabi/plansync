"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Building2, ExternalLink, ImageIcon, Palette, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseForm } from "@/components/enterprise/forms/EnterpriseForm";
import { EnterpriseFormField } from "@/components/enterprise/forms/EnterpriseFormField";
import {
  EnterpriseInput,
  EnterpriseTextarea,
} from "@/components/enterprise/forms/EnterpriseInputs";
import { useEnterpriseForm } from "@/components/enterprise/forms/useEnterpriseForm";
import { deleteWorkspacePermanently, patchWorkspace, uploadWorkspaceLogo } from "@/lib/api-client";
import {
  isValidWorkspacePrimaryHex,
  normalizeWorkspacePrimaryHex,
  workspaceEnterpriseCssVars,
} from "@/lib/enterpriseTheme";
import { OM_COMPACT_INPUT, OM_COMPACT_LABEL } from "@/lib/omCompactStyles";
import { paidPlanLabel } from "@/lib/productPricing";
import { qk } from "@/lib/queryKeys";
import {
  faviconUrlFromHostname,
  isGoogleFaviconUrl,
  isWorkspaceHostedLogoPath,
  normalizeWorkspaceWebsite,
} from "@/lib/workspaceBranding";
import { trialDaysLeft } from "@/lib/workspaceSubscription";
import type { MeResponse, MeWorkspace } from "@/types/enterprise";

type Props = {
  workspaceId: string;
  workspace: MeWorkspace["workspace"];
  roleLabel: string;
  canEdit: boolean;
};

export const organizationBrandingSchema = z.object({
  description: z.string(),
  name: z.string().trim().min(1, "Enter a workspace name."),
  primaryColor: z
    .string()
    .trim()
    .refine((value) => value === "" || isValidWorkspacePrimaryHex(value), {
      message: "Primary color must be a hex value like #2563EB (6 digits after #).",
    }),
  slug: z.string().trim().min(1, "Enter a URL slug."),
  website: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || normalizeWorkspaceWebsite(value).ok,
      "Enter a valid website address.",
    ),
});

type OrganizationBrandingValues = z.infer<typeof organizationBrandingSchema>;

// fallow-ignore-next-line complexity
export function OrganizationBrandingPanel({
  workspaceId,
  workspace: ws,
  roleLabel,
  canEdit,
}: Props) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const form = useEnterpriseForm(organizationBrandingSchema, {
    description: ws.description ?? "",
    name: ws.name,
    primaryColor: ws.primaryColor ?? "#2563EB",
    slug: ws.slug,
    website: ws.website ?? "",
  });

  const [logoUrl, setLogoUrl] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [websitePreviewHost, setWebsitePreviewHost] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    form.reset({
      description: ws.description ?? "",
      name: ws.name,
      primaryColor: ws.primaryColor ?? "#2563EB",
      slug: ws.slug,
      website: ws.website ?? "",
    });
    const lu = ws.logoUrl ?? "";
    setLogoUrl(isWorkspaceHostedLogoPath(lu) ? "" : lu);
    if (ws.website) {
      const n = normalizeWorkspaceWebsite(ws.website);
      setWebsitePreviewHost(n.ok ? n.hostname : null);
    } else {
      setWebsitePreviewHost(null);
    }
  }, [form, ws]);

  const saveMutation = useMutation({
    mutationFn: (values: OrganizationBrandingValues) =>
      patchWorkspace(workspaceId, {
        name: values.name.trim(),
        slug: values.slug.trim(),
        logoUrl: logoUrl.trim() || null,
        description: values.description.trim() || null,
        website: values.website.trim() || null,
        primaryColor: values.primaryColor.trim() || undefined,
      }),
    onMutate: async (values) => {
      const prev = queryClient.getQueryData<MeResponse | null>(qk.me());
      if (!prev) return {};
      const next: MeResponse = {
        ...prev,
        workspaces: prev.workspaces.map((mw) =>
          mw.workspace.id !== workspaceId
            ? mw
            : {
                ...mw,
                workspace: {
                  ...mw.workspace,
                  name: values.name.trim(),
                  slug: values.slug.trim(),
                  logoUrl: logoUrl.trim() || null,
                  description: values.description.trim() || null,
                  website: values.website.trim() || null,
                  primaryColor: normalizeWorkspacePrimaryHex(
                    values.primaryColor.trim() || undefined,
                  ),
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
      setMsg({ type: "ok", text: "Organization saved." });
    },
  });

  function onSaveOrg(values: OrganizationBrandingValues) {
    if (!canEdit) return;
    setMsg(null);
    saveMutation.mutate(values);
  }

  const trialDays =
    ws.subscriptionStatus === "trialing" ? trialDaysLeft(ws.currentPeriodEnd) : null;
  const planName = paidPlanLabel(ws.billingPlan) ?? "Paid";
  const planStatusLabel =
    ws.subscriptionStatus === "active"
      ? `${planName} · Active`
      : ws.subscriptionStatus === "trialing"
        ? trialDays === 0
          ? "Trial ended"
          : trialDays != null
            ? `${planName} trial (${trialDays} day${trialDays === 1 ? "" : "s"} left)`
            : `${planName} trial`
        : "Free";

  const primaryColor = form.watch("primaryColor");
  const previewColor = isValidWorkspacePrimaryHex(primaryColor)
    ? primaryColor.trim()
    : normalizeWorkspacePrimaryHex(undefined);

  return (
    <section className="enterprise-animate-in space-y-5">
      <div className="enterprise-card overflow-hidden">
        <div className="border-b border-[var(--enterprise-border)] bg-[linear-gradient(135deg,var(--enterprise-primary-soft),transparent_55%)] px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-start gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--enterprise-surface)] ring-1 ring-[var(--enterprise-border)]"
              style={{ color: previewColor }}
            >
              {ws.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ws.logoUrl} alt="" className="h-full w-full object-contain p-2" />
              ) : (
                <Building2 className="h-7 w-7" strokeWidth={1.75} aria-hidden />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">
                Workspace branding
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--enterprise-text)]">
                {ws.name}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--enterprise-subtitle)]">
                Name, logo, and color appear in the sidebar, invite emails, and client proposal
                pages. Your role:{" "}
                <span className="font-medium text-[var(--enterprise-text)]">{roleLabel}</span>
                {" · "}
                Plan:{" "}
                <span className="font-medium text-[var(--enterprise-text)]">{planStatusLabel}</span>
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-3 sm:px-6">
          <div className="flex items-start gap-2 text-xs text-[var(--enterprise-text-muted)]">
            <Palette
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--enterprise-primary)]"
              aria-hidden
            />
            <span>Primary color drives buttons, links, and focus accents across the app.</span>
          </div>
          <div className="flex items-start gap-2 text-xs text-[var(--enterprise-text-muted)]">
            <ImageIcon
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--enterprise-primary)]"
              aria-hidden
            />
            <span>Upload a logo or pull a favicon from your company website.</span>
          </div>
          <div className="flex items-start gap-2 text-xs text-[var(--enterprise-text-muted)]">
            <ExternalLink
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--enterprise-primary)]"
              aria-hidden
            />
            <span>Branding carries through to proposals and invite pages your clients see.</span>
          </div>
        </div>
      </div>

      {canEdit ? (
        <EnterpriseForm
          form={form}
          density="compact"
          onSubmit={onSaveOrg}
          className="space-y-5"
          style={workspaceEnterpriseCssVars(primaryColor)}
        >
          <div className="enterprise-card p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[var(--enterprise-text)]">Identity</h3>
            <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
              How this organization is named in the app and in URLs.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <EnterpriseFormField<OrganizationBrandingValues>
                name="name"
                label="Workspace name"
                required
              >
                {({ describedBy, field, id, invalid }) => (
                  <EnterpriseInput
                    {...field}
                    id={id}
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                  />
                )}
              </EnterpriseFormField>
              <EnterpriseFormField<OrganizationBrandingValues>
                name="slug"
                label="URL slug"
                required
              >
                {({ describedBy, field, id, invalid }) => (
                  <EnterpriseInput
                    {...field}
                    id={id}
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                    className="font-mono"
                  />
                )}
              </EnterpriseFormField>
            </div>
            <div className="mt-4">
              <EnterpriseFormField<OrganizationBrandingValues>
                name="description"
                label="Description"
              >
                {({ describedBy, field, id, invalid }) => (
                  <EnterpriseTextarea
                    {...field}
                    id={id}
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                    rows={3}
                    className="resize-y"
                    placeholder="Optional — shown on invite pages"
                  />
                )}
              </EnterpriseFormField>
            </div>
          </div>

          <div className="enterprise-card p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[var(--enterprise-text)]">Look & logo</h3>
            <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
              Color and logo used in the product shell and outward-facing pages.
            </p>

            <div className="mt-4">
              <label className={OM_COMPACT_LABEL} htmlFor="org-primary-color">
                Primary color
              </label>
              <p className="mt-0.5 text-[11px] leading-snug text-[var(--enterprise-text-muted)]">
                Pick a color or paste <span className="font-mono">#RRGGBB</span>.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <input
                  type="color"
                  value={previewColor}
                  onChange={(e) =>
                    form.setValue("primaryColor", e.target.value.toUpperCase(), {
                      shouldValidate: true,
                    })
                  }
                  className="h-11 w-14 cursor-pointer rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-1 "
                  aria-label="Choose primary brand color"
                />
                <EnterpriseFormField<OrganizationBrandingValues>
                  name="primaryColor"
                  label="Primary color"
                >
                  {({ describedBy, field, id, invalid }) => (
                    <EnterpriseInput
                      {...field}
                      id={id}
                      aria-describedby={describedBy}
                      aria-invalid={invalid}
                      placeholder="#2563EB"
                      spellCheck={false}
                      className="min-w-[9rem] max-w-[11rem] font-mono"
                      autoComplete="off"
                      onBlur={(event) => {
                        field.onBlur();
                        const value = event.currentTarget.value.trim();
                        if (value === "") {
                          form.setValue("primaryColor", normalizeWorkspacePrimaryHex(undefined));
                        } else if (isValidWorkspacePrimaryHex(value)) {
                          form.setValue("primaryColor", value.toUpperCase());
                        }
                      }}
                    />
                  )}
                </EnterpriseFormField>
                <span
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-2 text-xs text-[var(--enterprise-text-muted)]"
                  aria-hidden
                >
                  Preview
                  <span
                    className="inline-flex h-7 items-center rounded-md px-2.5 text-[11px] font-semibold text-white"
                    style={{ backgroundColor: previewColor }}
                  >
                    Button
                  </span>
                </span>
              </div>
            </div>

            <div className="mt-5">
              <p className="mt-0.5 text-[11px] leading-snug text-[var(--enterprise-text-muted)]">
                We can use your site&apos;s favicon as the logo when you haven&apos;t uploaded one.
              </p>
              <EnterpriseFormField<OrganizationBrandingValues> name="website" label="Website">
                {({ describedBy, field, id, invalid }) => (
                  <EnterpriseInput
                    {...field}
                    id={id}
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                    onBlur={(event) => {
                      field.onBlur();
                      const normalized = normalizeWorkspaceWebsite(
                        event.currentTarget.value.trim(),
                      );
                      if (!normalized.ok) {
                        setWebsitePreviewHost(null);
                        return;
                      }
                      setWebsitePreviewHost(normalized.hostname);
                      if (!logoUrl.trim() || isGoogleFaviconUrl(logoUrl)) {
                        setLogoUrl(faviconUrlFromHostname(normalized.hostname));
                      }
                    }}
                    placeholder="example.com or https://…"
                    inputMode="url"
                    autoComplete="url"
                  />
                )}
              </EnterpriseFormField>
              {websitePreviewHost ? (
                <div className="mt-2 flex items-center gap-3 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={faviconUrlFromHostname(websitePreviewHost)}
                    alt=""
                    width={40}
                    height={40}
                    referrerPolicy="no-referrer"
                    className="h-10 w-10 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] object-contain p-1"
                  />
                  <p className="text-xs text-[var(--enterprise-text-muted)]">
                    Favicon preview for {websitePreviewHost}. Save to apply it as the workspace
                    logo.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={OM_COMPACT_LABEL}>Upload logo</label>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--enterprise-text-muted)]">
                  PNG, JPEG, WebP, or GIF — max 2 MB.
                </p>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="mt-2 block w-full text-sm text-[var(--enterprise-text-muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--enterprise-primary-soft)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--enterprise-primary)]"
                  disabled={logoUploading}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    setLogoUploading(true);
                    setMsg(null);
                    try {
                      const updated = await uploadWorkspaceLogo(workspaceId, f);
                      queryClient.setQueryData<MeResponse | null>(qk.me(), (prev) => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          workspaces: prev.workspaces.map((mw) =>
                            mw.workspace.id !== workspaceId
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
                <label className={OM_COMPACT_LABEL} htmlFor="org-logo-url">
                  Logo URL <span className="font-normal">(optional)</span>
                </label>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--enterprise-text-muted)]">
                  Public image URL overrides an upload when you save.
                </p>
                <input
                  id="org-logo-url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://…"
                  className={OM_COMPACT_INPUT}
                />
              </div>
            </div>
          </div>

          {msg ? (
            <div
              className={
                msg.type === "ok"
                  ? "enterprise-alert-success text-sm"
                  : "enterprise-alert-danger text-sm"
              }
            >
              {msg.text}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <EnterpriseButton type="submit" size="md" loading={saveMutation.isPending}>
              Save branding
            </EnterpriseButton>
            <Link
              href={`/workspaces/${ws.id}/materials`}
              className="text-sm font-medium text-[var(--enterprise-primary)] hover:underline"
            >
              Material catalog fields →
            </Link>
          </div>
        </EnterpriseForm>
      ) : (
        <div className="enterprise-card p-4 sm:p-5">
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="enterprise-type-label text-[var(--enterprise-text-muted)]">Name</dt>
              <dd className="mt-1 font-medium text-[var(--enterprise-text)]">{ws.name}</dd>
            </div>
            {ws.description ? (
              <div>
                <dt className="enterprise-type-label text-[var(--enterprise-text-muted)]">
                  Description
                </dt>
                <dd className="mt-1 text-[var(--enterprise-text)]">{ws.description}</dd>
              </div>
            ) : null}
            {ws.website ? (
              <div>
                <dt className="enterprise-type-label text-[var(--enterprise-text-muted)]">
                  Website
                </dt>
                <dd className="mt-1">
                  <a
                    href={ws.website}
                    className="font-medium text-[var(--enterprise-primary)] hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {ws.website}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-4 text-xs text-[var(--enterprise-text-muted)]">
            Only the Super Admin can edit branding. Admins can manage people and invites.
          </p>
        </div>
      )}

      {canEdit ? (
        <div className="enterprise-card border-[var(--enterprise-semantic-danger-border)] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--enterprise-semantic-danger-text)]">
                <Trash2 className="h-4 w-4" aria-hidden />
                Delete workspace
              </h3>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
                Permanently deletes this organization and all related data. Active Stripe
                subscriptions are canceled first. This cannot be undone.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDeleteConfirmName("");
                setDeleteOpen(true);
              }}
              className="rounded-md border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-surface)] px-3.5 py-2 text-sm font-semibold text-[var(--enterprise-semantic-danger-text)] transition hover:bg-[var(--enterprise-semantic-danger-bg)]"
            >
              Delete workspace…
            </button>
          </div>
        </div>
      ) : null}

      {deleteOpen ? (
        <div
          className="mobile-sheet-host fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[3px] max-lg:items-end max-lg:p-0"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-ws-title"
        >
          <div className="w-full max-w-md rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-5 shadow-lg sm:p-6">
            <h3
              id="delete-ws-title"
              className="text-base font-semibold text-[var(--enterprise-semantic-danger-text)]"
            >
              Delete workspace permanently
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
              Type the workspace name{" "}
              <span className="font-medium text-[var(--enterprise-text)]">{ws.name}</span> to
              confirm.
            </p>
            <input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              autoComplete="off"
              placeholder="Workspace name"
              className={`${OM_COMPACT_INPUT} mt-4`}
            />
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <EnterpriseButton
                type="button"
                variant="secondary"
                size="md"
                disabled={deleteBusy}
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </EnterpriseButton>
              <button
                type="button"
                disabled={deleteBusy || deleteConfirmName.trim() !== ws.name.trim()}
                onClick={async () => {
                  setDeleteBusy(true);
                  try {
                    await deleteWorkspacePermanently(workspaceId, deleteConfirmName);
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
                className="rounded-md bg-[var(--enterprise-semantic-danger-text)] px-3 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
              >
                {deleteBusy ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
