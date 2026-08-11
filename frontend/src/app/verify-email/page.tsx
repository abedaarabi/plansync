"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { EnterpriseAuthLayout } from "@/components/auth/EnterpriseAuthLayout";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { authClient } from "@/lib/auth-client";

function VerifyEmailContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const email = sp.get("email") ?? "your@email.com";
  const next = sp.get("next") ?? "/onboarding";
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function onResend() {
    setBusy(true);
    setStatusMsg(null);
    try {
      const path = next.startsWith("/") ? next : `/${next}`;
      const callbackURL =
        typeof window !== "undefined" ? new URL(path, window.location.origin).href : undefined;
      const { error } = await authClient.sendVerificationEmail({
        email,
        ...(callbackURL ? { callbackURL } : {}),
      });
      if (error) {
        setResent(false);
        setStatusMsg(error.message ?? "Could not resend the email. Try again in a moment.");
      } else {
        setResent(true);
      }
    } catch {
      setResent(false);
      setStatusMsg("Could not resend the email. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function onContinue() {
    setChecking(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/v1/me", { credentials: "include", cache: "no-store" });
      if (res.status === 401) {
        setStatusMsg("Please sign in again after verifying your email.");
        return;
      }
      if (res.status === 403) {
        setStatusMsg("Your email is not verified yet. Open the link in your inbox first.");
        return;
      }
      if (!res.ok) {
        setStatusMsg("Could not confirm verification right now. Please try again.");
        return;
      }
      const me = (await res.json().catch(() => ({}))) as { user?: { emailVerified?: boolean } };
      if (me.user?.emailVerified !== true) {
        setStatusMsg("Your email is not verified yet. Open the link in your inbox first.");
        return;
      }
      router.push(next.startsWith("/") ? next : "/onboarding");
    } catch {
      setStatusMsg("Could not confirm verification right now. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <EnterpriseAuthLayout
      title="Check your inbox"
      description={
        <>
          We sent a verification link to <span className="font-medium text-slate-200">{email}</span>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href="https://mail.google.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex flex-1 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-hover-surface)]"
          >
            Open Gmail
          </a>
          <a
            href="https://outlook.live.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex flex-1 items-center justify-center rounded-md border border-[var(--enterprise-border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-hover-surface)]"
          >
            Open Outlook
          </a>
        </div>

        <button
          type="button"
          onClick={() => void onResend()}
          disabled={busy}
          className="w-full text-center text-sm text-[var(--enterprise-text-muted)] underline-offset-2 transition hover:text-[var(--enterprise-text)] hover:underline disabled:opacity-60"
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending…
            </span>
          ) : resent ? (
            "Check your inbox again — we sent another link."
          ) : (
            "Didn’t receive it? Resend verification email"
          )}
        </button>

        {statusMsg ? (
          <p className="text-center text-sm text-red-600" role="alert">
            {statusMsg}
          </p>
        ) : null}

        <EnterpriseButton
          type="button"
          fullWidth
          loading={checking}
          onClick={() => void onContinue()}
        >
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}I
          verified my email
        </EnterpriseButton>

        <button
          type="button"
          onClick={async () => {
            await authClient.signOut();
            router.push("/sign-in");
          }}
          className="w-full text-center text-sm text-[var(--enterprise-text-muted)] transition hover:text-[var(--enterprise-text)]"
        >
          Sign out
        </button>
      </div>
    </EnterpriseAuthLayout>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[var(--enterprise-auth-bg)] font-[family-name:var(--font-inter)] text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
