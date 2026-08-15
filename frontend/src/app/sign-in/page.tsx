"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, Lock, Mail, User } from "lucide-react";
import { z } from "zod";
import { BrandStoryPanel, MarketingHeroBackdrop } from "@/components/BrandStoryPanel";
import {
  AuthFormAlert,
  AUTH_FIELD_ICON,
  AUTH_FIELD_INPUT,
  AUTH_PASSWORD_INPUT,
} from "@/components/auth/authFormChrome";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import { EnterpriseForm } from "@/components/enterprise/forms/EnterpriseForm";
import { EnterpriseFormField } from "@/components/enterprise/forms/EnterpriseFormField";
import {
  EnterpriseInput,
  EnterprisePasswordInput,
} from "@/components/enterprise/forms/EnterpriseInputs";
import { useEnterpriseForm } from "@/components/enterprise/forms/useEnterpriseForm";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import { authClient } from "@/lib/auth-client";
import { workspaceGateUrl } from "@/lib/workspacePreference";

function createAuthSchema(mode: "sign-in" | "sign-up") {
  return z.object({
    email: z
      .string()
      .trim()
      .min(1, "Enter your email address.")
      .email("Enter a valid email address."),
    name: mode === "sign-up" ? z.string().trim().min(1, "Enter your full name.") : z.string(),
    password: z
      .string()
      .min(1, "Enter your password.")
      .min(8, "Password must be at least 8 characters."),
  });
}

type AuthValues = z.infer<ReturnType<typeof createAuthSchema>>;

