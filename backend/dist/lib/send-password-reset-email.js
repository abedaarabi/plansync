import { Resend } from "resend";
function escapeHtml(s) {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
/**
 * Sends the Better Auth password-reset link. In development without Resend, logs the URL.
 * Per Better Auth docs, avoid blocking the auth handler on email delivery (timing attacks).
 */
export function queuePasswordResetEmail(env, params) {
    void (async () => {
        const { to, displayName, resetUrl } = params;
        const subject = "Reset your PlanSync password";
        const greetingText = displayName?.trim() ? `Hi ${displayName.trim()},` : "Hi,";
        const text = `${greetingText}\n\nReset your password (link expires in one hour):\n${resetUrl}\n\nIf you did not request this, you can ignore this email.\n`;
        const greetingHtml = displayName?.trim() != null && displayName.trim() !== ""
            ? `Hi ${escapeHtml(displayName.trim())},`
            : "Hi,";
        const href = resetUrl.replace(/"/g, "%22");
        const html = `<p>${greetingHtml}</p><p><a href="${href}">Reset your password</a></p><p>This link expires in one hour. If you did not request a reset, you can ignore this email.</p>`;
        const key = env.RESEND_API_KEY?.trim();
        const from = env.RESEND_FROM?.trim();
        if (key && from) {
            const resend = new Resend(key);
            const { error } = await resend.emails.send({ from, to, subject, text, html });
            if (error)
                console.error("[password-reset] Resend failed", error);
            return;
        }
        if (env.NODE_ENV !== "production") {
            console.info("[password-reset] RESEND not configured; reset link:\n", resetUrl);
            return;
        }
        console.error("[password-reset] RESEND_API_KEY and RESEND_FROM must be set in production to send reset emails.");
    })();
}
