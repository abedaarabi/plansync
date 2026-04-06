import { Resend } from "resend";
import { ActivityType } from "@prisma/client";
import { logActivity } from "./activity.js";
import { prisma } from "./prisma.js";
import { buildTransactionalEmailHtml } from "./transactionalEmailLayout.js";
import { STORAGE_WARN_80, STORAGE_WARN_95 } from "../config/product.js";
export async function maybeSendStorageAlerts(env, workspaceId, prevUsed, newUsed, quota) {
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
    if (!ws)
        return;
    const adminEmails = ws.members.map((m) => m.user.email).filter(Boolean);
    if (adminEmails.length === 0)
        return;
    const resend = new Resend(env.RESEND_API_KEY);
    const gb = (n) => (Number(n) / 1024 ** 3).toFixed(2);
    const from = env.RESEND_FROM;
    const appBase = env.PUBLIC_APP_URL.replace(/\/$/, "");
    const send = async (level, subject, title, lines) => {
        await logActivity(workspaceId, ActivityType.STORAGE_THRESHOLD, {
            metadata: { level, used: newUsed.toString(), quota: quota.toString() },
        });
        const text = `${title}\n\n${lines.join("\n")}\n\n${appBase}`;
        const html = buildTransactionalEmailHtml(env, {
            eyebrow: "Workspace",
            title,
            bodyLines: lines,
            primaryAction: { url: appBase, label: "Open PlanSync" },
            fallbackUrl: appBase,
            footerNote: "You're receiving this because you are an admin of this workspace.",
        });
        await resend.emails.send({
            from,
            to: adminEmails,
            subject,
            text,
            html,
        });
    };
    if (newR >= STORAGE_WARN_95 && prevR < STORAGE_WARN_95) {
        await send(95, "PlanSync: storage almost full (95%)", "Storage almost full", [
            `Your workspace “${ws.name}” is using ${gb(newUsed)} GB of ${gb(quota)} GB (about 95%).`,
            "Consider upgrading your plan or removing old files to avoid uploads being blocked.",
        ]);
    }
    else if (newR >= STORAGE_WARN_80 && prevR < STORAGE_WARN_80) {
        await send(80, "PlanSync: storage warning (80%)", "Storage usage notice", [
            `Your workspace “${ws.name}” is using ${gb(newUsed)} GB of ${gb(quota)} GB (about 80%).`,
            "You may want to free up space or review your subscription before you hit the limit.",
        ]);
    }
}
