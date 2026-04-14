"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { resizeImageToDataUrl } from "@/lib/resize-avatar";
import { userInitials } from "@/lib/user-initials";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";
import { AccountDeviceAlerts } from "./AccountDeviceAlerts";

export function AccountClient() {
  const router = useRouter();
  const { primary } = useEnterpriseWorkspace();
  const { data: session, isPending, refetch } = authClient.useSession();

  const [name, setName] = useState("");
  /** Resolved avatar: data URL, https URL, or null if removed */
  const [avatar, setAvatar] = useState<string | null>(null);
  /** Separate field so users can paste/edit an image URL without fighting upload state */
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const u = session?.user;
    if (!u) return;
    setName(u.name ?? "");
    const img = u.image ?? null;
    setAvatar(img);
    setImageUrl(img && !img.startsWith("data:") ? img : "");
  }, [session?.user]);

  const onPickFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    setMessage(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setAvatar(dataUrl);
      setImageUrl("");
    } catch (err) {
      setMessage({
        type: "err",
        text: err instanceof Error ? err.message : "Could not process that image.",
      });
    }
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const trimmedUrl = imageUrl.trim();
      const image =
        trimmedUrl.length > 0
          ? trimmedUrl
          : avatar && avatar.startsWith("data:")
            ? avatar
            : avatar && (avatar.startsWith("http://") || avatar.startsWith("https://"))
              ? avatar
              : avatar;

      const { error } = await authClient.updateUser({
        name: name.trim() || undefined,
        image: image ?? null,
      });
      if (error) {
        setMessage({ type: "err", text: error.message ?? "Could not save profile." });
        return;
      }
      await refetch();
      setMessage({ type: "ok", text: "Profile saved." });
    } finally {
      setSaving(false);
    }
  }

  async function onSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  function onRemovePhoto() {
    setAvatar(null);
    setImageUrl("");
    setMessage(null);
  }

  if (isPending) {
    return (
      <div className="enterprise-card p-8">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-100" />
        <div className="mt-6 h-32 animate-pulse rounded-lg bg-slate-50" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="enterprise-card p-8">
        <p className="text-sm text-[var(--enterprise-text-muted)]">
          You need to sign in to manage your account.
        </p>
        <button
          type="button"
          className="mt-4 rounded-lg bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-medium text-white"
          onClick={() => router.push("/sign-in?next=/account")}
        >
          Sign in
        </button>
      </div>
    );
  }

  const u = session.user;
  const email = u.email ?? "";
  const initials = userInitials(u.name, u.email);
  const displaySrc = imageUrl.trim() || avatar;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
      <form onSubmit={(e) => void onSave(e)} className="enterprise-card p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-[var(--enterprise-text)]">Profile</h2>
        <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
          Your name and photo appear in the app header and activity.
        </p>

        <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex shrink-0 flex-col items-center gap-3 sm:items-start">
            <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-[var(--enterprise-border)] bg-gradient-to-br from-blue-100 to-slate-100 text-2xl font-semibold text-slate-800">
              {displaySrc ? (
                // eslint-disable-next-line @next/next/no-img-element -- user-controlled URL / data URL
                <img src={displaySrc} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="cursor-pointer rounded-lg border border-[var(--enterprise-border)] bg-slate-50 px-3 py-1.5 text-center text-xs font-medium text-[var(--enterprise-text)] transition hover:bg-slate-100">
                Upload photo
                <input type="file" accept="image/*" className="sr-only" onChange={onPickFile} />
              </label>
              {displaySrc ? (
                <button
                  type="button"
                  onClick={onRemovePhoto}
                  className="rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <label
                htmlFor="acct-name"
                className="block text-xs font-medium text-[var(--enterprise-text-muted)]"
              >
                Display name
              </label>
              <input
                id="acct-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[var(--enterprise-border)] bg-white px-3 py-2 text-sm text-[var(--enterprise-text)] outline-none ring-[var(--enterprise-primary)]/25 focus:ring-2"
                autoComplete="name"
              />
            </div>
            <div>
              <label
                htmlFor="acct-email"
                className="block text-xs font-medium text-[var(--enterprise-text-muted)]"
              >
                Email
              </label>
              <input
                id="acct-email"
                value={email}
                readOnly
                className="mt-1.5 w-full cursor-not-allowed rounded-lg border border-[var(--enterprise-border)] bg-slate-50 px-3 py-2 text-sm text-[var(--enterprise-text-muted)]"
              />
            </div>
            <div>
              <label
                htmlFor="acct-image-url"
                className="block text-xs font-medium text-[var(--enterprise-text-muted)]"
              >
                Profile image URL <span className="font-normal">(optional)</span>
              </label>
              <input
                id="acct-image-url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…"
                className="mt-1.5 w-full rounded-lg border border-[var(--enterprise-border)] bg-white px-3 py-2 text-sm text-[var(--enterprise-text)] outline-none ring-[var(--enterprise-primary)]/25 focus:ring-2"
              />
              <p className="mt-1 text-[11px] text-[var(--enterprise-text-muted)]">
                Or upload a photo above. URLs from Gravatar or your company directory work well.
              </p>
            </div>
          </div>
        </div>

        {message ? (
          <p
            className={`mt-4 text-sm ${message.type === "ok" ? "text-[var(--enterprise-semantic-success-text)]" : "text-[var(--enterprise-semantic-danger-text)]"}`}
            role="status"
          >
            {message.text}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <aside className="space-y-4">
        <AccountDeviceAlerts />
        <div className="enterprise-card p-5">
          <h3 className="text-sm font-semibold text-[var(--enterprise-text)]">Session</h3>
          <p className="mt-2 text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
            You are signed in as{" "}
            <span className="font-medium text-[var(--enterprise-text)]">{email}</span>.
          </p>
          {primary ? (
            <p className="mt-3 text-xs text-[var(--enterprise-text-muted)]">
              Workspace{" "}
              <span className="font-medium text-[var(--enterprise-text)]">
                {primary.workspace.name}
              </span>
              {" · "}
              {primary.role === "SUPER_ADMIN"
                ? "Super Admin"
                : primary.role === "ADMIN"
                  ? "Admin"
                  : "Member"}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="mt-4 w-full rounded-lg border border-[var(--enterprise-border)] bg-white py-2 text-sm font-medium text-[var(--enterprise-text)] transition hover:bg-slate-50"
          >
            Log out
          </button>
        </div>
      </aside>
    </div>
  );
}
