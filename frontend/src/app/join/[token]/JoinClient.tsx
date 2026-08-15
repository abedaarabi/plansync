"use client";

import { apiUrl } from "@/lib/api-url";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Mail, User } from "lucide-react";
import { z } from "zod";
import { EnterpriseButton } from "@/components/enterprise/EnterpriseButton";
import {
  AuthFormAlert,
  AuthSubmitButton,
  AUTH_FIELD_ICON,
  AUTH_FIELD_INPUT,
  AUTH_PASSWORD_INPUT,
} from "@/components/auth/authFormChrome";
import { EnterpriseForm } from "@/components/enterprise/forms/EnterpriseForm";
import { EnterpriseFormField } from "@/components/enterprise/forms/EnterpriseFormField";
import {
  EnterpriseInput,
  EnterprisePasswordInput,
} from "@/components/enterprise/forms/EnterpriseInputs";
import { useEnterpriseForm } from "@/components/enterprise/forms/useEnterpriseForm";
import { acceptInviteAndEnterWorkspace } from "@/lib/acceptInviteAndEnterWorkspace";
import { AUTH_PASSWORD_HINT, strongAuthPasswordSchema } from "@/lib/auth-password";
import { authClient } from "@/lib/auth-client";

type InvitePreview =
  | { valid: false; reason: "invalid" | "expired" }
  | {
      valid: true;
      workspace: {
        name: string;
        slug: string;
        logoUrl?: string | null;
        description?: string | null;
        website?: string | null;
      };
    };

function createJoinSchema(mode: "sign-up" | "sign-in") {
  return z
    .object({
      name: mode === "sign-up" ? z.string().trim().min(2, "Enter your full name.") : z.string(),
      email: z
        .string()
        .trim()
        .min(1, "Enter your email address.")
        .email("Enter a valid email address."),
      password:
        mode === "sign-up" ? strongAuthPasswordSchema : z.string().min(1, "Enter your password."),
      confirmPassword:
        mode === "sign-up" ? z.string().min(1, "Confirm your password.") : z.string(),
    })
    .superRefine((values, context) => {
      if (mode === "sign-up" && values.password !== values.confirmPassword) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Passwords do not match.",
          path: ["confirmPassword"],
        });
      }
    });
}

type JoinValues = z.infer<ReturnType<typeof createJoinSchema>>;

