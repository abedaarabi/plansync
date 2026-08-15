"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Lock } from "lucide-react";
import { z } from "zod";
import {
  AuthFormAlert,
  AuthSubmitButton,
  AUTH_FIELD_ICON,
  AUTH_PASSWORD_INPUT,
} from "@/components/auth/authFormChrome";
import { EnterpriseForm } from "@/components/enterprise/forms/EnterpriseForm";
import { EnterpriseFormField } from "@/components/enterprise/forms/EnterpriseFormField";
import { EnterprisePasswordInput } from "@/components/enterprise/forms/EnterpriseInputs";
import { useEnterpriseForm } from "@/components/enterprise/forms/useEnterpriseForm";
import { EnterpriseAuthLayout } from "@/components/auth/EnterpriseAuthLayout";
import { AUTH_PASSWORD_HINT, strongAuthPasswordSchema } from "@/lib/auth-password";
import { authClient } from "@/lib/auth-client";

const resetSchema = z
  .object({
    confirm: z.string().min(1, "Confirm your password."),
    password: strongAuthPasswordSchema,
  })
  .refine((values) => values.password === values.confirm, {
    message: "Passwords do not match.",
    path: ["confirm"],
  });

type ResetValues = z.infer<typeof resetSchema>;

export function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const qpError = searchParams.get("error");

  const form = useEnterpriseForm(resetSchema, { confirm: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit({ password }: ResetValues) {
    setError(null);
    const t = token?.trim() ?? "";
    if (!t) {
      setError("This reset link is missing a token. Request a new link from the sign-in page.");
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
      description={`${AUTH_PASSWORD_HINT} You’ll be signed out of other devices for security.`}
    >
      <EnterpriseForm form={form} onSubmit={onSubmit} className="space-y-5">
        <EnterpriseFormField<ResetValues> name="password" label="New password" required>
          {({ describedBy, field, id, invalid }) => (
            <div className="relative">
              <Lock className={AUTH_FIELD_ICON} aria-hidden />
              <EnterprisePasswordInput
                {...field}
                id={id}
                className={AUTH_PASSWORD_INPUT}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                autoComplete="new-password"
                placeholder="At least 10 characters"
              />
            </div>
          )}
        </EnterpriseFormField>

        <EnterpriseFormField<ResetValues> name="confirm" label="Confirm password" required>
          {({ describedBy, field, id, invalid }) => (
            <div className="relative">
              <Lock className={AUTH_FIELD_ICON} aria-hidden />
              <EnterprisePasswordInput
                {...field}
                id={id}
                className={AUTH_PASSWORD_INPUT}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                autoComplete="new-password"
                placeholder="••••••••••••"
              />
            </div>
          )}
        </EnterpriseFormField>

        {error && <AuthFormAlert>{error}</AuthFormAlert>}

        <AuthSubmitButton loading={loading} loadingLabel="Updating…" label="Update password" />
      </EnterpriseForm>
    </EnterpriseAuthLayout>
  );
}
