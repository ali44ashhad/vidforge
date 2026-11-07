import { prisma } from "@vidforge/db";
import { json } from "@/lib/api";
import { requireAdmin, withAuth } from "@/lib/adminApi";
export const dynamic = "force-dynamic";

export const GET = withAuth(async (req: Request) => {
  await requireAdmin();
  const q = new URL(req.url).searchParams.get("q")?.trim();
  const users = await prisma.user.findMany({
    where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {},
    orderBy: { createdAt: "desc" }, take: 100,
    select: { id: true, email: true, name: true, role: true, plan: true, planExpiresAt: true, credits: true, suspended: true, createdAt: true, _count: { select: { payments: true } } },
  });
  const counts = await prisma.project.groupBy({ by: ["userId"], _count: { _all: true }, where: { userId: { in: users.map((u) => u.id) } } });
  const pc = Object.fromEntries(counts.map((c) => [c.userId, c._count._all]));
  return json({ users: users.map((u) => ({ ...u, projects: pc[u.id] ?? 0 })) });
});