export function JoinClient({ token }: { token: string }) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [joining, setJoining] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"sign-up" | "sign-in">("sign-up");
  const form = useEnterpriseForm(createJoinSchema(mode), {
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    void (async () => {
      setLoadingPreview(true);
      try {
        const res = await fetch(apiUrl(`/api/v1/invites/${encodeURIComponent(token)}`), {
          cache: "no-store",
        });
        const data = (await res.json()) as InvitePreview;
        setPreview(data);
      } catch {
        setPreview({ valid: false, reason: "invalid" });
      } finally {
        setLoadingPreview(false);
      }
    })();
  }, [token]);

  const acceptAndGo = useCallback(async () => {
    const result = await acceptInviteAndEnterWorkspace(
      `/api/v1/invites/${encodeURIComponent(token)}/accept`,
      router,
    );
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, [router, token]);

  const onJoin = useCallback(async () => {
    setError(null);
    setJoining(true);
    try {
      await acceptAndGo();
    } finally {
      setJoining(false);
    }
  }, [acceptAndGo]);

  async function onAuthSubmit({ email, name, password }: JoinValues) {
    setError(null);
    setAuthLoading(true);
    try {
      if (mode === "sign-up") {
        const displayName = name.trim() || email.split("@")[0] || "User";
        const { error: err } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: displayName,
        });
        if (err) {
          setError(err.message ?? "Could not create account.");
          return;
        }
      } else {
        const { error: err } = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (err) {
          setError(err.message ?? "Sign in failed.");
          return;
        }
      }
      await acceptAndGo();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Something went wrong.");
    } finally {
      setAuthLoading(false);
    }
  }

  useEffect(() => {
    setError(null);
    form.clearErrors();
  }, [form, mode]);

  useEffect(() => {
    form.setValue("confirmPassword", "");
  }, [form, mode]);

  if (loadingPreview || sessionPending) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-slate-600">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        Loading invite…
      </div>
    );
  }

  if (!preview || !preview.valid) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Invite not available</h1>
        <p className="mt-2 text-sm text-slate-600">
          {preview?.reason === "expired"
            ? "This invite link has expired. Ask your admin for a new link."
            : "This link is invalid or was revoked."}
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm font-medium text-blue-600 hover:underline"
        >
          Back to home
        </Link>
      </div>
    );
  }

  const ws = preview.workspace;

  return (
    <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex flex-col items-center text-center">
        {ws.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ws.logoUrl}
            alt=""
            className="mb-4 h-16 w-16 rounded-xl border border-slate-200 bg-white object-contain p-2 ring-1 ring-black/5"
          />
        ) : (
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100 text-lg font-bold text-slate-700">
            {ws.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <h1 className="text-xl font-semibold text-slate-900">Join {ws.name}</h1>
        {ws.description ? <p className="mt-2 text-sm text-slate-600">{ws.description}</p> : null}
        {ws.website ? (
          <a
            href={ws.website}
            target="_blank"
            rel="noreferrer"
            className="mt-1 text-sm text-blue-600 hover:underline"
          >
            {ws.website.replace(/^https?:\/\//, "")}
          </a>
        ) : null}
      </div>

      <div className="mt-8">
        {session?.user ? (
          <div className="space-y-3">
            <p className="text-center text-sm text-slate-600">
              Signed in as <span className="font-medium text-slate-900">{session.user.email}</span>
            </p>
            {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
            <button
              type="button"
              onClick={() => void onJoin()}
              disabled={joining}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Join workspace
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div
              className="flex rounded-xl bg-slate-100/90 p-1 ring-1 ring-slate-200/80"
              role="tablist"
              aria-label="Account"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "sign-up"}
                onClick={() => setMode("sign-up")}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                  mode === "sign-up" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                }`}
              >
                New account
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "sign-in"}
                onClick={() => setMode("sign-in")}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                  mode === "sign-in" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                }`}
              >
                I have an account
              </button>
            </div>

            <p className="text-center text-sm text-slate-600">
              {mode === "sign-up"
                ? "Enter your name and choose a password to create your account, then you’ll join this workspace."
                : "Sign in with your PlanSync account, then join the workspace."}
            </p>

            <EnterpriseForm form={form} onSubmit={onAuthSubmit} className="space-y-4">
              {mode === "sign-up" ? (
                <EnterpriseFormField<JoinValues> name="name" label="Your name" required>
                  {({ describedBy, field, id, invalid }) => (
                    <div className="relative">
                      <User className={AUTH_FIELD_ICON} aria-hidden />
                      <EnterpriseInput
                        {...field}
                        id={id}
                        autoComplete="name"
                        placeholder="Jane Doe"
                        className={AUTH_FIELD_INPUT}
                        aria-describedby={describedBy}
                        aria-invalid={invalid}
                      />
                    </div>
                  )}
                </EnterpriseFormField>
              ) : null}

              <EnterpriseFormField<JoinValues> name="email" label="Email" required>
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
                      autoComplete="email"
                      placeholder="you@company.com"
                      className={AUTH_FIELD_INPUT}
                      aria-describedby={describedBy}
                      aria-invalid={invalid}
                    />
                  </div>
                )}
              </EnterpriseFormField>

              <EnterpriseFormField<JoinValues> name="password" label="Password" required>
                {({ describedBy, field, id, invalid }) => (
                  <div className="relative">
                    <Lock className={AUTH_FIELD_ICON} aria-hidden />
                    <EnterprisePasswordInput
                      {...field}
                      id={id}
                      autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                      placeholder={mode === "sign-up" ? "At least 10 characters" : "Your password"}
                      className={AUTH_PASSWORD_INPUT}
                      aria-describedby={describedBy}
                      aria-invalid={invalid}
                    />
                  </div>
                )}
              </EnterpriseFormField>
              {mode === "sign-up" ? (
                <p className="-mt-2 text-left text-xs text-slate-500">{AUTH_PASSWORD_HINT}</p>
              ) : null}

              {mode === "sign-up" ? (
                <EnterpriseFormField<JoinValues>
                  name="confirmPassword"
                  label="Confirm password"
                  required
                >
                  {({ describedBy, field, id, invalid }) => (
                    <div className="relative">
                      <Lock className={AUTH_FIELD_ICON} aria-hidden />
                      <EnterprisePasswordInput
                        {...field}
                        id={id}
                        autoComplete="new-password"
                        placeholder="Re-enter password"
                        className={AUTH_PASSWORD_INPUT}
                        aria-describedby={describedBy}
                        aria-invalid={invalid}
                      />
                    </div>
                  )}
                </EnterpriseFormField>
              ) : null}

              {error ? <AuthFormAlert>{error}</AuthFormAlert> : null}

              <AuthSubmitButton
                loading={authLoading}
                loadingLabel={mode === "sign-up" ? "Create account & join" : "Sign in & join"}
                label={mode === "sign-up" ? "Create account & join" : "Sign in & join"}
              />
            </EnterpriseForm>

            <p className="text-center text-xs text-slate-500">
              <Link
                href={`/sign-in?next=${encodeURIComponent(`/join/${token}`)}`}
                className="text-blue-600 hover:underline"
              >
                Sign in with Google
              </Link>
              {" · "}
              <Link href="/" className="text-slate-600 hover:underline">
                Home
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
