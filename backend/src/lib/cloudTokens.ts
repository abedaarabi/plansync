import { CloudStorageProvider } from "@prisma/client";
import type { Env } from "./env.js";
import { prisma } from "./prisma.js";
import {
  refreshDropboxAccessToken,
  refreshGoogleAccessToken,
  refreshMicrosoftAccessToken,
} from "./cloudProviders.js";

export async function ensureFreshCloudAccessToken(
  env: Env,
  userId: string,
  provider: CloudStorageProvider,
): Promise<{ accessToken: string } | { error: string; status: number }> {
  const row = await prisma.cloudStorageConnection.findUnique({
    where: { userId_provider: { userId, provider } },
  });
  if (!row) return { error: "Not connected to this cloud provider", status: 400 };

  const now = Date.now();
  const slackMs = 60_000;
  if (row.expiresAt && row.expiresAt.getTime() > now + slackMs) {
    return { accessToken: row.accessToken };
  }
  if (!row.refreshToken) {
    return { error: "Connection expired — reconnect in Import from cloud.", status: 401 };
  }

  if (provider === CloudStorageProvider.GOOGLE_DRIVE) {
    const r = await refreshGoogleAccessToken(env, row.refreshToken);
    if ("error" in r) return { error: r.error, status: 401 };
    const expiresAt = new Date(Date.now() + r.expires_in * 1000);
    await prisma.cloudStorageConnection.update({
      where: { id: row.id },
      data: { accessToken: r.access_token, expiresAt },
    });
    return { accessToken: r.access_token };
  }
  if (provider === CloudStorageProvider.ONEDRIVE) {
    const r = await refreshMicrosoftAccessToken(env, row.refreshToken);
    if ("error" in r) return { error: r.error, status: 401 };
    const expiresAt = new Date(Date.now() + r.expires_in * 1000);
    await prisma.cloudStorageConnection.update({
      where: { id: row.id },
      data: { accessToken: r.access_token, expiresAt },
    });
    return { accessToken: r.access_token };
  }
  if (provider === CloudStorageProvider.DROPBOX) {
    const r = await refreshDropboxAccessToken(env, row.refreshToken);
    if ("error" in r) return { error: r.error, status: 401 };
    const expiresAt = new Date(Date.now() + r.expires_in * 1000);
    await prisma.cloudStorageConnection.update({
      where: { id: row.id },
      data: { accessToken: r.access_token, expiresAt },
    });
    return { accessToken: r.access_token };
  }
  return { error: "Unknown provider", status: 500 };
}
