"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { z } from "zod";
import {
  AuthFormAlert,
  AuthSubmitButton,
  AUTH_FIELD_ICON,
  AUTH_FIELD_INPUT,
} from "@/components/auth/authFormChrome";
import { EnterpriseForm } from "@/components/enterprise/forms/EnterpriseForm";
import { EnterpriseFormField } from "@/components/enterprise/forms/EnterpriseFormField";
import { EnterpriseInput } from "@/components/enterprise/forms/EnterpriseInputs";
import { useEnterpriseForm } from "@/components/enterprise/forms/useEnterpriseForm";
import { EnterpriseAuthLayout } from "@/components/auth/EnterpriseAuthLayout";
import { authClient } from "@/lib/auth-client";

const forgotSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .email("Enter a valid email address."),
});

type ForgotValues = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const form = useEnterpriseForm(forgotSchema, { email: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  async function onSubmit({ email }: ForgotValues) {
    setError(null);
    setLoading(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error: err } = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: `${origin}/reset-password`,
      });
      if (err) setError(err.message ?? "Could not send reset email.");
      else {
        setSentEmail(email.trim());
        setSent(true);
      }
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
          <p className="enterprise-type-body text-[#64748B]">
            If an account exists for <strong className="text-[#0F172A]">{sentEmail}</strong>, you’ll
            get an email with a reset link shortly. Check your spam folder if nothing arrives.
          </p>
          <Link
            href="/sign-in"
            className="enterprise-type-nav inline-flex items-center justify-center gap-2 text-[#2563EB] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to sign in
          </Link>
        </div>
      ) : (
        <EnterpriseForm form={form} onSubmit={onSubmit} className="space-y-5">
          <EnterpriseFormField<ForgotValues> name="email" label="Email" required>
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
                  className={AUTH_FIELD_INPUT}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  placeholder="you@company.com"
                />
              </div>
            )}
          </EnterpriseFormField>

          {error && <AuthFormAlert>{error}</AuthFormAlert>}

          <AuthSubmitButton loading={loading} loadingLabel="Sending…" label="Send reset link" />

          <p className="text-center text-sm">
            <Link href="/sign-in" className="font-medium text-[#2563EB] hover:underline">
              ← Back to sign in
            </Link>
          </p>
        </EnterpriseForm>
      )}
    </EnterpriseAuthLayout>
  );
}
