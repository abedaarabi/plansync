import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "./env.js";

const resendSend = vi.hoisted(() => vi.fn());
const Resend = vi.hoisted(() =>
  vi.fn().mockImplementation(() => ({
    emails: { send: resendSend },
  })),
);

vi.mock("resend", () => ({ Resend }));

import { queuePasswordResetEmail } from "./send-password-reset-email.js";

const resetUrl =
  "https://api.plansync.dev/api/auth/reset-password/reset-token?callbackURL=https%3A%2F%2Fplansync.dev%2Freset-password";

function createEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: "test",
    PUBLIC_APP_URL: "https://plansync.dev",
    RESEND_API_KEY: "re_test",
    RESEND_FROM: "PlanSync <security@plansync.dev>",
    ...overrides,
  } as Env;
}

async function waitForQueuedDelivery() {
  await vi.waitFor(() => expect(resendSend).toHaveBeenCalledTimes(1));
}

describe("queuePasswordResetEmail", () => {
  beforeEach(() => {
    resendSend.mockResolvedValue({ data: { id: "email_123" }, error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resendSend.mockReset();
    Resend.mockClear();
  });

  it("sends a branded reset email through Resend", async () => {
    queuePasswordResetEmail(createEnv(), {
      to: "user@example.com",
      displayName: "Avery",
      resetUrl,
    });

    await waitForQueuedDelivery();

    expect(Resend).toHaveBeenCalledWith("re_test");
    expect(resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "PlanSync <security@plansync.dev>",
        to: "user@example.com",
        subject: "Reset your PlanSync password",
        text: expect.stringContaining(resetUrl),
        html: expect.stringContaining('href="' + resetUrl + '"'),
      }),
    );
    expect(resendSend.mock.calls[0]?.[0]?.html).toContain("Hi Avery,");
    expect(resendSend.mock.calls[0]?.[0]?.html).toContain("This link expires in one hour.");
  });

  it("logs the reset URL locally when Resend is not configured", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    queuePasswordResetEmail(createEnv({ RESEND_API_KEY: undefined, RESEND_FROM: undefined }), {
      to: "user@example.com",
      displayName: null,
      resetUrl,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(resendSend).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(
      "[password-reset] RESEND not configured; reset link:\n",
      resetUrl,
    );
  });

  it("reports missing production mail configuration without exposing it to the requester", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    queuePasswordResetEmail(
      createEnv({ NODE_ENV: "production", RESEND_API_KEY: undefined, RESEND_FROM: undefined }),
      {
        to: "user@example.com",
        displayName: null,
        resetUrl,
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(resendSend).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      "[password-reset] RESEND_API_KEY and RESEND_FROM must be set in production to send reset emails.",
    );
  });
});
