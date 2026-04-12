"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, Loader2, Lock, Mail, User } from "lucide-react";
import { BrandStoryPanel, MarketingHeroBackdrop } from "@/components/BrandStoryPanel";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import { authClient } from "@/lib/auth-client";

const CARD_RADIUS = "16px";

export default function SignInPage() {
  const router = useRouter();
  const [next, setNext] = useState("/dashboard");
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const q = sp.get("next");
    if (q?.startsWith("/")) setNext(q);
    if (sp.get("mode") === "sign-up") setMode("sign-up");
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [error, setError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function waitForSessionReady(): Promise<{
    ready: boolean;
    emailVerified: boolean | null;
  }> {
    const waitsMs = [0, 120, 250, 500, 900];
    for (const w of waitsMs) {
      if (w > 0) await new Promise((resolve) => window.setTimeout(resolve, w));
      try {
        const res = await fetch("/api/v1/me", {
          credentials: "include",
          cache: "no-store",
        });
        if (res.status === 403) {
          return { ready: true, emailVerified: false };
        }
        if (res.ok) {
          const me = (await res.json().catch(() => ({}))) as {
            user?: { emailVerified?: boolean };
          };
          return { ready: true, emailVerified: me.user?.emailVerified ?? null };
        }
      } catch {
        // retry
      }
    }
    return { ready: false, emailVerified: null };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setUnverifiedEmail(null);
    setLoading(true);
    try {
      if (mode === "sign-up") {
        const nextPath = next.startsWith("/") ? next : `/${next}`;
        const verifyCallbackUrl =
          typeof window !== "undefined"
            ? new URL(`/onboarding?next=${encodeURIComponent(nextPath)}`, window.location.origin)
                .href
            : undefined;
        const { error: err } = await authClient.signUp.email({
          email,
          password,
          name: name.trim() || email.split("@")[0] || "User",
          ...(verifyCallbackUrl ? { callbackURL: verifyCallbackUrl } : {}),
        });
        if (err) setError(err.message ?? "Sign up failed");
        else {
          const afterOnboarding = encodeURIComponent(nextPath);
          router.replace(
            `/verify-email?email=${encodeURIComponent(email)}&next=${encodeURIComponent(`/onboarding?next=${afterOnboarding}`)}`,
          );
        }
      } else {
        const { error: err } = await authClient.signIn.email({ email, password });
        if (err) setError(err.message ?? "Sign in failed");
        else {
          const session = await waitForSessionReady();
          if (!session.ready) {
            setError(
              "Signed in, but session was not persisted yet. Please try again. If this continues in production, check proxy Set-Cookie forwarding and cookie domain settings.",
            );
            return;
          }
          if (session.emailVerified === false) {
            await authClient.signOut();
            setUnverifiedEmail(email);
            setError("Please verify your email before signing in.");
            return;
          }
          // Full navigation after session is confirmed.
          window.location.assign(next.startsWith("/") ? next : `/${next}`);
        }
      }
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid h-dvh max-h-dvh min-h-0 grid-rows-1 overflow-hidden font-[family-name:var(--font-inter)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="min-h-0">
        <BrandStoryPanel backHref="/" backLabel="← Back to site" />
      </div>

      <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--enterprise-auth-bg)]">
        <MarketingHeroBackdrop showImageOnLarge={false} />

        <div className="relative z-10 flex min-h-0 flex-1 flex-col lg:justify-center">
          <div className="shrink-0 border-b border-white/10 bg-[#0F172A] px-4 py-2 lg:hidden">
            <Link
              href="/"
              className="mx-auto flex w-fit max-w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 ring-1 ring-white/[0.06]"
            >
              <Image
                src="/logo.svg"
                alt="PlanSync"
                width={32}
                height={32}
                className="h-8 w-8 shrink-0"
                priority
                unoptimized
              />
              <span className="text-sm font-bold tracking-tight text-white">PlanSync</span>
            </Link>
          </div>

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-3 py-2 sm:px-4 lg:py-3">
            <div className="flex w-full max-w-[400px] shrink-0 flex-col py-1">
              <div className="mb-3 flex flex-col items-center text-center">
                <h1 className="text-xl font-bold text-white sm:text-2xl">
                  {mode === "sign-in" ? "Welcome back" : "PlanSync"}
                </h1>
                {mode === "sign-up" ? (
                  <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                    14-day trial · No credit card
                  </p>
                ) : (
                  <p className="mt-1 max-w-sm text-xs leading-snug text-slate-400 sm:text-sm">
                    Workspace dashboard and cloud projects.
                  </p>
                )}
              </div>

              <div
                className="border border-slate-200/10 bg-white p-4 shadow-2xl shadow-black/40 sm:p-5"
                style={{ borderRadius: CARD_RADIUS }}
              >
                <div className="space-y-3 sm:space-y-4">
                  <div
                    className="flex rounded-xl bg-slate-100 p-1"
                    role="tablist"
                    aria-label="Authentication mode"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === "sign-in"}
                      onClick={() => {
                        setError(null);
                        setMode("sign-in");
                      }}
                      className={`relative flex-1 rounded-lg py-2 text-sm font-medium transition ${
                        mode === "sign-in"
                          ? "bg-white text-[#0F172A] shadow-sm"
                          : "text-slate-600 hover:text-slate-600"
                      }`}
                    >
                      Sign in
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === "sign-up"}
                      onClick={() => {
                        setError(null);
                        setMode("sign-up");
                      }}
                      className={`relative flex-1 rounded-lg py-2 text-sm font-medium transition ${
                        mode === "sign-up"
                          ? "bg-white text-[#0F172A] shadow-sm"
                          : "text-slate-600 hover:text-slate-600"
                      }`}
                    >
                      Create account
                    </button>
                  </div>

                  <form onSubmit={onSubmit} className="space-y-3 sm:space-y-4">
                    {mode === "sign-up" && (
                      <div>
                        <label
                          htmlFor="auth-name"
                          className="mb-1.5 block text-[13px] font-medium text-[#64748B]"
                        >
                          Full name
                        </label>
                        <div className="relative">
                          <User
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                            aria-hidden
                          />
                          <input
                            id="auth-name"
                            className="w-full rounded-xl border border-[#E2E8F0] bg-white py-2 pl-10 pr-3 text-sm text-[#0F172A] placeholder:text-slate-400 transition focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoComplete="name"
                            placeholder="Abed Aarabi"
                            required
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="auth-email"
                        className="mb-1.5 block text-[13px] font-medium text-[#64748B]"
                      >
                        {mode === "sign-up" ? "Work email" : "Email"}
                      </label>
                      <div className="relative">
                        <Mail
                          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                          aria-hidden
                        />
                        <input
                          id="auth-email"
                          type="email"
                          required
                          className="w-full rounded-xl border border-[#E2E8F0] bg-white py-2 pl-10 pr-3 text-sm text-[#0F172A] placeholder:text-slate-400 transition focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          autoComplete="email"
                          placeholder="you@company.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="auth-password"
                        className="mb-1.5 block text-[13px] font-medium text-[#64748B]"
                      >
                        Password
                      </label>
                      <div className="relative">
                        <Lock
                          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                          aria-hidden
                        />
                        <input
                          id="auth-password"
                          type="password"
                          required
                          minLength={8}
                          className="w-full rounded-xl border border-[#E2E8F0] bg-white py-2 pl-10 pr-3 text-sm text-[#0F172A] placeholder:text-slate-400 transition focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                          placeholder="••••••••••••"
                        />
                      </div>
                    </div>

                    {mode === "sign-in" ? (
                      <div className="-mt-1 text-right">
                        <Link
                          href="/forgot-password"
                          className="text-[13px] font-medium text-[#2563EB] hover:underline"
                        >
                          Forgot password?
                        </Link>
                      </div>
                    ) : null}

                    {error && (
                      <div
                        className="flex gap-2 rounded-xl border border-red-200 bg-red-50/90 px-3 py-2.5 text-sm text-red-800"
                        role="alert"
                      >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
                        <span>{error}</span>
                      </div>
                    )}
                    {unverifiedEmail ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                        <p>
                          Your account is not verified yet. Check your inbox for{" "}
                          <span className="font-medium">{unverifiedEmail}</span>.
                        </p>
                        <Link
                          href={`/verify-email?email=${encodeURIComponent(unverifiedEmail)}&next=${encodeURIComponent(`/onboarding?next=${encodeURIComponent(next)}`)}`}
                          className="mt-2 inline-flex font-semibold text-amber-900 underline underline-offset-2"
                        >
                          Open verification page
                        </Link>
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={loading}
                      className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition hover:bg-[#1d4ed8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/50 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          Please wait…
                        </>
                      ) : (
                        <>
                          {mode === "sign-in" ? "Sign in" : "Start Free Trial"}
                          <ArrowRight
                            className="h-4 w-4 transition group-hover:translate-x-0.5"
                            aria-hidden
                          />
                        </>
                      )}
                    </button>
                  </form>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center" aria-hidden>
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white px-2 text-[#64748B]">Or continue with</span>
                    </div>
                  </div>

                  <SocialAuthButtons callbackURL={next} onError={setError} />
                </div>
              </div>

              <p className="mt-3 text-center text-xs text-slate-500 sm:text-sm">
                {mode === "sign-up" ? (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setMode("sign-in");
                      }}
                      className="font-medium text-[#64748B] underline underline-offset-2 hover:text-white"
                    >
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    New to PlanSync?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setMode("sign-up");
                      }}
                      className="font-medium text-[#64748B] underline underline-offset-2 hover:text-white"
                    >
                      Start free trial
                    </button>
                  </>
                )}
              </p>

              <nav className="mt-2 flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 pb-1 text-center text-xs text-slate-500 sm:text-sm">
                <Link href="/" className="transition hover:text-slate-300">
                  ← Home
                </Link>
                <span className="text-slate-600" aria-hidden>
                  ·
                </span>
                <Link href="/viewer" className="transition hover:text-slate-300">
                  Free local viewer
                </Link>
                <span className="text-slate-600" aria-hidden>
                  ·
                </span>
                <Link href="/dashboard" className="transition hover:text-slate-300">
                  Dashboard
                </Link>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
