"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AlertCircle, Loader2, Lock } from "lucide-react";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseAuthLayout } from "@/components/auth/EnterpriseAuthLayout";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const qpError = searchParams.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const t = token?.trim() ?? "";
    if (!t) {
      setError("This reset link is missing a token. Request a new link from the sign-in page.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await authClient.resetPassword({
        newPassword: password,
        token: t,
      });
      if (err) setError(err.message ?? "Could not reset password.");
      else {
        setDone(true);
        setTimeout(() => router.replace("/sign-in"), 2000);
      }
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  if (qpError === "INVALID_TOKEN") {
    return (
      <EnterpriseAuthLayout
        title="Reset link problem"
        description="This reset link has expired or is invalid."
      >
        <div className="space-y-4 text-center">
          <Link
            href="/forgot-password"
            className="inline-flex w-full items-center justify-center rounded-md bg-[var(--enterprise-primary)] py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--enterprise-primary-deep)]"
          >
            Request a new link
          </Link>
          <Link
            href="/sign-in"
            className="block text-sm font-medium text-[var(--enterprise-primary)] hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </EnterpriseAuthLayout>
    );
  }

  if (!token?.trim()) {
    return (
      <EnterpriseAuthLayout
        title="Reset password"
        description="Open the link from your email, or request a new reset link."
      >
        <div className="space-y-4 text-center">
          <Link
            href="/forgot-password"
            className="inline-flex w-full items-center justify-center rounded-md bg-[var(--enterprise-primary)] py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--enterprise-primary-deep)]"
          >
            Request a new link
          </Link>
          <Link
            href="/sign-in"
            className="block text-sm font-medium text-[var(--enterprise-primary)] hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </EnterpriseAuthLayout>
    );
  }

  if (done) {
    return (
      <EnterpriseAuthLayout
        title="Password updated"
        description="You can sign in with your new password. Redirecting to sign in…"
      >
        <p className="enterprise-type-body text-center text-[#64748B]">
          <Link href="/sign-in" className="enterprise-type-nav text-[#2563EB] hover:underline">
            Go to sign in now
          </Link>
        </p>
      </EnterpriseAuthLayout>
    );
  }

  return (
    <EnterpriseAuthLayout
      title="Choose a new password"
      description="Use at least 8 characters. You’ll be signed out of other devices for security."
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="reset-password"
            className="enterprise-type-nav mb-1.5 block text-[#64748B]"
          >
            New password
          </label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              id="reset-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="enterprise-field-input enterprise-field-input--icon py-2.5 pr-3"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="reset-password-confirm"
            className="enterprise-type-nav mb-1.5 block text-[#64748B]"
          >
            Confirm password
          </label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              id="reset-password-confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="enterprise-field-input enterprise-field-input--icon py-2.5 pr-3"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••••••"
            />
          </div>
        </div>

        {error && (
          <div
            className="flex gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        <EnterpriseButton type="submit" fullWidth loading={loading} className="gap-2">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Updating…
            </>
          ) : (
            "Update password"
          )}
        </EnterpriseButton>
      </form>
    </EnterpriseAuthLayout>
  );
}
