import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./lib/prisma.js";
import { buildCorsAllowList, type Env } from "./lib/env.js";
import {
  AUTH_PASSWORD_HINT,
  AUTH_PASSWORD_MIN_LENGTH,
  isStrongAuthPassword,
} from "./lib/password-policy.js";
import { queuePasswordResetEmail } from "./lib/send-password-reset-email.js";
import { queueVerificationEmail } from "./lib/send-verification-email.js";

function buildSocialProviders(env: Env) {
  const out: Record<string, { clientId: string; clientSecret: string }> = {};
  if (env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim()) {
    out.google = {
      clientId: env.GOOGLE_CLIENT_ID.trim(),
      clientSecret: env.GOOGLE_CLIENT_SECRET.trim(),
    };
  }
  if (env.GITHUB_CLIENT_ID?.trim() && env.GITHUB_CLIENT_SECRET?.trim()) {
    out.github = {
      clientId: env.GITHUB_CLIENT_ID.trim(),
      clientSecret: env.GITHUB_CLIENT_SECRET.trim(),
    };
  }
  if (env.SLACK_CLIENT_ID?.trim() && env.SLACK_CLIENT_SECRET?.trim()) {
    out.slack = {
      clientId: env.SLACK_CLIENT_ID.trim(),
      clientSecret: env.SLACK_CLIENT_SECRET.trim(),
    };
  }
  return Object.keys(out).length ? out : undefined;
}

function passwordFromAuthBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  if (typeof o.password === "string") return o.password;
  if (typeof o.newPassword === "string") return o.newPassword;
  return null;
}

export function createAuth(env: Env) {
  const socialProviders = buildSocialProviders(env);
  const cookieDomain = env.BETTER_AUTH_COOKIE_DOMAIN?.trim();
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: buildCorsAllowList(env),
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: AUTH_PASSWORD_MIN_LENGTH,
      /** Verification is enforced on API routes via `sessionMiddleware`; set false so invite sign-up gets a session. */
      requireEmailVerification: false,
      sendResetPassword: async ({ user, url }) => {
        queuePasswordResetEmail(env, {
          to: user.email,
          displayName: user.name,
          resetUrl: url,
        });
      },
      revokeSessionsOnPasswordReset: true,
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        queueVerificationEmail(env, {
          to: user.email,
          displayName: user.name,
          verifyUrl: url,
        });
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const path = ctx.path ?? "";
        if (
          path !== "/sign-up/email" &&
          path !== "/reset-password" &&
          path !== "/change-password"
        ) {
          return;
        }
        const password = passwordFromAuthBody(ctx.body);
        if (password == null) return;
        if (!isStrongAuthPassword(password)) {
          throw new APIError("BAD_REQUEST", { message: AUTH_PASSWORD_HINT });
        }
      }),
    },
    ...(socialProviders ? { socialProviders } : {}),
    advanced: {
      trustedProxyHeaders: true,
      ...(cookieDomain
        ? {
            crossSubDomainCookies: {
              enabled: true,
              domain: cookieDomain,
            },
          }
        : {}),
    },
    session: {
      /** Long-lived sessions: stay signed in until explicit sign-out or prolonged inactivity. */
      expiresIn: 60 * 60 * 24 * 90,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
  });
}
