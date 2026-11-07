import { prisma } from "@vidforge/db";
import { json } from "@/lib/api";
import { requireAdmin, withAuth } from "@/lib/adminApi";
export const dynamic = "force-dynamic";

export const GET = withAuth(async (req: Request) => {
  await requireAdmin();
  const u = new URL(req.url);
  const status = u.searchParams.get("status") || undefined, q = u.searchParams.get("q")?.trim() || undefined, userId = u.searchParams.get("userId") || undefined;
  const projects = await prisma.project.findMany({
    where: { ...(status ? { status: status as never } : {}), ...(userId ? { userId } : {}), ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { id: { contains: q } }, { error: { contains: q, mode: "insensitive" } }] } : {}) },
    orderBy: { createdAt: "desc" }, take: 100,
    select: { id: true, userId: true, title: true, status: true, progress: true, currentStage: true, videoType: true, language: true, visualSource: true, targetDuration: true, creditsReserved: true, creditsCharged: true, error: true, createdAt: true, updatedAt: true, attempts: true },
  });
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(projects.map((p) => p.userId))] } }, select: { id: true, email: true } });
  const emails = Object.fromEntries(users.map((x) => [x.id, x.email]));
  return json({ projects: projects.map((p) => ({ ...p, email: emails[p.userId] ?? p.userId })) });
});
