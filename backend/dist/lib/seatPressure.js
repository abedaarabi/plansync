import { EmailInviteKind } from "@prisma/client";
import { prisma } from "./prisma.js";
/**
 * Seat pressure for included/overage billing UI and Stripe sync.
 * Counts internal (non-external) members + active team link invites + pending
 * INTERNAL email invites. Client / contractor / sub invites and external members
 * do not use seats.
 */
export async function countSeatPressure(workspaceId) {
    const now = new Date();
    const [members, linkInvites, emailInvites] = await Promise.all([
        prisma.workspaceMember.count({ where: { workspaceId, isExternal: false } }),
        prisma.workspaceInvite.count({
            where: { workspaceId, revokedAt: null, expiresAt: { gt: now } },
        }),
        prisma.emailInvite.count({
            where: {
                workspaceId,
                inviteKind: EmailInviteKind.INTERNAL,
                revokedAt: null,
                acceptedAt: null,
                expiresAt: { gt: now },
            },
        }),
    ]);
    return members + linkInvites + emailInvites;
}
/** Seats above the plan pack (never negative). */
export function seatOverageQuantity(pressure, includedSeats) {
    return Math.max(0, pressure - includedSeats);
}
