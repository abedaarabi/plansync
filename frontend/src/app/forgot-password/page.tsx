"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, ArrowLeft, Loader2, Mail } from "lucide-react";
import { EnterpriseAuthLayout } from "@/components/auth/EnterpriseAuthLayout";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error: err } = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: `${origin}/reset-password`,
      });
      if (err) setError(err.message ?? "Could not send reset email.");
      else setSent(true);
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <EnterpriseAuthLayout
      title="Forgot password"
      description="Enter your work email and we’ll send you a link to choose a new password."
    >
      {sent ? (
        <div className="space-y-4 text-center">
          <p className="text-sm leading-relaxed text-[#64748B]">
            If an account exists for <strong className="text-[#0F172A]">{email}</strong>, you’ll get
            an email with a reset link shortly. Check your spam folder if nothing arrives.
          </p>
          <Link
            href="/sign-in"
            className="inline-flex items-center justify-center gap-2 text-sm font-medium text-[#2563EB] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="forgot-email"
              className="mb-1.5 block text-[13px] font-medium text-[#64748B]"
            >
              Email
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                id="forgot-email"
                type="email"
                required
                autoComplete="email"
                className="w-full rounded-xl border border-[#E2E8F0] bg-white py-2.5 pl-10 pr-3 text-sm text-[#0F172A] placeholder:text-slate-400 transition focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
          </div>

          {error && (
            <div
              className="flex gap-2 rounded-xl border border-red-200 bg-red-50/90 px-3 py-2.5 text-sm text-red-800"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition hover:bg-[#1d4ed8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/50 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Sending…
              </>
            ) : (
              "Send reset link"
            )}
          </button>

          <p className="text-center text-sm">
            <Link href="/sign-in" className="font-medium text-[#2563EB] hover:underline">
              ← Back to sign in
            </Link>
          </p>
        </form>
      )}
    </EnterpriseAuthLayout>
  );
}
