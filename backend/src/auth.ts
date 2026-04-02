import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./lib/prisma.js";
import { buildCorsAllowList, type Env } from "./lib/env.js";

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

export function createAuth(env: Env) {
  const socialProviders = buildSocialProviders(env);
  const cookieDomain = env.BETTER_AUTH_COOKIE_DOMAIN?.trim();
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: buildCorsAllowList(env),
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    emailAndPassword: { enabled: true },
    ...(socialProviders ? { socialProviders } : {}),
    ...(cookieDomain
      ? {
          advanced: {
            crossSubDomainCookies: {
              enabled: true,
              domain: cookieDomain,
            },
          },
        }
      : {}),
    session: {
      cookieCache: { enabled: true, maxAge: 60 },
    },
  });
}
