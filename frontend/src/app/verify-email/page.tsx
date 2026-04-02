"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Loader2, Mail } from "lucide-react";

function VerifyEmailContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const email = sp.get("email") ?? "your@email.com";
  const next = sp.get("next") ?? "/onboarding";
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);

  function onResend() {
    setBusy(true);
    setResent(true);
    window.setTimeout(() => setBusy(false), 1200);
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[var(--enterprise-auth-bg)] font-[family-name:var(--font-inter)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 85% 55% at 50% -25%, rgba(59, 130, 246, 0.2), transparent 55%), radial-gradient(ellipse 100% 60% at 100% 100%, rgba(15, 23, 42, 0.3), transparent)",
        }}
        aria-hidden
      />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-3xl">
              📧
            </div>
            <h1 className="text-2xl font-bold text-white" style={{ fontSize: "24px" }}>
              Check your inbox
            </h1>
            <p className="mt-2 text-sm text-slate-400">We sent a verification link to</p>
            <p className="mt-1 text-sm font-medium text-white">{email}</p>
          </div>

          <div
            className="border border-slate-200/10 bg-white p-6 shadow-2xl shadow-black/40 sm:p-8"
            style={{ borderRadius: "16px" }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="https://mail.google.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-medium text-[#0F172A] transition hover:bg-[#F1F5F9]"
              >
                Open Gmail →
              </a>
              <a
                href="https://outlook.live.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-medium text-[#0F172A] transition hover:bg-[#F1F5F9]"
              >
                Open Outlook →
              </a>
            </div>

            <button
              type="button"
              onClick={() => void onResend()}
              disabled={busy}
              className="mt-6 w-full text-center text-sm text-[#64748B] underline-offset-2 transition hover:text-[#0F172A] hover:underline disabled:opacity-60"
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </span>
              ) : resent ? (
                "Check your inbox again — we sent another link."
              ) : (
                "Didn’t receive it? Resend email"
              )}
            </button>

            <button
              type="button"
              onClick={() => router.push(next.startsWith("/") ? next : "/onboarding")}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#1d4ed8]"
            >
              <Mail className="h-4 w-4" />
              Continue to setup
            </button>
          </div>

          <p className="mt-8 text-center text-sm text-slate-500">
            <Link href="/sign-in" className="hover:text-slate-300">
              ← Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
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
