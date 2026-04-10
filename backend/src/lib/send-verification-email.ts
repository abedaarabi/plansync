import { Resend } from "resend";
import type { Env } from "./env.js";
import { buildTransactionalEmailHtml } from "./transactionalEmailLayout.js";

/**
 * Sends the Better Auth email-verification link. Same delivery path as password reset (Resend).
 * Non-blocking in the auth handler to reduce timing leaks.
 */
export function queueVerificationEmail(
  env: Env,
  params: { to: string; displayName: string | null | undefined; verifyUrl: string },
): void {
  void (async () => {
    const { to, displayName, verifyUrl } = params;
    const subject = "Verify your PlanSync email";
    const greetingText = displayName?.trim() ? `Hi ${displayName.trim()},` : "Hi,";
    const text = `${greetingText}\n\nConfirm your email to finish setting up your account:\n${verifyUrl}\n\nIf you did not create a PlanSync account, you can ignore this email.\n`;
    const greet =
      displayName?.trim() != null && displayName.trim() !== ""
        ? `Hi ${displayName.trim()},`
        : "Hi,";
    const html = buildTransactionalEmailHtml(env, {
      eyebrow: "Account",
      title: "Verify your email",
      bodyLines: [
        greet,
        "Thanks for signing up for PlanSync. Confirm your email address to activate your account and continue to your workspace setup.",
        "This link expires in one hour. If you did not create an account, you can safely ignore this message.",
      ],
      primaryAction: { url: verifyUrl, label: "Verify email" },
      fallbackUrl: verifyUrl,
      footerNote:
        "If you didn't sign up for PlanSync, someone may have mistyped your address — you can ignore this email.",
    });

    const key = env.RESEND_API_KEY?.trim();
    const from = env.RESEND_FROM?.trim();
    if (key && from) {
      const resend = new Resend(key);
      const { error } = await resend.emails.send({ from, to, subject, text, html });
      if (error) console.error("[verification-email] Resend failed", error);
      return;
    }

    if (env.NODE_ENV !== "production") {
      console.info("[verification-email] RESEND not configured; verification link:\n", verifyUrl);
      return;
    }

    console.error(
      "[verification-email] RESEND_API_KEY and RESEND_FROM must be set in production to send verification emails.",
    );
  })();
}
