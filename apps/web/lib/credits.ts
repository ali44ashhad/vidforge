import { prisma } from "@vidforge/db";
import { FREE_SIGNUP_CREDITS } from "@vidforge/shared";

type LedgerType = "GRANT" | "PURCHASE" | "RESERVE" | "SETTLE" | "RELEASE" | "REFUND" | "ADJUST";

/** Append a ledger entry and update the cached balance atomically. amount: + in, − out. */
export async function postLedger(userId: string, type: LedgerType, amount: number, opts: { projectId?: string; paymentId?: string; reason?: string; actorId?: string } = {}) {
  return prisma.$transaction(async (tx) => {
    const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { credits: true } });
    const balance = u.credits + amount;
    if (balance < 0) throw new Error("INSUFFICIENT_CREDITS");
    await tx.user.update({ where: { id: userId }, data: { credits: balance } });
    return tx.creditLedger.create({ data: { userId, type, amount, balance, projectId: opts.projectId, paymentId: opts.paymentId, reason: opts.reason, actorId: opts.actorId } });
  });
}

export async function grantSignupCredits(userId: string) {
  await postLedger(userId, "GRANT", FREE_SIGNUP_CREDITS, { reason: "Welcome credits" });
}
