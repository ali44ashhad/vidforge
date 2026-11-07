import { prisma } from "@vidforge/db";
import { settleCredits } from "@vidforge/shared";
import { rates } from "./config";
import type { Project } from "@vidforge/db";

/** Append a ledger row + update cached balance. amount + in / − out. */
async function post(userId: string, type: "SETTLE" | "RELEASE" | "REFUND", amount: number, projectId: string, reason: string) {
  await prisma.$transaction(async (tx) => {
    const u = await tx.user.findUnique({ where: { id: userId }, select: { credits: true } });
    if (!u) return; // legacy "local" projects have no user
    const balance = u.credits + amount;
    await tx.user.update({ where: { id: userId }, data: { credits: balance } });
    await tx.creditLedger.create({ data: { userId, type, amount, balance, projectId, reason } });
  });
}

/** Reserve credits for a project created by the worker itself (e.g. Academy lessons). Throws on insufficient balance. */
export async function reserveCredits(userId: string, amount: number, projectId: string, reason: string) {
  await prisma.$transaction(async (tx) => {
    const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { credits: true } });
    if (u.credits < amount) throw new Error("INSUFFICIENT_CREDITS");
    await tx.user.update({ where: { id: userId }, data: { credits: u.credits - amount } });
    await tx.creditLedger.create({ data: { userId, type: "RESERVE", amount: -amount, balance: u.credits - amount, projectId, reason } });
  });
}

/** On success: charge actual usage, release the unused part of the reservation (or charge extra up to the reservation). */
export async function settleProject(p: Project): Promise<{ charged: number; released: number }> {
  if (!p.creditsReserved || p.creditsCharged) return { charged: p.creditsCharged, released: 0 };
  const actual = Math.min(p.creditsReserved, settleCredits((p.stats as Record<string, unknown>) ?? {}, p.targetDuration, p.musicEnabled, p.aiVideoResolution, await rates()));
  const released = p.creditsReserved - actual;
  // reservation already debited; RELEASE returns the difference
  if (released > 0) await post(p.userId, "RELEASE", released, p.id, `Unused reservation for "${p.title.slice(0, 40)}"`);
  await prisma.project.update({ where: { id: p.id }, data: { creditsCharged: actual } });
  return { charged: actual, released };
}

/** On terminal failure: refund the whole reservation. */
export async function refundProject(p: Project): Promise<number> {
  if (!p.creditsReserved || p.creditsCharged) return 0;
  await post(p.userId, "REFUND", p.creditsReserved, p.id, `Refund — "${p.title.slice(0, 40)}" failed`);
  await prisma.project.update({ where: { id: p.id }, data: { creditsCharged: 0, creditsReserved: 0 } });
  return p.creditsReserved;
}
