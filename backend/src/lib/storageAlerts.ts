import { Resend } from "resend";
import { ActivityType } from "@prisma/client";
import type { Env } from "./env.js";
import { logActivity } from "./activity.js";
import { prisma } from "./prisma.js";
import { STORAGE_WARN_80, STORAGE_WARN_95 } from "../config/product.js";

export async function maybeSendStorageAlerts(
  env: Env,
  workspaceId: string,
  prevUsed: bigint,
  newUsed: bigint,
  quota: bigint,
) {
  const prevR = Number(prevUsed) / Number(quota);
  const newR = Number(newUsed) / Number(quota);
  if (!env.RESEND_API_KEY || !env.RESEND_FROM) {
    if (newR >= STORAGE_WARN_80 && prevR < STORAGE_WARN_80) {
      await logActivity(workspaceId, ActivityType.STORAGE_THRESHOLD, {
        metadata: { level: 80, used: newUsed.toString(), quota: quota.toString() },
      });
    }
    return;
  }
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: { where: { role: "ADMIN" }, include: { user: true } },
    },
  });
  if (!ws) return;
  const adminEmails = ws.members.map((m) => m.user.email).filter(Boolean);
  if (adminEmails.length === 0) return;

  const resend = new Resend(env.RESEND_API_KEY);
  const gb = (n: bigint) => (Number(n) / 1024 ** 3).toFixed(2);
  const from = env.RESEND_FROM!;

  const send = async (level: 80 | 95, subject: string, body: string) => {
    await logActivity(workspaceId, ActivityType.STORAGE_THRESHOLD, {
      metadata: { level, used: newUsed.toString(), quota: quota.toString() },
    });
    await resend.emails.send({
      from,
      to: adminEmails,
      subject,
      text: body,
    });
  };

  if (newR >= STORAGE_WARN_95 && prevR < STORAGE_WARN_95) {
    await send(
      95,
      "PlanSync: storage almost full (95%)",
      `Your workspace "${ws.name}" is using ${gb(newUsed)} GB of ${gb(quota)} GB.`,
    );
  } else if (newR >= STORAGE_WARN_80 && prevR < STORAGE_WARN_80) {
    await send(
      80,
      "PlanSync: storage warning (80%)",
      `Your workspace "${ws.name}" is using ${gb(newUsed)} GB of ${gb(quota)} GB.`,
    );
  }
}
