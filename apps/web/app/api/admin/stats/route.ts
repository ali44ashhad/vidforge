import { prisma } from "@vidforge/db";
import { json } from "@/lib/api";
import { requireAdmin, withAuth } from "@/lib/adminApi";
export const dynamic = "force-dynamic";

export const GET = withAuth(async () => {
  await requireAdmin();
  const day = new Date(Date.now() - 86400e3), week = new Date(Date.now() - 7 * 86400e3);
  const [videos24, videos7, completed7, failed7, users, newUsers7, paid7, creditsUsed7, generating] = await Promise.all([
    prisma.project.count({ where: { createdAt: { gte: day } } }),
    prisma.project.count({ where: { createdAt: { gte: week } } }),
    prisma.project.count({ where: { createdAt: { gte: week }, status: "COMPLETED" } }),
    prisma.project.count({ where: { createdAt: { gte: week }, status: "FAILED" } }),
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: week } } }),
    prisma.payment.aggregate({ where: { status: "paid", paidAt: { gte: week } }, _sum: { amount: true }, _count: true }),
    prisma.creditLedger.aggregate({ where: { type: "SETTLE", createdAt: { gte: week } }, _sum: { amount: true } }),
    prisma.project.count({ where: { status: { notIn: ["COMPLETED", "FAILED", "PAUSED", "DRAFT"] } } }),
  ]);
  const recentDone = await prisma.project.findMany({ where: { status: "COMPLETED", createdAt: { gte: week } }, select: { createdAt: true, updatedAt: true, creditsCharged: true }, take: 200 });
  const avgReadySec = recentDone.length ? Math.round(recentDone.reduce((a, p) => a + (p.updatedAt.getTime() - p.createdAt.getTime()) / 1000, 0) / recentDone.length) : 0;
  const creditsCharged7 = recentDone.reduce((a, p) => a + p.creditsCharged, 0);
  const topErrors = await prisma.project.findMany({ where: { status: "FAILED", updatedAt: { gte: week } }, select: { error: true }, take: 200 });
  const errCounts = new Map<string, number>();
  for (const e of topErrors) { const k = (e.error ?? "unknown").replace(/[0-9a-f]{8,}/g, "…").slice(0, 90); errCounts.set(k, (errCounts.get(k) ?? 0) + 1); }
  return json({
    videos24, videos7, successRate: videos7 ? Math.round((completed7 / Math.max(1, completed7 + failed7)) * 100) : null, failed7,
    users, newUsers7, revenue7Inr: (paid7._sum.amount ?? 0) / 100, payments7: paid7._count, creditsCharged7, creditsSettleRows: creditsUsed7._sum.amount ?? 0,
    generating, avgReadySec, topErrors: [...errCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([error, count]) => ({ error, count })),
  });
});
