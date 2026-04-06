import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./lib/prisma.js";
import { buildCorsAllowList } from "./lib/env.js";
import { queuePasswordResetEmail } from "./lib/send-password-reset-email.js";
function buildSocialProviders(env) {
    const out = {};
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
export function createAuth(env) {
    const socialProviders = buildSocialProviders(env);
    const cookieDomain = env.BETTER_AUTH_COOKIE_DOMAIN?.trim();
    return betterAuth({
        baseURL: env.BETTER_AUTH_URL,
        secret: env.BETTER_AUTH_SECRET,
        trustedOrigins: buildCorsAllowList(env),
        database: prismaAdapter(prisma, { provider: "postgresql" }),
        emailAndPassword: {
            enabled: true,
            sendResetPassword: async ({ user, url }) => {
                queuePasswordResetEmail(env, {
                    to: user.email,
                    displayName: user.name,
                    resetUrl: url,
                });
            },
            revokeSessionsOnPasswordReset: true,
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
            cookieCache: { enabled: true, maxAge: 3600 },
        },
    });
}
