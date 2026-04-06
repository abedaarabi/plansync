import { Resend } from "resend";
import type { Env } from "./env.js";
import { buildTransactionalEmailHtml } from "./transactionalEmailLayout.js";

/**
 * Sends the Better Auth password-reset link. In development without Resend, logs the URL.
 * Per Better Auth docs, avoid blocking the auth handler on email delivery (timing attacks).
 */
export function queuePasswordResetEmail(
  env: Env,
  params: { to: string; displayName: string | null | undefined; resetUrl: string },
): void {
  void (async () => {
    const { to, displayName, resetUrl } = params;
    const subject = "Reset your PlanSync password";
    const greetingText = displayName?.trim() ? `Hi ${displayName.trim()},` : "Hi,";
    const text = `${greetingText}\n\nReset your password (link expires in one hour):\n${resetUrl}\n\nIf you did not request this, you can ignore this email.\n`;
    const greet =
      displayName?.trim() != null && displayName.trim() !== ""
        ? `Hi ${displayName.trim()},`
        : "Hi,";
    const html = buildTransactionalEmailHtml(env, {
      eyebrow: "Security",
      title: "Reset your password",
      bodyLines: [
        greet,
        "We received a request to reset your PlanSync password. Use the button below to choose a new password.",
        "This link expires in one hour. If you did not request a reset, you can safely ignore this email.",
      ],
      primaryAction: { url: resetUrl, label: "Reset password" },
      fallbackUrl: resetUrl,
      footerNote:
        "If you didn't request a password reset, someone may have entered your email by mistake — you can ignore this message.",
    });

    const key = env.RESEND_API_KEY?.trim();
    const from = env.RESEND_FROM?.trim();
    if (key && from) {
      const resend = new Resend(key);
      const { error } = await resend.emails.send({ from, to, subject, text, html });
      if (error) console.error("[password-reset] Resend failed", error);
      return;
    }

    if (env.NODE_ENV !== "production") {
      console.info("[password-reset] RESEND not configured; reset link:\n", resetUrl);
      return;
    }

    console.error(
      "[password-reset] RESEND_API_KEY and RESEND_FROM must be set in production to send reset emails.",
    );
  })();
}
