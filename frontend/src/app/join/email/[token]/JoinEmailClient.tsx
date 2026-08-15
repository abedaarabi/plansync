"use client";

import { apiUrl } from "@/lib/api-url";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageIcon, Loader2, Lock, Mail, User } from "lucide-react";
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

type EmailInvitePreview =
  | { valid: false; reason: "invalid" | "expired" | "used" }
  | {
      valid: true;
      kind: "email";
      inviteEmail: string;
      role: string;
      workspace: {
        name: string;
        slug: string;
        logoUrl?: string | null;
        description?: string | null;
        website?: string | null;
      };
      inviter: { name: string; image?: string | null; email: string };
      projects: { id: string; name: string }[];
    };

function createEmailJoinSchema(mode: "sign-up" | "sign-in") {
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
      avatarUrl: z.string().trim(),
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

type EmailJoinValues = z.infer<ReturnType<typeof createEmailJoinSchema>>;

export function JoinEmailClient({ token }: { token: string }) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [preview, setPreview] = useState<EmailInvitePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [joining, setJoining] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"sign-up" | "sign-in">("sign-up");
  const form = useEnterpriseForm(createEmailJoinSchema(mode), {
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    avatarUrl: "",
  });

  useEffect(() => {
    void (async () => {
      setLoadingPreview(true);
      try {
        const res = await fetch(apiUrl(`/api/v1/email-invites/${encodeURIComponent(token)}`), {
          cache: "no-store",
        });
        const data = (await res.json()) as EmailInvitePreview;
        setPreview(data);
        if (data.valid) {
          form.setValue("email", data.inviteEmail);
        }
      } catch {
        setPreview({ valid: false, reason: "invalid" });
      } finally {
        setLoadingPreview(false);
      }
    })();
  }, [form, token]);

  const acceptAndGo = useCallback(async () => {
    const result = await acceptInviteAndEnterWorkspace(
      `/api/v1/email-invites/${encodeURIComponent(token)}/accept`,
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

  async function onAuthSubmit({ avatarUrl, email, name, password }: EmailJoinValues) {
    setError(null);
    setAuthLoading(true);
    try {
      if (!preview || !preview.valid) return;
      const mustEmail = preview.inviteEmail.toLowerCase().trim();
      if (email.trim().toLowerCase() !== mustEmail) {
        setError(`Use the invited email: ${preview.inviteEmail}`);
        return;
      }
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
        if (avatarUrl.trim()) {
          await authClient.updateUser({
            image: avatarUrl.trim(),
          });
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
            ? "This invite has expired. Ask your admin for a new one."
            : preview?.reason === "used"
              ? "This invite was already accepted."
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
  const inv = preview.inviter;
  const inviteEmailNorm = preview.inviteEmail.toLowerCase().trim();
  const sessionEmailNorm = session?.user?.email?.toLowerCase().trim() ?? "";
  const sessionMatchesInvite = Boolean(session?.user && sessionEmailNorm === inviteEmailNorm);

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
        <div className="mt-4 flex items-center justify-center gap-3">
          {inv.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={inv.image}
              alt=""
              className="h-10 w-10 rounded-full border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-800">
              {inv.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <p className="text-left text-sm text-slate-600">
            <span className="font-medium text-slate-900">{inv.name}</span>
            <br />
            invited you
            {preview.projects.length > 0 ? (
              <>
                {" "}
                to{" "}
                <span className="font-medium text-slate-800">
                  {preview.projects.map((p) => p.name).join(", ")}
                </span>
              </>
            ) : null}
          </p>
        </div>
        {ws.description ? <p className="mt-3 text-sm text-slate-600">{ws.description}</p> : null}
      </div>

      <div className="mt-8">
        {session?.user && !sessionMatchesInvite ? (
          <div className="space-y-4">
            <p className="text-center text-sm text-slate-600">
              This invite is for{" "}
              <span className="font-medium text-slate-900">{preview.inviteEmail}</span>. You’re
              signed in as <span className="font-medium text-slate-900">{session.user.email}</span>.
              Sign out to create an account or sign in with the invited address.
            </p>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  await authClient.signOut();
                  router.refresh();
                })();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        ) : session?.user ? (
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
              Accept invitation
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
                : "Sign in with the email address you were invited with, then accept the invitation."}
            </p>

            <EnterpriseForm form={form} onSubmit={onAuthSubmit} className="space-y-4">
              {mode === "sign-up" ? (
                <EnterpriseFormField<EmailJoinValues> name="name" label="Your name" required>
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

              <EnterpriseFormField<EmailJoinValues>
                name="email"
                label="Email (invited address)"
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
                      autoComplete="email"
                      readOnly
                      placeholder="you@company.com"
                      className={`${AUTH_FIELD_INPUT} bg-slate-50 read-only:cursor-not-allowed`}
                      aria-describedby={describedBy}
                      aria-invalid={invalid}
                    />
                  </div>
                )}
              </EnterpriseFormField>

              <EnterpriseFormField<EmailJoinValues> name="password" label="Password" required>
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
                <>
                  <p className="-mt-1.5 text-xs text-slate-500">{AUTH_PASSWORD_HINT}</p>
                  <EnterpriseFormField<EmailJoinValues>
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
                </>
              ) : null}

              {mode === "sign-up" ? (
                <EnterpriseFormField<EmailJoinValues>
                  name="avatarUrl"
                  label="Profile image URL (optional)"
                >
                  {({ describedBy, field, id, invalid }) => (
                    <div className="relative">
                      <ImageIcon className={AUTH_FIELD_ICON} aria-hidden />
                      <EnterpriseInput
                        {...field}
                        id={id}
                        type="url"
                        inputMode="url"
                        placeholder="https://…"
                        className={AUTH_FIELD_INPUT}
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
                loadingLabel={mode === "sign-up" ? "Create account & accept" : "Sign in & accept"}
                label={mode === "sign-up" ? "Create account & accept" : "Sign in & accept"}
              />
            </EnterpriseForm>

            <p className="text-center text-xs text-slate-500">
              <Link
                href={`/sign-in?next=${encodeURIComponent(`/join/email/${token}`)}`}
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