export default function SignInPage() {
  const router = useRouter();
  const [next, setNext] = useState("/dashboard");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const q = sp.get("next");
    if (q?.startsWith("/")) setNext(q);
    if (sp.get("mode") === "sign-up") setMode("sign-up");
  }, []);
  // Schema follows the visible fields so empty submit marks every required input.
  const authSchema = useMemo(() => createAuthSchema(mode), [mode]);
  const form = useEnterpriseForm(authSchema, { email: "", name: "", password: "" });
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

  async function onSubmit({ email, name, password }: AuthValues) {
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
            setError("Signed in, but your session was not saved yet. Please try again.");
            return;
          }
          if (session.emailVerified === false) {
            await authClient.signOut();
            setUnverifiedEmail(email);
            setError("Please verify your email before signing in.");
            return;
          }
          // Full navigation after session is confirmed — workspace gate picks org when needed.
          const nextPath = next.startsWith("/") ? next : `/${next}`;
          window.location.assign(workspaceGateUrl(nextPath));
        }
      }
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] w-full flex-1 flex-col overflow-hidden font-[family-name:var(--font-inter)] lg:grid lg:h-[100dvh] lg:max-h-[100dvh] lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-1">
      <div className="hidden min-h-0 lg:block lg:h-full">
        <BrandStoryPanel backHref="/" backLabel="← Back to site" />
      </div>

      <div className="relative flex min-h-[100dvh] flex-1 flex-col bg-[var(--enterprise-auth-bg)] lg:h-full lg:min-h-0">
        <MarketingHeroBackdrop showImageOnLarge={false} />

        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pt-[env(safe-area-inset-top,0px)]">
          <div className="shrink-0 border-b border-white/10 px-4 py-3 lg:hidden">
            <Link
              href="/"
              className="mx-auto flex w-fit max-w-full items-center justify-center gap-2.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2"
            >
              <Image
                src="/logo.svg"
                alt="PlanSync"
                width={28}
                height={28}
                className="h-7 w-7 shrink-0"
                priority
                unoptimized
              />
              <span className="text-sm font-semibold tracking-tight text-white">PlanSync</span>
            </Link>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center px-4 py-6 sm:px-6 sm:py-10">
            <div className="my-auto w-full max-w-[400px]">
              <div className="mb-6 flex flex-col items-center text-center">
                <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                  {mode === "sign-in" ? "Sign in to PlanSync" : "Create your workspace"}
                </h1>
                {mode === "sign-up" ? (
                  <p className="mt-2 text-sm text-slate-400">
                    14-day Pro trial · No credit card required
                  </p>
                ) : (
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
                    Access projects, drawings, and field workflows.
                  </p>
                )}
              </div>

              <div className="enterprise-auth-card">
                <div className="space-y-4">
                  <div
                    className="flex rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)] p-0.5"
                    role="tablist"
                    aria-label="Authentication mode"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === "sign-in"}
                      onClick={() => {
                        setError(null);
                        form.clearErrors();
                        setMode("sign-in");
                      }}
                      className={`relative min-h-10 flex-1 rounded-[5px] py-2 text-sm font-semibold transition ${
                        mode === "sign-in"
                          ? "bg-white text-[var(--enterprise-text)]"
                          : "text-[var(--enterprise-text-muted)] hover:text-[var(--enterprise-text)]"
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
                        form.clearErrors();
                        setMode("sign-up");
                      }}
                      className={`relative min-h-10 flex-1 rounded-[5px] py-2 text-sm font-semibold transition ${
                        mode === "sign-up"
                          ? "bg-white text-[var(--enterprise-text)]"
                          : "text-[var(--enterprise-text-muted)] hover:text-[var(--enterprise-text)]"
                      }`}
                    >
                      Create account
                    </button>
                  </div>

                  <EnterpriseForm form={form} onSubmit={onSubmit} className="space-y-3.5">
                    {mode === "sign-up" && (
                      <EnterpriseFormField<AuthValues> name="name" label="Full name" required>
                        {({ describedBy, field, id, invalid }) => (
                          <div className="relative">
                            <User className={AUTH_FIELD_ICON} aria-hidden />
                            <EnterpriseInput
                              {...field}
                              id={id}
                              className={AUTH_FIELD_INPUT}
                              aria-describedby={describedBy}
                              aria-invalid={invalid}
                              autoComplete="name"
                              placeholder="Abed Aarabi"
                            />
                          </div>
                        )}
                      </EnterpriseFormField>
                    )}

                    <EnterpriseFormField<AuthValues>
                      name="email"
                      label={mode === "sign-up" ? "Work email" : "Email"}
                      required
                    >
                      {({ describedBy, field, id, invalid }) => (
                        <div className="relative">
                          <Mail className={AUTH_FIELD_ICON} aria-hidden />
                          <EnterpriseInput
                            {...field}
                            id={id}
                            type="text"
                            inputMode="email"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            className={AUTH_FIELD_INPUT}
                            aria-describedby={describedBy}
                            aria-invalid={invalid}
                            autoComplete="email"
                            placeholder="you@company.com"
                          />
                        </div>
                      )}
                    </EnterpriseFormField>

                    <EnterpriseFormField<AuthValues> name="password" label="Password" required>
                      {({ describedBy, field, id, invalid }) => (
                        <div className="relative">
                          <Lock className={AUTH_FIELD_ICON} aria-hidden />
                          <EnterprisePasswordInput
                            {...field}
                            id={id}
                            className={AUTH_PASSWORD_INPUT}
                            aria-describedby={describedBy}
                            aria-invalid={invalid}
                            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                            placeholder="••••••••••••"
                          />
                        </div>
                      )}
                    </EnterpriseFormField>

                    {mode === "sign-in" ? (
                      <div className="-mt-1 text-right">
                        <Link
                          href="/forgot-password"
                          className="text-sm font-medium text-[var(--enterprise-primary)] hover:underline"
                        >
                          Forgot password?
                        </Link>
                      </div>
                    ) : null}

                    {error && <AuthFormAlert>{error}</AuthFormAlert>}
                    {unverifiedEmail ? (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
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

                    <EnterpriseButton
                      type="submit"
                      disabled={loading}
                      variant="primary"
                      fullWidth
                      loading={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          Please wait…
                        </>
                      ) : (
                        <>
                          {mode === "sign-in" ? "Sign in" : "Start free trial"}
                          <ArrowRight
                            className="h-4 w-4 transition group-hover:translate-x-0.5"
                            aria-hidden
                          />
                        </>
                      )}
                    </EnterpriseButton>
                  </EnterpriseForm>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center" aria-hidden>
                      <div className="w-full border-t border-[var(--enterprise-border)]" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white px-2 text-[var(--enterprise-text-muted)]">
                        Or continue with
                      </span>
                    </div>
                  </div>

                  <SocialAuthButtons
                    callbackURL={workspaceGateUrl(next.startsWith("/") ? next : `/${next}`)}
                    onError={setError}
                  />
                </div>
              </div>

              <p className="mt-5 text-center text-sm text-slate-500">
                {mode === "sign-up" ? (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setMode("sign-in");
                      }}
                      className="font-medium text-slate-300 underline underline-offset-2 hover:text-white"
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
                      className="font-medium text-slate-300 underline underline-offset-2 hover:text-white"
                    >
                      Start free trial
                    </button>
                  </>
                )}
              </p>

              <nav className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 pb-[env(safe-area-inset-bottom,0px)] text-center text-sm text-slate-500">
                <Link href="/" className="transition hover:text-slate-300">
                  ← Home
                </Link>
                <span className="text-slate-600" aria-hidden>
                  ·
                </span>
                <Link href="/viewer" className="transition hover:text-slate-300">
                  Free local viewer
                </Link>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
