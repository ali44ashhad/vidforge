import { prisma } from "@vidforge/db";
import { json } from "@/lib/api";
import { requireUser, withAuth } from "@/lib/auth";
export const dynamic = "force-dynamic";

export const GET = withAuth(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const batch = await prisma.batch.findUnique({ where: { id }, include: { projects: { orderBy: { createdAt: "asc" }, select: { id: true, title: true, status: true, progress: true, currentStage: true, finalVideoUrl: true, thumbnailUrl: true, actualDuration: true, error: true, creditsReserved: true, creditsCharged: true, language: true, targetDuration: true } } } });
  if (!batch || (batch.userId !== user.id && user.role !== "ADMIN")) return json({ error: "Not found" }, 404);
  const completed = batch.projects.filter((p) => p.status === "COMPLETED").length, failed = batch.projects.filter((p) => p.status === "FAILED").length;
  const status = completed + failed >= batch.total ? (failed ? "COMPLETED" : "COMPLETED") : "RUNNING";
  return json({ batch: { ...batch, completed, failed, status } });
});
